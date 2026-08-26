"""T3 接口探针：未命中/低置信真数据 + 路由顺序修复验证。"""
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

BASE = "http://localhost:12393"
ROOT = Path(__file__).resolve().parents[1]

passed, failed = [], []


def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))


def call(path, token=None):
    req = urllib.request.Request(BASE + path)
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
    except Exception as e:
        return -1, {"error": str(e)}


def main():
    # 登录
    password = (ROOT / "data" / "auth" / "initial_admin_password.txt").read_text(encoding="utf-8").strip()
    data = json.dumps({"username": "admin", "password": password}).encode()
    req = urllib.request.Request(BASE + "/api/auth/login", data=data,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        token = json.loads(resp.read().decode())["token"]

    print("[1] 路由顺序修复：/unanswered 与 /low-confidence 不再被 /{entry_id} 吞掉")
    code, ua = call("/api/knowledge/unanswered", token)
    check("GET /unanswered 200", code == 200, f"code={code}")
    check("返回列表（非 404 detail）", isinstance(ua, list), f"type={type(ua).__name__}")
    code, lc = call("/api/knowledge/low-confidence", token)
    check("GET /low-confidence 200", code == 200, f"code={code}")

    print("[2] 真数据：单测写入的记录出现在接口里")
    check("未命中含校歌问题", any(i["question"] == "学校的校歌歌词是什么？" for i in ua),
          f"n={len(ua)}")
    item = next((i for i in lc if i["question"] == "学校的食堂饭菜价格怎么样？"), None)
    check("低置信含食堂问题", bool(item), f"n={len(lc)}")
    check("低置信带分数", bool(item) and 0 < item.get("confidence_score", 0) < 0.5,
          f"score={item and item.get('confidence_score')}")

    print("[3] /stats 汇总接真数据")
    code, stats = call("/api/knowledge/stats", token)
    check("GET /stats 200", code == 200)
    check("stats 未命中非 mock", any(i["question"] == "学校的校歌歌词是什么？"
                                      for i in stats.get("recent_unanswered", [])))

    print("[4] 详情路由仍然工作（挪到文件末尾后）")
    code, lst = call("/api/knowledge/list", token)
    entry_id = lst[0]["id"] if lst else None
    code, detail = call(f"/api/knowledge/{entry_id}", token)
    check("GET /{entry_id} 200", code == 200 and detail.get("id") == entry_id, f"code={code}")
    check("详情含 chunks", isinstance(detail.get("chunks"), list))

    print("[5] 未登录仍被拦")
    code, _ = call("/api/knowledge/unanswered")
    check("未登录 401", code == 401, f"code={code}")

    print()
    print(f"RESULT: {len(passed)} passed, {len(failed)} failed")
    if failed:
        print("FAILED:", *failed, sep="\n  - ")
        sys.exit(1)


if __name__ == "__main__":
    main()
