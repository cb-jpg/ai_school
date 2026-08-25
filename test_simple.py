"""
Simple test to verify embedding model imports and basic functionality.
"""
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

print("="*60)
print("Knowledge Base - Quick Functionality Test")
print("="*60)

# Test 1: Import modules
print("\n[1/5] Testing imports...")
try:
    from open_llm_vtuber.knowledge.embeddings import (
        get_embedding_model,
        CachedEmbeddingModel,
        EmbeddingModel
    )
    print("✅ Embedding modules imported successfully")
except Exception as e:
    print(f"❌ Import failed: {e}")
    sys.exit(1)

# Test 2: Check if sentence-transformers is available
print("\n[2/5] Checking sentence-transformers availability...")
try:
    import sentence_transformers
    print(f"✅ sentence-transformers version: {sentence_transformers.__version__}")
except ImportError:
    print("❌ sentence-transformers not installed")
    print("Run: uv pip install sentence-transformers")
    sys.exit(1)

# Test 3: Check vector store
print("\n[3/5] Testing vector store imports...")
try:
    from open_llm_vtuber.knowledge.vector_store import (
        VectorStore,
        get_vector_store,
        reset_vector_store
    )
    print("✅ Vector store modules imported successfully")
except Exception as e:
    print(f"❌ Vector store import failed: {e}")
    sys.exit(1)

# Test 4: Check knowledge models
print("\n[4/5] Testing knowledge models...")
try:
    from open_llm_vtuber.knowledge.models import (
        KnowledgeEntry,
        Chunk,
        KnowledgeCategory,
        SourceType,
        KnowledgeStatus
    )
    # Create a test entry
    test_entry = KnowledgeEntry(
        title="测试条目",
        category=KnowledgeCategory.OTHER,
        tags=["测试"],
        source_type=SourceType.MANUAL
    )
    print(f"✅ Knowledge models work, created test entry: {test_entry.id}")
except Exception as e:
    print(f"❌ Knowledge models test failed: {e}")
    sys.exit(1)

# Test 5: Verify vector store initialization
print("\n[5/5] Testing vector store initialization...")
try:
    reset_vector_store()
    # Test with embeddings disabled for quick test
    vs = get_vector_store(use_embeddings=False)
    print("✅ Vector store initialized successfully (text mode)")
    print("   To test with embeddings, run: uv run python test_vector_search.py")
except Exception as e:
    print(f"❌ Vector store initialization failed: {e}")
    sys.exit(1)

print("\n" + "="*60)
print("✅ All basic functionality tests passed!")
print("="*60)
print("\nNext steps:")
print("1. For full embedding test: uv run python test_vector_search.py")
print("2. To start server: uv run run_server.py")
print("3. To start web frontend: cd frontend && npm run dev:web")
