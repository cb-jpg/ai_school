"""
Embedding models for knowledge base vectorization.
Supports both OpenAI API and local sentence-transformers models.
"""
from typing import List, Optional, Dict, Any
from loguru import logger
from pathlib import Path
import json
import numpy as np

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    logger.warning("sentence-transformers not available. Install with: pip install sentence-transformers")


class EmbeddingModel:
    """Base class for embedding models - supports local sentence-transformers"""

    def __init__(
        self,
        model_name: str = "paraphrase-multilingual-MiniLM-L12-v2",
        device: Optional[str] = None,
        cache_folder: Optional[str] = None
    ):
        """
        Initialize embedding model.

        Args:
            model_name: Model name or path
            device: Device to run model on ('cpu', 'cuda', or None for auto)
            cache_folder: Cache folder for models (Note: cache_folder parameter in newer versions)
        """
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            raise RuntimeError(
                "sentence-transformers not installed. "
                "Install with: pip install sentence-transformers"
            )

        # Setup model kwargs
        model_kwargs = {}
        if device:
            model_kwargs['device'] = device

        # Setup cache folder (note: parameter name changed to cache_folder in newer versions)
        kwargs = {}
        if cache_folder:
            Path(cache_folder).mkdir(parents=True, exist_ok=True)
            kwargs['cache_folder'] = cache_folder

        logger.info(f"Loading embedding model: {model_name}")
        self.model = SentenceTransformer(
            model_name,
            **kwargs,
            **model_kwargs
        )
        self.dimension = self.model.get_sentence_embedding_dimension()
        self.model_name = model_name

        logger.info(f"Embedding model loaded: {model_name}, dimension: {self.dimension}")

    def embed_texts(self, texts: List[str]) -> np.ndarray:
        """
        Generate embeddings for multiple texts.

        Args:
            texts: List of text strings

        Returns:
            np.ndarray: Embeddings matrix of shape (len(texts), dimension)
        """
        if not texts:
            return np.array([])

        return self.model.encode(
            texts,
            convert_to_numpy=True,
            show_progress_bar=len(texts) > 10
        )

    def embed_text(self, text: str) -> np.ndarray:
        """
        Generate embedding for single text.

        Args:
            text: Text string

        Returns:
            np.ndarray: Embedding vector of shape (dimension,)
        """
        return self.model.encode(text, convert_to_numpy=True)

    def cosine_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """
        Calculate cosine similarity between two embeddings.

        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector

        Returns:
            float: Cosine similarity score (-1 to 1, typically 0 to 1 for text embeddings)
        """
        # Normalize vectors
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return float(np.dot(embedding1, embedding2) / (norm1 * norm2))

    def batch_similarity(self, query_embedding: np.ndarray, document_embeddings: np.ndarray) -> np.ndarray:
        """
        Calculate cosine similarity between query and multiple documents.

        Args:
            query_embedding: Query embedding vector
            document_embeddings: Document embeddings matrix

        Returns:
            np.ndarray: Similarity scores array
        """
        # Normalize query
        query_norm = np.linalg.norm(query_embedding)
        if query_norm == 0:
            return np.zeros(len(document_embeddings))

        query_normalized = query_embedding / query_norm

        # Normalize documents
        doc_norms = np.linalg.norm(document_embeddings, axis=1)
        doc_norms[doc_norms == 0] = 1  # Avoid division by zero
        docs_normalized = document_embeddings / doc_norms[:, np.newaxis]

        # Calculate similarities
        similarities = np.dot(docs_normalized, query_normalized)
        return similarities


class EmbeddingCache:
    """Cache for embeddings to avoid recomputation"""

    def __init__(self, cache_dir: str = "data/knowledge/embeddings"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.cache_dir / "index.json"
        self._cache: Dict[str, np.ndarray] = {}
        self._load_index()

    def _load_index(self):
        """Load cache index from disk"""
        if self.index_file.exists():
            try:
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                # Don't load all embeddings into memory, just the keys
                self._cache_keys = set(data.keys())
                logger.info(f"Loaded embedding cache index with {len(self._cache_keys)} entries")
            except Exception as e:
                logger.error(f"Error loading embedding cache index: {e}")
                self._cache_keys = set()
        else:
            self._cache_keys = set()

    def get(self, text: str) -> Optional[np.ndarray]:
        """Get cached embedding for text"""
        cache_key = self._get_cache_key(text)
        if cache_key in self._cache_keys:
            # Load from disk
            cache_file = self.cache_dir / f"{cache_key}.npy"
            if cache_file.exists():
                try:
                    embedding = np.load(cache_file)
                    self._cache[cache_key] = embedding
                    return embedding
                except Exception as e:
                    logger.error(f"Error loading cached embedding: {e}")
        return None

    def set(self, text: str, embedding: np.ndarray):
        """Cache embedding for text"""
        cache_key = self._get_cache_key(text)
        cache_file = self.cache_dir / f"{cache_key}.npy"

        try:
            np.save(cache_file, embedding)
            self._cache[cache_key] = embedding
            self._cache_keys.add(cache_key)
            self._save_index()
        except Exception as e:
            logger.error(f"Error saving cached embedding: {e}")

    def _get_cache_key(self, text: str) -> str:
        """Generate cache key from text"""
        import hashlib
        return hashlib.md5(text.encode('utf-8')).hexdigest()

    def _save_index(self):
        """Save cache index to disk"""
        try:
            with open(self.index_file, 'w', encoding='utf-8') as f:
                json.dump(list(self._cache_keys), f)
        except Exception as e:
            logger.error(f"Error saving embedding cache index: {e}")

    def clear(self):
        """Clear all cached embeddings"""
        import shutil
        if self.cache_dir.exists():
            shutil.rmtree(self.cache_dir)
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            self._cache = {}
            self._cache_keys = set()
            logger.info("Cleared embedding cache")


class CachedEmbeddingModel:
    """Embedding model with caching support"""

    def __init__(
        self,
        model_name: str = "paraphrase-multilingual-MiniLM-L12-v2",
        device: Optional[str] = None,
        cache_dir: Optional[str] = None
    ):
        """
        Initialize cached embedding model.

        Args:
            model_name: Model name or path
            device: Device to run model on
            cache_dir: Cache directory for embeddings
        """
        self.model = EmbeddingModel(model_name, device)
        self.model_name = model_name  # Store model name for reference
        self.cache = EmbeddingCache(cache_dir or "data/knowledge/embeddings")

    def embed_texts(self, texts: List[str], use_cache: bool = True) -> np.ndarray:
        """
        Generate embeddings for texts with caching.

        Args:
            texts: List of text strings
            use_cache: Whether to use cache

        Returns:
            np.ndarray: Embeddings matrix
        """
        embeddings = []
        texts_to_embed = []
        indices_to_embed = []

        # Check cache for each text
        for i, text in enumerate(texts):
            if use_cache:
                cached = self.cache.get(text)
                if cached is not None:
                    embeddings.append((i, cached))
                    continue
            texts_to_embed.append(text)
            indices_to_embed.append(i)

        # Generate embeddings for uncached texts
        if texts_to_embed:
            new_embeddings = self.model.embed_texts(texts_to_embed)
            for idx, text, embedding in zip(indices_to_embed, texts_to_embed, new_embeddings):
                embeddings.append((idx, embedding))
                if use_cache:
                    self.cache.set(text, embedding)

        # Sort by original order and return
        embeddings.sort(key=lambda x: x[0])
        return np.array([emb for _, emb in embeddings])

    def embed_text(self, text: str, use_cache: bool = True) -> np.ndarray:
        """Generate embedding for single text with caching"""
        if use_cache:
            cached = self.cache.get(text)
            if cached is not None:
                return cached

        embedding = self.model.embed_text(text)

        if use_cache:
            self.cache.set(text, embedding)

        return embedding

    @property
    def dimension(self) -> int:
        """Get embedding dimension"""
        return self.model.dimension


# Global embedding model instance
_embedding_model: Optional[CachedEmbeddingModel] = None


def get_embedding_model(
    model_name: str = "paraphrase-multilingual-MiniLM-L12-v2",
    device: Optional[str] = None,
    cache_folder: Optional[str] = None
) -> CachedEmbeddingModel:
    """Get or create the global embedding model instance

    Args:
        model_name: Model name or path
        device: Device to run model on
        cache_folder: Cache directory for embeddings

    Returns:
        CachedEmbeddingModel: Global embedding model instance
    """
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = CachedEmbeddingModel(
            model_name=model_name,
            device=device,
            cache_dir=cache_folder
        )
    return _embedding_model


def clear_embedding_model():
    """Clear the global embedding model instance"""
    global _embedding_model
    _embedding_model = None
