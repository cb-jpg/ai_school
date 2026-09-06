"""并发压测：数字人后端稳定运行最大并发数（2026-09-05）

模拟 N 个 App 用户（各 1 条 /client-ws 连接），每人两轮文本问答：
  第 1 轮 = 校情问题（触发 RAG 检索）；第 2 轮 = 纯聊天。
同级客户端在 ~2s 窗口内突发连接+提问（比真实课堂更苛刻）。

梯度加压 1→2→4→8→12→16→24→32→48，失败自动复测一次区分偶发/硬上限。

共用服务器保险丝（铁律，见 shared-server-heavy-job-rules）：
  监控线程每 5s SSH 采样四指标，任一超标立即中止全部压测：
    MemAvailable < 8G / load1 > 50 / swap 占比 > 50% / IO PSI full avg10 > 50%

判稳标准（每级）：
  连接成功率 100%；每轮收到 first sentence + audio + backend-synth-complete；
  首句延迟中位数 <= max(2.5x 单用户基线, 20s)；整轮 p95 <= 90s。

用法：
  .venv/Scripts/python.exe scripts/concurrency_stress_test.py
  PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe scripts/concurrency_stress_test.py
"""

import asyncio
import json
import os
import re
import statistics
import subprocess
import sys
import threading
import time
import uuid

import websockets

HOST = "183.36.243.124"
PORT = 12393
TOKEN = os.environ.get("OLLV_STRESS_TOKEN", "")  # 门禁令牌不入库（公开仓库铁律），运行时从环境变量传入
WS_URL = f"ws://{HOST}:{PORT}/client-ws?token={TOKEN}"
SSH_TARGET = "liucb@183.36.243.124"

def _parse_args():
    """--levels 64,96 --timeout 150 [--no-rag] 可覆盖默认梯度/单轮超时/关闭 RAG 问题"""
    global LEVELS, TURN_TIMEOUT, Q_SCHOOL
    argv = sys.argv[1:]
    for i, a in enumerate(argv):
        if a == "--levels" and i + 1 < len(argv):
            LEVELS = [int(x) for x in argv[i + 1].split(",")]
        elif a == "--timeout" and i + 1 < len(argv):
            TURN_TIMEOUT = float(argv[i + 1])
        elif a == "--no-rag":
            Q_SCHOOL = "给我讲一个笑话"  # 不含学校关键词，不触发 RAG 检索


LEVELS = [1, 2, 4, 8, 12, 16, 24, 32, 48]
TURNS_PER_CLIENT = 2
TURN_TIMEOUT = 90.0
CONNECT_TIMEOUT = 15.0
LEVEL_COOLDOWN = 20.0

Q_SCHOOL = "学校的校训是什么？"  # 触发 RAG
Q_CASUAL = "用一句话介绍你自己"  # 纯 LLM

_parse_args()  # 须在 Q_SCHOOL 定义之后调用，--no-rag 才能生效

# ---- 保险丝阈值（四指标，超标即中止）----
GUARD_AVAIL_MB = 8192.0
GUARD_LOAD1 = 50.0
GUARD_SWAP_PCT = 50.0
GUARD_PSI_FULL10 = 50.0

SSH_METRICS_CMD = (
    "awk '/MemAvailable/{print \"AVAIL_MB \" $2}' /proc/meminfo; "
    "awk -F' ' '{print \"LOAD1 \" $1}' /proc/loadavg; "
    "free -m | awk 'NR==3{if ($2>0) printf \"SWAP_PCT %.1f\\n\", $3*100/$2}'; "
    "grep '^full' /proc/pressure/io | grep -o 'avg10=[0-9.]*'; "
    # workers 模式：父进程（uvicorn supervisor）+ spawn 出的 worker 子进程一起求和，
    # 否则只采到空闲父进程，CPU/RSS 失真
    "PARENT=$(pgrep -f 'run_server[.]py' | head -1); "
    "PIDS=$(pgrep -f 'run_server[.]py'); "
    "[ -n \"$PARENT\" ] && PIDS=\"$PIDS $(pgrep -P $PARENT 2>/dev/null)\"; "
    "TJ=0; TR=0; "
    "for p in $PIDS; do "
    "[ -r /proc/$p/stat ] && J=$(awk '{print $14+$15}' /proc/$p/stat) "
    "&& R=$(awk '{print $24*4}' /proc/$p/stat) "
    "&& TJ=$((TJ+J)) && TR=$((TR+R)); done; "
    "echo SRV_JIFFIES $TJ; "
    "echo SRV_RSS_KB $TR"
)

metrics_lock = threading.Lock()
metrics_state = {
    "avail_mb": None,
    "load1": None,
    "swap_pct": None,
    "psi_full10": None,
    "srv_cpu_pct": None,
    "srv_rss_mb": None,
    "last_jiffies": None,
    "last_ts": None,
    "guard_tripped": None,  # None=正常, str=超标原因
}
metrics_timeline = []  # (ts, avail, load1, swap, psi, cpu, rss)


def sample_metrics_once() -> bool:
    """SSH 采样一次四指标 + run_server CPU/RSS。返回是否成功。"""
    try:
        out = subprocess.run(
            ["ssh", "-o", "ConnectTimeout=8", "-o", "BatchMode=yes", SSH_TARGET, SSH_METRICS_CMD],
            capture_output=True, text=True, timeout=20,
        ).stdout
    except Exception as e:
        with metrics_lock:
            metrics_state["guard_tripped"] = metrics_state["guard_tripped"] or f"SSH 采样失败: {e}"
        return False

    vals = {}
    for line in out.strip().splitlines():
        parts = line.split()
        if not parts:
            continue
        key = parts[0]
        if key == "AVAIL_MB":
            vals["avail_mb"] = float(parts[1]) / 1024.0  # /proc/meminfo 单位 kB → MB
        elif key == "LOAD1":
            vals["load1"] = float(parts[1])
        elif key == "SWAP_PCT":
            vals["swap_pct"] = float(parts[1])
        elif line.startswith("avg10="):
            vals["psi_full10"] = float(line.split("avg10=")[1].split()[0])
        elif key == "SRV_JIFFIES":
            vals["jiffies"] = float(parts[1])
        elif key == "SRV_RSS_KB":
            vals["rss_kb"] = float(parts[1])

    now = time.monotonic()
    cpu_pct = None
    with metrics_lock:
        prev = metrics_state
        if "jiffies" in vals and prev.get("last_jiffies") and prev.get("last_ts"):
            dt = now - prev["last_ts"]
            if dt > 0:
                cpu_pct = (vals["jiffies"] - prev["last_jiffies"]) / dt / 100.0  # 100 jiffies/s/cpu
        prev.update({
            "avail_mb": vals.get("avail_mb"),
            "load1": vals.get("load1"),
            "swap_pct": vals.get("swap_pct"),
            "psi_full10": vals.get("psi_full10"),
            "srv_rss_mb": vals.get("rss_kb", 0) / 1024.0,
        })
        if cpu_pct is not None:
            prev["srv_cpu_pct"] = cpu_pct
        if "jiffies" in vals:
            prev["last_jiffies"] = vals["jiffies"]
            prev["last_ts"] = now
        metrics_timeline.append((
            time.strftime("%H:%M:%S"), vals.get("avail_mb"), vals.get("load1"),
            vals.get("swap_pct"), vals.get("psi_full10"),
            None if cpu_pct is None else round(cpu_pct, 1),
            prev["srv_rss_mb"],
        ))
        # 四指标保险丝
        if prev["guard_tripped"] is None:
            if vals.get("avail_mb") is not None and vals["avail_mb"] < GUARD_AVAIL_MB:
                prev["guard_tripped"] = f"MemAvailable {vals['avail_mb']:.0f}MB < {GUARD_AVAIL_MB:.0f}MB"
            elif vals.get("load1") is not None and vals["load1"] > GUARD_LOAD1:
                prev["guard_tripped"] = f"load1 {vals['load1']} > {GUARD_LOAD1}"
            elif vals.get("swap_pct") is not None and vals["swap_pct"] > GUARD_SWAP_PCT:
                prev["guard_tripped"] = f"swap {vals['swap_pct']}% > {GUARD_SWAP_PCT}%"
            elif vals.get("psi_full10") is not None and vals["psi_full10"] > GUARD_PSI_FULL10:
                prev["guard_tripped"] = f"IO PSI full avg10 {vals['psi_full10']}% > {GUARD_PSI_FULL10}%"
            if prev["guard_tripped"]:
                print(f"\n!!! 保险丝触发：{prev['guard_tripped']} —— 中止压测 !!!\n")
    return True


def guard_thread_fn(stop_event: threading.Event):
    """每 5s 采样；间隔内跑一轮 utime 差分算 run_server CPU%。"""
    while not stop_event.is_set():
        ok = sample_metrics_once()
        if metrics_state.get("guard_tripped"):
            return
        stop_event.wait(5.0 if ok else 10.0)


def pctl(values, p):
    if not values:
        return None
    s = sorted(values)
    k = (len(s) - 1) * p / 100.0
    f = int(k)
    c = min(f + 1, len(s) - 1)
    return s[f] + (s[c] - s[f]) * (k - f)


class TurnResult:
    def __init__(self):
        self.ok = False
        self.t_first = None      # 首段音频到达（开口）延迟
        self.t_done = None       # 末个 backend-synth-complete 延迟
        self.n_audio = 0
        self.audio_bytes = 0
        self.error = None
        self.rag = None          # (has_context, doc_count)


GREETINGS = ("Connection established", "Thinking...")  # 连接问候/思考占位，非真实回复


async def run_turn(ws, client_uid: str, text: str) -> TurnResult:
    """真实回复在本版本只以 audio 消息下发（full-text 仅 'Thinking...' 占位），
    backend-synth-complete 每轮发两次（single_conversation + finalize 各一次）。"""
    r = TurnResult()
    t0 = time.monotonic()
    await ws.send(json.dumps({"type": "text-input", "text": text, "client_uid": client_uid}))
    synth_dones = 0
    while True:
        remaining = TURN_TIMEOUT - (time.monotonic() - t0)
        if remaining <= 0:
            r.error = "timeout"
            return r
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
        except asyncio.TimeoutError:
            r.error = "timeout"
            return r
        try:
            m = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            continue
        t = m.get("type")
        if t == "audio":
            r.n_audio += 1
            r.audio_bytes += len(raw)
            if r.t_first is None:
                r.t_first = time.monotonic() - t0
        elif t == "rag-status":
            r.rag = (bool(m.get("has_context")), m.get("doc_count"))
        elif t == "backend-synth-complete":
            synth_dones += 1
            if synth_dones >= 2:
                r.t_done = time.monotonic() - t0
                r.ok = r.t_first is not None and r.n_audio > 0
                return r
            # 第 1 个 synth-complete 后宽限 2s 收尾（等重复的第二个/尾段音频）
            try:
                while True:
                    raw2 = await asyncio.wait_for(ws.recv(), timeout=2.0)
                    try:
                        m2 = json.loads(raw2)
                    except (json.JSONDecodeError, TypeError):
                        continue
                    t2 = m2.get("type")
                    if t2 == "audio":
                        r.n_audio += 1
                        r.audio_bytes += len(raw2)
                        if r.t_first is None:
                            r.t_first = time.monotonic() - t0
                    elif t2 == "backend-synth-complete":
                        r.t_done = time.monotonic() - t0
                        r.ok = r.t_first is not None and r.n_audio > 0
                        return r
                    elif t2 == "error":
                        r.error = m2.get("message", "error")
                        return r
            except asyncio.TimeoutError:
                pass  # 2s 内无第二个 synth-complete，视为完成
            r.t_done = time.monotonic() - t0
            r.ok = r.t_first is not None and r.n_audio > 0
            return r
        elif t == "error":
            r.error = m.get("message", "error")
            return r


async def client_session(idx: int, results: list, connect_delay: float):
    """单个模拟用户：连接 → 轮1(RAG) → 停顿 → 轮2(纯聊天)。"""
    await asyncio.sleep(connect_delay)
    rec = {"idx": idx, "connect_s": None, "connect_err": None, "turns": []}
    results.append(rec)
    client_uid = str(uuid.uuid4())[:8]

    t0 = time.monotonic()
    try:
        ws = await asyncio.wait_for(
            websockets.connect(WS_URL, max_size=50 * 1024 * 1024, open_timeout=CONNECT_TIMEOUT),
            CONNECT_TIMEOUT,
        )
    except Exception as e:
        rec["connect_err"] = f"{type(e).__name__}: {e}"
        return
    rec["connect_s"] = time.monotonic() - t0

    # 排干连接初始消息（问候/模型配置/start-mic，~0.5s 内到齐，给 2.5s）
    try:
        while True:
            await asyncio.wait_for(ws.recv(), timeout=2.5)
    except asyncio.TimeoutError:
        pass

    try:
        for turn_i, q in ((1, Q_SCHOOL), (2, Q_CASUAL)):
            try:
                tr = await run_turn(ws, client_uid, q)
            except websockets.exceptions.ConnectionClosed as e:
                # 连接被服务端/网络掐断（如多进程下某 worker 崩溃）：
                # 记为该客户端失败，不能让异常炸掉整个 gather
                rec["turns"].append({
                    "turn": turn_i, "ok": False, "t_open": None, "t_done": None,
                    "n_audio": 0, "audio_kb": 0,
                    "error": f"ConnectionClosed: {type(e).__name__}", "rag": None,
                })
                break
            tr_dict = {
                "turn": turn_i, "ok": tr.ok,
                "t_open": None if tr.t_first is None else round(tr.t_first, 2),
                "t_done": None if tr.t_done is None else round(tr.t_done, 2),
                "n_audio": tr.n_audio,
                "audio_kb": round(tr.audio_bytes / 1024),
                "error": tr.error, "rag": tr.rag,
            }
            rec["turns"].append(tr_dict)
            if not tr.ok:
                break  # 这条连接已不可靠，不再继续第 2 轮
            await asyncio.sleep(1.0 + (idx % 5) * 0.4)  # 自然节奏
    finally:
        try:
            await ws.close()
        except Exception:
            pass


async def run_level(n: int) -> dict:
    print(f"\n===== 级别 N={n} =====")
    results: list = []
    connect_window = max(2.0, n * 0.08)  # 全部在 ~2s 内突发连入
    delays = [connect_window * i / n for i in range(n)]
    t0 = time.monotonic()
    await asyncio.gather(*(client_session(i, results, d) for i, d in enumerate(delays)))
    wall = time.monotonic() - t0

    conn_ok = [r for r in results if r["connect_err"] is None]
    all_turns = [t for r in results for t in r["turns"]]
    ok_turns = [t for t in all_turns if t["ok"]]
    rag_hits = [t["rag"] for t in all_turns if t["rag"] and t["rag"][0]]

    stats = {
        "n": n, "wall_s": round(wall, 1),
        "conn_ok": len(conn_ok), "conn_fail": n - len(conn_ok),
        "turns_expected": n * TURNS_PER_CLIENT,
        "turns_ok": len(ok_turns), "turns_attempted": len(all_turns),
        "t_open_med": None, "t_open_p95": None,
        "t_done_med": None, "t_done_p95": None,
        "rag_hit": len(rag_hits),
        "errors": [t["error"] for t in all_turns if t["error"]][:5],
        "turns_detail": all_turns,
    }
    firsts = [t["t_open"] for t in ok_turns if t.get("t_open") is not None]
    dones = [t["t_done"] for t in ok_turns if t.get("t_done") is not None]
    if firsts:
        stats["t_open_med"] = round(statistics.median(firsts), 1)
        stats["t_open_p95"] = round(pctl(firsts, 95), 1)
    if dones:
        stats["t_done_med"] = round(statistics.median(dones), 1)
        stats["t_done_p95"] = round(pctl(dones, 95), 1)

    with metrics_lock:
        ms = dict(metrics_state)
    print(f"  连接 {stats['conn_ok']}/{n}  轮成功 {stats['turns_ok']}/{stats['turns_expected']}"
          f"  RAG命中 {stats['rag_hit']}"
          f"  开口 med/p95 = {stats['t_open_med']}/{stats['t_open_p95']}s"
          f"  整轮 med/p95 = {stats['t_done_med']}/{stats['t_done_p95']}s"
          f"  墙钟 {stats['wall_s']}s")
    if stats["errors"]:
        print(f"  错误样例: {stats['errors']}")
    print(f"  服务器: avail={ms['avail_mb']}MB load1={ms['load1']} "
          f"swap={ms['swap_pct']}% psi10={ms['psi_full10']}% "
          f"run_server CPU={ms['srv_cpu_pct']}% RSS={ms['srv_rss_mb'] and round(ms['srv_rss_mb'])}MB")
    return stats


def verdict(stats: dict, baseline_first: float | None) -> tuple[bool, str]:
    if stats["conn_fail"] > 0:
        return False, f"{stats['conn_fail']} 条连接失败"
    if stats["turns_ok"] < stats["turns_expected"]:
        return False, f"仅 {stats['turns_ok']}/{stats['turns_expected']} 轮完整"
    lim = max(2.5 * baseline_first, 20.0) if baseline_first else 20.0
    if stats["t_open_med"] is not None and stats["t_open_med"] > lim:
        return False, f"开口中位 {stats['t_open_med']}s > 上限 {lim:.0f}s"
    if stats["t_done_p95"] is not None and stats["t_done_p95"] > 90:
        return False, f"整轮 p95 {stats['t_done_p95']}s > 90s"
    return True, "PASS"


async def warmup():
    print("== 预热（不计入结果）：单用户一轮 ==")
    async with websockets.connect(WS_URL, max_size=50 * 1024 * 1024, open_timeout=CONNECT_TIMEOUT) as ws:
        tr = await run_turn(ws, str(uuid.uuid4())[:8], Q_CASUAL)
        print(f"  预热轮 ok={tr.ok} 开口={tr.t_first and round(tr.t_first,1)}s "
              f"整轮={tr.t_done and round(tr.t_done,1)}s 段数={tr.n_audio} err={tr.error}")
        if not tr.ok:
            print("  预热失败，中止（服务器/链路当前不可用）")
            sys.exit(2)


async def main():
    print(f"压测目标 ws://{HOST}:{PORT}/client-ws  梯度={LEVELS}")
    await warmup()

    stop_event = threading.Event()
    gt = threading.Thread(target=guard_thread_fn, args=(stop_event,), daemon=True)
    gt.start()

    baseline_first = None
    level_reports = []
    cliff = None
    try:
        for n in LEVELS:
            if metrics_state.get("guard_tripped"):
                break
            if n > 1:
                print(f"--- 冷却 {LEVEL_COOLDOWN:.0f}s ---")
                await asyncio.sleep(LEVEL_COOLDOWN)
                if metrics_state.get("guard_tripped"):
                    break

            stats = await run_level(n)
            if baseline_first is None and stats["t_open_med"]:
                baseline_first = stats["t_open_med"]
            ok, why = verdict(stats, baseline_first)
            stats["verdict"] = f"{why}"
            level_reports.append(stats)

            if not ok:
                print(f"  级别 N={n} 未过判稳（{why}），30s 后复测一次区分偶发/硬上限...")
                await asyncio.sleep(30)
                if metrics_state.get("guard_tripped"):
                    break
                retry = await run_level(n)
                ok2, why2 = verdict(retry, baseline_first)
                retry["verdict"] = f"复测: {why2}"
                level_reports.append(retry)
                if not ok2:
                    cliff = n
                    print(f"  复测仍未过（{why2}）→ 稳定并发上限 = {prev_level(LEVELS, n)}")
                    break
                else:
                    print("  复测通过（偶发抖动），继续加压")
            if n == LEVELS[-1]:
                print(f"  最高档 {n} 通过")
    finally:
        stop_event.set()
        gt.join(timeout=25)

    trip = metrics_state.get("guard_tripped")
    print("\n" + "=" * 60)
    print("压测结果汇总")
    print("=" * 60)
    for s in level_reports:
        print(f"N={s['n']:>3}  连接{s['conn_ok']}/{s['n']}  轮{s['turns_ok']}/{s['turns_expected']}  "
              f"开口{s['t_open_med']}/{s['t_open_p95']}s  整轮{s['t_done_med']}/{s['t_done_p95']}s  "
              f"RAG{s['rag_hit']}  {s['verdict']}")
    if trip:
        print(f"保险丝: {trip}（共用服务器保护中止，非 App 上限）")
    elif cliff:
        print(f"结论: 稳定并发上限 = {prev_level(LEVELS, cliff)}（N={cliff} 连续两轮未过判稳）")
    else:
        print(f"结论: 至 N={level_reports[-1]['n'] if level_reports else '?'} 全部通过")

    with open("scripts/concurrency_stress_results.json", "w", encoding="utf-8") as f:
        json.dump({"levels": level_reports, "guard": trip,
                   "baseline_first_s": baseline_first,
                   "timeline": metrics_timeline}, f, ensure_ascii=False, indent=1)
    print("明细已写 scripts/concurrency_stress_results.json")


def prev_level(levels, failed):
    """失败档的前一档 = 稳定上限；失败的是第一档则 0。"""
    idx = levels.index(failed)
    return levels[idx - 1] if idx > 0 else 0


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n用户中止")
