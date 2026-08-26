"""冒烟探活：GET /health、/api/auth/me(未登录应 401)、/api/knowledge/list(未登录应 401)。"""
import json
import sys
import urllib.request
import urllib.error

BASE = "http://localhost:12393"


def probe(path: str, token: str = None) -> None:
    req = urllib.request.Request(BASE + path)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8", "replace")
            print(f"[{resp.status}] {path} -> {body[:300]}")
            return json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        print(f"[{e.code}] {path} -> {e.read().decode('utf-8', 'replace')[:300]}")
    except Exception as e:
        print(f"[ERR] {path} -> {e}")
    return None


if __name__ == "__main__":
    probe("/health")
    probe("/api/auth/me")
    probe("/api/knowledge/list")
    # 登录冒烟：admin 初始密码在 data/auth/initial_admin_password.txt
    from pathlib import Path
    pw_file = Path(__file__).resolve().parents[1] / "data" / "auth" / "initial_admin_password.txt"
    if not pw_file.exists():
        # UserStore 懒加载：先来一次失败登录触发 admin 引导
        data = json.dumps({"username": "admin", "password": "bootstrap-trigger"}).encode()
        req = urllib.request.Request(
            BASE + "/api/auth/login", data=data,
            headers={"Content-Type": "application/json"},
        )
        try:
            urllib.request.urlopen(req, timeout=10)
        except urllib.error.HTTPError as e:
            print(f"[{e.code}] bootstrap login attempt (expected 401)")
        except Exception as e:
            print(f"[ERR] bootstrap login attempt -> {e}")
    if pw_file.exists():
        password = pw_file.read_text(encoding="utf-8").strip()
        data = json.dumps({"username": "admin", "password": password}).encode()
        req = urllib.request.Request(
            BASE + "/api/auth/login", data=data,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                body = json.loads(resp.read().decode())
                print(f"[{resp.status}] /api/auth/login -> token ok={bool(body.get('token'))}, user={body.get('user')}")
                token = body.get("token")
            if token:
                probe("/api/auth/me", token)
                probe("/api/knowledge/list", token)
        except urllib.error.HTTPError as e:
            print(f"[{e.code}] /api/auth/login -> {e.read().decode('utf-8', 'replace')[:200]}")
        except Exception as e:
            print(f"[ERR] /api/auth/login -> {e}")
    else:
        print("(no initial password file; skip login smoke)")
