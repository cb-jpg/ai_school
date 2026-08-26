"""T3 离线单测：RAG 服务（检索/增强/未命中记录/重启回载）。

用法（仓库根目录）：
  HF_HUB_OFFLINE=1 HF_HOME=D:/srp_project/ai-school/.hf-cache \
    .venv/Scripts/python.exe verification/test_rag_service.py
"""
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

passed, failed = [], []


def check(name: str, cond: bool, detail: str = ""):
    (passed if cond else failed).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))


async def main():
    from src.open_llm_vtuber.knowledge.rag_service import (
        get_rag_service, get_question_log,
    )
    from src.open_llm_vtuber.knowledge.vector_store import VectorStore
    from src.open_llm_vtuber.knowledge.models import KnowledgeStatus

    svc = get_rag_service()

    print("[1] 关键词触发")
    check("学校问题触发检索", svc.needs_rag_retrieval("学校是什么时候创办的？"))
    check("无关问题不触发", not svc.needs_rag_retrieval("今天天气怎么样"))
    check("空输入不触发", not svc.needs_rag_retrieval(""))

    print("[2] 检索与增强（种子条目：石实实验学校简介）")
    r1 = await svc.retrieve_and_enrich_input("学校是什么时候创办的？")
    check("命中知识", r1["has_context"], f"docs={len(r1['retrieved_docs'])}")
    check("增强 prompt 含资料", "相关学校资料" in r1["enriched_query"] and "1999" in r1["enriched_query"])
    check("docs 带标题", all(d.get("title") for d in r1["retrieved_docs"]))

    print("[3] 低置信与未命中记录")
    # 3a 集成路径：食堂问题 ~0.32 分 → 命中但低于 0.5 → 记为低置信
    r2 = await svc.retrieve_and_enrich_input("学校的食堂饭菜价格怎么样？")
    low = get_question_log().get_low_confidence()
    item = next((i for i in low if i["question"] == "学校的食堂饭菜价格怎么样？"), None)
    check("弱命中仍增强（分数 0.3~0.5）", r2["has_context"],
          f"best={r2['retrieved_docs'][0]['score'] if r2['retrieved_docs'] else 'n/a'}")
    check("低置信问题已记录", bool(item), f"score={item and item['score']}")
    check("低置信记录含次数", bool(item) and item["count"] >= 1)

    # 3b 单元路径：完全未命中（无任何条目可检索时也走同一记录函数）
    log = get_question_log()
    log.record_unanswered("学校的校歌歌词是什么？")
    log.record_unanswered("学校的校歌歌词是什么？")
    ua = next((i for i in log.get_unanswered() if i["question"] == "学校的校歌歌词是什么？"), None)
    check("未命中问题已记录", bool(ua))
    check("重复提问累加次数", bool(ua) and ua["count"] == 2, f"count={ua and ua['count']}")
    check("记录含时间", bool(ua) and "last_asked" in ua)

    print("[4] 重启回载（新建 VectorStore 实例立即检索）")
    fresh = VectorStore(knowledge_dir=str(ROOT / "data" / "knowledge"))
    hits = fresh.search("石实实验学校的荣誉", top_k=3, min_score=0.3)
    check("新实例可检索", len(hits) >= 1, f"hits={len(hits)}")
    entry_ids = fresh._searchable_entry_ids() if hasattr(fresh, "_searchable_entry_ids") else None
    _ = entry_ids
    check("回载后 embedding 索引非空", len(fresh._embeddings_index) > 0,
          f"embeddings={len(fresh._embeddings_index)}")

    print("[5] 可检索范围（状态过滤）")
    ids = svc._searchable_entry_ids()
    from src.open_llm_vtuber.knowledge.crud import get_knowledge_crud
    for e in get_knowledge_crud().get_all(include_archived=True):
        if e.status in (KnowledgeStatus.INDEXED, KnowledgeStatus.PUBLISHED):
            check(f"条目 {e.title[:12]}({e.status}) 可检索", e.id in ids)
        else:
            check(f"条目 {e.title[:12]}({e.status}) 不可检索", e.id not in ids)

    print()
    print(f"RESULT: {len(passed)} passed, {len(failed)} failed")
    if failed:
        print("FAILED:", *failed, sep="\n  - ")
        sys.exit(1)


if __name__ == "__main__":
    os.chdir(ROOT)  # knowledge 模块用相对路径 data/knowledge
    asyncio.run(main())
