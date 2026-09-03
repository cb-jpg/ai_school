"""登录门禁 + 角色区分 + 每账号历史隔离 端到端验证（在服务器本机跑）

用法: .venv/bin/python3 login_e2e_test.py <access_token>
覆盖:
  1. admin 登录            2. admin 创建 user 角色
  3. user 登录 + /me       4. user 调知识库管理 API → 403
  5. WS 伪造 user_token → 拒绝(1008)
  6. WS 合法 user_token 对话 → 历史落 users/<name>/ 目录
  7. WS 无 user_token（旧浏览器行为）→ 仍可连（共享历史）
"""

import asyncio
import json
import sys
import urllib.request
import uuid

import websockets

BASE = "http://localhost:12393"
WS = "ws://localhost:12393/client-ws"
USER_NAME = "teacher01"
USER_PASS = "Shishi@2026"


def http(method: str, path: str, body: dict | None = None, token: str | None = None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}


async def try_connect(url: str, timeout: float = 10):
    try:
        async with websockets.connect(url) as ws:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=2)
                return "CONNECTED", msg[:60]
            except asyncio.TimeoutError:
                return "CONNECTED", "(no message)"
    except Exception as e:
        return "REJECTED", f"{type(e).__name__}: {e}"


async def create_history(url: str, timeout: float = 10):
    """连 WS 发 create-new-history（前端开新会话同款指令），返回是否成功。"""
    async with websockets.connect(url, max_size=50 * 1024 * 1024) as ws:
        await ws.send(json.dumps({
            "type": "create-new-history",
            "client_uid": str(uuid.uuid4())[:8],
        }))
        start = asyncio.get_event_loop().time()
        while asyncio.get_event_loop().time() - start < timeout:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
            except asyncio.TimeoutError:
                return False
            try:
                m = json.loads(raw)
            except json.JSONDecodeError:
                continue
            # 服务端确认消息类型为 new-history-created（带 history_uid）
            if m.get("type") == "new-history-created":
                return True
        return False


async def conversation(url: str, timeout: float):
    """连 WS 发一句话，等回复。返回是否拿到 full-text。"""
    async with websockets.connect(url, max_size=50 * 1024 * 1024) as ws:
        client_uid = str(uuid.uuid4())[:8]
        await ws.send(json.dumps({
            "type": "text-input",
            "text": "你好",
            "client_uid": client_uid,
        }))
        start = asyncio.get_event_loop().time()
        while asyncio.get_event_loop().time() - start < timeout:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
            except asyncio.TimeoutError:
                return False
            try:
                m = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if m.get("type") == "full-text":
                return True
        return False


async def main():
    access = sys.argv[1]
    t = lambda p: f"{p}{'&' if '?' in p else '?'}token={access}"
    results = []

    def check(name, ok, detail=""):
        results.append((name, ok))
        print(f"{'PASS' if ok else 'FAIL'} | {name} {detail}")

    # 1. admin 登录
    code, body = http("POST", t("/api/auth/login"), {"username": "admin", "password": "pN7As2YmrIpc1Js5"})
    admin_jwt = body.get("token", "")
    check("admin 登录", code == 200 and admin_jwt, f"({code})")

    # 2. 创建/确保 user 账号存在（已存在则跳过创建）
    code, body = http("POST", t("/api/auth/users"),
                      {"username": USER_NAME, "password": USER_PASS, "role": "user"}, token=admin_jwt)
    check("创建 user 账号", code in (200, 400), f"({code})")  # 400=已存在也视为通过

    # 3. user 登录 + /me
    code, body = http("POST", t("/api/auth/login"), {"username": USER_NAME, "password": USER_PASS})
    user_jwt = body.get("token", "")
    role_ok = False
    if user_jwt:
        code2, me = http("GET", t("/api/auth/me"), token=user_jwt)
        role_ok = me.get("role") == "user"
    check("user 登录 + 角色正确", bool(user_jwt) and role_ok)

    # 4. user 调知识库管理 API → 403
    code, _ = http("GET", t("/api/knowledge/list"), token=user_jwt)
    check("user 调知识库 API 被拒(403)", code == 403, f"({code})")

    # 5. WS 伪造 user_token → 拒绝（HTTP 403 握手拒绝，或 WS close 1008，都算拒）
    state, detail = await try_connect(f"{t(WS)}&user_token=FAKE.TOKEN.HERE")
    check("WS 伪造 user_token 被拒", state == "REJECTED", f"({detail[:60]})")

    # 6. WS 合法 user_token：建历史 + 对话 → 历史落 users/ 目录
    created = await create_history(f"{t(WS)}&user_token={user_jwt}")
    ok = await conversation(f"{t(WS)}&user_token={user_jwt}", timeout=90)
    check("user WS 对话有回复", ok, f"(建历史={'OK' if created else 'no-ack'})")

    # 7. WS 无 user_token（旧浏览器路径）→ 仍可连
    state, detail = await try_connect(t(WS))
    check("旧无身份连接仍可用", state == "CONNECTED", f"({detail[:40]})")

    print("\n== 文件系统抽查: users/ 目录 ==")
    import subprocess
    out = subprocess.run(
        ["find", "chat_history", "-path", "*users/" + USER_NAME, "-name", "*.json"],
        capture_output=True, text=True)
    files = [l for l in out.stdout.splitlines() if l.strip()]
    check("user 历史落 users/%s/ 目录" % USER_NAME, len(files) > 0, f"({len(files)} 个文件)")

    failed = [n for n, ok in results if not ok]
    print(f"\n== 结果: {len(results) - len(failed)}/{len(results)} PASS ==")
    if failed:
        print("FAILED:", *failed, sep="\n  - ")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
