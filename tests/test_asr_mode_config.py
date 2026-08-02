import pytest

from verification.asr_config import build_asr_config


@pytest.mark.parametrize("mode", ["auto", "web_speech", "sherpa_onnx"])
def test_supported_asr_modes(mode):
    config = build_asr_config({"ASR_MODE": mode})
    assert config.mode == mode
    assert config.language == "zh-CN"


def test_invalid_asr_mode_is_rejected():
    with pytest.raises(ValueError):
        build_asr_config({"ASR_MODE": "unknown"})
