"""
CRUD operations for knowledge base entries.
"""
import json
import os
from pathlib import Path
from typing import List, Optional, Dict
from datetime import datetime
from loguru import logger

from .models import KnowledgeEntry, KnowledgeStatus, KnowledgeCategory


class KnowledgeCRUD:
    """CRUD operations for knowledge entries"""

    def __init__(self, knowledge_dir: str = "data/knowledge"):
        self.knowledge_dir = Path(knowledge_dir)
        self.index_file = self.knowledge_dir / "index.json"

        # Ensure directory exists
        self.knowledge_dir.mkdir(parents=True, exist_ok=True)

        # Load or create index
        self._load_index()

    def _load_index(self):
        """Load knowledge index from disk"""
        if self.index_file.exists():
            try:
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self._index = {k: KnowledgeEntry(**v) for k, v in data.items()}
                logger.info(f"Loaded knowledge index with {len(self._index)} entries")
            except Exception as e:
                logger.error(f"Error loading knowledge index: {e}")
                self._index = {}
        else:
            self._index = {}
            self._save_index()

    def _save_index(self):
        """Save knowledge index to disk"""
        try:
            data = {k: v.model_dump() for k, v in self._index.items()}
            with open(self.index_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving knowledge index: {e}")

    def create(self, entry: KnowledgeEntry) -> KnowledgeEntry:
        """Create a new knowledge entry"""
        if entry.id in self._index:
            raise ValueError(f"Entry with id {entry.id} already exists")

        self._index[entry.id] = entry
        self._save_index()
        logger.info(f"Created knowledge entry: {entry.id}")
        return entry

    def get(self, entry_id: str) -> Optional[KnowledgeEntry]:
        """Get a knowledge entry by ID"""
        return self._index.get(entry_id)

    def get_all(
        self,
        category: Optional[KnowledgeCategory] = None,
        status: Optional[KnowledgeStatus] = None,
        search: Optional[str] = None,
        include_archived: bool = False
    ) -> List[KnowledgeEntry]:
        """Get all knowledge entries with optional filters"""
        entries = list(self._index.values())

        # Filter by category
        if category:
            entries = [e for e in entries if e.category == category]

        # Filter by status
        if status:
            entries = [e for e in entries if e.status == status]

        # Filter archived
        if not include_archived:
            entries = [e for e in entries if e.status != KnowledgeStatus.ARCHIVED]

        # Search
        if search:
            search_lower = search.lower()
            entries = [
                e for e in entries
                if search_lower in e.title.lower() or
                any(search_lower in tag.lower() for tag in e.tags) or
                (e.summary and search_lower in e.summary.lower())
            ]

        # Sort by updated_at descending
        entries.sort(key=lambda x: x.updated_at, reverse=True)

        return entries

    def update(self, entry_id: str, **kwargs) -> Optional[KnowledgeEntry]:
        """Update a knowledge entry"""
        entry = self._index.get(entry_id)
        if not entry:
            return None

        # Update fields
        for key, value in kwargs.items():
            if hasattr(entry, key) and value is not None:
                setattr(entry, key, value)

        entry.updated_at = datetime.now()
        self._index[entry_id] = entry
        self._save_index()
        logger.info(f"Updated knowledge entry: {entry_id}")
        return entry

    def delete(self, entry_id: str) -> bool:
        """Delete a knowledge entry"""
        if entry_id not in self._index:
            return False

        # Remove from index
        del self._index[entry_id]
        self._save_index()

        # Remove processed data
        processed_dir = self.knowledge_dir / "processed" / entry_id
        if processed_dir.exists():
            import shutil
            shutil.rmtree(processed_dir)

        logger.info(f"Deleted knowledge entry: {entry_id}")
        return True

    def bulk_delete(self, entry_ids: List[str]) -> Dict[str, bool]:
        """Delete multiple knowledge entries"""
        results = {}
        for entry_id in entry_ids:
            results[entry_id] = self.delete(entry_id)
        return results

    def get_statistics(self) -> Dict:
        """Get knowledge base statistics"""
        entries = list(self._index.values())

        # Count by status
        status_counts = {}
        for status in KnowledgeStatus:
            status_counts[status.value] = sum(1 for e in entries if e.status == status)

        # Count by category
        category_counts = {}
        for category in KnowledgeCategory:
            category_counts[category.value] = sum(1 for e in entries if e.category == category)

        # Total chunks
        total_chunks = sum(e.chunk_count for e in entries)

        return {
            "total_entries": len(entries),
            "status_counts": status_counts,
            "category_counts": category_counts,
            "total_chunks": total_chunks,
        }

    def publish(self, entry_id: str) -> Optional[KnowledgeEntry]:
        """Publish a knowledge entry"""
        return self.update(entry_id, status=KnowledgeStatus.PUBLISHED, published_at=datetime.now())

    def archive(self, entry_id: str) -> Optional[KnowledgeEntry]:
        """Archive a knowledge entry"""
        return self.update(entry_id, status=KnowledgeStatus.ARCHIVED)

    def set_error(self, entry_id: str, error_message: str) -> Optional[KnowledgeEntry]:
        """Mark entry as error"""
        return self.update(entry_id, status=KnowledgeStatus.ERROR, error_message=error_message)


# Global CRUD instance
_knowledge_crud: Optional[KnowledgeCRUD] = None


def get_knowledge_crud(knowledge_dir: str = "data/knowledge") -> KnowledgeCRUD:
    """Get or create the global KnowledgeCRUD instance"""
    global _knowledge_crud
    if _knowledge_crud is None:
        _knowledge_crud = KnowledgeCRUD(knowledge_dir)
    return _knowledge_crud
