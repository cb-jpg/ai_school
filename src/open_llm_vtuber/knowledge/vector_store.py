"""
Vector store for knowledge base chunks.
Supports both text-based and vector-based similarity search.
"""
import json
import threading
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Any, Iterable
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

        # 全库检索索引（对话 RAG 用）：embedding 矩阵 + 全语料 BM25 各构建一次。
        # 高并发下单次查询只做 1 次 query embedding + 1 次矩阵余弦 + 1 次 BM25 打分，
        # 替代旧版逐条目循环（每 query × 91 条目的 BM25/余弦），避免线程池被 GIL 密集任务灌满。
        self._g_entry_key: Optional[frozenset] = None
        self._g_index_mtime: Optional[float] = None
        self._g_built: bool = False
        self._g_all_chunks: List[Chunk] = []
        self._g_bm25: Optional["BM25Okapi"] = None
        self._g_vec_chunks: List[Chunk] = []
        self._g_vec_matrix: Optional[np.ndarray] = None
        # 重建锁：无锁时并发首查会同时在半建状态上检索（2026-09-21 校验踩坑：
        # 4 线程并发首查期间部分查询退化成纯向量路径，BM25/标题加成全丢，
        # 同一查询时中时不中）
        self._g_lock = threading.Lock()

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

    # ------------------------------------------------------------------
    # 全库检索索引（对话 RAG 高并发路径）
    # ------------------------------------------------------------------

    def _index_mtime(self) -> Optional[float]:
        """知识库索引文件的 mtime；跨进程改库（管理端写入另一进程）时据此失效重建"""
        try:
            return self.knowledge_dir.joinpath("index.json").stat().st_mtime
        except OSError:
            return None

    def invalidate_global_index(self) -> None:
        """条目增删改索引后调用，使全库检索索引失效"""
        with self._g_lock:
            self._g_entry_key = None
            self._g_index_mtime = None
            self._g_built = False
            self._g_all_chunks = []
            self._g_bm25 = None
            self._g_vec_chunks = []
            self._g_vec_matrix = None
            self._g_title_by_entry = {}
            self._g_title_chunk_ids = {}

    def _load_entry_titles(self) -> Dict[str, str]:
        """读 index.json 里的 {条目id: 标题}，供标题子串精确匹配加成"""
        try:
            raw = json.loads(self.knowledge_dir.joinpath("index.json").read_text(encoding="utf-8"))
            return {eid: e.get("title", "") for eid, e in raw.items() if isinstance(e, dict)}
        except Exception:
            return {}

    def _ensure_global_index(self, entry_ids: Iterable[str]) -> None:
        """确保全库索引就绪：条目集合或 index.json mtime 变化时重建"""
        key = frozenset(entry_ids)
        mtime = self._index_mtime()
        if self._g_built and self._g_entry_key == key and self._g_index_mtime == mtime:
            return

        chunks: List[Chunk] = []
        for entry_id in key:
            chunks.extend(self.load_entry_chunks(entry_id))

        self._g_title_by_entry = self._load_entry_titles()
        self._g_title_chunk_ids: Dict[str, List[str]] = {}
        for c in chunks:
            self._g_title_chunk_ids.setdefault(c.source_id, []).append(c.id)

        if self.use_embeddings and self.embedding_model:
            self._ensure_embeddings(chunks)

        self._g_all_chunks = chunks
        self._g_vec_chunks = (
            [c for c in chunks if c.id in self._embeddings_index]
            if self.use_embeddings and self.embedding_model
            else []
        )
        self._g_vec_matrix = (
            np.array([self._embeddings_index[c.id] for c in self._g_vec_chunks])
            if self._g_vec_chunks
            else None
        )
        self._g_bm25 = None
        if BM25_AVAILABLE and chunks:
            corpus = []
            for chunk in chunks:
                tokens = self._bm25_tokens.get(chunk.id)
                if tokens is None:
                    tokens = [t for t in jieba.lcut(chunk.content) if t.strip()]
                    self._bm25_tokens[chunk.id] = tokens
                corpus.append(tokens)
            self._g_bm25 = BM25Okapi(corpus)

        self._g_entry_key = key
        self._g_index_mtime = mtime
        self._g_built = True
        logger.info(
            f"Global search index built: {len(chunks)} chunks "
            f"({len(self._g_vec_chunks)} vectorized, BM25={'on' if self._g_bm25 else 'off'})"
        )

    def search_all(
        self,
        query: str,
        entry_ids: Iterable[str],
        top_k: int = 5,
        min_score: float = 0.3,
    ) -> List[Tuple[Chunk, float]]:
        """全库混合检索（向量 + BM25，RRF 融合），语义与逐条目 search() 一致，
        但每次查询只做一次 embedding、一次全库余弦、一次 BM25 打分。

        上报分数仍为余弦相似度，与 rag_service 低置信阈值语义保持一致。
        """
        with self._g_lock:
            self._ensure_global_index(entry_ids)

        has_vectors = self._g_vec_matrix is not None and len(self._g_vec_chunks) > 0
        if has_vectors and self._g_bm25 is not None:
            return self._global_hybrid_search(query, top_k, min_score)
        if has_vectors:
            return self._global_vector_search(query, top_k, min_score)
        return self._text_search(query, self._g_all_chunks, top_k, min_score)

    def _global_vector_ranking(
        self, query: str
    ) -> Tuple[List[Chunk], Dict[str, float]]:
        """一次 query embedding + 一次全库矩阵余弦，返回全库排序"""
        try:
            query_embedding = self.embedding_model.embed_text(query, use_cache=True)
        except Exception as e:
            logger.error(f"Query embedding failed: {e}")
            return [], {}

        similarities = self.embedding_model.model.batch_similarity(
            query_embedding, self._g_vec_matrix
        )
        cosine_by_id = {
            c.id: float(s) for c, s in zip(self._g_vec_chunks, similarities)
        }
        ranking = sorted(
            self._g_vec_chunks, key=lambda c: cosine_by_id[c.id], reverse=True
        )
        return ranking, cosine_by_id

    def _global_bm25_ranking(self, query: str) -> List[Chunk]:
        """全库 BM25 一次打分，只返回得分 > 0 的 chunk"""
        if self._g_bm25 is None or not self._g_all_chunks:
            return []
        query_tokens = [t for t in jieba.lcut(query) if t.strip()]
        scores = self._g_bm25.get_scores(query_tokens)
        ranked = sorted(
            zip(self._g_all_chunks, scores), key=lambda x: x[1], reverse=True
        )
        return [chunk for chunk, score in ranked if score > 0]

    def _global_vector_search(
        self, query: str, top_k: int, min_score: float
    ) -> List[Tuple[Chunk, float]]:
        """纯向量单路（BM25 依赖缺失时的退路），语义与 _vector_search 一致"""
        ranking, cosine_by_id = self._global_vector_ranking(query)
        results = [
            (chunk, cosine_by_id[chunk.id])
            for chunk in ranking
            if cosine_by_id[chunk.id] >= min_score
        ]
        return results[:top_k]

    def _global_hybrid_search(
        self, query: str, top_k: int, min_score: float
    ) -> List[Tuple[Chunk, float]]:
        """全库 RRF 融合；融合逻辑与 _hybrid_search 一致。

        返回仍按余弦降序截断 top_k：旧版逐条目检索最终在 rag_service 按
        余弦合并排序，低置信阈值（docs[0].score）依赖这一语义，必须保持。
        """
        vector_ranking, cosine_by_id = self._global_vector_ranking(query)
        bm25_ranking = self._global_bm25_ranking(query)
        # BM25 名次表：查询嵌入失败时（GPU 被占 CUDA OOM 等）幸存块没有
        # 真实余弦、全部记 0.0，若无次级排序键，top_k 截断会退化为按块
        # 存储顺序随机挤掉 BM25 精确命中（2026-09-21 检索校验发现）
        bm25_rank_by_id = {c.id: i for i, c in enumerate(bm25_ranking)}

        rrf: Dict[str, float] = {}
        for ranking in (vector_ranking, bm25_ranking):
            for rank, chunk in enumerate(ranking, start=1):
                rrf[chunk.id] = rrf.get(chunk.id, 0.0) + 1.0 / (RRF_K + rank)

        by_id = {c.id: c for c in self._g_all_chunks}

        # 候选池 = RRF 融合前列 ∪ 全部 BM25 命中 ∪ 向量路前列，不随 top_k
        # 截断（旧版融合窗和 BM25 保留窗都取 top_k，同一查询不同 top_k 结果
        # 不成前缀，且小 top_k 时关键词命中被挤出候选——2026-09-21 校验：
        # 「学校的电话是多少」top_k=5 查不到「学校联系方式」，top_k=20 却第 1）。
        # 候选变多不影响顶部质量：低余弦的候选排序时沉底（见 _order_key）。
        candidate_ids: Dict[str, None] = {}
        for chunk_id, _ in sorted(rrf.items(), key=lambda x: x[1], reverse=True)[: max(top_k * 2, 20)]:
            candidate_ids.setdefault(chunk_id, None)
        for chunk in bm25_ranking:
            candidate_ids.setdefault(chunk.id, None)
        for chunk in vector_ranking[:top_k]:
            candidate_ids.setdefault(chunk.id, None)

        survivors: List[Tuple[Chunk, float]] = []
        for chunk_id in candidate_ids:
            cosine = cosine_by_id.get(chunk_id, 0.0)
            # 保留：余弦过阈值，或 BM25 有任意命中
            if cosine >= min_score or chunk_id in bm25_rank_by_id:
                survivors.append((by_id[chunk_id], cosine))

        # 主序仍是余弦降序（rag_service 低置信阈值依赖此语义，见 docstring），
        # 在其上叠加 BM25 名次加成：只影响排序、不改上报分数。背景：同模板
        # 条目（如成批的学生推荐表）和泛主题大条目余弦普遍 0.7+，精确词命中
        # 的目标块余弦反而被压下去（2026-09-21 校验实测：查"陈雨桐"top20 全是
        # 别的学生条目；"学校概况"bm25 第 0 名却进不了 top5）；BM25 对精确词
        # 的判断恰好补这个短板。加成幅度按检索实测校准：需盖过 ~0.75 的泛主题
        # 余弦、且 rank0 与 rank1 拉开 ~0.08 才能让目标条目进对话上下文
        # （CHAT_TOP_K 量级）。加成只给余弦已达阈值的块，低置信判定不受影响；
        # 无余弦（查询嵌入失败 OOM 等）的块之间退回按 BM25 名次排。
        # 标题子串精确命中加成：查询包含标题，或（≥2 字的）查询被标题包含。
        # 短标题（如"学校简介"）经分词后常与正文碎片失配，BM25/余弦都可能
        # 压不过同主题大条目，子串匹配是最稳的精确信号；同批命中的条目之间
        # 相对次序仍由余弦决定。
        q = query.strip()
        tb_ids: set = set()
        if len(q) >= 2:
            for eid, t in self._g_title_by_entry.items():
                if t and (t in q or q in t):
                    tb_ids.update(self._g_title_chunk_ids.get(eid, ()))

        def _order_key(item: Tuple[Chunk, float]):
            chunk, cosine = item
            rank = bm25_rank_by_id.get(chunk.id)
            if cosine >= min_score:
                bonus = 0.25 / (1 + 0.5 * rank) if rank is not None else 0.0
                if chunk.id in tb_ids:
                    bonus += 0.3
                return (1, cosine + bonus, 0.0)
            return (0, 0.0, float(-rank) if rank is not None else 0.0)

        survivors.sort(key=_order_key, reverse=True)
        return survivors[:top_k]

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
            self.invalidate_global_index()

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
            self.invalidate_global_index()

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
