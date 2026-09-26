"""v3 灌库执行器（2026-09-26）：执行 build_v3_seed.py 产出的 v3_seed_plan.json。

- replaces：先 DELETE 旧标题条目，再 CREATE 新条目（新标题已存在则视为已完成）
- creates：标题已存在则跳过（幂等可续传）
- 铁律复用 seed_via_api：ssh 健康开窗、每条 1.5s、连续 2 失败中止、
  每 5 条健康复查、4xx 不重试 5xx 重试一次
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")

from seed_via_api import BASE, REQ_TIMEOUT, SLEEP_BETWEEN, health_check, log, make_session

PLAN = Path(__file__).resolve().parent / "v3_seed_plan.json"
HEALTH_EVERY = 5


def create_one(s, e) -> None:
    payload = {
        "title": e["title"][:200],
        "category": e["category"],
        "tags": e.get("tags", []),
        "summary": (e.get("summary") or "")[:200],
        "content": e["content"],
    }
    err = None
    for attempt in (1, 2):
        try:
            r = s.post(f"{BASE}/api/knowledge/create", json=payload, timeout=REQ_TIMEOUT)
            if r.status_code == 200:
                return None
            err = f"HTTP {r.status_code}: {r.text[:200]}"
            if r.status_code < 500:
                break
        except Exception as exc:
            err = str(exc)[:120]
        if attempt == 1:
            time.sleep(10)
    return err


def main():
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    log(f"载入计划：替换 {len(plan['replaces'])} 条，新建 {len(plan['creates'])} 条")

    ok, desc, _ = health_check()
    log(f"开窗前服务器状态：{desc}")
    if not ok:
        sys.exit("服务器余量不足，按铁律不开窗。稍后再跑（幂等可续传）。")

    s = make_session()
    listed = s.get(f"{BASE}/api/knowledge/list", params={"include_archived": "true"}, timeout=30)
    listed.raise_for_status()
    by_title = {item["title"]: item["id"] for item in listed.json()}
    log(f"服务器现有 {len(by_title)} 条")

    done, failed = 0, []
    consec_fail = 0
    actions = [("replace", r) for r in plan["replaces"]] + [("create", c) for c in plan["creates"]]
    t0 = time.time()
    for i, (kind, item) in enumerate(actions, 1):
        entry = item["entry"] if kind == "replace" else item
        new_title = entry["title"][:200]
        same_title = kind == "replace" and item["match_title"] == new_title
        if new_title in by_title and not same_title:
            log(f"[{i}/{len(actions)}] 跳过（新标题已存在）「{new_title}」")
            continue
        if kind == "replace":
            old_id = by_title.get(item["match_title"])
            if old_id:
                r = s.delete(f"{BASE}/api/knowledge/{old_id}", timeout=30)
                log(f"[{i}/{len(actions)}] 删除旧条目「{item['match_title']}」：HTTP {r.status_code}")
                by_title.pop(item["match_title"], None)
                time.sleep(SLEEP_BETWEEN)
        err = create_one(s, entry)
        if err is None:
            done += 1
            consec_fail = 0
            by_title[new_title] = "just-created"
            log(f"[{i}/{len(actions)}] OK「{new_title}」{len(entry['content'])}字 累计{time.time()-t0:.0f}s")
            time.sleep(SLEEP_BETWEEN)
        else:
            failed.append((new_title, err))
            consec_fail += 1
            log(f"[{i}/{len(actions)}] 失败「{new_title}」：{err}")
            if consec_fail >= 2:
                log("❌ 连续 2 条失败，中止（重跑可续传）")
                sys.exit(3)
        if i % HEALTH_EVERY == 0:
            ok, desc, _ = health_check()
            log(f"健康检查：{desc}（已完成 {done} 条）")
            if not ok:
                log("❌ 服务器余量不足，中止（重跑可续传）")
                sys.exit(2)

    log(f"\n完成：执行 {done} 条，失败 {len(failed)} 条，耗时 {time.time()-t0:.0f}s")
    for t, why in failed:
        log(f"  失败: {t} — {why}")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
