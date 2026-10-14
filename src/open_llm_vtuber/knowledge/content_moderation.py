"""
敏感词过滤（2026-10-14 合规材料包：输出为文本的敏感词拦截）

词表：knowledge/sensitive_words.txt（每行一词，# 为注释，按类别分节），
校方可直接增删后重启生效（带 mtime 缓存，无需改代码）。

总开关：环境变量 OLLV_SENSITIVE_FILTER（默认开，=0 关）。
匹配：归一化（去空白+小写）后子串匹配——校园演示场景下可接受，
误杀由词表收敛兜底（12 题回归问法须零命中，见 check_content_moderation.py）。
"""

import os
import threading
from pathlib import Path
from typing import List

from loguru import logger

WORDS_FILE = Path(__file__).resolve().parent / "sensitive_words.txt"

_refusal_text = "这个话题我不太方便聊，我们聊点别的吧～"

_lock = threading.Lock()
_cache_words: List[str] = []
_cache_sig: tuple | None = None


def is_enabled() -> bool:
    return os.environ.get("OLLV_SENSITIVE_FILTER", "1") != "0"


def get_refusal_text() -> str:
    return _refusal_text


def _load_words() -> List[str]:
    """读取词表（按 mtime+size 缓存；文件缺失/读失败返回已缓存或空表，不抛错）。"""
    global _cache_words, _cache_sig
    try:
        st = WORDS_FILE.stat()
        sig = (st.st_mtime_ns, st.st_size)
    except OSError:
        return _cache_words
    with _lock:
        if _cache_sig == sig:
            return _cache_words
        try:
            words: List[str] = []
            for line in WORDS_FILE.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                # 行内 # 后同样当注释（支持 "词 # 说明" 写法）
                word = line.split("#", 1)[0].strip()
                if word:
                    words.append(word)
            _cache_words = words
            _cache_sig = sig
            logger.info(f"敏感词表已加载：{len(words)} 词（{WORDS_FILE.name}）")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"敏感词表读取失败，沿用旧表：{e}")
        return _cache_words


def check_text(text: str) -> List[str]:
    """返回输入文本命中的敏感词列表（去重、按词表顺序）；未命中返回空表。"""
    if not is_enabled() or not text:
        return []
    words = _load_words()
    if not words:
        return []
    normalized = "".join(str(text).split()).lower()
    hits: List[str] = []
    for word in words:
        w = "".join(word.split()).lower()
        if w and w in normalized and word not in hits:
            hits.append(word)
    return hits
