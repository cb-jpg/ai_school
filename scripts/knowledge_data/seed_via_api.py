"""走常驻 run_server 的 HTTP API 灌库（零额外内存，不起新的 torch 进程）。

背景：09-02 用 seed_knowledge_v2.py 在服务器起独立进程做向量化，把共用服务器
推入换页风暴（见记忆 shared-server-heavy-job-rules）。本脚本改为本地逐条 POST
服务器已有的 POST /api/knowledge/create，向量化在常驻 run_server 进程内完成。

用法（在本地跑，不是服务器）:
    python scripts/knowledge_data/seed_via_api.py clean   # 清洗 merged.json（HTML实体/零宽字符）
    python scripts/knowledge_data/seed_via_api.py seed    # 灌库（幂等，按标题去重，可断点续跑）
    python scripts/knowledge_data/seed_via_api.py search  # 检索自检（走与对话 RAG 同一检索路径）

安全:
- 访问令牌：环境变量 ACCESS_TOKEN 或 frontend/.env.web.local
- admin 密码：环境变量 SEED_PASS 或本目录 .seed_auth 两行（用户名/密码）；不进被跟踪文件
- 铁律（shared-server-heavy-job-rules）：每 10 条 ssh 查 /proc/meminfo+loadavg，
  available<5G / load1>50 / swap used>50% 立即中止（脚本幂等，重跑可续传）
"""

import html
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8")

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
DATA = HERE / "merged.json"
LOG = HERE / "seed_api.log"

BASE = "http://183.36.243.124:12393"
SSH_TARGET = "liucb@183.36.243.124"

# 中止阈值（铁律 #3/#4 + 2026-09-04 ollama 换页风暴教训）
MIN_AVAIL_KB = 8 * 1024 * 1024      # available < 8G 停手（上次 5G 阈值太晚）
MAX_LOAD1 = 50.0                     # load1 > 50 不开窗
MAX_SWAP_PCT = 50.0                  # swap used > 50% 不开窗
MAX_IO_PSI = 50.0                    # 磁盘压力 PSI io full avg10 > 50% = 风暴中

# 上次 v2 中断前用"未清洗"内容灌入的 2 条，重建以保持语料一致
RESET_TITLES = ("育人目标", "学校办学特色")

SLEEP_BETWEEN = 1.5
REQ_TIMEOUT = 600
HEALTH_EVERY = 5


def log(msg: str) -> None:
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def _auth_file_lines() -> list[str]:
    auth_file = HERE / ".seed_auth"
    if auth_file.exists():
        return [l.strip() for l in auth_file.read_text(encoding="utf-8").splitlines() if l.strip()]
    return []


def load_username() -> str:
    lines = _auth_file_lines()
    return lines[0] if lines else "admin"


def load_access_token() -> str:
    tok = os.environ.get("ACCESS_TOKEN")
    if tok:
        return tok
    env_local = REPO_ROOT / "frontend" / ".env.web.local"
    if env_local.exists():
        for line in env_local.read_text(encoding="utf-8").splitlines():
            if line.startswith("VITE_ACCESS_TOKEN="):
                return line.split("=", 1)[1].strip()
    sys.exit("找不到访问令牌（设 ACCESS_TOKEN 或补 frontend/.env.web.local）")


def load_password() -> str:
    pw = os.environ.get("SEED_PASS")
    if pw:
        return pw
    lines = _auth_file_lines()
    if len(lines) >= 2:
        return lines[1]
    sys.exit("找不到 admin 密码（设 SEED_PASS 或建 scripts/knowledge_data/.seed_auth 两行：用户名/密码）")


def make_session() -> requests.Session:
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"username": load_username(), "password": load_password()},
        headers={"X-Access-Token": load_access_token()},  # 登录接口本身也过访问令牌门禁
        timeout=30,
    )
    r.raise_for_status()
    jwt = r.json()["token"]
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {jwt}",
        "X-Access-Token": load_access_token(),
    })
    log(f"登录成功（{load_username()}），JWT 就绪")
    return s


# ============ clean ============

ZW_RE = re.compile("[​‌‍⁠﻿]")


def clean() -> None:
    entries = json.loads(DATA.read_text(encoding="utf-8"))
    changed = 0
    for e in entries:
        for field in ("content", "summary"):
            v = e.get(field) or ""
            v2 = ZW_RE.sub("", html.unescape(v))
            if v2 != v:
                e[field] = v2
                changed += 1
                print(f"清洗: {e['title']} {field} {len(v)}→{len(v2)} 字")
    bak = DATA.with_suffix(".json.bak-pre-clean")
    if not bak.exists():
        bak.write_bytes(DATA.read_bytes())
    DATA.write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"共清洗 {changed} 处（{len(entries)} 条）；备份在 {bak.name}")


# ============ 服务器健康检查（铁律） ============

def health_check() -> tuple[bool, str, bool]:
    """ssh 读 /proc：返回 (是否安全, 描述, ssh是否可达)。
    指标：MemAvailable、swap 占用比、load1、磁盘压力 PSI（io full avg10）。
    PSI 高 = 换页风暴进行中（09-04 教训：内存够但别的进程引发换页，事件循环照样卡死）。"""
    cmd = (
        "awk '/MemAvailable/{a=$2}/SwapTotal/{t=$2}/SwapFree/{f=$2}"
        "END{print a, t-f, t}' /proc/meminfo; cat /proc/loadavg; "
        "awk '/^full/{gsub(\"avg10=\", \"\", $2); print $2; exit}'"
        " /proc/pressure/io 2>/dev/null || echo 0"
    )
    try:
        p = subprocess.run(
            ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", SSH_TARGET, cmd],
            capture_output=True, text=True, timeout=25,
        )
        lines = [l for l in p.stdout.strip().splitlines() if l.strip()]
        avail_kb, swap_used_kb, swap_total_kb = (int(x) for x in lines[0].split())
        load1 = float(lines[1].split()[0])
        io_psi = float(lines[2])
    except Exception as e:
        return True, f"健康检查 ssh 失败（本次忽略）：{e}", False
    swap_pct = swap_used_kb / swap_total_kb * 100 if swap_total_kb else 0
    desc = (f"available={avail_kb/1048576:.1f}G load1={load1} swap={swap_pct:.0f}% "
            f"ioPSI={io_psi:.0f}%")
    if (avail_kb < MIN_AVAIL_KB or load1 > MAX_LOAD1 or swap_pct > MAX_SWAP_PCT
            or io_psi > MAX_IO_PSI):
        return False, desc, True
    return True, desc, True


# ============ seed ============

def seed() -> None:
    entries = json.loads(DATA.read_text(encoding="utf-8"))
    log(f"载入 {len(entries)} 条待灌条目（merged.json）")

    s = make_session()

    ok, desc, _ = health_check()
    log(f"开窗前服务器状态：{desc}")
    if not ok:
        sys.exit("服务器余量不足，按铁律不开窗。稍后再跑（脚本幂等可续传）。")

    # 现有条目（含归档）按标题去重
    listed = s.get(f"{BASE}/api/knowledge/list", params={"include_archived": "true"}, timeout=30)
    listed.raise_for_status()
    by_title = {item["title"]: item["id"] for item in listed.json()}
    log(f"服务器现有 {len(by_title)} 条")

    # 上次中断残留的脏内容条目：删掉重建
    for t in RESET_TITLES:
        if t in by_title:
            r = s.delete(f"{BASE}/api/knowledge/{by_title[t]}", timeout=30)
            log(f"删除待重建残留条目「{t}」：HTTP {r.status_code}")
            by_title.pop(t, None)
            time.sleep(SLEEP_BETWEEN)

    created, skipped, failed = 0, 0, []
    t0 = time.time()
    ssh_unreachable_streak = 0
    consec_fail = 0
    for i, e in enumerate(entries, 1):
        title = e["title"][:200]
        if title in by_title:
            skipped += 1
            continue

        payload = {
            "title": title,
            "category": e["category"],
            "tags": e.get("tags", []),
            "summary": (e.get("summary") or "")[:200],
            "content": e["content"],
        }
        err = None
        for attempt in (1, 2):
            try:
                r = s.post(f"{BASE}/api/knowledge/create", json=payload, timeout=REQ_TIMEOUT)
                if r.status_code == 200:
                    err = None
                    break
                err = f"HTTP {r.status_code}: {r.text[:200]}"
                if r.status_code < 500:
                    break  # 4xx 重试无益
            except requests.RequestException as exc:
                err = str(exc)[:120]
            if attempt == 1:
                time.sleep(10)

        if err is None:
            created += 1
            consec_fail = 0
            log(f"[{i}/{len(entries)}] OK「{title}」{len(e['content'])}字 累计{time.time()-t0:.0f}s")
            by_title[title] = "just-created"
            time.sleep(SLEEP_BETWEEN)
        else:
            failed.append((title, err))
            consec_fail += 1
            log(f"[{i}/{len(entries)}] 失败「{title}」：{err}")
            if consec_fail >= 2:
                log("❌ 连续 2 条请求失败，服务器疑似卡死，中止（稍后重跑可续传）")
                sys.exit(3)

        if i % HEALTH_EVERY == 0:
            ok, desc, reachable = health_check()
            ssh_unreachable_streak = 0 if reachable else ssh_unreachable_streak + 1
            log(f"健康检查：{desc}（已灌 {created} 条）")
            if not ok:
                log("❌ 服务器余量不足，按铁律中止（重跑本脚本可续传）")
                sys.exit(2)
            if ssh_unreachable_streak >= 2:
                log("❌ 连续 2 次健康检查不可达，中止（重跑本脚本可续传）")
                sys.exit(2)

    log(f"\n灌库完成：新增 {created} 条，跳过 {skipped} 条，失败 {len(failed)} 条，"
        f"耗时 {time.time()-t0:.0f}s")
    for t, why in failed:
        log(f"  失败: {t} — {why}")
    if failed:
        sys.exit(1)


# ============ search 自检 ============

QUESTIONS = [
    "学校的办学特色是什么？",
    "学校有哪些国家级荣誉？",
    "学校2016年有什么大事？",
    "学校作息时间是怎样安排的？",
    "学生获得过哪些信息学竞赛奖项？",
    "学校的校训和育人目标是什么？",
]


def search() -> None:
    s = make_session()
    listed = s.get(f"{BASE}/api/knowledge/list", timeout=30)
    listed.raise_for_status()
    log(f"服务器现有 {len(listed.json())} 条条目")
    hit = 0
    for q in QUESTIONS:
        r = s.post(f"{BASE}/api/knowledge/search", json={"query": q, "top_k": 3}, timeout=60)
        r.raise_for_status()
        docs = r.json()["results"]
        if docs:
            hit += 1
            tops = "；".join(f"{d['title']}({d['score']:.2f})" for d in docs[:2])
            log(f"[命中] {q} → {tops}")
        else:
            log(f"[未命中] {q}")
    log(f"自检：{hit}/{len(QUESTIONS)} 命中")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "seed"
    if len(sys.argv) > 2:  # 数据文件可覆盖：python seed_via_api.py seed merged_v2.json
        DATA = HERE / sys.argv[2]
    {"clean": clean, "seed": seed, "search": search}[mode]()
