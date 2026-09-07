"""每轮对话的开口延迟分段计时（LATENCY 日志，2026-09-07）。

把 text-input → 首个音频 payload 发出的每一站耗时落成一行可 grep 的
`LATENCY|...` INFO 日志，压测与线上都可直接看出延迟花在哪一段
（RAG / 历史写入 / LLM 首字 / 首句 TTS 合成 / 编码 / 序列化）。

用法约定：
- turn 协程入口调用 begin_turn()：创建 span 并绑定 contextvar，对该 task
  及其后续 create_task 子树可见；打点处 span = current_span()，span 为
  None 一律跳过（群聊 / static-narration / 管理端等非 turn 路径零影响）。
- 线程池内取不到 contextvar（run_in_executor 不复制上下文变量），RAG
  检索 / TTS 合成等线程段用显式 timings dict 带回 submit/start/end 时刻，
  由调用方在事件循环侧换算成耗时后 set_once 写入 span。
- 单连接可同时有多轮在飞（uid 会撞），所以 span 按 task 隔离、日志用
  随机 turn_id 自标识，任何打点都不要以 uid 为键。

日志只在首个音频 payload 发出时由 tts_manager 打印一次（open = 客户端
视角的开口时刻）；非 turn 路径没有 span，自然不打印。

开关：环境变量 OLLV_LATENCY_LOG=0 静默（默认开）。
"""

import os
import time
from contextvars import ContextVar
from dataclasses import dataclass, field
from uuid import uuid4

from loguru import logger

LATENCY_LOG_ENABLED = os.environ.get("OLLV_LATENCY_LOG", "1") == "1"

# 字段顺序即日志字段顺序；除标注外均为秒（时刻=距 t0，时长=持续）
_SPAN_FIELDS = (
    "sched",      # create_task → 协程真正开跑（事件循环调度延迟）
    "open",       # 首个音频 payload 发出时刻（客户端开口时刻）
    "rag",        # RAG 检索 run_in_executor 总耗时；查询缓存命中时为 '-'（见 rag_cache）
    "rag_q",      # 其中排队等线程时间（submit→线程开跑）
    "rag_exec",   # 其中线程内执行时间
    "rag_cache",  # 1=查询 TTL 缓存命中
    "rag_hit",    # 1=检索到资料
    "hist",       # 用户消息历史写入 await 耗时（压测不建历史时为 '-'）
    "llm_req",    # 发出 LLM 请求的时刻
    "llm_hdr",    # 流式响应返回时刻（llm_hdr-llm_req ≈ 连接+上游排队）
    "llm_ttft",   # 首个非空 token 时刻
    "fs_chars",   # 首句字符数
    "tts_q",      # 首句合成排队等线程时间
    "synth",      # 首句 edge-tts 合成耗时
    "enc",        # 首句音频编码耗时
    "dumps",      # 首个 payload json.dumps 耗时
    "cached",     # 1=首句命中 TTS 句缓存（此时 synth/enc 为 '-'）
)
_BOOL_FIELDS = {"rag_cache", "rag_hit", "cached"}
_INT_FIELDS = {"fs_chars"}


@dataclass
class TurnSpan:
    uid: str
    t0: float
    turn_id: str = field(default_factory=lambda: uuid4().hex[:6])
    logged: bool = False
    values: dict = field(default_factory=dict)

    def set_once(self, name: str, value) -> None:
        """首次写胜出：一个打点可能被多条路径触达，只保留第一处的值"""
        if name not in self.values:
            self.values[name] = value

    def mark(self, name: str) -> None:
        """记录"距 t0 的时刻"型打点"""
        self.set_once(name, round(time.monotonic() - self.t0, 3))

    def summary_line(self) -> str:
        out = [f"uid={self.uid[:8]}", f"id={self.turn_id}"]
        for name in _SPAN_FIELDS:
            v = self.values.get(name)
            if v is None:
                out.append(f"{name}=-")
            elif name in _BOOL_FIELDS:
                out.append(f"{name}={1 if v else 0}")
            elif name in _INT_FIELDS:
                out.append(f"{name}={int(v)}")
            else:
                out.append(f"{name}={float(v):.3f}")
        return "|".join(out)

    def emit(self) -> None:
        """打印整轮 LATENCY 汇总行（每个 span 只发一次）"""
        if self.logged or not LATENCY_LOG_ENABLED:
            return
        self.logged = True
        logger.info("LATENCY|{}", self.summary_line())


_turn_span: ContextVar["TurnSpan | None"] = ContextVar("ollv_turn_span", default=None)


def current_span() -> "TurnSpan | None":
    return _turn_span.get()


def begin_turn(uid: str, turn_t0: "float | None" = None) -> "TurnSpan | None":
    """turn 协程入口调用：绑定 span。turn_t0 为 create_task 前取的时刻，
    差值即事件循环调度延迟；未开启日志时返回 None，全链路零开销。"""
    if not LATENCY_LOG_ENABLED:
        return None
    span = TurnSpan(uid=uid, t0=turn_t0 if turn_t0 is not None else time.monotonic())
    _turn_span.set(span)
    return span
