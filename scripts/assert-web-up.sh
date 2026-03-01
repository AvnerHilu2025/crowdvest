#!/usr/bin/env bash
# Assert the web server (default http://localhost:4000) is responding.
# Usage: ./scripts/assert-web-up.sh
#   or:  WEB_BASE=http://localhost:4000 ./scripts/assert-web-up.sh
# Exits 0 if up, 1 with clear message if down.

WEB_BASE="${WEB_BASE:-http://localhost:4000}"
URL="${WEB_BASE}/api/health"
TIMEOUT=5

if ! curl -fsS --max-time "$TIMEOUT" "$URL" >/dev/null 2>&1; then
  echo "WEB (4000) is not responding. Start it: pnpm -C apps/web dev" >&2
  exit 1
fi
