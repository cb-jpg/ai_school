"""
系统日志 API —— 管理后台「系统日志」页面的后端支撑。

- GET /api/logs/stats     知识库与问答概况（对应功能点一期"问答统计"）
- GET /api/logs/audit     知识库操作记录（对应功能点 §7"知识库更新记录"）
- GET /api/logs/service   服务运行日志尾部（logs/debug_*.log，loguru 落盘）

service 与 stats 仅 admin 可见；audit 登录即可（editor 也需要看到操作记录）。
"""

import os
from glob import glob
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger

from .knowledge import audit
from .knowledge.auth import require_admin, require_user

LOG_DIR = Path("logs")
DEFAULT_LINES = 400
MAX_LINES = 2000


def _latest_runtime_log() -> Optional[Path]:
    """返回最近修改的 logs/debug_*.log（rotation 会产生带时间戳后缀的文件）。"""
    candidates = [Path(p) for p in glob(str(LOG_DIR / "debug_*.log"))]
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)


def init_system_logs_routes(knowledge_dir: str = "data/knowledge") -> APIRouter:
    router = APIRouter(prefix="/api/logs", tags=["system-logs"])

    @router.get("/stats", dependencies=[Depends(require_admin)])
    async def get_stats():
        """知识库规模/状态概况 + 未回答问题数"""
        from .knowledge.crud import get_knowledge_crud
        from .knowledge.rag_service import get_question_log

        crud = get_knowledge_crud(knowledge_dir)
        stats = crud.get_statistics()

        try:
            question_log = get_question_log()
            stats["unanswered_count"] = len(question_log.get_unanswered())
        except Exception as e:  # noqa: BLE001
            logger.warning(f"读取未回答问题统计失败：{e}")
            stats["unanswered_count"] = None

        return stats

    @router.get("/audit", dependencies=[Depends(require_user)])
    async def get_audit(
        limit: int = Query(100, ge=1, le=1000),
        offset: int = Query(0, ge=0),
        action: Optional[str] = None,
    ):
        """知识库操作记录（最新在前）"""
        return audit.list_entries(limit=limit, offset=offset, action=action)

    @router.get("/service", dependencies=[Depends(require_admin)])
    async def get_service_log(lines: int = Query(DEFAULT_LINES, ge=10, le=MAX_LINES)):
        """服务运行日志尾部（loguru 写入的 logs/debug_*.log）"""
        log_file = _latest_runtime_log()
        if log_file is None:
            raise HTTPException(status_code=404, detail="未找到服务日志文件")

        try:
            with log_file.open("r", encoding="utf-8", errors="replace") as f:
                tail: List[str] = f.readlines()[-lines:]
        except OSError as e:
            logger.error(f"读取服务日志失败：{e}")
            raise HTTPException(status_code=500, detail=f"读取服务日志失败：{e}")

        return {
            "file": str(log_file).replace(os.sep, "/"),
            "size": log_file.stat().st_size,
            "lines": [line.rstrip("\n") for line in tail],
        }

    return router
