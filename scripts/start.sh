#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PATH="$ROOT/.venv/bin:$PATH"
if [[ ! -f .env ]]; then
  printf 'Missing .env. Run scripts/bootstrap.sh and fill the required LLM settings.\n' >&2
  exit 1
fi
set -a
source ./.env
set +a
: "${APP_HOST:=127.0.0.1}"
: "${APP_PORT:=12393}"
: "${LOG_LEVEL:=INFO}"
: "${ASR_MODE:=auto}"
export APP_HOST APP_PORT LOG_LEVEL ASR_MODE
mkdir -p logs run

if [[ -f run/server.pid ]]; then
  pid="$(<run/server.pid)"
  if kill -0 "$pid" 2>/dev/null; then
    printf 'Server already running with PID %s\n' "$pid"
    exit 0
  fi
  rm -f run/server.pid
fi

# Recover a running project server even if the PID file is stale or missing.
while IFS= read -r candidate; do
  [[ -n "$candidate" ]] || continue
  candidate_cwd="$(readlink -f "/proc/$candidate/cwd" 2>/dev/null || true)"
  if [[ "$candidate_cwd" == "$ROOT" ]] && kill -0 "$candidate" 2>/dev/null; then
    printf '%s\n' "$candidate" >run/server.pid
    printf 'Server already running with PID %s\n' "$candidate"
    exit 0
  fi
done < <(pgrep -f '[.]venv/bin/python run_server.py' || true)

# The server serves frontend/dist/web when it exists. Rebuild it before every
# start so source fixes cannot be hidden behind an old checked-in bundle.
"$ROOT/scripts/build_frontend.sh"

"$ROOT/.venv/bin/python" scripts/render_config.py
nohup "$ROOT/.venv/bin/python" run_server.py >logs/startup.log 2>&1 &
pid=$!
printf '%s\n' "$pid" >run/server.pid
ready=0
for _ in {1..60}; do
  if ! kill -0 "$pid" 2>/dev/null; then
    printf 'Server exited during startup; inspect logs/startup.log\n' >&2
    rm -f run/server.pid
    exit 1
  fi
  if curl -fsS --max-time 2 "http://${APP_HOST}:${APP_PORT}/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.5
done
if [[ "$ready" -ne 1 ]]; then
  printf 'Server did not become healthy within 30 seconds; inspect logs/startup.log\n' >&2
  kill -TERM "$pid" 2>/dev/null || true
  rm -f run/server.pid
  exit 1
fi
printf 'Server started: PID=%s URL=http://%s:%s\n' "$pid" "$APP_HOST" "$APP_PORT"
printf 'SSH tunnel: ssh -L %s:127.0.0.1:%s USER@SERVER\n' "$APP_PORT" "$APP_PORT"
printf 'Browser: http://localhost:%s\n' "$APP_PORT"
