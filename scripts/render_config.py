#!/usr/bin/env python3
"""Render the verification YAML from environment variables without logging secrets."""

from __future__ import annotations

import os
import re
import stat
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "config_alts" / "server_verification.yaml"
OUTPUT = ROOT / "conf.yaml"
ENV_FILE = ROOT / ".env"
PLACEHOLDER = re.compile(r"\$\{([A-Z0-9_]+)\}")


def read_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        values[key] = value
    return values


def render() -> None:
    dotenv = read_dotenv(ENV_FILE)
    merged = {**dotenv, **os.environ}
    content = TEMPLATE.read_text(encoding="utf-8")
    missing: set[str] = set()

    def replace(match: re.Match[str]) -> str:
        name = match.group(1)
        value = merged.get(name, "")
        if not value:
            missing.add(name)
        return value

    rendered = PLACEHOLDER.sub(replace, content)
    required = {"APP_HOST", "APP_PORT", "LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"}
    missing.update(name for name in required if not merged.get(name))
    if missing:
        raise SystemExit("Missing required .env setting(s): " + ", ".join(sorted(missing)))
    if PLACEHOLDER.search(rendered):
        raise SystemExit("Unresolved configuration placeholder remains")

    OUTPUT.write_text(rendered, encoding="utf-8")
    OUTPUT.chmod(stat.S_IRUSR | stat.S_IWUSR)


if __name__ == "__main__":
    render()
