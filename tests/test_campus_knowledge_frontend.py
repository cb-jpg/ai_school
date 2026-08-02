from pathlib import Path


ROOT = Path(__file__).parents[1]
APP = ROOT / "frontend/src/renderer/src/App.tsx"
COMPONENT = ROOT / "frontend/src/renderer/src/components/campus/campus-knowledge.tsx"
DATA = ROOT / "frontend/src/renderer/src/data/campus-knowledge.ts"
HANDLER = ROOT / "src/open_llm_vtuber/websocket_handler.py"


def test_frontend_exposes_three_campus_topics_and_hash_routes():
    app_source = APP.read_text(encoding="utf-8")
    component_source = COMPONENT.read_text(encoding="utf-8")
    data_source = DATA.read_text(encoding="utf-8")

    assert "#/campus/${topicId}" in app_source
    assert "campus-navigation" in component_source
    assert "campus-nav-${topic.id}" in component_source
    assert "id: 'history'" in data_source
    assert "id: 'achievements'" in data_source
    assert "id: 'role-models'" in data_source
    assert "佛山市南海区石实实验学校" in data_source
    assert "石门实验学校”变更为“石实实验学校" in data_source
    assert "陈曼涵" in data_source
    assert "邓桢" in data_source
    assert "陈哲章" in data_source
    assert "模拟案例" not in data_source
    assert "sources:" in data_source
    assert "启航实验中学" not in data_source


def test_campus_narration_bypasses_llm_and_uses_static_message_type():
    component_source = COMPONENT.read_text(encoding="utf-8")
    handler_source = HANDLER.read_text(encoding="utf-8")

    assert "type: 'static-narration'" in component_source
    assert '"static-narration": self._handle_static_narration' in handler_source
    assert "process_static_narration" in handler_source
