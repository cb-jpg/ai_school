"""菜单 X 关闭按钮实测: 打开菜单 → 真实触摸点 X 位置 → 看菜单是否关闭
用法: python cdp_menu_x_test.py <cdp_port>
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
            msg = json.loads(await asyncio.wait_for(self.ws.recv(), timeout))
            if msg.get("id") == rid:
                return msg.get("result")

    async def evaluate(self, expr, timeout=30):
        res = await self.call("Runtime.evaluate",
                              {"expression": expr, "returnByValue": True,
                               "awaitPromise": True}, timeout)
        return res.get("result", {}).get("value")

    async def tap(self, x, y):
        await self.call("Input.dispatchTouchEvent", {
            "type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 1}]})
        await asyncio.sleep(0.08)
        await self.call("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})


async def main():
    page = next(t for t in http_json("/json") if t.get("type") == "page")
    async with websockets.connect(page["webSocketDebuggerUrl"], max_size=50 * 1024 * 1024) as ws:
        cdp = CDP(ws)
        await cdp.call("Page.enable")

        menu_state = "(()=>{const m=[...document.querySelectorAll('div')].find(d=>{const s=getComputedStyle(d); return s.position==='fixed'&&+s.zIndex===40}); return m?getComputedStyle(m).opacity:'gone'})()"

        # 1. 打开菜单
        await cdp.evaluate(
            "(()=>{const b=[...document.querySelectorAll('button')].find(b=>/menu/i.test(b.getAttribute('aria-label')||'')); if(b)b.click(); return 1})()")
        await asyncio.sleep(1.5)
        print("打开后 opacity:", await cdp.evaluate(menu_state))

        # 2. 找到 X 的坐标, 看该点最顶层元素是谁
        info = await cdp.evaluate(
            "(()=>{const m=[...document.querySelectorAll('div')].find(d=>{const s=getComputedStyle(d); return s.position==='fixed'&&+s.zIndex===40}); if(!m)return null; const c=m.querySelector('button'); if(!c)return null; const r=c.getBoundingClientRect(); const cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2); const t=document.elementFromPoint(cx,cy); const al=t.closest('button')?(t.closest('button').getAttribute('aria-label')||''):(t.tagName); return JSON.stringify({cx,cy,top:al})})()")
        if not info:
            print("找不到菜单 X")
            sys.exit(1)
        hit = json.loads(info)
        print(f"X 位置 ({hit['cx']},{hit['cy']}) 顶层元素: {hit['top']}")

        # 3. 真实触摸点它
        await cdp.tap(hit["cx"], hit["cy"])
        await asyncio.sleep(1.5)
        after = await cdp.evaluate(menu_state)
        print("点击后 opacity:", after)
        print("RESULT:", "PASS（菜单关闭）" if after in ("0", "gone") else "FAIL（菜单没关）")

asyncio.run(main())
