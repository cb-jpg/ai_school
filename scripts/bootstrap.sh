#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
UV_CACHE_DIR="${UV_CACHE_DIR:-/tmp/open-llm-vtuber-uv-cache}"
export UV_CACHE_DIR

fail=0
for command_name in git curl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Missing system dependency: %s\n' "$command_name" >&2
    fail=1
  fi
done
if ! command -v ffmpeg >/dev/null 2>&1; then
  printf 'Missing system dependency: ffmpeg (install it with system package management)\n' >&2
  fail=1
fi
if ! command -v uv >/dev/null 2>&1; then
  printf 'Missing uv. Install uv before rerunning bootstrap.\n' >&2
  fail=1
fi
if (( fail )); then exit 1; fi

python_version="$(python3 --version 2>&1 | awk '{print $2}')"
python3 - <<'PY'
import sys
if not (sys.version_info >= (3, 10) and sys.version_info < (3, 13)):
    raise SystemExit(f"Python 3.10-3.12 is required; found {sys.version.split()[0]}")
PY
printf 'Python: %s\n' "$python_version"

if [[ ! -x .venv/bin/python ]]; then
  uv venv --python 3.11 .venv
fi
uv pip install --python .venv/bin/python -e . 'pytest>=8,<9'
if command -v npm >/dev/null 2>&1 && [[ -f frontend/package.json ]]; then
  (cd frontend && npm ci && npm run build:web)
else
  printf 'npm or frontend source is unavailable; use the checked-in frontend artifact.\n'
fi
mkdir -p logs run cache models config_alts
if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env
  printf 'Created .env from .env.example; fill LLM_BASE_URL, LLM_API_KEY and LLM_MODEL before start.\n'
fi
printf 'Bootstrap complete. Upstream version: %s\n' "$(git describe --tags --always)"
