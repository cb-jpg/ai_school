from pathlib import Path


HOOK = Path(__file__).parents[1] / "frontend" / "src" / "renderer" / "src" / "hooks" / "footer" / "use-dual-asr.ts"


def test_frontend_keeps_auto_fallback_and_manual_modes():
    source = HOOK.read_text(encoding="utf-8")
    assert "web_speech" in source
    assert "sherpa_onnx" in source
    assert "serverCaptureActive" in source
    assert "runServerFallback" in source
    assert "permissionAlreadyGranted" in source
    assert "no-speech" in source
    assert "getAudioTrack" in source
    assert "decoded.numberOfChannels" in source
    assert "lastError" in source


def test_web_speech_watchdog_starts_before_browser_recognition():
    source = HOOK.read_text(encoding="utf-8")
    watchdog = source.index("timer = window.setTimeout")
    browser_start = source.index("recognition.start(", watchdog)
    assert watchdog < browser_start
