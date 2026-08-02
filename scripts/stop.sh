#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

pids=()
add_pid() {
  local candidate="$1"
  local existing
  [[ "$candidate" =~ ^[0-9]+$ ]] || return
  for existing in "${pids[@]:-}"; do
    [[ "$existing" == "$candidate" ]] && return
  done
  pids+=("$candidate")
}

if [[ -f run/server.pid ]]; then
  add_pid "$(<run/server.pid)"
fi

# Recover from stale/missing PID files by finding only run_server.py processes
# whose working directory is this exact project.
while IFS= read -r candidate; do
  [[ -n "$candidate" ]] || continue
  candidate_cwd="$(readlink -f "/proc/$candidate/cwd" 2>/dev/null || true)"
  if [[ "$candidate_cwd" == "$ROOT" ]]; then
    add_pid "$candidate"
  fi
done < <(pgrep -f '[.]venv/bin/python run_server.py' || true)

if [[ "${#pids[@]}" -eq 0 ]]; then
  rm -f run/server.pid
  printf 'Server is not running.\n'
  exit 0
fi

for pid in "${pids[@]}"; do
  if kill -0 "$pid" 2>/dev/null; then
    kill -TERM "$pid"
  fi
done

for _ in {1..50}; do
  remaining=0
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then remaining=1; fi
  done
  [[ "$remaining" -eq 0 ]] && break
  sleep 0.2
done

for pid in "${pids[@]}"; do
  if kill -0 "$pid" 2>/dev/null; then
    printf 'Server did not stop gracefully; PID %s remains.\n' "$pid" >&2
    exit 1
  fi
done

rm -f run/server.pid
printf 'Server stopped.\n'
