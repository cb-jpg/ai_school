"""拖动回归（自动定位人物版）：hitTest 找模型 → 从命中点拖动 → 验证 tx 变化
用法: python cdp_drag_locate_test.py <cdp_port>
"""
import asyncio
import json
import sys
import urllib.request

import websockets

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9222


def http_json(path):
    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}{path}", timeout=10) as r:
        return json.loads(r.read().decode())


class CDP:
    def __init__(self, ws):
        self.ws = ws
        self.next_id = 1

    async def call(self, method, params=None, timeout=30):
        rid = self.next_id
        self.next_id += 1
        await self.ws.send(json.dumps({"id": rid, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(await asyncio.wait_for(ws_recv(self), timeout))
            if msg.get("id") == rid:
                return msg.get("result")

    async def evaluate(self, expr, timeout=30):
        res = await self.call("Runtime.evaluate",
                              {"expression": expr, "returnByValue": True,
                               "awaitPromise": True}, timeout)
        return res.get("result", {}).get("value")

    async def drag(self, x0, y0, x1, y1, steps=14):
        await self.call("Input.dispatchTouchEvent", {
            "type": "touchStart",
            "touchPoints": [{"x": x0, "y": y0, "id": 1}]})
        for i in range(1, steps + 1):
            t = i / steps
            await self.call("Input.dispatchTouchEvent", {
                "type": "touchMove",
                "touchPoints": [{"x": x0 + (x1 - x0) * t,
                                 "y": y0 + (y1 - y0) * t, "id": 1}]})
            await asyncio.sleep(0.016)
        await self.call("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})


async def ws_recv(cdp):
    return await cdp.ws.recv()


async def main():
    page = next(t for t in http_json("/json") if t.get("type") == "page")
    async with websockets.connect(page["webSocketDebuggerUrl"], max_size=50 * 1024 * 1024) as ws:
        cdp = CDP(ws)
        await cdp.call("Page.enable")

        before = await cdp.evaluate(
            "(()=>{const m=window.getLAppAdapter().getModel();"
            "const a=m._modelMatrix.getArray();"
            "return JSON.stringify({tx:+a[12].toFixed(3),ty:+a[13].toFixed(3)})})()")
        print("before:", before)

        # 网格定位人物
        located = await cdp.evaluate(
            "(()=>{const ht=window.__live2dHitTest;if(!ht)return null;"
            "for(let y=60;y<700;y+=20){for(let x=60;x<370;x+=20){"
            "if(ht(x,y))return JSON.stringify({x,y})}}return null})()")
        if not located:
            print("FAIL: 未定位到人物")
            sys.exit(1)
        hit = json.loads(located)
        print(f"定位到人物: ({hit['x']},{hit['y']})")

        # 命中点起拖，向左下拖 120px
        await cdp.drag(hit["x"], hit["y"], hit["x"] - 120, hit["y"] + 60)
        await asyncio.sleep(1.0)

        after = await cdp.evaluate(
            "(()=>{const m=window.getLAppAdapter().getModel();"
            "const a=m._modelMatrix.getArray();"
            "return JSON.stringify({tx:+a[12].toFixed(3),ty:+a[13].toFixed(3)})})()")
        print("after:", after)

        b, a = json.loads(before), json.loads(after)
        moved = abs(a["tx"] - b["tx"]) > 0.02 or abs(a["ty"] - b["ty"]) > 0.02
        print("DRAG RESULT:", "PASS（模型随拖动移动）" if moved else "FAIL（模型未动）")

        # 拖回原位，避免影响后续
        await cdp.drag(hit["x"] - 120, hit["y"] + 60, hit["x"], hit["y"])
        sys.exit(0 if moved else 1)

asyncio.run(main())
