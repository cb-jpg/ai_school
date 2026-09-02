"""CDP 真机拖动测试:把 Live2D 人物从画布上部拖进聊天卡片区,验证新层级。

用法: python cdp_drag_test.py [port]
前置: App 在 hero 页,模型已加载
流程: 记录状态行位置 → 触摸拖动模型(向下 180px)→ 截图 → 检查输入框可点
"""

import asyncio
import base64
import json
import sys
import urllib.request

import websockets

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9222
OUT = sys.argv[2] if len(sys.argv) > 2 else "screenshots/09-02/drag_test.png"


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
            msg = json.loads(await asyncio.wait_for(self.ws.recv(), timeout))
            if msg.get("id") == rid:
                return msg.get("result")

    async def evaluate(self, expr, timeout=30):
        res = await self.call("Runtime.evaluate",
                              {"expression": expr, "returnByValue": True,
                               "awaitPromise": True}, timeout)
        return res.get("result", {}).get("value")

    async def drag(self, x0, y0, x1, y1, steps=14):
        """真机 WebView 全管线可用的触摸拖动"""
        await self.call("Input.dispatchTouchEvent", {
            "type": "touchStart",
            "touchPoints": [{"x": x0, "y": y0, "id": 1}],
        })
        for i in range(1, steps + 1):
            t = i / steps
            await self.call("Input.dispatchTouchEvent", {
                "type": "touchMove",
                "touchPoints": [{"x": x0 + (x1 - x0) * t,
                                 "y": y0 + (y1 - y0) * t, "id": 1}],
            })
            await asyncio.sleep(0.016)
        await self.call("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})


async def main():
    targets = http_json("/json")
    page = next(t for t in targets if t.get("type") == "page" and "localhost" in t.get("url", ""))
    async with websockets.connect(page["webSocketDebuggerUrl"], max_size=50 * 1024 * 1024) as ws:
        cdp = CDP(ws)
        await cdp.call("Page.enable")

        # 模型起始状态
        before = await cdp.evaluate(
            "(()=>{const m=window.getLAppAdapter&&window.getLAppAdapter().getModel();"
            "const mtx=m&&m._modelMatrix;return JSON.stringify({hasModel:!!m,"
            "tx:mtx?mtx._tr[12]:null,ty:mtx?mtx._tr[13]:null})})()", 15)
        print("before:", before)

        # 找模型当前位置(屏幕坐标):从 canvas 中心偏上开始拖(人物通常在中上部)
        dims = await cdp.evaluate(
            "(()=>{const c=document.querySelector('canvas');"
            "const r=c.getBoundingClientRect();"
            "return JSON.stringify({w:Math.round(r.width),h:Math.round(r.height)})})()", 15)
        print("canvas:", dims)
        d = json.loads(dims)
        cx, cy0 = d["w"] / 2, d["h"] * 0.35
        cy1 = cy0 + 180  # 向下拖 180px,进入聊天卡片区

        await cdp.drag(cx, cy0, cx, cy1)
        await asyncio.sleep(1.0)

        after = await cdp.evaluate(
            "(()=>{const m=window.getLAppAdapter&&window.getLAppAdapter().getModel();"
            "const mtx=m&&m._modelMatrix;return JSON.stringify({tx:mtx?mtx._tr[12]:null,"
            "ty:mtx?mtx._tr[13]:null})})()", 15)
        print("after:", after)

        # 输入框可点性:elementFromPoint 在输入框中心应命中 textarea 而非 canvas
        hit = await cdp.evaluate(
            "(()=>{const ta=document.querySelector('textarea');"
            "const r=ta.getBoundingClientRect();"
            "const el=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);"
            "return el===ta||ta.contains(el)?'textarea-clickable':'blocked by '+el.tagName})()", 15)
        print("input hit test:", hit)

        shot = await cdp.call("Page.captureScreenshot", {"format": "png"})
        with open(OUT, "wb") as f:
            f.write(base64.b64decode(shot["data"]))
        print("saved", OUT)

asyncio.run(main())
