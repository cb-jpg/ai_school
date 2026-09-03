"""
FastAPI routes for knowledge base management.
"""
import asyncio
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from loguru import logger

from .auth import require_staff
from .audit import record as audit_record
from .audit import bump_counter
from .audit import list_entries as audit_list_entries

from .models import (
    KnowledgeEntry, KnowledgeStatus, KnowledgeCategory,
    SourceType, Chunk
)
from .schemas import (
    KnowledgeCreateRequest, KnowledgeUpdateRequest,
    UrlAddRequest, BulkOperationRequest, SearchRequest,
    KnowledgeListItem, KnowledgeDetailResponse,
    UploadProgressResponse, KnowledgeStatsResponse,
    UnansweredQuestion, LowConfidenceQuestion
)
from .crud import get_knowledge_crud
from .document_processor import DocumentProcessor
from .vector_store import get_vector_store
from .rag_service import get_question_log, get_rag_service


# Create router（全部知识库管理接口要求登录）
router = APIRouter(
    prefix="/api/knowledge", tags=["knowledge"], dependencies=[Depends(require_staff)]
)

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

        # 未命中 / 低置信问题：来自对话 RAG 的真实记录（data/runtime/question_log.json）
        question_log = get_question_log()
        unanswered = [
            UnansweredQuestion(
                id=item["id"],
                question=item["question"],
                timestamp=datetime.fromisoformat(item["last_asked"]),
                count=item["count"],
            )
            for item in question_log.get_unanswered()
        ]

        low_conf = [
            LowConfidenceQuestion(
                id=item["id"],
                question=item["question"],
                confidence_score=item["score"],
                timestamp=datetime.fromisoformat(item["last_asked"]),
                retrieval_count=item["count"],
            )
            for item in question_log.get_low_confidence()
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
# 注意：GET /{entry_id} 定义在文件末尾——FastAPI 按定义顺序匹配，
# 若放在 /unanswered、/low-confidence 之前会把它们当作 entry_id 吞掉。

@router.post("/create", response_model=KnowledgeListItem)
async def create_knowledge(request: KnowledgeCreateRequest, _user: dict = Depends(require_staff)):
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

        # Index chunks（embedding 是 CPU 密集运算，放线程池避免阻塞事件循环）
        if chunks:
            await asyncio.to_thread(vector_store.index_chunks, entry.id, chunks)

        audit_record(
            _user["username"], "create", entry.id, entry.title,
            f"手动录入，切分 {len(chunks)} 块",
        )

        return KnowledgeListItem(**created.model_dump())

    except Exception as e:
        logger.error(f"Error creating knowledge: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{entry_id}", response_model=KnowledgeListItem)
async def update_knowledge(
    entry_id: str, request: KnowledgeUpdateRequest, _user: dict = Depends(require_staff)
):
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

        audit_record(
            _user["username"], "update", entry_id, entry.title,
            f"更新字段：{', '.join(update_data.keys()) or '无'}",
        )

        return KnowledgeListItem(**entry.model_dump())

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating knowledge: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{entry_id}")
async def delete_knowledge(entry_id: str, _user: dict = Depends(require_staff)):
    """Delete a knowledge entry"""
    try:
        existing = crud.get(entry_id)
        title = existing.title if existing else ""

        success = crud.delete(entry_id)
        if not success:
            raise HTTPException(status_code=404, detail="Knowledge entry not found")

        # Remove from vector store
        vector_store.remove_entry(entry_id)

        audit_record(_user["username"], "delete", entry_id, title)

        return {"message": "Knowledge entry deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting knowledge: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-operation")
async def bulk_operation(request: BulkOperationRequest, _user: dict = Depends(require_staff)):
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
            # 重建是重操作，逐条放线程池避免阻塞事件循环
            for entry_id in request.entry_ids:
                chunks = await asyncio.to_thread(vector_store.load_entry_chunks, entry_id)
                if chunks:
                    results[entry_id] = await asyncio.to_thread(vector_store.index_chunks, entry_id, chunks)
                else:
                    results[entry_id] = False
            return {"results": results, "message": "Bulk reindex completed"}

        else:
            raise HTTPException(status_code=400, detail=f"Unknown operation: {request.operation}")

        audit_record(
            _user["username"], f"bulk_{request.operation}", "",
            "", f"批量操作 {len(request.entry_ids)} 个条目",
        )

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
    summary: Optional[str] = Form(None),
    _user: dict = Depends(require_staff),
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

        # 不信任客户端文件名：防路径穿越（如 ../../conf.yaml）与同名覆盖，仅保留扩展名
        file_path = upload_dir / f"{upload_id}{Path(file.filename).suffix}"
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

        # Index chunks（embedding 是 CPU 密集运算，放线程池避免阻塞事件循环）
        if chunks:
            await asyncio.to_thread(vector_store.index_chunks, entry.id, chunks)

        audit_record(
            _user["username"], "upload", entry.id, entry.title,
            f"文件 {file.filename}，切分 {len(chunks)} 块",
        )

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
async def add_url(request: UrlAddRequest, _user: dict = Depends(require_staff)):
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

        # Index chunks（embedding 是 CPU 密集运算，放线程池避免阻塞事件循环）
        if chunks:
            await asyncio.to_thread(vector_store.index_chunks, entry.id, chunks)

        audit_record(
            _user["username"], "add_url", entry.id, entry.title,
            f"网页抓取 {request.url}，切分 {len(chunks)} 块",
        )

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
async def reindex_entry(entry_id: str, _user: dict = Depends(require_staff)):
    """Reindex a knowledge entry"""
    try:
        entry = crud.get(entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Knowledge entry not found")

        # Load chunks from processor
        chunks = await processor.load_chunks(entry_id)
        if not chunks:
            raise HTTPException(status_code=400, detail="No chunks found for entry")

        # Reindex（放线程池，避免 embedding 阻塞事件循环）
        success = await asyncio.to_thread(vector_store.index_chunks, entry_id, chunks)

        # Update entry status
        if success:
            crud.update(entry_id, chunk_count=len(chunks))

        audit_record(
            _user["username"], "reindex", entry_id, entry.title,
            f"重建向量索引，{len(chunks)} 块，{'成功' if success else '失败'}",
        )

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


# ============== Search（与对话 RAG 同一条检索路径） ==============

@router.post("/search")
async def search_knowledge(request: SearchRequest):
    """Search published knowledge chunks by semantic similarity"""
    try:
        docs = await get_rag_service().search(request.query, top_k=request.top_k)
        # 搜索计数：供主工作台"搜索次数"卡片使用
        bump_counter("search_total")
        return {"success": True, "query": request.query, "results": docs, "total": len(docs)}
    except Exception as e:
        logger.error(f"Error searching knowledge: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Workspace Stats（主工作台统计卡片） ==============

@router.get("/workspace-stats")
async def get_workspace_stats():
    """主工作台统计：知识条目 / 本月上传 / 搜索次数。
    注意：必须定义在 GET /{entry_id} 之前，否则路径会被吞。"""
    from .audit import get_counters

    stats = crud.get_statistics()

    month_prefix = datetime.now().strftime("%Y-%m")
    uploads_this_month = sum(
        1
        for item in audit_list_entries(limit=100000)["entries"]
        if item.get("action") in ("upload", "add_url", "create")
        and datetime.fromtimestamp(item.get("ts", 0)).strftime("%Y-%m") == month_prefix
    )

    return {
        "total_entries": stats["total_entries"],
        "indexed_entries": stats["status_counts"].get("indexed", 0),
        "total_chunks": stats["total_chunks"],
        "uploads_this_month": uploads_this_month,
        "search_total": get_counters().get("search_total", 0),
    }


# ============== Unanswered Queries ==============

@router.get("/unanswered", response_model=List[UnansweredQuestion])
async def get_unanswered_queries(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get list of questions the knowledge base failed to answer"""
    from datetime import datetime as dt

    def _in_range(ts: Optional[str]) -> bool:
        if not start_date and not end_date:
            return True
        try:
            t = dt.fromisoformat(ts) if ts else None
        except ValueError:
            return True
        if start_date and (t is None or t < dt.fromisoformat(start_date)):
            return False
        if end_date and (t is None or t > dt.fromisoformat(end_date)):
            return False
        return True

    return [
        UnansweredQuestion(
            id=item["id"],
            question=item["question"],
            timestamp=dt.fromisoformat(item["last_asked"]),
            count=item["count"],
        )
        for item in get_question_log().get_unanswered()
        if _in_range(item.get("last_asked"))
    ]


@router.get("/low-confidence", response_model=List[LowConfidenceQuestion])
async def get_low_confidence_queries(
    threshold: float = 0.6,
    start_date: Optional[str] = None
):
    """Get list of questions answered with low retrieval confidence"""
    return [
        LowConfidenceQuestion(
            id=item["id"],
            question=item["question"],
            confidence_score=item["score"],
            timestamp=datetime.fromisoformat(item["last_asked"]),
            retrieval_count=item["count"],
        )
        for item in get_question_log().get_low_confidence()
        if item["score"] < threshold
    ]


@router.delete("/unanswered/{question_id}")
async def resolve_unanswered_question(question_id: str):
    """Close an unanswered question after the admin adds knowledge for it"""
    removed = get_question_log().remove_unanswered(question_id)
    if not removed:
        raise HTTPException(status_code=404, detail="问题不存在")
    return {"message": "问题已关闭"}


@router.delete("/low-confidence/{question_id}")
async def resolve_low_confidence_question(question_id: str):
    """Close a low-confidence question after the admin adds knowledge for it"""
    removed = get_question_log().remove_low_confidence(question_id)
    if not removed:
        raise HTTPException(status_code=404, detail="问题不存在")
    return {"message": "问题已关闭"}


# ============== Entry Detail（parametric 路由，必须放在静态路由之后） ==============

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


def init_knowledge_routes(knowledge_dir: str = "data/knowledge"):
    """Initialize knowledge routes with custom directory"""
    global crud, processor, vector_store

    crud = get_knowledge_crud(knowledge_dir)
    processor = DocumentProcessor(knowledge_dir)
    vector_store = get_vector_store(knowledge_dir)

    return router
