"""Validation and public browser configuration for the dual ASR design."""

from dataclasses import dataclass


ASR_MODES = {"auto", "web_speech", "sherpa_onnx"}


@dataclass(frozen=True)
class ASRConfig:
    mode: str = "auto"
    language: str = "zh-CN"
    timeout_seconds: float = 15.0
    interim_results: bool = True
    sherpa_provider: str = "cpu"
    sherpa_num_threads: int = 4


def build_asr_config(env: dict[str, str]) -> ASRConfig:
    mode = env.get("ASR_MODE", "auto").strip().lower()
    if mode not in ASR_MODES:
        raise ValueError(f"ASR_MODE must be one of {sorted(ASR_MODES)}")
    timeout = float(env.get("WEB_SPEECH_TIMEOUT_SECONDS", "15"))
    threads = int(env.get("SHERPA_ONNX_NUM_THREADS", "4"))
    if timeout <= 0 or threads <= 0:
        raise ValueError("ASR timeout and sherpa thread count must be positive")
    return ASRConfig(
        mode=mode,
        language=env.get("WEB_SPEECH_LANGUAGE", "zh-CN").strip() or "zh-CN",
        timeout_seconds=timeout,
        interim_results=env.get("WEB_SPEECH_INTERIM_RESULTS", "true").lower() == "true",
        sherpa_provider=env.get("SHERPA_ONNX_PROVIDER", "cpu").strip().lower(),
        sherpa_num_threads=threads,
    )


def public_browser_config(config: ASRConfig) -> dict[str, object]:
    return {
        "asr_mode": config.mode,
        "web_speech_language": config.language,
        "web_speech_timeout_seconds": config.timeout_seconds,
        "web_speech_interim_results": config.interim_results,
    }
