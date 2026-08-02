#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT/frontend"
ELECTRON_NODE="$FRONTEND/node_modules/electron/dist/electron"
VITE_CLI="$FRONTEND/node_modules/vite/bin/vite.js"

if [[ ! -x "$ELECTRON_NODE" || ! -f "$VITE_CLI" ]]; then
  printf 'Frontend build tools are missing. Run the frontend dependency installation first.\n' >&2
  exit 1
fi

cd "$FRONTEND"
printf 'Building browser frontend from current source...\n'
env ELECTRON_RUN_AS_NODE=1 "$ELECTRON_NODE" "$VITE_CLI" build --config vite.config.ts --mode web
