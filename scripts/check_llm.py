#!/usr/bin/env python3
"""Redacted OpenAI-compatible streaming smoke test."""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path

import httpx

from verification.llm_provider import build_provider_profile


PROMPT = "请只回复：连接成功"
REPORT = Path(__file__).resolve().parents[1] / "logs" / "llm-check.json"


async def run() -> dict[str, object]:
    profile = build_provider_profile()
    endpoint = profile.base_url.rstrip("/") + "/chat/completions"
    headers = {"Authorization": f"Bearer {profile.api_key}", "Content-Type": "application/json"}
    payload = {
        "model": profile.model,
        "messages": [{"role": "user", "content": PROMPT}],
        "temperature": profile.temperature,
        "stream": True,
    }
    started = time.perf_counter()
    first_token = None
    text = ""
    streaming = False
    error = ""
    try:
        timeout = httpx.Timeout(profile.timeout)
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", endpoint, headers=headers, json=payload) as response:
                response.raise_for_status()
                streaming = True
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    chunk = json.loads(data)
                    delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content") or ""
                    if delta and first_token is None:
                        first_token = time.perf_counter()
                    text += delta
    except Exception as exc:  # noqa: BLE001 - report a clear smoke-test error
        error = type(exc).__name__ + ": " + str(exc).replace(profile.api_key, "[REDACTED]")

    finished = time.perf_counter()
    result = {
        "provider": profile.provider,
        "model": profile.model,
        "base_url_host": profile.base_url_host,
        "streaming": streaming,
        "first_token_seconds": round(first_token - started, 3) if first_token else None,
        "total_seconds": round(finished - started, 3),
        "result": "PASS" if text == "连接成功" else "PARTIAL" if text else "FAIL",
        "error": error,
    }
    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


if __name__ == "__main__":
    print(json.dumps(asyncio.run(run()), ensure_ascii=False, indent=2))
