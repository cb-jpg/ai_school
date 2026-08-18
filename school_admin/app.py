"""
学校知识库管理后台 - FastAPI 主应用
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from pathlib import Path
import shutil
from datetime import datetime
from loguru import logger

import sys
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from school_rag import SchoolKnowledgeBase


# Pydantic 模型
class DocumentAddRequest(BaseModel):
    text: str = Field(..., description="文档文本内容")
    category: Optional[str] = Field(None, description="文档分类")
    title: Optional[str] = Field(None, description="文档标题")
    metadata: Optional[Dict[str, Any]] = Field(None, description="额外元数据")


class DocumentUpdateRequest(BaseModel):
    doc_id: str = Field(..., description="文档ID")
    text: Optional[str] = Field(None, description="新的文本内容")
    metadata: Optional[Dict[str, Any]] = Field(None, description="新的元数据")


class SearchRequest(BaseModel):
    query: str = Field(..., description="搜索查询")
    top_k: Optional[int] = Field(5, description="返回结果数量")
    category: Optional[str] = Field(None, description="分类过滤")


class RAGQueryRequest(BaseModel):
    query: str = Field(..., description="用户问题")
    conversation_history: Optional[List[Dict[str, str]]] = Field(None, description="对话历史")


class DocumentDeleteRequest(BaseModel):
    doc_id: Optional[str] = Field(None, description="文档ID")
    category: Optional[str] = Field(None, description="按分类删除")
    title: Optional[str] = Field(None, description="按标题删除")


# 创建应用
def create_app() -> FastAPI:
    """创建 FastAPI 应用实例"""

    app = FastAPI(
        title="学校知识库管理后台",
        description="AI 数字人中学问答系统 - 知识库管理 API",
        version="1.0.0",
    )

    # CORS 中间件
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # 生产环境应限制具体域名
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 初始化知识库
    project_root = Path(__file__).parent.parent
    knowledge_dir = project_root / "school_data" / "knowledge"
    vector_db_dir = project_root / "school_data" / "vector_db"

    knowledge_base = SchoolKnowledgeBase(
        persist_directory=str(vector_db_dir),
        knowledge_dir=str(knowledge_dir),
    )

    @app.on_event("startup")
    async def startup_event():
        """应用启动事件"""
        logger.info("知识库管理后台启动")
        logger.info(f"知识库目录: {knowledge_dir}")
        logger.info(f"向量库目录: {vector_db_dir}")

    # ========== 健康检查 ==========
    @app.get("/health")
    async def health_check():
        """健康检查接口"""
        return {
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "service": "学校知识库管理后台",
        }

    # ========== 知识库 CRUD ==========

    @app.post("/api/documents")
    async def add_document(request: DocumentAddRequest):
        """
        添加文本文档到知识库

        Args:
            request: 文档添加请求

        Returns:
            添加的文档ID列表
        """
        try:
            doc_ids = knowledge_base.add_document(
                text=request.text,
                category=request.category,
                title=request.title,
                metadata=request.metadata,
            )

            return {
                "success": True,
                "document_ids": doc_ids,
                "message": f"成功添加 {len(doc_ids)} 个文档块",
            }

        except Exception as e:
            logger.error(f"添加文档失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/documents/upload")
    async def upload_document(
        file: UploadFile = File(...),
        category: Optional[str] = Query(None, description="文档分类"),
        title: Optional[str] = Query(None, description="文档标题"),
    ):
        """
        上传文件到知识库

        Args:
            file: 上传的文件
            category: 文档分类
            title: 文档标题

        Returns:
            添加的文档ID列表
        """
        try:
            # 保存上传的文件
            upload_dir = knowledge_dir / "uploads"
            upload_dir.mkdir(parents=True, exist_ok=True)

            file_path = upload_dir / file.filename
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)

            # 添加到知识库
            doc_title = title or file.filename
            doc_ids = knowledge_base.add_document(
                file_path=str(file_path),
                category=category,
                title=doc_title,
            )

            return {
                "success": True,
                "document_ids": doc_ids,
                "message": f"成功上传并处理文件: {file.filename}",
                "chunks_count": len(doc_ids),
            }

        except Exception as e:
            logger.error(f"上传文件失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.put("/api/documents")
    async def update_document(request: DocumentUpdateRequest):
        """
        更新文档

        Args:
            request: 文档更新请求

        Returns:
            更新结果
        """
        try:
            success = knowledge_base.update_document(
                doc_id=request.doc_id,
                text=request.text,
                metadata=request.metadata,
            )

            return {
                "success": success,
                "message": "文档更新成功" if success else "文档更新失败",
            }

        except Exception as e:
            logger.error(f"更新文档失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.delete("/api/documents")
    async def delete_document(request: DocumentDeleteRequest):
        """
        删除文档

        Args:
            request: 文档删除请求

        Returns:
            删除结果
        """
        try:
            count = knowledge_base.delete_document(
                doc_id=request.doc_id,
                category=request.category,
                title=request.title,
            )

            return {
                "success": True,
                "deleted_count": count,
                "message": f"成功删除 {count} 个文档",
            }

        except Exception as e:
            logger.error(f"删除文档失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    # ========== 搜索和检索 ==========

    @app.post("/api/search")
    async def search_documents(request: SearchRequest):
        """
        搜索知识库文档

        Args:
            request: 搜索请求

        Returns:
            搜索结果
        """
        try:
            results = knowledge_base.search(
                query=request.query,
                top_k=request.top_k,
                category=request.category,
            )

            return {
                "success": True,
                "query": request.query,
                "results": results,
                "total": len(results),
            }

        except Exception as e:
            logger.error(f"搜索失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/rag")
    async def rag_query(request: RAGQueryRequest):
        """
        RAG 检索 - 返回用于 LLM 的上下文

        Args:
            request: RAG 查询请求

        Returns:
            检索结果和上下文
        """
        try:
            result = knowledge_base.retrieve_with_rag(
                query=request.query,
                conversation_history=request.conversation_history,
            )

            return {
                "success": True,
                "query": request.query,
                "context": result.get("context"),
                "has_results": result.get("has_results"),
                "detected_category": result.get("detected_category"),
                "results": result.get("results"),
            }

        except Exception as e:
            logger.error(f"RAG 检索失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    # ========== 统计和查询 ==========

    @app.get("/api/categories")
    async def get_categories():
        """
        获取所有文档分类

        Returns:
            分类列表
        """
        try:
            categories = knowledge_base.get_categories()
            return {
                "success": True,
                "categories": categories,
            }

        except Exception as e:
            logger.error(f"获取分类失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/api/statistics")
    async def get_statistics():
        """
        获取知识库统计信息

        Returns:
            统计数据
        """
        try:
            stats = knowledge_base.get_statistics()
            return {
                "success": True,
                "statistics": stats,
            }

        except Exception as e:
            logger.error(f"获取统计信息失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/api/documents/{doc_id}")
    async def get_document(doc_id: str):
        """
        根据 ID 获取文档

        Args:
            doc_id: 文档ID

        Returns:
            文档内容
        """
        try:
            document = knowledge_base.get_document_by_id(doc_id)
            if document is None:
                raise HTTPException(status_code=404, detail="文档不存在")

            return {
                "success": True,
                "document": document,
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取文档失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    # ========== 批量操作 ==========

    @app.post("/api/documents/rebuild")
    async def rebuild_index():
        """
        重建索引

        Returns:
            重建结果
        """
        try:
            success = knowledge_base.rebuild_index()
            return {
                "success": success,
                "message": "索引重建成功" if success else "索引重建失败",
            }

        except Exception as e:
            logger.error(f"重建索引失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/api/export/metadata")
    async def export_metadata():
        """
        导出元数据

        Returns:
            导出结果
        """
        try:
            success = knowledge_base.export_metadata()
            return {
                "success": success,
                "message": "元数据导出成功" if success else "元数据导出失败",
            }

        except Exception as e:
            logger.error(f"导出元数据失败: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    return app


# 创建应用实例
app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        log_level="info",
    )
