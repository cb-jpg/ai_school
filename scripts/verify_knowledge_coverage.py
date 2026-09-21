"""知识库全量覆盖校验（2026-09-21）

逐条验证服务器知识库（data/knowledge，现 220 条）：
  1. 拉取全部条目 → 统计状态分布、重复标题
  2. 与本地清单 merged_v2.json 对账（清单里的每一条是否都在库；库里的多出项列出）
  3. 逐条用【条目标题】调 /api/knowledge/search（与对话 RAG 同一条检索路径），
     top_k=5 内出现同标题块 = 检索命中；未命中的输出清单
  4. 报告落盘 scripts/knowledge_data/coverage_report.json

用法: python scripts/verify_knowledge_coverage.py [--concurrency 4]
凭据：scripts/knowledge_data/.seed_auth（admin 账号）+ frontend/.env.web.local（访问令牌）
"""
import io
import json
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

if hasattr(sys.stdout, "reconfigure"):  # GBK 控制台防 ✓/❌ 编码崩
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HERE = Path(__file__).resolve().parent
BASE = "http://183.36.243.124:12393"
AUTH_FILE = HERE / "knowledge_data" / ".seed_auth"
TOKEN_FILE = HERE.parent / "frontend" / ".env.web.local"
MERGED_V2 = HERE / "knowledge_data" / "merged_v2.json"
REPORT = HERE / "knowledge_data" / "coverage_report.json"

_print_lock = threading.Lock()


def log(msg: str) -> None:
    with _print_lock:
        print(msg, flush=True)


def load_access_token() -> str:
    for line in io.open(TOKEN_FILE, encoding="utf-8"):
        if "VITE_ACCESS_TOKEN" in line and "=" in line:
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError(f"no VITE_ACCESS_TOKEN in {TOKEN_FILE}")


def load_auth() -> tuple[str, str]:
    lines = [l.strip() for l in io.open(AUTH_FILE, encoding="utf-8") if l.strip()]
    return lines[0], lines[1]  # username, password


def make_session() -> requests.Session:
    username, password = load_auth()
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"username": username, "password": password},
        headers={"X-Access-Token": load_access_token()},
        timeout=30,
    )
    r.raise_for_status()
    jwt = r.json()["token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {jwt}", "X-Access-Token": load_access_token()})
    return s


def main() -> int:
    concurrency = 4
    if "--concurrency" in sys.argv:
        concurrency = int(sys.argv[sys.argv.index("--concurrency") + 1])

    s = make_session()
    log("✓ 登录成功")

    listed = s.get(f"{BASE}/api/knowledge/list", params={"include_archived": "true"}, timeout=60)
    listed.raise_for_status()
    entries = listed.json()
    log(f"库内条目总数: {len(entries)}")

    status_counts: dict[str, int] = {}
    for e in entries:
        status_counts[e.get("status", "?")] = status_counts.get(e.get("status", "?"), 0) + 1
    log(f"状态分布: {status_counts}")

    titles = [e.get("title", "") for e in entries]
    dup_titles = sorted({t for t in titles if titles.count(t) > 1})
    if dup_titles:
        log(f"⚠️ 重复标题 {len(dup_titles)} 个: {dup_titles}")

    # —— 清单对账（merged_v2.json 206 条 vs 库）——
    inventory_missing = []
    inventory_total = 0
    if MERGED_V2.exists():
        inv = json.load(io.open(MERGED_V2, encoding="utf-8"))
        if isinstance(inv, dict):
            inv = inv.get("entries", [])
        inv_titles = [item.get("title", "") for item in inv]
        inventory_total = len(inv_titles)
        db_title_set = set(titles)
        inventory_missing = [t for t in inv_titles if t not in db_title_set]
        db_only = [t for t in titles if t not in set(inv_titles)]
        log(f"清单条目 {inventory_total}，未入库 {len(inventory_missing)}；库内清单外条目 {len(db_only)}")
        if inventory_missing:
            log(f"⚠️ 清单未入库: {inventory_missing}")
        if db_only:
            log(f"库内清单外: {db_only}")

    # —— 逐条检索校验（仅 published/indexed 状态；archived 跳过并记录）——
    to_check = [e for e in entries if e.get("status") != "archived"]
    skipped = [e["title"] for e in entries if e.get("status") == "archived"]
    results: dict[str, dict] = {}
    done = 0

    def check(entry: dict) -> tuple[str, dict]:
        title = entry.get("title", "")
        try:
            r = s.post(f"{BASE}/api/knowledge/search",
                       json={"query": title, "top_k": 5}, timeout=90)
            r.raise_for_status()
            docs = r.json().get("results", [])
            hit_titles = [d.get("title", "") for d in docs]
            hit = any(t == title or title in t or t in title for t in hit_titles if t)
            best = docs[0] if docs else None
            return title, {
                "hit": hit, "top": hit_titles[:2],
                "score": round(best["score"], 3) if best else None,
            }
        except Exception as exc:  # noqa: BLE001
            return title, {"hit": False, "error": str(exc)[:200]}

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futs = {pool.submit(check, e): e for e in to_check}
        for fut in as_completed(futs):
            title, info = fut.result()
            results[title] = info
            done += 1
            if done % 40 == 0 or done == len(to_check):
                log(f"… {done}/{len(to_check)} 已检 ({time.time()-t0:.0f}s)")

    misses = sorted(t for t, i in results.items() if not i.get("hit"))
    errors = sorted(t for t, i in results.items() if i.get("error"))
    log("=" * 50)
    log(f"检索校验: {len(to_check) - len(misses)}/{len(to_check)} 命中"
        f"（archived 跳过 {len(skipped)}）")
    if misses:
        log(f"❌ 未命中 {len(misses)} 条:")
        for t in misses:
            log(f"  - {t} | {results[t].get('top') or results[t].get('error')}")
    else:
        log("✅ 全部条目检索命中")

    scores = sorted(i["score"] for i in results.values() if i.get("score") is not None)
    if scores:
        log(f"首块相似度: min={scores[0]}, p10={scores[len(scores)//10]}, med={scores[len(scores)//2]}")

    report = {
        "ts": time.strftime("%Y-%m-%d %H:%M:%S"),
        "base": BASE,
        "total_entries": len(entries),
        "status_counts": status_counts,
        "dup_titles": dup_titles,
        "inventory_total": inventory_total,
        "inventory_missing": inventory_missing,
        "search_checked": len(to_check),
        "search_misses": misses,
        "search_errors": errors,
        "archived_skipped": skipped,
        "detail": results,
    }
    io.open(REPORT, "w", encoding="utf-8").write(json.dumps(report, ensure_ascii=False, indent=1))
    log(f"报告已写入 {REPORT}")
    return 1 if (misses or inventory_missing) else 0


if __name__ == "__main__":
    sys.exit(main())
