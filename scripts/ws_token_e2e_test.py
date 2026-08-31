"""WS 端到端对话测试（含 token 门禁验证）

用法: .venv/bin/python3 ws_token_e2e_test.py <ws_url_with_or_without_token> [timeout]
不带 token 的连接应被拒绝（1008/403）；带 token 的连接应完成一轮对话。
"""

import asyncio
import json
import sys
import uuid

import websockets


async def try_connect(url: str, timeout: float = 15):
    try:
        async with websockets.connect(url) as ws:
            # 若握手成功，等 2 秒看是否有消息
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=2)
                return "CONNECTED", msg[:80]
            except asyncio.TimeoutError:
                return "CONNECTED", "(no message)"
    except Exception as e:
        return "REJECTED", f"{type(e).__name__}: {e}"


async def full_conversation(url: str, timeout: float):
    async with websockets.connect(url, max_size=50 * 1024 * 1024) as ws:
        client_uid = str(uuid.uuid4())[:8]

        async def send(obj):
            await ws.send(json.dumps(obj))

        async def recv_until(want_types: set, overall_deadline):
            while True:
                remaining = overall_deadline - asyncio.get_event_loop().time()
                if remaining <= 0:
                    return None
                raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
                try:
                    m = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                t = m.get("type")
                if t in want_types:
                    return m

        start = asyncio.get_event_loop().time()
        await send({"type": "text-input", "text": "你好，请用一句话介绍你自己", "client_uid": client_uid})

        full_text = await recv_until({"full-text", "ai-sentence"}, start + timeout)
        if full_text is None:
            print("FAIL: no reply within", timeout, "s")
            return False
        dt = asyncio.get_event_loop().time() - start
        text = full_text.get("text") or full_text.get("message", "")
        print(f"REPLY ({dt:.1f}s): {text[:100]}")

        audio = await recv_until({"audio"}, start + timeout)
        has_audio = audio is not None and bool(audio.get("audio"))
        print("AUDIO payload received:", has_audio)
        return bool(text) and has_audio


async def main():
    url_with = sys.argv[1]
    timeout = float(sys.argv[2]) if len(sys.argv) > 2 else 120

    base = url_with.split("?")[0]
    print("== 1) 无 token 连接（应被拒绝）==")
    state, detail = await try_connect(base)
    print(f"{state}: {detail}")

    print("== 2) 错误 token 连接（应被拒绝）==")
    state, detail = await try_connect(base + "?token=WRONGTOKEN")
    print(f"{state}: {detail}")

    print("== 3) 正确 token 连接 + 一轮完整对话 ==")
    ok = await full_conversation(url_with, timeout)
    print("E2E RESULT:", "PASS" if ok else "FAIL")


if __name__ == "__main__":
    asyncio.run(main())
