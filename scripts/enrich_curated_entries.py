"""一次性内容增补（服务器跑）：给 3 个高频策展条目的正文补自然问法词

背景（2026-09-21 检索校验）：这些条目内容本身完整，但用户自然问法里的
关键词与正文分词错位（如问"电话"而正文只有"联系电话"，jieba 切整词），
或泛标题被同模板大条目余弦压制。在正文前补一句问法密集的引导语，
只增不删、事实不变。

用法（服务器）: cd ~/ai_school && .venv/bin/python scripts/enrich_curated_entries.py
"""
import asyncio
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from open_llm_vtuber.knowledge.crud import get_knowledge_crud
from open_llm_vtuber.knowledge.document_processor import DocumentProcessor
from open_llm_vtuber.knowledge.vector_store import get_vector_store

ENRICHED = {
    "学校联系方式": (
        "学校联系方式（学校的电话和地址）。石实实验学校联系方式：学校地址："
        "佛山市南海区大沥镇太平社区体育南路20号。学校的电话（联系电话、招生电话、"
        "咨询电话）：0757-85930080。如需到校咨询，可在工作日拨打电话预约。"
        "（信息来源：学校2024年官方宣传折页封底）"
    ),
    "学校概况": (
        "学校概况（学校情况介绍）。佛山市南海区石实实验学校（曾用名：佛山市南海区"
        "石门实验学校，简称石实实验学校）是一所全日制寄宿制民办实验学校，始建于"
        "1999年，2023年9月经南海区教育局批复更名。学校位于佛山市南海区大沥镇太平"
        "体育南路一带，由大沥镇教育办公室负责日常业务管理。办学理念是让每一个孩子"
        "都能成长、成才、成功。"
    ),
    "教学特色": (
        "教学特色（学校教学特色与办学特色介绍）。佛山市南海区石实实验学校形成了"
        "多元化的课程体系：长期重视信息学特长培养，在信息学竞赛和升学方面成绩显著；"
        "积极参与美育和艺术活动，在区级美育赛事中表现优异；将防震减灾科普教育融入"
        "日常教学；课后服务开设体育、艺术、心理等特色社团，为学生提供多样化成长平台。"
    ),
}


async def main() -> None:
    crud = get_knowledge_crud()
    processor = DocumentProcessor()
    store = get_vector_store()

    for title, content in ENRICHED.items():
        entries = [e for e in crud.get_all(include_archived=True) if e.title == title]
        if not entries:
            print(f"✗ 未找到条目：{title}", flush=True)
            continue
        e = entries[0]
        chunks = processor._chunk_text(content, title=e.title)
        await processor._save_processed_data(e.id, content, chunks)
        ok = await asyncio.to_thread(store.index_chunks, e.id, chunks)
        crud.update(e.id, chunk_count=len(chunks), summary=processor._generate_summary(content))
        print(f"{'✓' if ok else '✗'} {title}: {len(chunks)} 块已重嵌重索引", flush=True)
        await asyncio.sleep(0.2)

    print("完成。run_server 靠索引 mtime 自动失效重建，无需重启（改代码才需）", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
