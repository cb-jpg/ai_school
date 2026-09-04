"""手机 WebView 诊断：读登录态/路由，带控制台捕获重载，观察 WS 连接行为。

用法: python cdp_phone_diag.py <cdp_port>
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
        self.console = []

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
            if msg.get("method") in ("Runtime.consoleAPICalled", "Log.entryAdded",
                                     "Runtime.exceptionThrown"):
                self.console.append(msg)

    async def evaluate(self, expr, timeout=30):
        res = await self.call("Runtime.evaluate",
                              {"expression": expr, "returnByValue": True,
                               "awaitPromise": True}, timeout)
        return res.get("result", {}).get("value")


async def main():
    targets = http_json("/json")
    page = next((t for t in targets if t.get("type") == "page"
                 and "localhost" in t.get("url", "")), None)
    if not page:
        sys.exit("no page target")
    async with websockets.connect(page["webSocketDebuggerUrl"],
                                  max_size=50 * 1024 * 1024) as ws:
        cdp = CDP(ws)
        await cdp.call("Runtime.enable")
        await cdp.call("Log.enable")
        await cdp.call("Network.enable")

        state = await cdp.evaluate("""JSON.stringify({
          kb_user: localStorage.getItem('kb_user'),
          kb_token_set: !!localStorage.getItem('kb_token'),
          baseUrl: localStorage.getItem('baseUrl'),
          wsUrl: localStorage.getItem('wsUrl'),
          hash: location.hash,
        })""")
        print("BEFORE:", state)

        # WS 网络活动捕获
        ws_frames = []
        await cdp.call("Network.enable")
        # 重载并捕获 console + WS 事件
        network_ws = []
        await cdp.evaluate("""(() => {
          window.__wslog = [];
          const OrigWS = window.WebSocket;
          window.WebSocket = function(url, protos) {
            window.__wslog.push({t: Date.now(), url: String(url).slice(0, 120)});
            const w = protos !== undefined ? new OrigWS(url, protos) : new OrigWS(url);
            w.addEventListener('open', () => window.__wslog.push({t: Date.now(), ev: 'open'}));
            w.addEventListener('close', (e) => window.__wslog.push({t: Date.now(), ev: 'close', code: e.code}));
            w.addEventListener('error', () => window.__wslog.push({t: Date.now(), ev: 'error'}));
            return w;
          };
          window.WebSocket.prototype = OrigWS.prototype;
          Object.assign(window.WebSocket, {CONNECTING:0, OPEN:1, CLOSING:2, CLOSED:3});
        })()""")
        await cdp.evaluate("location.reload()")
        await asyncio.sleep(20)

        state2 = await cdp.evaluate("""JSON.stringify({
          kb_user: localStorage.getItem('kb_user'),
          kb_token_set: !!localStorage.getItem('kb_token'),
          hash: location.hash,
          wslog: (window.__wslog || []).slice(0, 10),
        })""")
        print("AFTER:", state2)
        print("\n=== CONSOLE (errors/warnings) ===")
        for m in cdp.console[-25:]:
            method = m.get("method")
            if method == "Runtime.consoleAPICalled":
                args = m["params"].get("args", [])
                text = " ".join(str(a.get("value", a.get("description", "")))[:150] for a in args)
                if m["params"].get("type") in ("error", "warning") or "error" in text.lower():
                    print(f"[{m['params'].get('type')}] {text[:220]}")
            elif method == "Runtime.exceptionThrown":
                d = m["params"].get("exceptionDetails", {})
                print(f"[exception] {json.dumps(d.get('exception', {}).get('description', d))[:220]}")
            elif method == "Log.entryAdded":
                e = m["params"]["entry"]
                if e.get("level") in ("error", "warning"):
                    print(f"[log.{e['level']}] {e.get('text','')[:220]} {e.get('url','')[:60]}")


asyncio.run(main())
