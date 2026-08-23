"""
FastAPI routes for knowledge base management.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from loguru import logger

from .models import (
    KnowledgeEntry, KnowledgeStatus, KnowledgeCategory,
    SourceType, Chunk
)
from .schemas import (
    KnowledgeCreateRequest, KnowledgeUpdateRequest,
    UrlAddRequest, BulkOperationRequest,
    KnowledgeListItem, KnowledgeDetailResponse,
    UploadProgressResponse, KnowledgeStatsResponse,
    UnansweredQuestion, LowConfidenceQuestion
)
from .crud import get_knowledge_crud
from .document_processor import DocumentProcessor
from .vector_store import get_vector_store


# Create router
router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

# Initialize components
crud = get_knowledge_crud()
processor = DocumentProcessor()
vector_store = get_vector_store()


# ============== Knowledge List & Search ==============

@router.get("/list", response_model=List[KnowledgeListItem])
async def list_knowledge(
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    include_archived: bool = False
):
    """Get list of knowledge entries with optional filtering"""
    try:
        # Convert string parameters to enums
        cat_enum = None
        if category:
            try:
                cat_enum = KnowledgeCategory(category)
            except ValueError:
                pass

        status_enum = None
        if status:
            try:
                status_enum = KnowledgeStatus(status)
            except ValueError:
                pass

        entries = crud.get_all(
            category=cat_enum,
            status=status_enum,
            search=search,
            include_archived=include_archived
        )

        return [KnowledgeListItem(**entry.model_dump()) for entry in entries]

    except Exception as e:
        logger.error(f"Error listing knowledge: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats", response_model=KnowledgeStatsResponse)
async def get_knowledge_stats():
    """Get knowledge base statistics"""
    try:
        stats = crud.get_statistics()

        # Get unanswered questions (mock data for now)
        unanswered = [
            UnansweredQuestion(
                id="1",
                question="学校什么时候建立的？",
                timestamp=datetime.now(),
                count=3
            )
        ]

        # Get low confidence questions (mock data)
        low_conf = [
            LowConfidenceQuestion(
                id="2",
                question="学校有哪些特色课程？",
                confidence_score=0.45,
                timestamp=datetime.now(),
                retrieval_count=5
            )
        ]

        return KnowledgeStatsResponse(
            total_entries=stats["total_entries"],
            published_entries=stats["status_counts"].get("published", 0),
            processing_entries=stats["status_counts"].get("processing", 0),
            archived_entries=stats["status_counts"].get("archived", 0),
            error_entries=stats["status_counts"].get("error", 0),
            total_chunks=stats["total_chunks"],
            category_counts=stats["category_counts"],
            recent_unanswered=unanswered,
            low_confidence_questions=low_conf
        )

    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Knowledge CRUD ==============

@router.get("/{entry_id}", response_model=KnowledgeDetailResponse)
async def get_knowledge_detail(entry_id: str):
    """Get detailed information about a knowledge entry"""
    try:
        entry = crud.get(entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Knowledge entry not found")

        # Load chunks
        chunks = vector_store.load_entry_chunks(entry_id)

        return KnowledgeDetailResponse(
            **entry.model_dump(),
            chunks=[chunk.model_dump() for chunk in chunks]
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting knowledge detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=KnowledgeListItem)
async def create_knowledge(request: KnowledgeCreateRequest):
    """Create a new manual knowledge entry"""
    try:
        entry, chunks = await processor.create_manual_entry(
            title=request.title,
            content=request.content,
            category=request.category,
            tags=request.tags,
            summary=request.summary
        )

        # Save entry
        created = crud.create(entry)

        # Index chunks
        if chunks:
            vector_store.index_chunks(entry.id, chunks)

        return KnowledgeListItem(**created.model_dump())

    except Exception as e:
        logger.error(f"Error creating knowledge: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{entry_id}", response_model=KnowledgeListItem)
async def update_knowledge(entry_id: str, request: KnowledgeUpdateRequest):
    """Update a knowledge entry"""
    try:
        # Update only provided fields
        update_data = {}
        if request.title is not None:
            update_data['title'] = request.title
        if request.category is not None:
            update_data['category'] = request.category
        if request.tags is not None:
            update_data['tags'] = request.tags
        if request.summary is not None:
            update_data['summary'] = request.summary
        if request.status is not None:
            update_data['status'] = request.status

        entry = crud.update(entry_id, **update_data)
        if not entry:
            raise HTTPException(status_code=404, detail="Knowledge entry not found")

        return KnowledgeListItem(**entry.model_dump())

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating knowledge: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{entry_id}")
async def delete_knowledge(entry_id: str):
    """Delete a knowledge entry"""
    try:
        success = crud.delete(entry_id)
        if not success:
            raise HTTPException(status_code=404, detail="Knowledge entry not found")

        # Remove from vector store
        vector_store.remove_entry(entry_id)

        return {"message": "Knowledge entry deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting knowledge: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-operation")
async def bulk_operation(request: BulkOperationRequest):
    """Perform bulk operations on multiple entries"""
    try:
        if request.operation == "delete":
            results = crud.bulk_delete(request.entry_ids)
            # Remove from vector store
            for entry_id in request.entry_ids:
                vector_store.remove_entry(entry_id)
            return {"results": results, "message": "Bulk delete completed"}

        elif request.operation == "publish":
            results = {}
            for entry_id in request.entry_ids:
                entry = crud.publish(entry_id)
                results[entry_id] = entry is not None
            return {"results": results, "message": "Bulk publish completed"}

        elif request.operation == "archive":
            results = {}
            for entry_id in request.entry_ids:
                entry = crud.archive(entry_id)
                results[entry_id] = entry is not None
            return {"results": results, "message": "Bulk archive completed"}

        elif request.operation == "reindex":
            results = {}
            for entry_id in request.entry_ids:
                chunks = vector_store.load_entry_chunks(entry_id)
                if chunks:
                    results[entry_id] = vector_store.index_chunks(entry_id, chunks)
                else:
                    results[entry_id] = False
            return {"results": results, "message": "Bulk reindex completed"}

        else:
            raise HTTPException(status_code=400, detail=f"Unknown operation: {request.operation}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in bulk operation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== File Upload ==============

@router.post("/upload", response_model=UploadProgressResponse)
async def upload_file(
    file: UploadFile = File(...),
    title: str = Form(...),
    category: str = Form(...),
    tags: str = Form(""),
    summary: Optional[str] = Form(None)
):
    """Upload a file and process it into the knowledge base"""
    import uuid
    upload_id = str(uuid.uuid4())

    try:
        # Parse tags
        tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

        # Convert category string to enum
        try:
            category_enum = KnowledgeCategory(category)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}")

        # Save uploaded file
        from pathlib import Path
        upload_dir = Path("data/knowledge/documents")
        upload_dir.mkdir(parents=True, exist_ok=True)

        file_path = upload_dir / file.filename
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        # Process file
        entry, chunks = await processor.process_file(
            file_path=str(file_path),
            title=title,
            category=category_enum,
            tags=tag_list
        )

        if entry.status == KnowledgeStatus.ERROR:
            return UploadProgressResponse(
                upload_id=upload_id,
                file_name=file.filename,
                status="error",
                progress=0,
                message=entry.error_message or "Processing failed"
            )

        # Save entry
        crud.create(entry)

        # Index chunks
        if chunks:
            vector_store.index_chunks(entry.id, chunks)

        return UploadProgressResponse(
            upload_id=upload_id,
            file_name=file.filename,
            status="completed",
            progress=100,
            message="File processed successfully",
            entry_id=entry.id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        return UploadProgressResponse(
            upload_id=upload_id,
            file_name=file.filename,
            status="error",
            progress=0,
            message=str(e)
        )


# ============== URL Processing ==============

@router.post("/add-url", response_model=UploadProgressResponse)
async def add_url(request: UrlAddRequest):
    """Add knowledge from a URL"""
    import uuid
    upload_id = str(uuid.uuid4())

    try:
        entry, chunks = await processor.process_url(
            url=request.url,
            title=request.title,
            category=request.category,
            tags=request.tags
        )

        if entry.status == KnowledgeStatus.ERROR:
            return UploadProgressResponse(
                upload_id=upload_id,
                file_name=request.url,
                status="error",
                progress=0,
                message=entry.error_message or "Processing failed"
            )

        # Save entry
        crud.create(entry)

        # Index chunks
        if chunks:
            vector_store.index_chunks(entry.id, chunks)

        return UploadProgressResponse(
            upload_id=upload_id,
            file_name=request.url,
            status="completed",
            progress=100,
            message="URL processed successfully",
            entry_id=entry.id
        )

    except Exception as e:
        logger.error(f"Error adding URL: {e}")
        return UploadProgressResponse(
            upload_id=upload_id,
            file_name=request.url,
            status="error",
            progress=0,
            message=str(e)
        )


# ============== Reindex Entry ==============

@router.post("/{entry_id}/reindex")
async def reindex_entry(entry_id: str):
    """Reindex a knowledge entry"""
    try:
        entry = crud.get(entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Knowledge entry not found")

        # Load chunks from processor
        chunks = await processor.load_chunks(entry_id)
        if not chunks:
            raise HTTPException(status_code=400, detail="No chunks found for entry")

        # Reindex
        success = vector_store.index_chunks(entry_id, chunks)

        # Update entry status
        if success:
            crud.update(entry_id, chunk_count=len(chunks))

        return {
            "message": "Entry reindexed successfully" if success else "Reindex failed",
            "chunk_count": len(chunks),
            "success": success
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reindexing entry: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Unanswered Queries ==============

@router.get("/unanswered", response_model=List[UnansweredQuestion])
async def get_unanswered_queries(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get list of unanswered questions (mock implementation)"""
    # Mock data for now - would be implemented with query logging
    return [
        UnansweredQuestion(
            id="1",
            question="学校什么时候建立的？",
            timestamp=datetime.now(),
            count=3
        ),
        UnansweredQuestion(
            id="2",
            question="学校有哪些特色课程？",
            timestamp=datetime.now(),
            count=2
        )
    ]


@router.get("/low-confidence", response_model=List[LowConfidenceQuestion])
async def get_low_confidence_queries(
    threshold: float = 0.6,
    start_date: Optional[str] = None
):
    """Get list of low confidence questions (mock implementation)"""
    # Mock data for now
    return [
        LowConfidenceQuestion(
            id="1",
            question="学校有哪些特色课程？",
            confidence_score=0.45,
            timestamp=datetime.now(),
            retrieval_count=5
        )
    ]


def init_knowledge_routes(knowledge_dir: str = "data/knowledge"):
    """Initialize knowledge routes with custom directory"""
    global crud, processor, vector_store

    crud = get_knowledge_crud(knowledge_dir)
    processor = DocumentProcessor(knowledge_dir)
    vector_store = get_vector_store(knowledge_dir)

    return router
