import asyncio
import json
import os
import re
import threading
import time
import uuid
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import List, Optional, Dict, Tuple
from loguru import logger

from ..agent.output_types import DisplayText, Actions
from ..live2d_model import Live2dModel
from ..tts.tts_interface import TTSInterface
from ..utils.stream_audio import (
    build_audio_payload,
    encode_audio_payload_basics,
    prepare_audio_payload,
)
from ..utils.turn_latency import current_span
from .types import WebSocketSend

# 句级 TTS 缓存：key=(voice, text) → (audio_base64, volumes)。
# TTSTaskManager 每轮会话新建，缓存必须放模块级才能跨用户命中——
# 专题讲解（static-narration 固定文本）、连接问候、重复演示问题等
# 只有第一个人真调 TTS 合成，其余直接复用，大幅降低高并发下 edge-tts 上游压力。
_TTS_CACHE_MAX = 256
_tts_payload_cache: "OrderedDict[Tuple[str, str], Tuple[str, list]]" = OrderedDict()
_tts_cache_lock = threading.Lock()


def _tts_cache_get(key: Tuple[str, str]) -> Optional[Tuple[str, list]]:
    with _tts_cache_lock:
        item = _tts_payload_cache.get(key)
        if item is None:
            return None
        _tts_payload_cache.move_to_end(key)
        return item


def _tts_cache_put(key: Tuple[str, str], value: Tuple[str, list]) -> None:
    with _tts_cache_lock:
        _tts_payload_cache[key] = value
        _tts_payload_cache.move_to_end(key)
        while len(_tts_payload_cache) > _TTS_CACHE_MAX:
            _tts_payload_cache.popitem(last=False)


# 合成并发上限：edge-tts 每次合成经 to_thread 占住一个默认线程池线程直到
# 网络完成（0.5-2s），高并发突发下与音频编码/ASR 挤满默认 executor，
# 同时对微软端点形成 TLS 握手风暴（长尾劣化）。用 FIFO 信号量整流——
# 各轮首句按到达顺序排队、等待有界（N=64÷3 workers≈21 首句/worker，
# ÷12 并发 × ~0.7s ≈ 首句最多等 ~1.5s）；少用户时无竞争零影响。
# 旋钮 OLLV_TTS_MAX_CONC（设为 0/负数 = 退化为串行合成，作紧急刹车）。
_TTS_MAX_CONC = max(1, int(os.environ.get("OLLV_TTS_MAX_CONC", "12")))
_SYNTH_SEMAPHORE = asyncio.Semaphore(_TTS_MAX_CONC)

# 音频编码专用池（mp3 解码/WAV 重编码/base64/RMS）：不再与合成线程
# 共享默认 executor，编码永远不会排在 12 路合成线程后面
_ENCODE_EXECUTOR = ThreadPoolExecutor(max_workers=8, thread_name_prefix="audio-encode")


class TTSTaskManager:
    """Manages TTS tasks and ensures ordered delivery to frontend while allowing parallel TTS generation"""

    def __init__(self) -> None:
        self.task_list: List[asyncio.Task] = []
        self._lock = asyncio.Lock()
        # Queue to store ordered payloads
        self._payload_queue: asyncio.Queue[Dict] = asyncio.Queue()
        # Task to handle sending payloads in order
        self._sender_task: Optional[asyncio.Task] = None
        # Counter for maintaining order
        self._sequence_counter = 0
        self._next_sequence_to_send = 0

    async def speak(
        self,
        tts_text: str,
        display_text: DisplayText,
        actions: Optional[Actions],
        live2d_model: Live2dModel,
        tts_engine: TTSInterface,
        websocket_send: WebSocketSend,
    ) -> None:
        """
        Queue a TTS task while maintaining order of delivery.

        Args:
            tts_text: Text to synthesize
            display_text: Text to display in UI
            actions: Live2D model actions
            live2d_model: Live2D model instance
            tts_engine: TTS engine instance
            websocket_send: WebSocket send function
        """
        if len(re.sub(r'[\s.,!?，。！？\'"』」）】\s]+', "", tts_text)) == 0:
            logger.debug("Empty TTS text, sending silent display payload")
            # Get current sequence number for silent payload
            current_sequence = self._sequence_counter
            self._sequence_counter += 1

            # Start sender task if not running
            if not self._sender_task or self._sender_task.done():
                self._sender_task = asyncio.create_task(
                    self._process_payload_queue(websocket_send)
                )

            await self._send_silent_payload(display_text, actions, current_sequence)
            return

        logger.debug(
            f"🏃Queuing TTS task for: '''{tts_text}''' (by {display_text.name})"
        )

        # Get current sequence number
        current_sequence = self._sequence_counter
        self._sequence_counter += 1

        # Start sender task if not running
        if not self._sender_task or self._sender_task.done():
            self._sender_task = asyncio.create_task(
                self._process_payload_queue(websocket_send)
            )

        # Create and queue the TTS task
        task = asyncio.create_task(
            self._process_tts(
                tts_text=tts_text,
                display_text=display_text,
                actions=actions,
                live2d_model=live2d_model,
                tts_engine=tts_engine,
                sequence_number=current_sequence,
            )
        )
        self.task_list.append(task)

    async def _process_payload_queue(self, websocket_send: WebSocketSend) -> None:
        """
        Process and send payloads in correct order.
        Runs continuously until all payloads are processed.
        """
        buffered_payloads: Dict[int, Dict] = {}

        while True:
            try:
                # Get payload from queue
                payload, sequence_number = await self._payload_queue.get()
                buffered_payloads[sequence_number] = payload

                # Send payloads in order
                while self._next_sequence_to_send in buffered_payloads:
                    next_payload = buffered_payloads.pop(self._next_sequence_to_send)
                    span = current_span()
                    t_dumps = time.monotonic()
                    payload_text = json.dumps(next_payload)
                    if span is not None:
                        span.set_once("dumps", round(time.monotonic() - t_dumps, 3))
                    await websocket_send(payload_text)
                    # LATENCY 汇总行：首个 payload（sequence 0）发出即客户端"开口"时刻
                    if span is not None and not span.logged and self._next_sequence_to_send == 0:
                        span.mark("open")
                        span.emit()
                    self._next_sequence_to_send += 1

                self._payload_queue.task_done()

            except asyncio.CancelledError:
                break

    async def _send_silent_payload(
        self,
        display_text: DisplayText,
        actions: Optional[Actions],
        sequence_number: int,
    ) -> None:
        """Queue a silent audio payload"""
        audio_payload = prepare_audio_payload(
            audio_path=None,
            display_text=display_text,
            actions=actions,
        )
        await self._payload_queue.put((audio_payload, sequence_number))

    async def _process_tts(
        self,
        tts_text: str,
        display_text: DisplayText,
        actions: Optional[Actions],
        live2d_model: Live2dModel,
        tts_engine: TTSInterface,
        sequence_number: int,
    ) -> None:
        """Process TTS generation and queue the result for ordered delivery"""
        audio_file_path = None
        try:
            cache_key = (str(getattr(tts_engine, "voice", "")), tts_text)
            cached = _tts_cache_get(cache_key)
            if cached is not None:
                audio_base64, volumes = cached
                span = current_span()
                if span is not None:
                    span.set_once("cached", True)
            else:
                # 合成整流：只包住合成调用（FIFO 排队等待计入 tts_q 打点）；
                # 编码与 payload 队列不碰信号量，无死锁路径
                async with _SYNTH_SEMAPHORE:
                    audio_file_path = await self._generate_audio(tts_engine, tts_text)
                # 解码/重编码/base64 是 CPU 密集操作，跑专用编码池，
                # 不再阻塞事件循环、也不再排在合成线程后面
                span = current_span()
                t_encode = time.monotonic()
                loop = asyncio.get_running_loop()
                audio_base64, volumes = await loop.run_in_executor(
                    _ENCODE_EXECUTOR, encode_audio_payload_basics, audio_file_path
                )
                if span is not None:
                    span.set_once("enc", round(time.monotonic() - t_encode, 3))
                _tts_cache_put(cache_key, (audio_base64, volumes))
            payload = build_audio_payload(
                audio_base64=audio_base64,
                volumes=volumes,
                display_text=display_text,
                actions=actions,
            )
            # Queue the payload with its sequence number
            await self._payload_queue.put((payload, sequence_number))

        except Exception as e:
            logger.error(f"Error preparing audio payload: {e}")
            # Queue silent payload for error case
            payload = prepare_audio_payload(
                audio_path=None,
                display_text=display_text,
                actions=actions,
            )
            await self._payload_queue.put((payload, sequence_number))

        finally:
            if audio_file_path:
                tts_engine.remove_file(audio_file_path)
                logger.debug("Audio cache file cleaned.")

    async def _generate_audio(self, tts_engine: TTSInterface, text: str) -> str:
        """Generate audio file from text"""
        logger.debug(f"🏃Generating audio for '''{text}'''...")
        # LATENCY 分段计时：tts_q=排队等线程时间，synth=合成本身耗时
        # （线程内取不到 contextvar，用 timings dict 带回时刻）
        span = current_span()
        timings = {"submit": time.monotonic()} if span is not None else None
        path = await tts_engine.async_generate_audio(
            text=text,
            file_name_no_ext=f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{str(uuid.uuid4())[:8]}",
            timings=timings,
        )
        if span is not None and timings and "start" in timings and "end" in timings:
            span.set_once("tts_q", round(timings["start"] - timings["submit"], 3))
            span.set_once("synth", round(timings["end"] - timings["start"], 3))
        return path

    def clear(self) -> None:
        """Clear all pending tasks and reset state"""
        self.task_list.clear()
        if self._sender_task:
            self._sender_task.cancel()
        self._sequence_counter = 0
        self._next_sequence_to_send = 0
        # Create a new queue to clear any pending items
        self._payload_queue = asyncio.Queue()
