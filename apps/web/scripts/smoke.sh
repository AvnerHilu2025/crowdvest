#!/usr/bin/env bash
set -e
BASE="${WEB_BASE:-http://localhost:4000}"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/dashboard")
[ "$code" = "200" ] || { echo "dashboard: expected 200, got $code"; exit 1; }
curl -s "$BASE/api/dashboard/summary?limit=5" | jq -e '.driftAsset != null and .driftGlobal != null' > /dev/null || { echo "summary: missing driftAsset/driftGlobal"; exit 1; }
echo "smoke OK"
