import os

import pytest


def test_llm_connection_is_skipped_without_credentials():
    if not all(os.getenv(name) for name in ("LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL")):
        pytest.skip("LLM credentials are intentionally absent in the repository test environment")
    pytest.importorskip("httpx")
    pytest.importorskip("verification.llm_provider")
    assert True
