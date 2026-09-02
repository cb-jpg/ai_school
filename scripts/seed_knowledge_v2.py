"""学校知识库灌库 v2：从学校提供的数据清单提取条目（merged.json）灌入知识库

前置: scripts/knowledge_data/merged.json（由 extract_school_data.py + Word COM 提取合并生成）
用法（服务器上）:
    cd ~/ai_school
    HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 .venv/bin/python scripts/seed_knowledge_v2.py

特性:
- 幂等：按标题去重，重复执行不灌重复条目
- 进度打印：每条完成即输出（82 万字向量化耗时较长，建议 nohup 后台跑）
- 灌完自检：典型问题检索验证
"""

import asyncio
import json
import os
import sys
import time
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src"))

from open_llm_vtuber.knowledge.crud import get_knowledge_crud  # noqa: E402
from open_llm_vtuber.knowledge.document_processor import (  # noqa: E402
    DocumentProcessor,
)
from open_llm_vtuber.knowledge.models import KnowledgeCategory  # noqa: E402
from open_llm_vtuber.knowledge.vector_store import get_vector_store  # noqa: E402

DATA = REPO_ROOT / "scripts" / "knowledge_data" / "merged.json"


async def seed() -> None:
    entries = json.loads(DATA.read_text(encoding="utf-8"))
    print(f"载入 {len(entries)} 条待灌条目")

    crud = get_knowledge_crud()
    processor = DocumentProcessor()
    store = get_vector_store()

    existing_titles = {e.title for e in crud.get_all(include_archived=True)}
    created, skipped = 0, 0
    t0 = time.time()
    for i, e in enumerate(entries, 1):
        title = e["title"]
        if title in existing_titles:
            print(f"[{i}/{len(entries)}] SKIP(已存在): {title}")
            skipped += 1
            continue
        try:
            category = KnowledgeCategory(e["category"])
        except ValueError:
            category = KnowledgeCategory.OTHER
        entry, chunks = await processor.create_manual_entry(
            title=title,
            content=e["content"],
            category=category,
            tags=e.get("tags", []),
            summary=e.get("summary", "")[:200],
            created_by="seed_v2(学校数据清单)",
        )
        crud.create(entry)
        if chunks:
            await asyncio.to_thread(store.index_chunks, entry.id, chunks)
        existing_titles.add(title)
        created += 1
        print(f"[{i}/{len(entries)}] OK: {title}（{len(chunks)} 块, "
              f"{time.time() - t0:.0f}s）", flush=True)

    print(f"\n灌库完成：新增 {created} 条，跳过 {skipped} 条，耗时 {time.time() - t0:.0f}s")


def selfcheck() -> None:
    from open_llm_vtuber.knowledge.rag_service import get_rag_service

    rag = get_rag_service()
    questions = [
        "学校的办学特色是什么？",
        "学校有哪些国家级荣誉？",
        "学校2016年有什么大事？",
        "学校作息时间是怎样安排的？",
        "学生获得过哪些信息学竞赛奖项？",
    ]
    print("\n=== 检索自检 ===")
    for q in questions:
        docs = asyncio.run(rag.search(q, top_k=3))
        if docs:
            tops = "；".join(f"{d['title']}({d['score']:.2f})" for d in docs[:2])
            print(f"[命中] {q} → {tops}")
        else:
            print(f"[未命中] {q}")


if __name__ == "__main__":
    start = time.time()
    asyncio.run(seed())
    selfcheck()
    print(f"\n总耗时 {time.time() - start:.1f}s")
