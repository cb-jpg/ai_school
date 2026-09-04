"""验证"登录过期自动回登录页"修复（一次性 e2e）。

步骤：headless Edge 打开站点（?token= 过门禁）→ 注入伪造 kb_token/kb_user
（模拟 12h TTL 过期后的本地状态）→ 重载 → WS 握手 403 → 探活 /api/auth/me
返回 401 → 应回登录页且清除本地登录态，而不是永远"正在连接服务器"。

用法: python cdp_auth_expire_test.py <cdp_port>
前置: msedge --headless --remote-debugging-port=<port> --user-data-dir=<tmp> \
      "http://183.36.243.124:12393/?token=<访问令牌>"
"""

import asyncio
import json
import sys
import urllib.request

import websockets

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9333


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
    page = next((t for t in targets if t.get("type") == "page"
                 and "183.36.243.124" in t.get("url", "")), None)
    if not page:
        sys.exit("no app page target")
    async with websockets.connect(page["webSocketDebuggerUrl"],
                                  max_size=50 * 1024 * 1024) as ws:
        cdp = CDP(ws)
        # 注入伪造的"已过期"登录态（gate 只看 kb_user 是否存在）
        await cdp.evaluate(
            "localStorage.setItem('kb_token', 'bogus-expired-token');"
            "localStorage.setItem('kb_user', JSON.stringify({username:'admin', role:'admin'}));"
            "'injected'")
        await cdp.call("Page.enable")
        await cdp.evaluate("location.reload()")
        await asyncio.sleep(6)  # 首次握手失败(1s) + 探活 + 401 清除 + 路由切换
        kb_user = await cdp.evaluate("localStorage.getItem('kb_user')")
        kb_token = await cdp.evaluate("localStorage.getItem('kb_token')")
        text = await cdp.evaluate(
            "document.body.innerText.replace(/\\s+/g, ' ').slice(0, 300)")
        print("kb_user after test:", kb_user)
        print("kb_token after test:", kb_token)
        print("page text:", json.dumps(text, ensure_ascii=True)[:300])
        if kb_user is None and kb_token is None:
            print("PASS: 登录态已清除并回登录页")
        else:
            print("FAIL: 仍卡在旧状态")


asyncio.run(main())
