from pathlib import Path


HOOK = (
    Path(__file__).parents[1]
    / "frontend"
    / "src"
    / "renderer"
    / "src"
    / "hooks"
    / "utils"
    / "use-audio-task.ts"
)


def test_subtitles_do_not_depend_on_generated_audio():
    source = HOOK.read_text(encoding="utf-8")
    subtitle_update = source.index("updateSubtitle(displayText.text)")
    audio_branch = source.index("if (audioBase64)")
    assert subtitle_update < audio_branch


def test_silent_payload_uses_browser_speech_fallback():
    source = HOOK.read_text(encoding="utf-8")
    assert "SpeechSynthesisUtterance" in source
    assert "utterance.lang = 'zh-CN'" in source
