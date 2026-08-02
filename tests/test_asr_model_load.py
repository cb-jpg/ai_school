from pathlib import Path

import pytest


def test_sensevoice_int8_files_are_checked_when_present():
    model_dir = Path(__file__).parents[1] / "models" / "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17"
    model = model_dir / "model.int8.onnx"
    tokens = model_dir / "tokens.txt"
    if not model.exists() or not tokens.exists():
        pytest.skip("SenseVoice model is not downloaded yet")
    assert model.stat().st_size > 0
    assert tokens.stat().st_size > 0
