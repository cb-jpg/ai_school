"""CDP 双指捏合缩放实测：headless Chromium/Edge + Input.dispatchTouchEvent

用法: python cdp_pinch_test.py [cdp_port]
前置: 浏览器已用 --remote-debugging-port=<port> --window-size=412,915 打开
      http://183.36.243.124:12393/?token=<TOKEN>#/hero 且模型加载完成
流程: 等 Live2D 模型就绪 → 读 scale → 双指张开捏合 → 读 scale → 判定 PASS/FAIL
"""

import asyncio
import json
import sys

import websockets
import urllib.request

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9333


def http_json(path):
    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}{path}") as r:
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
                return msg.get("result", {}).get("result", {}).get("value")

    def evaluate(self, expr, timeout=45):
        return self.call("Runtime.evaluate",
                         {"expression": expr, "returnByValue": True}, timeout)


async def main():
    targets = http_json("/json")
    page = next(t for t in targets
                if t.get("type") == "page" and "12393" in t.get("url", ""))
    async with websockets.connect(page["webSocketDebuggerUrl"],
                                  max_size=50 * 1024 * 1024) as ws:
        cdp = CDP(ws)
        await cdp.call("Page.enable")

        print("等待 Live2D 模型加载...", flush=True)
        model_ready = False
        for _ in range(90):
            ready = await cdp.evaluate(
                "(()=>{try{return !!(window.getLAppAdapter&&"
                "window.getLAppAdapter().getModel())}catch(e){return false}})()",
                timeout=15,
            )
            if ready:
                model_ready = True
                break
            await asyncio.sleep(1)
        if not model_ready:
            print("FAIL: 模型 90s 未就绪")
            return

        def scale_expr():
            return ("(()=>{const m=window.getLAppAdapter().getModel();"
                    "return m._modelMatrix.getScaleX()})()")

        before = await cdp.evaluate(scale_expr())
        print(f"捏合前 scale = {before}")

        async def touch(type_, points):
            # Input.dispatchTouchEvent 在部分实现里不回响应，发后不等
            rid = cdp.next_id
            cdp.next_id += 1
            await cdp.ws.send(json.dumps({
                "id": rid,
                "method": "Input.dispatchTouchEvent",
                "params": {"type": type_, "touchPoints": points},
            }))
            await asyncio.sleep(0.08)

        cx, cy = 206, 190
        await touch("touchStart", [
            {"x": cx - 50, "y": cy, "id": 1},
            {"x": cx + 50, "y": cy, "id": 2},
        ])
        for i in range(1, 6):
            half = 50 + i * 34
            await touch("touchMove", [
                {"x": cx - half, "y": cy, "id": 1},
                {"x": cx + half, "y": cy, "id": 2},
            ])
            cur = await cdp.evaluate(scale_expr())
            print(f"  张开 step{i}: 间距={half * 2} scale={cur}")

        await touch("touchEnd", [])
        await asyncio.sleep(0.3)

        after = await cdp.evaluate(scale_expr())
        print(f"捏合后 scale = {after}")
        grown = isinstance(after, (int, float)) and after > before * 1.5
        print("PINCH RESULT:", "PASS（成功放大）" if grown else "FAIL（未放大或抖动）")


if __name__ == "__main__":
    asyncio.run(main())
