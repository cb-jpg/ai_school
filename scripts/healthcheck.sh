#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
set -a
source ./.env
set +a
: "${APP_HOST:=127.0.0.1}"
: "${APP_PORT:=12393}"
pid=''
if [[ -f run/server.pid ]]; then pid="$(<run/server.pid)"; fi
process='FAIL'
if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then process='PASS'; fi
http='FAIL'
health=''
if health="$(curl -fsS --max-time 5 "http://${APP_HOST}:${APP_PORT}/health" 2>/dev/null)"; then http='PASS'; fi
websocket='MANUAL'
log_anomaly='PASS'
if [[ -f logs/startup.log ]] && rg -n -i 'traceback|critical|fatal|unhandled exception' logs/startup.log >/dev/null; then log_anomaly='FAIL'; fi
printf 'checked_at=%s\nprocess=%s\nport_http=%s\nwebsocket=%s\nlog_anomaly=%s\n' "$(date -Is)" "$process" "$http" "$websocket" "$log_anomaly"
printf '%s\n' "${health:-health endpoint unavailable}"
if [[ "$process" != PASS || "$http" != PASS || "$log_anomaly" != PASS ]]; then exit 1; fi
