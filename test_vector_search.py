"""
Test script for knowledge base vector search functionality.
Tests both embedding-based search and fallback text search.
"""
import asyncio
import sys
import os
from pathlib import Path

# Fix Windows console encoding
if os.name == 'nt':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from open_llm_vtuber.knowledge import (
    get_embedding_model,
    get_vector_store,
    reset_vector_store,
    KnowledgeEntry,
    Chunk,
    KnowledgeCategory,
    SourceType
)


def test_embedding_model():
    """Test embedding model initialization and usage"""
    print("\n=== Testing Embedding Model ===")

    try:
        model = get_embedding_model()
        print(f"✅ Embedding model loaded successfully")
        print(f"   Model: {model.model_name}")
        print(f"   Dimension: {model.dimension}")

        # Test single text embedding
        test_text = "石实实验学校是一所优秀的学校"
        embedding = model.embed_text(test_text)
        print(f"✅ Generated embedding for test text")
        print(f"   Embedding shape: {embedding.shape}")

        # Test batch embeddings
        texts = [
            "学校历史悠久，创办于1999年",
            "学生在信息学竞赛中表现优异",
            "学校注重全面发展"
        ]
        embeddings = model.embed_texts(texts)
        print(f"✅ Generated batch embeddings")
        print(f"   Batch shape: {embeddings.shape}")

        return True

    except Exception as e:
        print(f"❌ Embedding model test failed: {e}")
        return False


def test_vector_store():
    """Test vector store with embeddings"""
    print("\n=== Testing Vector Store ===")

    try:
        # Reset any existing vector store
        reset_vector_store()

        # Create vector store with embeddings
        vector_store = get_vector_store(use_embeddings=True)
        print(f"✅ Vector store initialized with embedding support")

        # Create test chunks
        test_entry = KnowledgeEntry(
            title="石实实验学校简介",
            category=KnowledgeCategory.SCHOOL_INTRO,
            tags=["学校", "简介"],
            source_type=SourceType.MANUAL
        )

        test_chunks = [
            Chunk(
                content="石实实验学校创办于1999年，是一所致力于全人教育的现代化学校。",
                source_id=test_entry.id,
                chunk_index=0
            ),
            Chunk(
                content="学校在信息学培养方面成果显著，多位学生凭信息学特长进入清华北大等名校。",
                source_id=test_entry.id,
                chunk_index=1
            ),
            Chunk(
                content="学校坚持'以人为本，全面发展'的办学理念，注重学生综合素质培养。",
                source_id=test_entry.id,
                chunk_index=2
            )
        ]

        # Index chunks
        success = vector_store.index_chunks(test_entry.id, test_chunks)
        if success:
            print(f"✅ Successfully indexed {len(test_chunks)} chunks with embeddings")
        else:
            print(f"❌ Failed to index chunks")
            return False

        # Test vector search
        print("\n--- Testing Vector Search ---")
        queries = [
            "学校是什么时候创办的？",
            "学生在哪些方面表现优异？",
            "学校的办学理念是什么？"
        ]

        for query in queries:
            results = vector_store.search(query, top_k=2, min_score=0.3)
            print(f"\n查询: {query}")
            if results:
                for chunk, score in results:
                    print(f"   评分: {score:.3f}")
                    print(f"   内容: {chunk.content[:50]}...")
            else:
                print("   未找到相关内容")

        return True

    except Exception as e:
        print(f"❌ Vector store test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_text_search_fallback():
    """Test text search fallback when embeddings are disabled"""
    print("\n=== Testing Text Search Fallback ===")

    try:
        # Reset vector store
        reset_vector_store()

        # Create vector store without embeddings
        vector_store = get_vector_store(use_embeddings=False)
        print(f"✅ Vector store initialized without embeddings")

        # Create test chunks
        test_entry = KnowledgeEntry(
            title="测试条目",
            category=KnowledgeCategory.OTHER,
            tags=["测试"],
            source_type=SourceType.MANUAL
        )

        test_chunks = [
            Chunk(
                content="石实实验学校是全国防震减灾科普示范学校。",
                source_id=test_entry.id,
                chunk_index=0
            ),
            Chunk(
                content="学校位于佛山市，是广东省一级学校。",
                source_id=test_entry.id,
                chunk_index=1
            )
        ]

        # Index chunks
        vector_store.index_chunks(test_entry.id, test_chunks)
        print(f"✅ Indexed {len(test_chunks)} chunks (text search only)")

        # Test text search
        query = "石实实验学校的地理位置在哪里？"
        results = vector_store.search(query, top_k=2, min_score=0.2)
        print(f"\n查询: {query}")
        if results:
            for chunk, score in results:
                print(f"   评分: {score:.3f}")
                print(f"   内容: {chunk.content[:50]}...")
        else:
            print("   未找到相关内容")

        return True

    except Exception as e:
        print(f"❌ Text search fallback test failed: {e}")
        return False


async def test_knowledge_search_integration():
    """Test full knowledge search integration"""
    print("\n=== Testing Knowledge Search Integration ===")

    try:
        from open_llm_vtuber.knowledge.document_processor import DocumentProcessor
        from open_llm_vtuber.knowledge.crud import get_knowledge_crud

        # Reset vector store
        reset_vector_store()

        # Initialize components
        crud = get_knowledge_crud()
        processor = DocumentProcessor()
        vector_store = get_vector_store(use_embeddings=True)

        print(f"✅ Initialized knowledge components")

        # Create a test knowledge entry
        test_content = """
石实实验学校简介

石实实验学校创办于1999年，是一所致力于全人教育的现代化学校。
学校占地面积5万平方米，建筑面积4万平方米，现有教学班60个，
学生3000余人，教职工200余人。

学校荣誉
石实实验学校先后获得"全国防震减灾科普示范学校"、"广东省一级学校"、
"佛山市绿色学校"等荣誉称号。

特色教育
学校在信息学奥赛、机器人竞赛、科技创新等方面成绩显著。
近年来，多位学生凭信息学特长进入清华大学、北京大学等名校。
        """

        entry, chunks = await processor.create_manual_entry(
            title="石实实验学校简介",
            content=test_content,
            category=KnowledgeCategory.SCHOOL_INTRO,
            tags=["学校简介", "荣誉", "特色"],
            summary="石实实验学校的基本信息、荣誉和特色教育"
        )

        print(f"✅ Created knowledge entry with {len(chunks)} chunks")

        # Save entry and index
        crud.create(entry)
        vector_store.index_chunks(entry.id, chunks)

        # Test search queries
        test_queries = [
            "学校有哪些荣誉？",
            "学校在信息学方面有什么成就？",
            "学校的办学规模如何？"
        ]

        print("\n--- Knowledge Search Results ---")
        for query in test_queries:
            results = vector_store.search(query, top_k=2, min_score=0.25)
            print(f"\n查询: {query}")
            if results:
                for i, (chunk, score) in enumerate(results, 1):
                    print(f"   结果 {i} (评分: {score:.3f}):")
                    print(f"   {chunk.content[:80]}...")
            else:
                print("   未找到相关内容")

        return True

    except Exception as e:
        print(f"❌ Knowledge search integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("Knowledge Base Vector Search Test Suite")
    print("="*60)

    results = {}

    # Test 1: Embedding Model
    results["embedding_model"] = test_embedding_model()

    # Test 2: Vector Store
    results["vector_store"] = test_vector_store()

    # Test 3: Text Search Fallback
    results["text_search"] = test_text_search_fallback()

    # Test 4: Full Integration
    results["integration"] = asyncio.run(test_knowledge_search_integration())

    # Summary
    print("\n" + "="*60)
    print("Test Results Summary")
    print("="*60)

    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name:20s}: {status}")

    total_passed = sum(results.values())
    total_tests = len(results)
    print(f"\nTotal: {total_passed}/{total_tests} tests passed")

    if total_passed == total_tests:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total_tests - total_passed} test(s) failed")
        return 1


if __name__ == "__main__":
    exit(main())
