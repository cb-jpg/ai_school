"""一次性改造（服务器跑）：给存量知识条目的分块补标题前缀

背景（2026-09-21 检索覆盖校验）：220 条全在库，但 21 条特征词只在标题的条目
（人名获奖/图片资料说明/校史节点等）检索不到——分块只含正文，标题词两路
（向量/BM25）都看不见。document_processor._chunk_text 已加 title 前缀，
本脚本把存量条目按新逻辑重切、重嵌、重建索引。

安全：逐条顺序 + 0.2s 间隔；向量库按条目落盘，run_server 靠索引 mtime
跨进程失效重建，跑完重启一次服务即可。
用法（服务器）: cd ~/ai_school && .venv/bin/python scripts/retrofit_chunk_titles.py
"""
import asyncio
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from open_llm_vtuber.knowledge.crud import get_knowledge_crud
from open_llm_vtuber.knowledge.document_processor import DocumentProcessor
from open_llm_vtuber.knowledge.vector_store import get_vector_store


async def main() -> None:
    crud = get_knowledge_crud()
    processor = DocumentProcessor()
    store = get_vector_store()

    entries = crud.get_all(include_archived=True)
    print(f"共 {len(entries)} 条待改造", flush=True)

    t0 = time.time()
    done = skipped = failed = 0
    for e in entries:
        try:
            content_file = processor.processed_dir / e.id / "content.txt"
            if not content_file.exists():
                skipped += 1
                print(f"跳过(无content.txt) {e.title}", flush=True)
                continue
            content = content_file.read_text(encoding="utf-8")
            chunks = processor._chunk_text(content, title=e.title)
            await processor._save_processed_data(e.id, content, chunks)
            ok = await asyncio.to_thread(store.index_chunks, e.id, chunks)
            crud.update(e.id, chunk_count=len(chunks))
            done += 1
            if not ok:
                failed += 1
                print(f"索引失败 {e.title}", flush=True)
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"失败 {e.title}: {exc}", flush=True)
        if done % 20 == 0:
            print(f"… {done}/{len(entries)} ({time.time() - t0:.0f}s)", flush=True)
        await asyncio.sleep(0.2)

    print(f"完成：成功 {done}，跳过 {skipped}，失败 {failed}，用时 {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
