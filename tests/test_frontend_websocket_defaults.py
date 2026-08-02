from pathlib import Path


ROOT = Path(__file__).parents[1]
CONTEXT = ROOT / "frontend/src/renderer/src/context/websocket-context.tsx"
HANDLER = ROOT / "frontend/src/renderer/src/services/websocket-handler.tsx"
SERVICE = ROOT / "frontend/src/renderer/src/services/websocket-service.tsx"
TEXT_INPUT = ROOT / "frontend/src/renderer/src/hooks/footer/use-text-input.tsx"


def test_web_frontend_uses_same_origin_websocket_and_http_base():
    source = CONTEXT.read_text(encoding="utf-8")
    assert "window.location.host" in source
    assert "window.location.origin" in source
    assert "window.location.protocol === 'https:' ? 'wss:' : 'ws:'" in source


def test_legacy_loopback_browser_settings_are_migrated():
    context = CONTEXT.read_text(encoding="utf-8")
    handler = HANDLER.read_text(encoding="utf-8")
    assert "normalizeWsUrl" in context
    assert "normalizeBaseUrl" in context
    assert "migrated legacy URL" in handler
    assert "persistWsUrl(wsUrl)" in handler


def test_text_submission_fails_loudly_when_websocket_is_closed():
    service = SERVICE.read_text(encoding="utf-8")
    text_input = TEXT_INPUT.read_text(encoding="utf-8")
    assert "sendMessage(message: object): boolean" in service
    assert "return false" in service
    assert "if (!sent)" in text_input
    assert "websocket-not-open" in text_input
