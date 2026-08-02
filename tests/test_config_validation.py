from pathlib import Path


def test_verification_template_contains_required_architecture_choices():
    template = (Path(__file__).parents[1] / "config_alts" / "server_verification.yaml").read_text(encoding="utf-8")
    assert "openai_compatible_llm" in template
    assert "sense_voice" in template
    assert "model.onnx" in template
    assert "edge_tts" in template
    assert "LLM_API_KEY" in template
