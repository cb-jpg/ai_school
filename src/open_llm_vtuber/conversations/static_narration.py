import asyncio
import json
from typing import Any, Iterable

from loguru import logger

from ..agent.output_types import Actions, DisplayText, SentenceOutput
from ..service_context import ServiceContext
from .conversation_utils import (
    cleanup_conversation,
    finalize_conversation_turn,
    process_agent_output,
    send_conversation_end_signal,
    send_conversation_start_signals,
)
from .tts_manager import TTSTaskManager
from .types import WebSocketSend


MAX_NARRATION_SEGMENTS = 12
MAX_NARRATION_SEGMENT_CHARS = 600
MAX_NARRATION_TOTAL_CHARS = 5000
MAX_NARRATION_TITLE_CHARS = 80


def normalize_narration_title(value: Any) -> str:
    """Validate a browser-provided static narration title."""
    if not isinstance(value, str):
        return "校园知识讲解"
    title = " ".join(value.split()).strip()
    return title[:MAX_NARRATION_TITLE_CHARS] or "校园知识讲解"


def normalize_narration_segments(value: Any) -> list[str]:
    """Return safe, non-empty narration segments with bounded TTS cost."""
    if not isinstance(value, list):
        raise ValueError("Narration segments must be a list")
    if len(value) > MAX_NARRATION_SEGMENTS:
        raise ValueError("Too many narration segments")

    segments: list[str] = []
    total_chars = 0
    for item in value:
        if not isinstance(item, str):
            raise ValueError("Narration segments must contain only text")
        segment = " ".join(item.split()).strip()
        if not segment:
            continue
        if len(segment) > MAX_NARRATION_SEGMENT_CHARS:
            raise ValueError("Narration segment is too long")
        total_chars += len(segment)
        if total_chars > MAX_NARRATION_TOTAL_CHARS:
            raise ValueError("Narration is too long")
        segments.append(segment)

    if not segments:
        raise ValueError("Narration is empty")
    return segments


async def process_static_narration(
    context: ServiceContext,
    websocket_send: WebSocketSend,
    client_uid: str,
    title: str,
    segments: Iterable[str],
) -> None:
    """Speak trusted static page copy without sending it through the LLM."""
    tts_manager = TTSTaskManager()
    session_label = f"static:{title}"

    try:
        await send_conversation_start_signals(websocket_send)
        await websocket_send(
            json.dumps(
                {
                    "type": "full-text",
                    "text": f"正在讲解：{title}",
                },
                ensure_ascii=False,
            )
        )

        for segment in segments:
            output = SentenceOutput(
                display_text=DisplayText(text=segment),
                tts_text=segment,
                actions=Actions(),
            )
            await process_agent_output(
                output=output,
                character_config=context.character_config,
                live2d_model=context.live2d_model,
                tts_engine=context.tts_engine,
                websocket_send=websocket_send,
                tts_manager=tts_manager,
                # Static Chinese copy should be spoken exactly as authored.
                translate_engine=None,
            )

        await finalize_conversation_turn(
            tts_manager=tts_manager,
            websocket_send=websocket_send,
            client_uid=client_uid,
        )
        logger.info(
            "Static narration completed: client_uid={} title={} segments={}",
            client_uid,
            title,
            len(tts_manager.task_list),
        )
    except asyncio.CancelledError:
        logger.info(
            "Static narration cancelled: client_uid={} title={}",
            client_uid,
            title,
        )
        raise
    except Exception as error:
        logger.exception("Static narration failed: {}", error)
        await websocket_send(
            json.dumps(
                {
                    "type": "error",
                    "message": f"静态讲解失败：{error}",
                },
                ensure_ascii=False,
            )
        )
        await send_conversation_end_signal(websocket_send, None)
    finally:
        cleanup_conversation(tts_manager, session_label)
