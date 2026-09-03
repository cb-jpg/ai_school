"""抓取 Live2D canvas 帧缓冲内容（同帧 toDataURL，绕过 CDP 截图对 GL 的盲区）
用法: python cdp_fb_dump.py <cdp_port> <out_png>
"""
import asyncio
import base64
import json
import sys
import urllib.request

import websockets

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9222
OUT = sys.argv[2] if len(sys.argv) > 2 else "fb_dump.png"


def http_json(path):
    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}{path}", timeout=10) as r:
        return json.loads(r.read().decode())


async def main():
    pages = http_json("/json")
    page = next(p for p in pages if p.get("type") == "page")
    async with websockets.connect(page["webSocketDebuggerUrl"], max_size=64 * 1024 * 1024) as ws:
        expr = (
            "(function(){return new Promise(function(res){"
            "var c=document.getElementById('canvas');"
            "requestAnimationFrame(function(){"
            "requestAnimationFrame(function(){"
            "try{res(c.toDataURL('image/png'))}catch(e){res('ERR:'+e.message)}"
            "});});});})()"
        )
        await ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate",
                                  "params": {"expression": expr, "awaitPromise": True,
                                             "returnByValue": True}}))
        while True:
            msg = json.loads(await asyncio.wait_for(ws.recv(), 60))
            if msg.get("id") == 1:
                res_obj = msg.get("result", {}).get("result", {})
                val = res_obj.get("value")
                if val is None:
                    print("NO VALUE:", json.dumps(msg)[:500])
                    sys.exit(1)
                break
    if val.startswith("ERR:"):
        print(val)
        sys.exit(1)
    b64 = val.split(",", 1)[1]
    open(OUT, "wb").write(base64.b64decode(b64))
    print(f"saved {OUT} ({len(b64)} b64 chars)")

asyncio.run(main())
