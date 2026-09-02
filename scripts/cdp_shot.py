"""CDP 真机巡检:导航 hash 路由 + 截图(WebView 内容) + 可选 JS 执行

用法:
  python cdp_shot.py <cdp_port> <hash_route> <out_png> ["js_expr"]
例:
  python cdp_shot.py 9222 "#/system-logs" shot_logs.png
  python cdp_shot.py 9222 "#/hero" shot_hero.png "document.title"
"""

import asyncio
import base64
import json
import sys
import urllib.request

import websockets

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9222
ROUTE = sys.argv[2] if len(sys.argv) > 2 else "#/hero"
OUT = sys.argv[3] if len(sys.argv) > 3 else "shot.png"
JS = sys.argv[4] if len(sys.argv) > 4 else None


def http_json(path):
    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}{path}", timeout=10) as r:
        return json.loads(r.read().decode())


class CDP:
    def __init__(self, ws):
        self.ws = ws
        self.next_id = 1

    async def call(self, method, params=None, timeout=45):
        rid = self.next_id
        self.next_id += 1
        await self.ws.send(json.dumps({"id": rid, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(await asyncio.wait_for(self.ws.recv(), timeout))
            if msg.get("id") == rid:
                if "error" in msg:
                    raise RuntimeError(msg["error"])
                return msg.get("result")

    async def evaluate(self, expr, timeout=30):
        res = await self.call("Runtime.evaluate",
                              {"expression": expr, "returnByValue": True,
                               "awaitPromise": True}, timeout)
        return res.get("result", {}).get("value")


async def main():
    targets = http_json("/json")
    page = next((t for t in targets
                 if t.get("type") == "page" and "localhost" in t.get("url", "")), None)
    if not page:
        sys.exit("no page target found")
    async with websockets.connect(page["webSocketDebuggerUrl"],
                                  max_size=50 * 1024 * 1024) as ws:
        cdp = CDP(ws)
        await cdp.call("Page.enable")
        # 导航(hash 路由直接改 hash 即可,React Router 监听 hashchange)
        await cdp.evaluate(f"window.location.hash = '{ROUTE}'")
        await asyncio.sleep(2.5)  # 等渲染 + 数据加载
        if JS:
            print("JS =>", json.dumps(await cdp.evaluate(JS), ensure_ascii=True)[:500])
            await asyncio.sleep(1.2)  # 等点击后的动画/状态切换
        shot = await cdp.call("Page.captureScreenshot", {"format": "png"})
        with open(OUT, "wb") as f:
            f.write(base64.b64decode(shot["data"]))
        print(f"saved {OUT} ({len(shot['data'])} b64 chars) url={await cdp.evaluate('location.href')}")

asyncio.run(main())
