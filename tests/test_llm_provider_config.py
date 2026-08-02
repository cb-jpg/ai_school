from verification.llm_provider import ProviderConfigError, build_provider_profile


def test_profiles_share_openai_compatible_shape():
    for provider in ("deepseek", "qwen", "openai", "openai_compatible"):
        profile = build_provider_profile(
            {
                "LLM_PROVIDER": provider,
                "LLM_BASE_URL": "https://example.invalid/v1",
                "LLM_API_KEY": "test-key",
                "LLM_MODEL": "test-model",
            }
        )
        assert profile.provider == provider
        assert profile.base_url == "https://example.invalid/v1"
        assert profile.redacted()["base_url_host"] == "example.invalid"


def test_provider_does_not_accept_missing_secret():
    try:
        build_provider_profile(
            {
                "LLM_PROVIDER": "qwen",
                "LLM_BASE_URL": "https://example.invalid/v1",
                "LLM_MODEL": "test-model",
            }
        )
    except ProviderConfigError as error:
        assert "LLM_API_KEY" in str(error)
    else:
        raise AssertionError("missing API key must be rejected")
