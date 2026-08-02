import os

import pytest


def test_edge_tts_configuration_is_present():
    assert os.getenv("EDGE_TTS_VOICE", "zh-CN-XiaoxiaoNeural")
    pytest.importorskip("edge_tts")
