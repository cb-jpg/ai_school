"""T4 离线单测：URL 抓取边界处理（非法 scheme / 非 HTML / 超时文案 / 正常网页）。

输出全部落临时目录 data/knowledge/test-url-tmp，测试结束删除。
"""
import asyncio
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

TMP_DIR = ROOT / "data" / "knowledge" / "test-url-tmp"

passed, failed = [], []


def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))


async def main():
    from src.open_llm_vtuber.knowledge.document_processor import DocumentProcessor
    from src.open_llm_vtuber.knowledge.models import KnowledgeCategory, KnowledgeStatus

    proc = DocumentProcessor(knowledge_dir=str(TMP_DIR))

    print("[1] 非法 scheme")
    entry, chunks = await proc.process_url(
        "file:///C:/Windows/win.ini", None, KnowledgeCategory.OTHER, []
    )
    check("file:// 被拒", entry.status == KnowledgeStatus.ERROR and "http" in (entry.error_message or ""),
          f"msg={entry.error_message}")

    entry, _ = await proc.process_url("不是链接", None, KnowledgeCategory.OTHER, [])
    check("非 URL 被拒", entry.status == KnowledgeStatus.ERROR)

    print("[2] 非 HTML 直链（PDF）")
    entry, _ = await proc.process_url(
        "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        None, KnowledgeCategory.OTHER, [],
    )
    check("PDF 直链给出明确提示",
          entry.status == KnowledgeStatus.ERROR and "上传" in (entry.error_message or ""),
          f"msg={(entry.error_message or '')[:60]}")

    print("[3] 正常网页抓取")
    entry, chunks = await proc.process_url(
        "https://www.baidu.com", None, KnowledgeCategory.SCHOOL_INTRO, ["测试"]
    )
    check("抓取成功入库", entry.status == KnowledgeStatus.INDEXED, f"chunks={len(chunks)}")
    check("自动提取标题", bool(entry.title) and entry.title != "https://www.baidu.com",
          f"title={entry.title!r}")
    check("生成了摘要", bool(entry.summary))

    print()
    print(f"RESULT: {len(passed)} passed, {len(failed)} failed")
    if failed:
        print("FAILED:", *failed, sep="\n  - ")
        sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    finally:
        shutil.rmtree(TMP_DIR, ignore_errors=True)  # 清理测试自身的产物
