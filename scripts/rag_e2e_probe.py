"""RAG 链路专项探测：学校问题 → rag-status → full-text → audio

用法: python rag_e2e_probe.py <ws_url_with_token> [question] [timeout]
在标准 e2e 之上额外检查 rag-status（知识检索状态），验证
"检索 → 生成 → TTS 音频" 服务端链路。字幕联动是前端行为，真机验证。
"""

import asyncio
import json
import sys
import uuid

import websockets

INTERESTING = {"rag-status", "full-text", "ai-sentence", "audio"}


async def run(url: str, question: str, timeout: float):
    seen = {}
    async with websockets.connect(url, max_size=50 * 1024 * 1024) as ws:
        client_uid = str(uuid.uuid4())[:8]
        await ws.send(json.dumps({"type": "text-input", "text": question, "client_uid": client_uid}))

        deadline = asyncio.get_event_loop().time() + timeout
        while set(seen) != INTERESTING:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                break
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
            except asyncio.TimeoutError:
                break
            try:
                m = json.loads(raw)
            except json.JSONDecodeError:
                continue
            t = m.get("type")
            if t == "rag-status" and t not in seen:
                seen[t] = m
                print(f"RAG-STATUS: has_context={m.get('has_context')} doc_count={m.get('doc_count')}")
            elif t in ("full-text", "ai-sentence") and t not in seen:
                seen[t] = m
                text = m.get("text") or m.get("message", "")
                print(f"REPLY: {text[:160]}")
            elif t == "audio" and t not in seen:
                seen[t] = m
                dt = m.get("display_text") or {}
                print(f"AUDIO: has_payload={bool(m.get('audio'))} caption={str(dt.get('text'))[:60]}")

    print("---")
    print("rag-status:", "rag-status" in seen)
    print("reply:", bool(seen.get("full-text") or seen.get("ai-sentence")))
    print("audio:", "audio" in seen and bool(seen["audio"].get("audio")))
    ok = ("rag-status" in seen
          and bool(seen.get("full-text") or seen.get("ai-sentence"))
          and "audio" in seen and bool(seen["audio"].get("audio")))
    print("RAG E2E:", "PASS" if ok else "INCOMPLETE")


if __name__ == "__main__":
    url = sys.argv[1]
    q = sys.argv[2] if len(sys.argv) > 2 else "学校是什么时候创办的？"
    t = float(sys.argv[3]) if len(sys.argv) > 3 else 180
    asyncio.run(run(url, q, t))
