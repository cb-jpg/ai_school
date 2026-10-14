"""
对话内容审核记录（JSONL 追加写，无新依赖；2026-10-14 合规材料包）

每一轮对话都落一行记录，供管理后台「系统日志 → 内容审核」页面查看，
覆盖备案要求的五大要素：用户ID、审核时间、输入指令、输出内容、审核状态。
- status="通过"    ：正常经 LLM 生成的回复
- status="已拦截"  ：命中敏感词被拒答的输入

注意：记录含对话文本，属内容安全审计留痕（备案要求），不进 git；
用户协议/隐私政策中已如实披露该用途。
"""

import json
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from loguru import logger

REVIEW_FILE = Path("data/knowledge") / "content_review.jsonl"

_write_lock = threading.Lock()

# 单字段落盘上限：审核页面是表格浏览，超长内容截断即可
MAX_FIELD_CHARS = 500


def _clip(value: str) -> str:
    return value if len(value) <= MAX_FIELD_CHARS else value[:MAX_FIELD_CHARS] + "…"


def record(
    username: str,
    input_text: str,
    output_text: str,
    status: str,
    hit_words: Optional[List[str]] = None,
) -> None:
    """追加一条审核记录；写入失败只打日志，不影响对话主流程。

    五大要素字段：username（用户ID）、review_time（审核时间）、
    input_text（输入指令）、output_text（输出内容）、status（审核状态）。
    """
    entry = {
        "ts": time.time(),
        "review_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "username": username or "未登录",
        "input_text": _clip(input_text or ""),
        "output_text": _clip(output_text or ""),
        "status": status,
        "hit_words": hit_words or [],
    }
    try:
        REVIEW_FILE.parent.mkdir(parents=True, exist_ok=True)
        with _write_lock, REVIEW_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"写入内容审核记录失败：{e}")


def list_entries(
    limit: int = 200,
    offset: int = 0,
    status: Optional[str] = None,
) -> dict:
    """按时间倒序返回审核记录（最新在前），含总数与出现过的状态类型。"""
    entries: List[dict] = []
    try:
        if REVIEW_FILE.exists():
            with REVIEW_FILE.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        item = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if status and item.get("status") != status:
                        continue
                    entries.append(item)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"读取内容审核记录失败：{e}")

    statuses = sorted({item.get("status", "") for item in entries} - {""})
    total = len(entries)
    page = list(reversed(entries))[offset : offset + limit]
    return {"total": total, "entries": page, "statuses": statuses}
