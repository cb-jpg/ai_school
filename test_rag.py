"""
RAG 模块测试脚本

验证向量存储、文档处理、检索功能是否正常工作。
"""

import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from school_rag import SchoolKnowledgeBase, DocumentProcessor, VectorStore
from loguru import logger


def test_vector_store():
    """测试向量存储"""
    print("\n=== 测试向量存储 ===")

    vector_store = VectorStore()

    # 测试添加文档
    test_docs = [
        "学校创办于1958年，位于北京市海淀区。",
        "学校现有教师120人，其中高级教师30人。",
        "学校图书馆藏书5万册，每周一至周五开放。",
    ]

    test_metadatas = [
        {"category": "校史", "title": "学校创办"},
        {"category": "教师", "title": "教师队伍"},
        {"category": "校园", "title": "图书馆"},
    ]

    doc_ids = vector_store.add_documents(test_docs, test_metadatas)
    print(f"[OK] 添加了 {len(doc_ids)} 个文档")

    # 测试搜索
    results = vector_store.search("学校有多少老师？", n_results=2)
    print(f"[OK] 搜索结果: {len(results)} 条")
    for result in results:
        print(f"  - {result['document'][:50]}... (相关度: {result.get('score', 0):.2f})")

    # 测试统计
    count = vector_store.count()
    print(f"[OK] 文档总数: {count}")

    # 清理
    vector_store.delete(ids=doc_ids)
    print("[OK] 清理测试数据完成")

    return True


def test_document_processor():
    """测试文档处理器"""
    print("\n=== 测试文档处理器 ===")

    processor = DocumentProcessor()

    # 测试文本切分
    test_text = """
    学校概况
    XX中学是一所全日制普通高级中学，创办于1958年。
    学校占地100亩，建筑面积5万平方米。

    办学理念
    学校秉承"以人为本，全面发展"的办学理念，
    注重学生综合素质培养。

    师资队伍
    学校现有教职工150人，其中专任教师120人，
    特级教师3人，高级教师50人。
    """

    chunks = processor.split_text_into_chunks(test_text)
    print(f"[OK] 文本切分: {len(chunks)} 个块")
    for i, chunk in enumerate(chunks):
        print(f"  块{i+1}: {len(chunk)} 字符 - {chunk[:30]}...")

    return True


def test_knowledge_base():
    """测试知识库管理"""
    print("\n=== 测试知识库管理 ===")

    kb = SchoolKnowledgeBase()

    # 测试添加文档
    doc_ids = kb.add_document(
        text="XX中学创办于1958年，位于北京市海淀区，是一所全日制普通高级中学。",
        category="校史",
        title="学校简介",
    )
    print(f"[OK] 添加文档: {len(doc_ids)} 个块")

    # 测试检索
    result = kb.retrieve_with_rag("学校什么时候创办的？")
    print(f"[OK] RAG 检索: {result['has_results']}")
    if result['has_results']:
        print(f"  检测到分类: {result.get('detected_category')}")
        print(f"  找到 {len(result['results'])} 条相关资料")

    # 测试统计
    stats = kb.get_statistics()
    print(f"[OK] 知识库统计: {stats['total_documents']} 个文档")

    # 清理
    kb.delete_document(category="校史", title="学校简介")
    print("[OK] 清理测试数据完成")

    return True


def main():
    """运行所有测试"""
    print("=" * 50)
    print("RAG 模块功能测试")
    print("=" * 50)

    try:
        test_vector_store()
        test_document_processor()
        test_knowledge_base()

        print("\n" + "=" * 50)
        print("[OK] 所有测试通过！")
        print("=" * 50)

    except Exception as e:
        print(f"\n[FAILED] 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
