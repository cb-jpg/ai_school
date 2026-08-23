"""
Vector store for knowledge base chunks.
Simplified implementation for chunk indexing and retrieval.
"""
import json
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from loguru import logger

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    logger.warning("NumPy not available. Vector similarity features will be limited.")

from .models import Chunk


class VectorStore:
    """Simple vector store for knowledge chunks"""

    def __init__(self, knowledge_dir: str = "data/knowledge"):
        self.knowledge_dir = Path(knowledge_dir)
        self.vectors_dir = self.knowledge_dir / "vectors"
        self.vectors_dir.mkdir(parents=True, exist_ok=True)

        # Simple in-memory index
        self._chunks_by_entry: Dict[str, List[Chunk]] = {}
        self._chunk_index: Dict[str, Chunk] = {}

    def index_chunks(self, entry_id: str, chunks: List[Chunk]) -> bool:
        """
        Index chunks for a knowledge entry.

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
        top_k: int = 5
    ) -> List[Tuple[Chunk, float]]:
        """
        Search for relevant chunks.

        Args:
            query: Search query text
            entry_id: Optional entry ID to restrict search
            top_k: Number of results to return

        Returns:
            List of (chunk, score) tuples
        """
        chunks = self._get_search_chunks(entry_id)

        if not chunks:
            return []

        # Simple text matching scoring
        results = []
        query_lower = query.lower()
        query_terms = query_lower.split()

        for chunk in chunks:
            content_lower = chunk.content.lower()
            score = 0.0

            # Exact phrase match
            if query_lower in content_lower:
                score += 1.0

            # Term frequency scoring
            for term in query_terms:
                if len(term) < 2:  # Skip short terms
                    continue
                term_count = content_lower.count(term)
                if term_count > 0:
                    score += min(term_count * 0.1, 0.5)

            if score > 0:
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


def get_vector_store(knowledge_dir: str = "data/knowledge") -> VectorStore:
    """Get or create the global VectorStore instance"""
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore(knowledge_dir)
    return _vector_store
