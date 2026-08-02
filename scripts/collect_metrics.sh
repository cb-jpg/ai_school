#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
set -a
source ./.env
set +a
: "${APP_PORT:=12393}"
mkdir -p logs
file="logs/metrics.csv"
if [[ ! -f "$file" ]]; then
  printf 'timestamp,pid,cpu_percent,rss_kib,mem_available_kib,gpu_util_percent,gpu_mem_used_mib,port_listening\n' >"$file"
fi
pid=''
if [[ -f run/server.pid ]]; then pid="$(<run/server.pid)"; fi
cpu=''; rss=''
if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
  cpu="$(ps -p "$pid" -o %cpu= | awk '{print $1}')"
  rss="$(ps -p "$pid" -o rss= | awk '{print $1}')"
fi
mem_available="$(awk '/MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null || true)"
gpu_util=''; gpu_mem=''
if command -v nvidia-smi >/dev/null 2>&1; then
  gpu_line="$(nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader,nounits 2>/dev/null || true)"
  if [[ -n "$gpu_line" ]]; then read -r gpu_util gpu_mem <<<"$gpu_line"; fi
fi
port='0'
if command -v ss >/dev/null 2>&1 && ss -ltn "sport = :$APP_PORT" | tail -n +2 | grep -q .; then port='1'; fi
printf '%s,%s,%s,%s,%s,%s,%s,%s\n' "$(date -Is)" "${pid:-}" "${cpu:-}" "${rss:-}" "${mem_available:-}" "${gpu_util:-}" "${gpu_mem:-}" "$port" >>"$file"
printf 'Metrics appended to %s\n' "$file"
