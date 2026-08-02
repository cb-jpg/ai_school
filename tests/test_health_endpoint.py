import asyncio
from pathlib import Path


def test_health_route_is_declared():
    source = (Path(__file__).parents[1] / "src" / "open_llm_vtuber" / "routes.py").read_text(encoding="utf-8")
    assert '@router.get("/health")' in source
    assert '@router.websocket("/client-ws")' in source or 'init_client_ws_route' in source


def test_health_endpoint_returns_ready_without_network():
    from src.open_llm_vtuber.routes import init_webtool_routes

    class DummyContext:
        asr_engine = object()
        tts_engine = object()
        agent_engine = object()

    router = init_webtool_routes(DummyContext())
    route = next(item for item in router.routes if item.path == "/health")
    result = asyncio.run(route.endpoint())
    assert result == {"status": "ok", "ready": True, "version": "v1.2.1"}
