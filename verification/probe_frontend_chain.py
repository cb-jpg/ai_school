"""
前端全链路探针：vite dev(:3000) → 代理 → 后端(:12393)
验证 web 页面可访问、/health 与 /api 代理生效、登录 + token 可用、
知识库列表 / 未命中 / 低置信 / 语义检索 端点经代理全部打通。

用法（需先起后端与前端）：
  .venv/Scripts/python.exe verification/probe_frontend_chain.py
控制台中文乱码是 GBK 显示问题，不影响判定。
"""
import json
import urllib.request
import urllib.error

BASE = "http://localhost:3000"
PASS, FAIL = 0, 0


def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS  {name}  {detail}")
    else:
        FAIL += 1
        print(f"  FAIL  {name}  {detail}")


def req(path, method="GET", body=None, token=None, timeout=15):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    if body is not None:
        r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return 0, str(e)


print("[1] 页面与代理")
code, body = req("/")
check("GET / 返回页面", code == 200 and "<html" in body.lower(), f"[code={code}]")

code, body = req("/health")
check("GET /health 经代理", code == 200, f"[code={code}]")

print("[2] 登录（经代理）")
code, body = req("/api/auth/login", "POST", {"username": "admin", "password": "wrong-password"})
bootstrap_hint = "initial_admin_password" in body if code != 200 else False
code, body = req("/api/auth/login", "POST", {"username": "admin", "password": "admin12345"})
if code == 200:
    token = json.loads(body).get("token")
    check("POST /api/auth/login", True, "[token ok]")
else:
    # 密码非默认时，按引导流程读 data/auth/initial_admin_password.txt
    import pathlib
    pw_file = pathlib.Path(__file__).resolve().parents[1] / "data" / "auth" / "initial_admin_password.txt"
    real_pw = pw_file.read_text().strip() if pw_file.exists() else ""
    code, body = req("/api/auth/login", "POST", {"username": "admin", "password": real_pw})
    token = json.loads(body).get("token") if code == 200 else None
    check("POST /api/auth/login（读引导密码）", code == 200, f"[code={code}, hint={bootstrap_hint}]")

print("[3] 知识库端点（经代理，带 token）")
code, body = req("/api/knowledge/list", token=token)
check("GET /api/knowledge/list", code == 200, f"[code={code}]")

code, body = req("/api/knowledge/unanswered", token=token)
check("GET /api/knowledge/unanswered", code == 200, f"[code={code}]")

code, body = req("/api/knowledge/low-confidence", token=token)
check("GET /api/knowledge/low-confidence", code == 200, f"[code={code}]")

code, body = req("/api/knowledge/stats", token=token)
check("GET /api/knowledge/stats", code == 200, f"[code={code}]")

code, body = req("/api/knowledge/search", "POST", {"query": "石实实验学校是什么学校", "top_k": 3}, token=token)
docs = json.loads(body).get("results", []) if code == 200 else []
check("POST /api/knowledge/search", code == 200 and len(docs) > 0, f"[code={code}, hits={len(docs)}]")

print("[4] 未登录拦截（经代理）")
code, body = req("/api/knowledge/list")
check("无 token 401", code == 401, f"[code={code}]")

print(f"\nRESULT: {PASS} passed, {FAIL} failed")
raise SystemExit(1 if FAIL else 0)
