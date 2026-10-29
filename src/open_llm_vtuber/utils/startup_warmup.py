"""启动预热（2026-10-29 延迟优化，不影响任何输出）。

每个 worker 初始化完成后在后台把两条「只有第一个真实用户才会踩到」的冷路径
跑热（LATENCY 实测：RAG 首查每 worker 2.7~3.3s，热后 0.056s；edge-tts 首次
合成含初始化/建连开销）：

- RAG：跑一次检索，把嵌入查询/分词/向量索引整条链路初始化好。检索结果只进
  进程内查询缓存（TTL 180s）与向量缓存，键为预热专用查询，不会与真实提问
  相撞；不走 retrieve_and_enrich_input，不写未答问题日志。
- TTS：合成一句固定短语，把引擎初始化与首次建连开销消化掉；音频只进句缓存。

实现注记：必须用独立守护线程承载自己的事件循环——initialize() 由
asyncio.run 驱动，任务若建在那条循环上会随 asyncio.run 返回被一并取消
（v1 实测 warmup=0 的原因）；FastAPI 0.141 又已移除 add_event_handler，
挂不上 startup 事件。RAG 锁均为 threading.Lock、search 走调用方循环的
executor，TTS 基类经 asyncio.to_thread 落回同步方法，跨循环调用安全。

全部后台执行、异常吞掉只留日志，失败等价于没有预热（与旧行为一致）。
开关：环境变量 OLLV_STARTUP_WARMUP=0 关闭。
"""

import asyncio
import os
import threading
import time

from loguru import logger

_WARMUP_ENABLED = os.environ.get("OLLV_STARTUP_WARMUP", "1") == "1"

_WARMUP_QUERY = "学校简介"
_WARMUP_TEXT = "你好。"


async def _warm(context) -> None:
    # RAG 冷路径（嵌入模型已在启动时加载，这里热的是首查链路本身）。
    # 全库检索索引按「可见条目集合」为键缓存，登录态与游客（屏蔽 students
    # 类目）是两个键，各建一次，否则该变体的第一个真实用户仍付全量重建。
    try:
        from ..knowledge.rag_service import (
            GUEST_EXCLUDED_CATEGORIES,
            get_rag_service,
        )

        svc = get_rag_service()
        t = time.monotonic()
        docs = await svc.search(_WARMUP_QUERY, top_k=3)
        t_rag = time.monotonic() - t
        t2 = time.monotonic()
        docs_guest = await svc.search(
            _WARMUP_QUERY, top_k=3, exclude_categories=GUEST_EXCLUDED_CATEGORIES
        )
        logger.info(
            f"[warmup] RAG 预热完成 登录态{t_rag:.2f}s（命中 {len(docs)} 条）"
            f"/游客{time.monotonic() - t2:.2f}s（命中 {len(docs_guest)} 条）"
        )
    except Exception as e:  # noqa: BLE001 — 预热失败不应影响服务
        logger.warning(f"[warmup] RAG 预热失败（等价未预热）: {e}")

    # TTS 冷路径（首次合成含引擎初始化/建连）
    try:
        t = time.monotonic()
        await context.tts_engine.async_generate_audio(
            text=_WARMUP_TEXT, file_name_no_ext="warmup"
        )
        logger.info(f"[warmup] TTS 预热完成 {time.monotonic() - t:.2f}s")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[warmup] TTS 预热失败（等价未预热）: {e}")


def _run_warmup_in_thread(context) -> None:
    try:
        asyncio.run(_warm(context))
    except Exception as e:  # noqa: BLE001 — 预热失败不应影响服务
        logger.warning(f"[warmup] 预热线程异常（等价未预热）: {e}")


def start_background_warmup(default_context_cache) -> None:
    """initialize() 内调用：起独立守护线程做预热，与主循环生命周期解耦。"""
    if not _WARMUP_ENABLED:
        return
    threading.Thread(
        target=_run_warmup_in_thread,
        args=(default_context_cache,),
        name="ollv-startup-warmup",
        daemon=True,
    ).start()
