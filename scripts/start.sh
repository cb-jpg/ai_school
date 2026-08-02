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

if [[ -f run/server.pid ]]; then
  pid="$(<run/server.pid)"
  if kill -0 "$pid" 2>/dev/null; then
    printf 'Server already running with PID %s\n' "$pid"
    exit 0
  fi
  rm -f run/server.pid
fi

"$ROOT/.venv/bin/python" scripts/render_config.py
mkdir -p logs run
nohup "$ROOT/.venv/bin/python" run_server.py >logs/startup.log 2>&1 &
pid=$!
printf '%s\n' "$pid" >run/server.pid
sleep 1
if ! kill -0 "$pid" 2>/dev/null; then
  printf 'Server exited during startup; inspect logs/startup.log\n' >&2
  rm -f run/server.pid
  exit 1
fi
printf 'Server started: PID=%s URL=http://%s:%s\n' "$pid" "$APP_HOST" "$APP_PORT"
printf 'SSH tunnel: ssh -L %s:127.0.0.1:%s USER@SERVER\n' "$APP_PORT" "$APP_PORT"
printf 'Browser: http://localhost:%s\n' "$APP_PORT"
