"""Environment-driven OpenAI-compatible provider profiles.

DeepSeek, Qwen, OpenAI, and generic gateways deliberately share the same
runtime shape. Provider is metadata for reporting; the upstream adapter is
always ``openai_compatible_llm``.
"""

from dataclasses import dataclass
from os import getenv
from urllib.parse import urlsplit


SUPPORTED_PROVIDERS = {"deepseek", "qwen", "openai", "openai_compatible"}


class ProviderConfigError(ValueError):
    """Raised when the provider configuration is incomplete or invalid."""


@dataclass(frozen=True)
class LLMProviderProfile:
    provider: str
    base_url: str
    api_key: str
    model: str
    temperature: float = 0.3
    timeout: float = 60.0

    @property
    def base_url_host(self) -> str:
        return urlsplit(self.base_url).netloc or urlsplit(self.base_url).path

    def redacted(self) -> dict[str, object]:
        return {
            "provider": self.provider,
            "base_url_host": self.base_url_host,
            "model": self.model,
            "temperature": self.temperature,
            "timeout": self.timeout,
        }


def build_provider_profile(env: dict[str, str] | None = None) -> LLMProviderProfile:
    values = env if env is not None else getenv

    def read(name: str, default: str = "") -> str:
        return values(name, default) if callable(values) else values.get(name, default)

    provider = read("LLM_PROVIDER", "deepseek").strip().lower()
    if provider not in SUPPORTED_PROVIDERS:
        raise ProviderConfigError(
            f"LLM_PROVIDER must be one of {sorted(SUPPORTED_PROVIDERS)}, got {provider!r}"
        )

    required = {name: read(name).strip() for name in ("LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL")}
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise ProviderConfigError("Missing required LLM setting(s): " + ", ".join(missing))
    if not required["LLM_BASE_URL"].startswith(("http://", "https://")):
        raise ProviderConfigError("LLM_BASE_URL must start with http:// or https://")

    try:
        temperature = float(read("LLM_TEMPERATURE", "0.3"))
        timeout = float(read("LLM_TIMEOUT_SECONDS", "60"))
    except ValueError as exc:
        raise ProviderConfigError("LLM_TEMPERATURE and LLM_TIMEOUT_SECONDS must be numbers") from exc
    if not 0 <= temperature <= 2:
        raise ProviderConfigError("LLM_TEMPERATURE must be between 0 and 2")
    if timeout <= 0:
        raise ProviderConfigError("LLM_TIMEOUT_SECONDS must be greater than 0")

    return LLMProviderProfile(
        provider=provider,
        base_url=required["LLM_BASE_URL"],
        api_key=required["LLM_API_KEY"],
        model=required["LLM_MODEL"],
        temperature=temperature,
        timeout=timeout,
    )
