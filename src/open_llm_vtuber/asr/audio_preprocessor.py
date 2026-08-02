import re

import numpy as np


def prepare_browser_audio(
    audio: np.ndarray,
    sample_rate: int = 16000,
) -> tuple[np.ndarray, dict[str, float]]:
    """Validate and normalize mono browser audio before offline ASR."""
    samples = np.asarray(audio, dtype=np.float32).reshape(-1)
    if samples.size == 0 or not np.isfinite(samples).all():
        raise ValueError("Invalid or empty audio")

    duration = samples.size / sample_rate
    if duration < 0.4:
        raise ValueError("Recording is too short")

    samples = samples - float(np.mean(samples))
    peak = float(np.max(np.abs(samples)))
    rms = float(np.sqrt(np.mean(np.square(samples))))
    if peak < 0.004 or rms < 0.0005:
        raise ValueError(
            "No clear speech detected "
            f"(duration={duration:.2f}s, rms={rms:.6f}, peak={peak:.6f})"
        )

    gain = min(8.0, 0.95 / peak)
    normalized = np.clip(samples * gain, -1.0, 1.0).astype(np.float32)
    return normalized, {"duration": duration, "peak": peak, "rms": rms, "gain": gain}


def is_plausible_chinese_transcript(text: str) -> bool:
    """Reject common non-Chinese hallucinations from short/noisy SenseVoice input."""
    normalized = text.strip()
    if not normalized:
        return False
    has_han = bool(re.search(r"[\u3400-\u4dbf\u4e00-\u9fff]", normalized))
    has_hangul_or_kana = bool(re.search(r"[\u3040-\u30ff\uac00-\ud7af]", normalized))
    return has_han or not has_hangul_or_kana
