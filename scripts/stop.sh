#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ ! -f run/server.pid ]]; then
  printf 'Server is not running.\n'
  exit 0
fi
pid="$(<run/server.pid)"
if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
  kill -TERM "$pid"
  for _ in {1..30}; do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.2
  done
  if kill -0 "$pid" 2>/dev/null; then
    printf 'Server did not stop gracefully; PID %s remains.\n' "$pid" >&2
    exit 1
  fi
fi
rm -f run/server.pid
printf 'Server stopped.\n'
