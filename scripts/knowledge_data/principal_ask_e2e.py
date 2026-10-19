# -*- coding: utf-8 -*-
"""「校长是谁」真发问 e2e（2026-10-18）：用户反馈"回答不对、数据太旧"的验收。

复用 vague_ask_e2e 的 WS 链路（kiosk 登录、每题独立新连接=新对话铁律、只看本轮答复）。
判定：
  PASS   = 提及梁小翠作为现任校长，且未把旧名字当现任、无对冲话术
  SOFT   = 提及旧名字但明确说是历任/前任（可接受）
  FAIL   = 把旧名字当现任校长 / 说没资料 / 资料冲突 / 不确定
用法: python scripts/knowledge_data/principal_ask_e2e.py
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

sys.path.insert(0, str(Path(__file__).resolve().parent))
from vague_ask_e2e import _ENV, ACCESS, KIOSK_USER, KIOSK_PASS  # noqa: E402

REPLY_LOG = Path.home() / ".claude" / "jobs" / "tmp" / "principal_replies-20261018.txt"

QUESTIONS = [
    "我们的校长是谁",
    "你们学校现在的校长是谁",
    "校长是谁啊",
    "现任校长叫什么名字",
    "学校的负责人是谁",
    "罗剑辉是现任校长吗",
    "你们的校长是不是罗剑辉",
    "阳智平是谁",
]

OLD_NAMES = ["阳智平", "罗剑辉", "陈慧文", "盘文健", "叶影颜", "李俊兴"]
HEDGE = ["资料冲突", "不确定", "没有资料", "以学校公布为准", "可能换届", "没有明确"]


def judge(reply: str) -> tuple[str, str]:
    has_cur = "梁小翠" in reply
    old_as_cur = any(n in reply and ("现任" in reply or "校长是" in reply)
                     and reply.find(n) < reply.find("历任" if "历任" in reply else n)
                     for n in OLD_NAMES[:1])  # 只严格判首名句式，细节人工看摘录
    old_mentioned = [n for n in OLD_NAMES if n in reply]
    old_as_history = bool(old_mentioned) and any(
        k in reply for k in ["历任", "前任", "曾经", "时任", "以前", "彼时"])
    hedges = [k for k in HEDGE if k in reply]
    if not has_cur:
        return "FAIL", f"未提现任梁小翠；对冲={hedges or '无'}"
    if hedges:
        return "FAIL", f"对冲话术 {hedges}"
    if old_mentioned and not old_as_history:
        return "FAIL", f"提及旧名 {old_mentioned} 但未标注历任"
    if old_mentioned and old_as_history:
        return "SOFT", f"旧名已标注历任 {old_mentioned}"
    return "PASS", "现任答对"


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
            if m.get("type") == "audio":
                dt = (m.get("display_text") or {}).get("text")
                if dt:
                    parts.append(dt)
                    last = loop.time()
            elif m.get("type") == "conversation-chain-end":
                break
        return "".join(parts)


async def main():
    req = urllib.request.Request(
        f"{BASE}/api/auth/login",
        data=json.dumps({"username": KIOSK_USER, "password": KIOSK_PASS}).encode(),
        headers={"Content-Type": "application/json", "X-Access-Token": ACCESS})
    with urllib.request.urlopen(req, timeout=30) as r:
        jwt = json.loads(r.read().decode())["token"]
    url = f"{WS}?token={ACCESS}&user_token={jwt}"

    REPLY_LOG.parent.mkdir(parents=True, exist_ok=True)
    f = open(REPLY_LOG, "w", encoding="utf-8")
    npass = nsoft = nfail = 0
    for i, q in enumerate(QUESTIONS, 1):
        t0 = time.time()
        reply = await ask(url, q)
        verdict, why = judge(reply)
        if verdict == "PASS":
            npass += 1
        elif verdict == "SOFT":
            nsoft += 1
        else:
            nfail += 1
        mark = {"PASS": "✅", "SOFT": "🟡", "FAIL": "❌"}[verdict]
        print(f"[{i}/8] {mark} {verdict} ({time.time()-t0:.0f}s) | {q}  ({why})")
        print(f"  ↳ {reply[:180].replace(chr(10), ' ')}")
        f.write(f"\nQ{i} {q}  [{verdict} {why}]\n{reply}\n{'-'*60}\n")
        await asyncio.sleep(2)
    f.close()
    print(f"\n汇总: PASS {npass} / SOFT {nsoft} / FAIL {nfail}（共 8）")
    print(f"完整答复：{REPLY_LOG}")


if __name__ == "__main__":
    asyncio.run(main())
