"""
知识库操作审计日志（JSONL 追加写，无新依赖）

对应功能点 §7 知识库后台「支持知识库版本管理和更新记录」中"更新记录"部分：
所有知识条目的增删改/上传/索引重建操作都会落一行 JSON 记录，
供管理后台"系统日志"页面查看。数据文件在 data/knowledge/ 下，不进 git。
"""

import json
import threading
import time
from pathlib import Path
from typing import List, Optional

from loguru import logger

AUDIT_FILE = Path("data/knowledge") / "audit_log.jsonl"
USAGE_COUNTER_FILE = Path("data/runtime") / "usage_stats.json"

_write_lock = threading.Lock()


def bump_counter(name: str) -> None:
    """累计使用计数（如搜索次数）；写入失败不影响主流程。"""
    try:
        data: dict = {}
        if USAGE_COUNTER_FILE.exists():
            with USAGE_COUNTER_FILE.open("r", encoding="utf-8") as f:
                data = json.load(f)
        data[name] = data.get(name, 0) + 1
        USAGE_COUNTER_FILE.parent.mkdir(parents=True, exist_ok=True)
        with _write_lock, USAGE_COUNTER_FILE.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"更新计数 {name} 失败：{e}")


def get_counters() -> dict:
    """读取全部使用计数。"""
    try:
        if USAGE_COUNTER_FILE.exists():
            with USAGE_COUNTER_FILE.open("r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"读取计数失败：{e}")
    return {}


def record(
    username: str,
    action: str,
    target_id: str = "",
    target_title: str = "",
    detail: str = "",
) -> None:
    """追加一条操作记录；写入失败只打日志，不影响主流程。"""
    entry = {
        "ts": time.time(),
        "username": username,
        "action": action,
        "target_id": target_id,
        "target_title": target_title,
        "detail": detail,
    }
    try:
        AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
        with _write_lock, AUDIT_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"写入审计日志失败：{e}")


def list_entries(
    limit: int = 200,
    offset: int = 0,
    action: Optional[str] = None,
) -> dict:
    """按时间倒序返回审计记录（最新在前），含总数与可用动作类型。"""
    entries: List[dict] = []
    try:
        if AUDIT_FILE.exists():
            with AUDIT_FILE.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        item = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if action and item.get("action") != action:
                        continue
                    entries.append(item)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"读取审计日志失败：{e}")

    actions = sorted({item.get("action", "") for item in entries} - {""})
    total = len(entries)
    page = list(reversed(entries))[offset : offset + limit]
    return {"total": total, "entries": page, "actions": actions}
