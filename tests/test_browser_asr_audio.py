import numpy as np
import pytest

from src.open_llm_vtuber.asr.audio_preprocessor import (
    is_plausible_chinese_transcript,
    prepare_browser_audio,
)


def test_prepare_browser_audio_rejects_silence():
    with pytest.raises(ValueError, match="No clear speech"):
        prepare_browser_audio(np.zeros(16000, dtype=np.float32))


def test_prepare_browser_audio_normalizes_quiet_speech_like_signal():
    time = np.arange(16000, dtype=np.float32) / 16000
    audio = 0.01 * np.sin(2 * np.pi * 220 * time)
    normalized, metrics = prepare_browser_audio(audio)
    assert metrics["duration"] == pytest.approx(1.0)
    assert np.max(np.abs(normalized)) > 0.05


@pytest.mark.parametrize(
    ("text", "expected"),
    [("你好。", True), ("그.", False), ("テスト", False), ("OpenAI 123", True)],
)
def test_chinese_transcript_guard(text, expected):
    assert is_plausible_chinese_transcript(text) is expected
