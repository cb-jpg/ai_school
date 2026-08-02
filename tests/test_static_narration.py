import asyncio

import pytest

from src.open_llm_vtuber.conversations.static_narration import (
    MAX_NARRATION_SEGMENTS,
    MAX_NARRATION_SEGMENT_CHARS,
    normalize_narration_segments,
    normalize_narration_title,
)
from src.open_llm_vtuber.websocket_handler import WebSocketHandler


def test_static_narration_normalizes_copy():
    assert normalize_narration_title("  校史   导览  ") == "校史 导览"
    assert normalize_narration_segments(
        ["  第一段。  ", "", "第二段。\n继续。"]
    ) == ["第一段。", "第二段。 继续。"]


def test_static_narration_rejects_non_text_segments():
    with pytest.raises(ValueError, match="only text"):
        normalize_narration_segments(["有效内容", 123])


def test_static_narration_rejects_excessive_requests():
    with pytest.raises(ValueError, match="Too many"):
        normalize_narration_segments(["内容"] * (MAX_NARRATION_SEGMENTS + 1))

    with pytest.raises(ValueError, match="too long"):
        normalize_narration_segments(["讲" * (MAX_NARRATION_SEGMENT_CHARS + 1)])


def test_static_narration_rejects_empty_copy():
    with pytest.raises(ValueError, match="empty"):
        normalize_narration_segments([" ", "\n"])


def test_interrupting_static_narration_skips_agent_history_path():
    async def scenario():
        handler = WebSocketHandler(default_context_cache=None)
        task = asyncio.create_task(asyncio.sleep(60))
        handler.current_conversation_tasks["client"] = task
        handler.static_narration_tasks["client"] = task

        await handler._handle_interrupt(None, "client", {})

        assert task.cancelled()
        assert "client" not in handler.current_conversation_tasks
        assert "client" not in handler.static_narration_tasks

    asyncio.run(scenario())
