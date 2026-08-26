# 真实对话冒烟:走 /client-ws 发 text-input,量首包/总时长,收全文验语气与幻觉
import asyncio
import json
import time

import websockets

WS = "ws://127.0.0.1:12393/client-ws"
QUESTION = "我们学校是什么时候创办的？"
LOG = r"D:\srp_project\ai-school\logs\conversation-smoke.log"


async def main():
    t_start = time.time()
    t_first_audio = None
    t_synth_done = None
    full_text = ""
    rag_status = None
    seen_types = {}
    audio_count = 0
    async with websockets.connect(WS, max_size=10**7) as ws:
        await ws.send(json.dumps({"type": "text-input", "text": QUESTION}))
        end = time.time() + 120
        while time.time() < end:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=5)
            except asyncio.TimeoutError:
                if time.time() - t_start > 90:
                    break
                continue
            t_now = time.time() - t_start
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            mtype = msg.get("type")
            seen_types[mtype] = seen_types.get(mtype, 0) + 1
            if mtype == "rag-status":
                rag_status = (msg.get("has_context"), msg.get("doc_count"))
            elif mtype == "audio" and t_first_audio is None:
                t_first_audio = t_now
                audio_count = 1
            elif mtype == "audio":
                audio_count += 1
            elif mtype == "backend-synth-complete":
                # 模拟真实前端：音频播完后回 ACK，后端才会收链发 chain-end
                if t_synth_done is None:
                    t_synth_done = t_now
                await ws.send(json.dumps({"type": "frontend-playback-complete"}))
            elif mtype == "full-text" and msg.get("text"):
                full_text = msg["text"]
            elif mtype == "control":
                if msg.get("text") == "conversation-chain-end":
                    break

    lines = [
        f"question: {QUESTION}",
        f"rag_status: {rag_status}",
        f"first_audio_at: {t_first_audio and round(t_first_audio, 1)}s",
        f"backend_synth_done_at: {t_synth_done and round(t_synth_done, 1)}s",
        f"audio_chunks: {audio_count}",
        f"total_until_chain_end: {round(time.time() - t_start, 1)}s",
        f"full_text: {full_text}",
        f"seen_types: {seen_types}",
    ]
    out = "\n".join(lines)
    open(LOG, "w", encoding="utf-8").write(out)
    print(out)


asyncio.run(main())
