"""
Vector store for knowledge base chunks.
Supports both text-based and vector-based similarity search.
"""
import json
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Any
from loguru import logger
import numpy as np

from .models import Chunk
from .embeddings import get_embedding_model, CachedEmbeddingModel

# 混合召回：BM25 关键词路（可选依赖，缺失时自动退回纯向量单路）
try:
    import jieba
    from rank_bm25 import BM25Okapi
    BM25_AVAILABLE = True
except ImportError:
    BM25_AVAILABLE = False

RRF_K = 60  # Reciprocal Rank Fusion 常数（业界通用值）


class VectorStore:
    """Vector store for knowledge chunks with embedding-based search"""

    def __init__(
        self,
        knowledge_dir: str = "data/knowledge",
        embedding_model: Optional[CachedEmbeddingModel] = None,
        use_embeddings: bool = True
    ):
        """
        Initialize vector store.

        Args:
            knowledge_dir: Directory for knowledge data
            embedding_model: Optional pre-configured embedding model
            use_embeddings: Whether to use embedding-based search (falls back to text search if False)
        """
        self.knowledge_dir = Path(knowledge_dir)
        self.vectors_dir = self.knowledge_dir / "vectors"
        self.vectors_dir.mkdir(parents=True, exist_ok=True)

        # Simple in-memory index
        self._chunks_by_entry: Dict[str, List[Chunk]] = {}
        self._chunk_index: Dict[str, Chunk] = {}
        self._embeddings_index: Dict[str, np.ndarray] = {}

        # BM25 分词缓存（chunk_id -> tokens），避免每次查询重复分词
        self._bm25_tokens: Dict[str, List[str]] = {}

        # jieba 词典首次加载约 1 秒，放在启动期而不是首次查询
        if BM25_AVAILABLE:
            # jieba 默认把词典缓存写到系统 Temp，收进项目数据目录
            jieba.dt.tmp_dir = str(self.knowledge_dir)
            jieba.initialize()
            logger.info("Hybrid recall enabled: vector + BM25 (RRF fusion)")
        else:
            logger.warning("jieba/rank-bm25 not installed, falling back to vector-only recall")

        # Embedding model
        self.use_embeddings = use_embeddings
        if use_embeddings:
            try:
                self.embedding_model = embedding_model or get_embedding_model()
                logger.info("Vector store initialized with embedding support")
            except Exception as e:
                logger.warning(f"Failed to initialize embedding model: {e}. Falling back to text search.")
                self.use_embeddings = False
                self.embedding_model = None
        else:
            self.embedding_model = None

        # 重启后内存索引为空会导致 search 永远无结果，这里从磁盘回载全部条目
        self._reload_all_from_disk()

    def _reload_all_from_disk(self):
        """Load all persisted chunk files into the in-memory index.

        Chunks are reloaded without embeddings; embeddings are restored lazily
        from the embedding cache on the first search (or regenerated if the
        cache entry is missing).
        """
        try:
            loaded = 0
            for entry_file in self.vectors_dir.glob("*.json"):
                chunks = self.load_entry_chunks(entry_file.stem)
                if not chunks:
                    continue
                loaded += 1
                if self.use_embeddings and self.embedding_model:
                    self._ensure_embeddings(chunks)
            if loaded:
                logger.info(f"Reloaded {loaded} entries from disk into vector store")
        except Exception as e:
            logger.warning(f"Failed to reload vector store from disk: {e}")

    def _ensure_embeddings(self, chunks: List[Chunk]):
        """Restore embeddings for chunks that are missing from the index"""
        missing = [c for c in chunks if c.id not in self._embeddings_index]
        if not missing:
            return
        try:
            embeddings = self.embedding_model.embed_texts(
                [c.content for c in missing], use_cache=True
            )
            for chunk, embedding in zip(missing, embeddings):
                self._embeddings_index[chunk.id] = embedding
        except Exception as e:
            logger.error(f"Error restoring embeddings: {e}")

    def index_chunks(self, entry_id: str, chunks: List[Chunk]) -> bool:
        """
        Index chunks for a knowledge entry with embeddings.

        Args:
            entry_id: Knowledge entry ID
            chunks: List of chunks to index

        Returns:
            True if successful
        """
        try:
            # Update entry_id in chunks
            for chunk in chunks:
                chunk.source_id = entry_id

            # Store in memory
            for old in self._chunks_by_entry.get(entry_id, []):
                self._bm25_tokens.pop(old.id, None)  # 丢弃过期的 BM25 分词缓存
            self._chunks_by_entry[entry_id] = chunks
            for chunk in chunks:
                self._chunk_index[chunk.id] = chunk

            # Generate embeddings if enabled
            if self.use_embeddings and self.embedding_model:
                try:
                    chunk_texts = [chunk.content for chunk in chunks]
                    embeddings = self.embedding_model.embed_texts(chunk_texts, use_cache=True)

                    for chunk, embedding in zip(chunks, embeddings):
                        self._embeddings_index[chunk.id] = embedding

                    logger.info(f"Generated embeddings for {len(chunks)} chunks")
                except Exception as e:
                    logger.error(f"Error generating embeddings: {e}")

            # Save to disk
            self._save_entry_vectors(entry_id, chunks)

            logger.info(f"Indexed {len(chunks)} chunks for entry {entry_id}")
            return True

        except Exception as e:
            logger.error(f"Error indexing chunks for {entry_id}: {e}")
            return False

    def _save_entry_vectors(self, entry_id: str, chunks: List[Chunk]):
        """Save chunk vectors to disk"""
        entry_file = self.vectors_dir / f"{entry_id}.json"
        data = [chunk.model_dump() for chunk in chunks]
        with open(entry_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_entry_chunks(self, entry_id: str) -> List[Chunk]:
        """Load chunks for an entry"""
        # Check memory first
        if entry_id in self._chunks_by_entry:
            return self._chunks_by_entry[entry_id]

        # Load from disk
        entry_file = self.vectors_dir / f"{entry_id}.json"
        if not entry_file.exists():
            return []

        try:
            with open(entry_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            chunks = [Chunk(**chunk) for chunk in data]
            self._chunks_by_entry[entry_id] = chunks
            for chunk in chunks:
                self._chunk_index[chunk.id] = chunk

            # 懒加载路径同样补齐 embedding，避免检索退化到纯文本匹配
            if self.use_embeddings and self.embedding_model:
                self._ensure_embeddings(chunks)

            return chunks

        except Exception as e:
            logger.error(f"Error loading chunks for {entry_id}: {e}")
            return []

    def get_all_chunks(self) -> List[Chunk]:
        """Get all chunks from all entries"""
        all_chunks = []
        for chunks in self._chunks_by_entry.values():
            all_chunks.extend(chunks)
        return all_chunks

    def search(
        self,
        query: str,
        entry_id: Optional[str] = None,
        top_k: int = 5,
        min_score: float = 0.3
    ) -> List[Tuple[Chunk, float]]:
        """
        Search for relevant chunks using vector similarity or text matching.

        Args:
            query: Search query text
            entry_id: Optional entry ID to restrict search
            top_k: Number of results to return
            min_score: Minimum similarity score threshold

        Returns:
            List of (chunk, score) tuples
        """
        chunks = self._get_search_chunks(entry_id)

        if not chunks:
            return []

        # 向量 + BM25 双路召回（RRF 融合）；BM25 依赖缺失时退回纯向量单路
        if self.use_embeddings and self.embedding_model and self._embeddings_index:
            if BM25_AVAILABLE:
                return self._hybrid_search(query, chunks, top_k, min_score)
            return self._vector_search(query, chunks, top_k, min_score)
        else:
            return self._text_search(query, chunks, top_k, min_score)

    def _vector_search(
        self,
        query: str,
        chunks: List[Chunk],
        top_k: int,
        min_score: float
    ) -> List[Tuple[Chunk, float]]:
        """
        Perform vector similarity search.

        Args:
            query: Search query text
            chunks: Candidate chunks
            top_k: Number of results to return
            min_score: Minimum similarity score

        Returns:
            List of (chunk, score) tuples
        """
        try:
            # Generate query embedding
            query_embedding = self.embedding_model.embed_text(query, use_cache=True)

            # Collect embeddings for chunks
            valid_chunks = []
            embeddings = []

            for chunk in chunks:
                if chunk.id in self._embeddings_index:
                    valid_chunks.append(chunk)
                    embeddings.append(self._embeddings_index[chunk.id])

            if not embeddings:
                logger.debug("No embeddings found for chunks, falling back to text search")
                return self._text_search(query, chunks, top_k, min_score)

            # Calculate similarities
            embeddings_array = np.array(embeddings)
            similarities = self.embedding_model.model.batch_similarity(
                query_embedding,
                embeddings_array
            )

            # Create results and filter by minimum score
            results = [
                (chunk, float(score))
                for chunk, score in zip(valid_chunks, similarities)
                if score >= min_score
            ]

            # Sort by score and return top_k
            results.sort(key=lambda x: x[1], reverse=True)
            return results[:top_k]

        except Exception as e:
            logger.error(f"Vector search failed, falling back to text search: {e}")
            return self._text_search(query, chunks, top_k, min_score)

    def _hybrid_search(
        self,
        query: str,
        chunks: List[Chunk],
        top_k: int,
        min_score: float
    ) -> List[Tuple[Chunk, float]]:
        """
        向量 + BM25 双路召回，RRF 融合排序。

        RRF 只决定排序；上报分数仍用余弦相似度，保证
        rag_service 低置信阈值语义与纯向量路一致。
        BM25 前列命中（精确关键词匹配）即使余弦低于阈值也保留。
        """
        vector_ranking, cosine_by_id = self._vector_ranking(query, chunks)
        bm25_ranking = self._bm25_ranking(query, chunks)

        # RRF 融合：score = Σ 1/(RRF_K + rank)，rank 从 1 起
        rrf: Dict[str, float] = {}
        for ranking in (vector_ranking, bm25_ranking):
            for rank, chunk in enumerate(ranking, start=1):
                rrf[chunk.id] = rrf.get(chunk.id, 0.0) + 1.0 / (RRF_K + rank)

        by_id = {c.id: c for c in chunks}
        bm25_top = {c.id for c in bm25_ranking[:top_k]}

        results: List[Tuple[Chunk, float]] = []
        fused = sorted(rrf.items(), key=lambda x: x[1], reverse=True)
        for chunk_id, _ in fused[: top_k * 2]:
            cosine = cosine_by_id.get(chunk_id, 0.0)
            # 保留：余弦过阈值，或 BM25 路前列命中
            if cosine >= min_score or chunk_id in bm25_top:
                results.append((by_id[chunk_id], cosine))
            if len(results) >= top_k:
                break
        return results

    def _vector_ranking(
        self,
        query: str,
        chunks: List[Chunk]
    ) -> Tuple[List[Chunk], Dict[str, float]]:
        """
        全量余弦排序（不做阈值过滤），供 RRF 融合使用。

        Returns:
            (按余弦降序的 chunk 列表, chunk_id -> 余弦分数)
        """
        try:
            query_embedding = self.embedding_model.embed_text(query, use_cache=True)
        except Exception as e:
            logger.error(f"Query embedding failed: {e}")
            return [], {}

        valid_chunks = [c for c in chunks if c.id in self._embeddings_index]
        if not valid_chunks:
            return [], {}

        similarities = self.embedding_model.model.batch_similarity(
            query_embedding,
            np.array([self._embeddings_index[c.id] for c in valid_chunks])
        )
        cosine_by_id = {c.id: float(s) for c, s in zip(valid_chunks, similarities)}
        ranking = sorted(valid_chunks, key=lambda c: cosine_by_id[c.id], reverse=True)
        return ranking, cosine_by_id

    def _bm25_ranking(self, query: str, chunks: List[Chunk]) -> List[Chunk]:
        """
        BM25 关键词排序（jieba 分词）。只返回得分 > 0 的 chunk。

        分词结果按 chunk_id 缓存；语料规模小，BM25Okapi 每次现建（毫秒级）。
        """
        if not chunks:
            return []

        corpus = []
        for chunk in chunks:
            tokens = self._bm25_tokens.get(chunk.id)
            if tokens is None:
                tokens = [t for t in jieba.lcut(chunk.content) if t.strip()]
                self._bm25_tokens[chunk.id] = tokens
            corpus.append(tokens)

        query_tokens = [t for t in jieba.lcut(query) if t.strip()]
        scores = BM25Okapi(corpus).get_scores(query_tokens)
        ranked = sorted(zip(chunks, scores), key=lambda x: x[1], reverse=True)
        return [chunk for chunk, score in ranked if score > 0]

    def _text_search(
        self,
        query: str,
        chunks: List[Chunk],
        top_k: int,
        min_score: float
    ) -> List[Tuple[Chunk, float]]:
        """
        Perform text-based search as fallback.

        Args:
            query: Search query text
            chunks: Candidate chunks
            top_k: Number of results to return
            min_score: Minimum similarity score

        Returns:
            List of (chunk, score) tuples
        """
        results = []
        query_lower = query.lower()
        query_terms = query_lower.split()

        for chunk in chunks:
            content_lower = chunk.content.lower()
            score = 0.0

            # Exact phrase match (higher weight)
            if query_lower in content_lower:
                score += 1.0

            # Term frequency scoring
            for term in query_terms:
                if len(term) < 2:  # Skip short terms
                    continue
                term_count = content_lower.count(term)
                if term_count > 0:
                    score += min(term_count * 0.1, 0.5)

            if score >= min_score:
                results.append((chunk, min(score, 1.0)))

        # Sort by score and return top_k
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    def _get_search_chunks(self, entry_id: Optional[str] = None) -> List[Chunk]:
        """Get chunks for search"""
        if entry_id:
            return self.load_entry_chunks(entry_id)
        return self.get_all_chunks()

    def remove_entry(self, entry_id: str) -> bool:
        """Remove chunks for an entry"""
        try:
            # Remove from memory
            if entry_id in self._chunks_by_entry:
                chunks = self._chunks_by_entry[entry_id]
                for chunk in chunks:
                    self._chunk_index.pop(chunk.id, None)
                    self._bm25_tokens.pop(chunk.id, None)
                del self._chunks_by_entry[entry_id]

            # Remove from disk
            entry_file = self.vectors_dir / f"{entry_id}.json"
            if entry_file.exists():
                entry_file.unlink()

            logger.info(f"Removed vectors for entry {entry_id}")
            return True

        except Exception as e:
            logger.error(f"Error removing vectors for {entry_id}: {e}")
            return False

    def get_chunk_count(self, entry_id: Optional[str] = None) -> int:
        """Get count of chunks"""
        if entry_id:
            chunks = self.load_entry_chunks(entry_id)
            return len(chunks)
        return len(self._chunk_index)


# Global vector store instance
_vector_store: Optional[VectorStore] = None


def get_vector_store(
    knowledge_dir: str = "data/knowledge",
    embedding_model: Optional[CachedEmbeddingModel] = None,
    use_embeddings: bool = True
) -> VectorStore:
    """Get or create the global VectorStore instance

    Args:
        knowledge_dir: Directory for knowledge data
        embedding_model: Optional pre-configured embedding model
        use_embeddings: Whether to use embedding-based search

    Returns:
        VectorStore: Global vector store instance
    """
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore(
            knowledge_dir=knowledge_dir,
            embedding_model=embedding_model,
            use_embeddings=use_embeddings
        )
    return _vector_store


def reset_vector_store():
    """Reset the global vector store instance"""
    global _vector_store
    _vector_store = None
