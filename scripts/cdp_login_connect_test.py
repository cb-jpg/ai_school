"""验证"App 内登录 → 自动连接 WebSocket"修复（端到端）。

headless 浏览器全新档案（无登录态）→ 打开站点 → 表单登录 admin →
观察是否自动连上 WS（页面出现"在线"/localStorage 有登录态）。
服务端交叉验证：登录后服务器日志应出现本机 IP 的 /client-ws 握手且无 403。

用法: python cdp_login_connect_test.py <cdp_port> <username> <password>
"""

import asyncio
import json
import sys
import urllib.request

import websockets

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9334
USER = sys.argv[2] if len(sys.argv) > 2 else "admin"
PASS = sys.argv[3] if len(sys.argv) > 3 else ""


def http_json(path):
    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}{path}", timeout=10) as r:
        return json.loads(r.read().decode())


class CDP:
    def __init__(self, ws):
        self.ws, self.next_id = ws, 1

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
    page = next((t for t in http_json("/json") if t.get("type") == "page"
                 and "183.36.243.124" in t.get("url", "")), None)
    if not page:
        sys.exit("no page target")
    async with websockets.connect(page["webSocketDebuggerUrl"],
                                  max_size=50 * 1024 * 1024) as ws:
        cdp = CDP(ws)
        await cdp.call("Page.enable")
        await asyncio.sleep(2)
        text = await cdp.evaluate('document.body.innerText.replace(/\\s+/g," ").slice(0,120)')
        print("初始页面:", json.dumps(text, ensure_ascii=True)[:150])

        ok = await cdp.evaluate("""
(() => {
  const setVal = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, v);
    el.dispatchEvent(new Event("input", {bubbles: true}));
  };
  const inputs = document.querySelectorAll("input");
  if (inputs.length < 2) return "no-inputs";
  setVal(inputs[0], %s);
  setVal(inputs[1], %s);
  const btn = [...document.querySelectorAll("button")].find(b => b.innerText.replace(/\\s/g,"").includes("登录"));
  if (!btn) return "no-button";
  btn.click();
  return "clicked";
})()""" % (json.dumps(USER), json.dumps(PASS)))
        print("登录操作:", ok)
        await asyncio.sleep(15)

        text2 = await cdp.evaluate('document.body.innerText.replace(/\\s+/g," ").slice(0,150)')
        print("登录后页面:", json.dumps(text2, ensure_ascii=True)[:200])
        kb = await cdp.evaluate(
            'JSON.stringify({user_set: !!localStorage.getItem("kb_user"), '
            'token_set: !!localStorage.getItem("kb_token")})')
        print("登录态:", kb)
        if "在线" in (text2 or ""):
            print("PASS: 登录后自动连接（页面显示在线）")
        else:
            print("FAIL: 登录后未见在线状态")


asyncio.run(main())
