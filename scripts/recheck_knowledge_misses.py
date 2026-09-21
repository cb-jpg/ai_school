"""二阶段复核：coverage_report.json 里的检索未命中条目

一阶段用【条目标题】作查询词，对人名/图片资料/校史类条目不自然
（真实用户会问"陈峻琦是谁"而非复述全称）。本脚本对每个未命中条目
生成多组候选查询（冒号后缀/去括号/自然问法），任一变体 top_k=5
命中该条目即算可检索；仍不中的列出并给人工判读。

用法: python scripts/recheck_knowledge_misses.py
"""
import io
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = Path(__file__).resolve().parent
BASE = "http://183.36.243.124:12393"
REPORT = HERE / "knowledge_data" / "coverage_report.json"

# 通用类条目：标题即用户会问的主题，补自然问法变体
NATURAL_Q = {
    "学校简介": ["学校简介介绍一下", "介绍一下学校", "石实实验学校是什么学校"],
    "学校概况": ["学校概况", "介绍一下学校情况"],
    "学校办学特色": ["学校有什么办学特色", "办学特色是什么"],
    "教学特色": ["学校教学有什么特色"],
    "招生简章": ["招生简章内容", "怎么招生", "招生要求是什么"],
    "学校联系方式": ["学校的电话是多少", "怎么联系学校", "学校地址在哪"],
    "推文": ["公众号推文", "学校发过什么推文"],
    "学校信息速查（校名/创办/校址/管理）": ["学校地址", "校名由来", "学校什么时候创办"],
    "学校创建时间及创建背景": ["学校什么时候创建的", "创建背景是什么"],
    "学校重要发展阶段": ["学校经历了哪些发展阶段"],
    "学校历任重要领导及相关历史信息": ["历任校长有哪些", "校长是谁"],
    "校园文化相关介绍": ["校园文化是什么"],
    "学校简介 首块": [],
}


def build_queries(title: str) -> list[str]:
    queries = [title]
    if "：" in title:
        tail = title.split("：", 1)[1].strip()
        if tail:
            queries.append(tail)
    if "：" not in title and ":" in title:
        queries.append(title.split(":", 1)[1].strip())
    # 去括号（南海区优秀学生（2026届）：陈峻琦 → 陈峻琦 已由上一条覆盖；双保险）
    no_paren = re.sub(r"[（(][^）)]*[）)]", "", title).strip()
    if no_paren and no_paren not in queries:
        queries.append(no_paren)
    queries += NATURAL_Q.get(title, [])
    # 去重保序
    seen, out = set(), []
    for q in queries:
        if q and q not in seen:
            seen.add(q)
            out.append(q)
    return out[:5]


def main() -> int:
    report = json.load(io.open(REPORT, encoding="utf-8"))
    misses = report["search_misses"]
    print(f"待复核 {len(misses)} 条")

    # 登录（同 coverage 脚本方式）
    auth = [l.strip() for l in io.open(HERE / "knowledge_data" / ".seed_auth", encoding="utf-8") if l.strip()]
    tok = ""
    for line in io.open(HERE.parent / "frontend" / ".env.web.local", encoding="utf-8"):
        if "VITE_ACCESS_TOKEN" in line and "=" in line:
            tok = line.split("=", 1)[1].strip().strip('"').strip("'")
    s0 = requests.post(f"{BASE}/api/auth/login", json={"username": auth[0], "password": auth[1]},
                       headers={"X-Access-Token": tok}, timeout=30)
    s0.raise_for_status()
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {s0.json()['token']}", "X-Access-Token": tok})

    lock_results: dict[str, dict] = {}

    def check(title: str) -> tuple[str, dict]:
        for q in build_queries(title):
            try:
                r = s.post(f"{BASE}/api/knowledge/search", json={"query": q, "top_k": 5}, timeout=90)
                r.raise_for_status()
                docs = r.json().get("results", [])
                titles = [d.get("title", "") for d in docs]
                if any(t == title or title in t or t in title for t in titles if t):
                    return title, {"ok": True, "via": q}
            except Exception as exc:  # noqa: BLE001
                return title, {"ok": False, "error": str(exc)[:150]}
        return title, {"ok": False}

    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = [pool.submit(check, t) for t in misses]
        for fut in as_completed(futs):
            title, info = fut.result()
            lock_results[title] = info

    ok = sorted(t for t, i in lock_results.items() if i.get("ok"))
    bad = sorted(t for t, i in lock_results.items() if not i.get("ok"))
    print("=" * 50)
    print(f"换自然查询后: {len(ok)}/{len(misses)} 可检索")
    for t in ok:
        print(f"  ✓ {t}  ←「{lock_results[t]['via']}」")
    if bad:
        print(f"❌ 仍不可检索 {len(bad)} 条:")
        for t in bad:
            print(f"  - {t} | tried={build_queries(t)}")
    else:
        print("✅ 全部未命中条目用自然问法均可检索——一阶段 57 条属查询词不自然，非缺库")

    io.open(HERE / "knowledge_data" / "recheck_report.json", "w", encoding="utf-8").write(
        json.dumps({"ok": ok, "bad": bad, "detail": lock_results}, ensure_ascii=False, indent=1))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
