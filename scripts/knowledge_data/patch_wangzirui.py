"""修正 KB 中"王赫/王皓"识读错误 → 王梓睿（2026-09-26）。

高清重渲染招生简章 p2（dpi220）+ 荣誉台账 xls 双重确认：2024届优秀毕业生为王梓睿
（CSP2024提高组第二轮测试成绩佛山市第一）。重建 v3_seed_plan.json 后，
对本轮入庫且内容含旧误辨名的 3 条（招生简章 / 招生简章：…第2页 / 宣传栏…下篇）
执行 DELETE+CREATE 覆盖；其余条目不动。完成后需重启服务器清孤儿 chunk。
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")

from seed_via_api import BASE, log, make_session

HERE = Path(__file__).resolve().parent
plan = __import__("json").loads((HERE / "v3_seed_plan.json").read_text(encoding="utf-8"))


def pick():
    out = []
    for r in plan["replaces"]:
        t = r["entry"]["title"]
        if t == "招生简章":
            out.append(r["entry"])
    for c in plan["creates"]:
        t = c["title"]
        if "招生简章·第2页" in t or ("宣传栏" in t and "下篇" in t):
            out.append(c)
    return out


def main():
    targets = pick()
    log(f"待修正 {len(targets)} 条：{[t['title'] for t in targets]}")
    s = make_session()
    listed = s.get(f"{BASE}/api/knowledge/list", params={"include_archived": "true"}, timeout=30)
    listed.raise_for_status()
    by_title = {item["title"]: item["id"] for item in listed.json()}

    for e in targets:
        t = e["title"][:200]
        old_id = by_title.get(t)
        if old_id:
            r = s.delete(f"{BASE}/api/knowledge/{old_id}", timeout=30)
            log(f"删除旧「{t}」HTTP {r.status_code}")
            time.sleep(1.5)
        payload = {
            "title": t,
            "category": e["category"],
            "tags": e.get("tags", []),
            "summary": (e.get("summary") or "")[:200],
            "content": e["content"],
        }
        r = s.post(f"{BASE}/api/knowledge/create", json=payload, timeout=120)
        ok = r.status_code == 200
        log(f"{'OK ' if ok else 'FAIL'} 重建「{t}」HTTP {r.status_code}")
        if not ok:
            print(r.text[:300])
            sys.exit(1)
        time.sleep(1.5)
    log("完成。记得重启服务器清孤儿 chunk。")


if __name__ == "__main__":
    main()
