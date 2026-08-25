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

        # Use vector search if embeddings are available
        if self.use_embeddings and self.embedding_model and self._embeddings_index:
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
