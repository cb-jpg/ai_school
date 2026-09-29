"""笼统问法基线/验收（2026-09-27）：家长学生真实问法都很粗糙（"学校怎么样""怎么报名"），
用户反馈"问得粗糙答得也粗糙"。本脚本用 6 个典型笼统问法走真实 WS 链路，
量回答丰富度：字数、具体事实数（数字/专名/电话）、是否给后续引导。
判定不设关键词 PASS/FAIL——粗细由人看摘录+richness 指标，完整答复写 job tmp。
用法: python scripts/knowledge_data/vague_ask_e2e.py [baseline|after]
"""
import asyncio
import json
import os
import sys
import time
import urllib.request
import uuid
from pathlib import Path

import websockets

sys.stdout.reconfigure(encoding="utf-8")
BASE = "http://183.36.243.124:12393"
WS = "ws://183.36.243.124:12393/client-ws"


def _load_env_web_local() -> dict:
    """从 frontend/.env.web.local（gitignored）读 VITE_*=… 键值；环境变量优先。
    凭据（访问令牌/登录口令）一律不进被跟踪文件——公开仓库铁律。"""
    p = Path(__file__).resolve().parents[2] / "frontend" / ".env.web.local"
    if not p.exists():
        return {}
    out = {}
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            out[k.strip()] = v.strip()
    return out


_ENV = _load_env_web_local()
ACCESS = os.environ.get("OLLV_ACCESS_TOKEN") or _ENV.get("VITE_ACCESS_TOKEN", "")
# 2026-09-29 演示账号 student01/parent01 被校方有意删除，e2e 一律走 kiosk
# （设备自动登录账号，role=user 对话可用）
KIOSK_USER = os.environ.get("OLLV_KIOSK_USER") or _ENV.get("VITE_KIOSK_USERNAME", "")
KIOSK_PASS = os.environ.get("OLLV_KIOSK_PASS") or _ENV.get("VITE_KIOSK_PASSWORD", "")
TAG = sys.argv[1] if len(sys.argv) > 1 else "baseline"
REPLY_LOG = rf"C:\Users\28432\.claude\jobs\bc8ee473\tmp\vague_replies-20260927-{TAG}.txt"

QUESTIONS = [
    "学校怎么样？",
    "介绍一下你们学校",
    "孩子去你们学校读书好不好？",
    "你们学校有什么特色？",
    "想上你们学校初中怎么报名？",
    "老师教得好不好？",
]

# 具体性信号：数字、年份、专名、电话、课程/班型名
CONCRETE = ["保送", "清华", "北大", "100+", "13 ", "40", "扬长", "信息学",
            "85930080", "南海区", "荣誉", "芝兰玉树", "百佳之星", "中考", "高考",
            "住宿", "学费", "社团", "选修", "主" ]


def login():
    req = urllib.request.Request(
        f"{BASE}/api/auth/login",
        data=json.dumps({"username": KIOSK_USER, "password": KIOSK_PASS}).encode(),
        headers={"Content-Type": "application/json", "X-Access-Token": ACCESS})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())["token"]


async def ask(url, question, timeout=240, idle_gap=15):
    async with websockets.connect(url, max_size=50 * 1024 * 1024) as ws:
        client_uid = str(uuid.uuid4())[:8]
        await ws.send(json.dumps({"type": "text-input", "text": question, "client_uid": client_uid}))
        loop = asyncio.get_event_loop()
        t0 = loop.time()
        last = t0
        parts = []
        while True:
            now = loop.time()
            if now - t0 > timeout:
                break
            if parts and now - last > idle_gap:
                break
            budget = max(1.0, min(idle_gap, timeout - (now - t0)))
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=budget)
            except asyncio.TimeoutError:
                if parts:
                    break
                continue
            m = json.loads(raw)
            t = m.get("type")
            if t == "audio":
                dt = (m.get("display_text") or {}).get("text")
                if dt:
                    parts.append(dt)
                    last = loop.time()
            elif t == "conversation-chain-end":
                break
        return "".join(parts)


def richness(reply):
    hits = [k for k in CONCRETE if k in reply]
    guide = any(k in reply for k in ["还想", "可以问", "欢迎", "了解", "告诉", "咨询"])
    return len(reply), len(hits), guide


async def main():
    jwt = login()
    url = f"{WS}?token={ACCESS}&user_token={jwt}"
    f = open(REPLY_LOG, "w", encoding="utf-8")
    stats = []
    for i, q in enumerate(QUESTIONS, 1):
        t0 = time.time()
        reply = await ask(url, q)
        n, conc, guide = richness(reply)
        stats.append((n, conc, guide))
        print(f"[{i}/6] {n}字 具体{conc} 引导{'有' if guide else '无'} ({time.time()-t0:.0f}s) | {q}")
        print(f"  ↳ {reply[:200].replace(chr(10), ' ')}")
        f.write(f"\nQ{i} {q}  [{n}字 具体{conc} 引导{'有' if guide else '无'}]\n{reply}\n{'-'*60}\n")
        await asyncio.sleep(2)
    f.close()
    avg_n = sum(s[0] for s in stats) / len(stats)
    avg_c = sum(s[1] for s in stats) / len(stats)
    ng = sum(1 for s in stats if s[2])
    print(f"\n汇总[{TAG}]: 平均 {avg_n:.0f}字 / 具体信号 {avg_c:.1f} 个 / 带引导 {ng}/6")
    print(f"完整答复：{REPLY_LOG}")


if __name__ == "__main__":
    asyncio.run(main())
