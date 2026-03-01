#!/usr/bin/env bash
# Deterministic hardening + bench suite.
# Runs 4 agent buckets (50, 200, 1000, 2000), validates summary-compact and variants.
# Usage: ./scripts/run-hardening-suite.sh
# Requires: API on http://localhost:4001, worker CLI, curl, jq

set -euo pipefail

API="${API:-http://localhost:4001}"
agentBuckets=(50 200 1000 2000)
POLL_INTERVAL=1
POLL_TIMEOUT=120
UUID_REGEX='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'

mkdir -p logs/hardening

die() {
  local reason="$1"
  local log_file="${2:-}"
  echo "FAIL bucket agents=${agents:-?} runId=${runId:-?} reason=$reason"
  echo "---- LOG TAIL ----"
  if [ -z "$log_file" ] || [ ! -f "$log_file" ]; then
    echo "(no log file)"
  elif [ ! -s "$log_file" ]; then
    echo "(log empty)"
  else
    tail -n 200 "$log_file"
  fi
  exit 1
}

require_cmd() {
  for cmd in "$@"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      die "required command not found: $cmd"
    fi
  done
}

# GET url, capture body and status. On 200, output body. On 4xx/5xx, print debug and return non-zero.
http_get_json() {
  local url="$1"
  local raw
  raw="$(curl -sS -w '\n__HTTP_STATUS__:%{http_code}\n' "$url")"
  local status
  status="$(echo "$raw" | tail -n1 | sed 's/__HTTP_STATUS__://')"
  local body
  body="$(echo "$raw" | sed '$d')"
  if [ "$status" != "200" ]; then
    echo "HTTP GET failed url=$url status=$status" >&2
    echo "body (first 40 lines):" >&2
    echo "$body" | head -n 40 >&2
    return 1
  fi
  echo "$body"
}

# Tolerant GET /runs/:id for polling. Does NOT use -f. Returns status string; on FAILED, outputs body on line 2.
get_run_status_tolerant() {
  local runId="$1"
  local raw
  raw="$(curl -sS -w '\n__HTTP__:%{http_code}\n' "$API/runs/$runId")"
  local http_code
  http_code="$(echo "$raw" | tail -n1 | sed 's/__HTTP__://')"
  local body
  body="$(echo "$raw" | sed '$d')"
  if [ "$http_code" = "200" ]; then
    local status
    status="$(echo "$body" | jq -r '.status // empty' 2>/dev/null || true)"
    if [ -n "$status" ]; then
      if [ "$status" = "FAILED" ]; then
        echo "FAILED"
        echo "$body"
      else
        echo "$status"
      fi
      return 0
    fi
    echo "NON_JSON"
    return 0
  fi
  if [ "$http_code" = "400" ]; then
    local msg
    msg="$(echo "$body" | jq -r '.message // empty' 2>/dev/null || true)"
    if [[ "$msg" == *"is not COMPLETED"* ]]; then
      echo "RUNNING"
      return 0
    fi
    if [[ "$msg" == *"not found"* ]] || [[ "$msg" == *"Not found"* ]]; then
      echo "NOT_FOUND"
      return 0
    fi
    echo "UNKNOWN_400"
    return 0
  fi
  if [ "$http_code" = "404" ]; then
    echo "NOT_FOUND"
    return 0
  fi
  echo "HTTP_${http_code}"
  return 0
}

# Poll until status=COMPLETED or FAILED or timeout. Tolerates 400 "is not COMPLETED" during polling.
poll_run() {
  local runId="$1"
  local timeout_sec="${2:-$POLL_TIMEOUT}"
  local log_file="${3:-}"
  local elapsed=0
  local status="unknown"
  while [ "$elapsed" -lt "$timeout_sec" ]; do
    local result
    result="$(get_run_status_tolerant "$runId")"
    status="$(echo "$result" | head -n1)"
    if [ "$status" = "COMPLETED" ]; then
      return 0
    fi
    if [ "$status" = "FAILED" ]; then
      local body lastError
      body="$(echo "$result" | tail -n +2)"
      lastError="$(echo "$body" | jq -r '.lastError // "no lastError"')"
      die "Run FAILED: $lastError" "$log_file"
    fi
    if [ "$status" = "NOT_FOUND" ]; then
      die "Run not found" "$log_file"
    fi
    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
  done
  die "Run did not reach COMPLETED within ${timeout_sec}s (status=$status)" "$log_file"
}

# Validate summary-compact: BUY+SELL+HOLD > 0
validate_summary_compact() {
  local runId="$1"
  local log_file="${2:-}"
  local res
  res="$(http_get_json "$API/results/summary-compact?run_id=$runId")" || die "GET /results/summary-compact failed" "$log_file"
  local buy sell hold
  buy="$(echo "$res" | jq -r '.debug.persistedHistogram.BUY // 0')"
  sell="$(echo "$res" | jq -r '.debug.persistedHistogram.SELL // 0')"
  hold="$(echo "$res" | jq -r '.debug.persistedHistogram.HOLD // 0')"
  local total
  total=$((buy + sell + hold))
  if [ "$total" -le 0 ]; then
    die "summary-compact histogram BUY+SELL+HOLD=$total (expected > 0)" "$log_file"
  fi
  echo "$total"
}

# Validate variants: length==3, seeds 1,2,3 exist
validate_variants() {
  local runId="$1"
  local log_file="${2:-}"
  local res
  res="$(http_get_json "$API/runs/$runId/variants?assetSymbol=SPY")" || die "GET /runs/$runId/variants failed" "$log_file"
  local count
  count="$(echo "$res" | jq -r '.items | length')"
  if [ "$count" -ne 3 ]; then
    die "variants length=$count (expected 3)" "$log_file"
  fi
  local seeds
  seeds="$(echo "$res" | jq -r '[.items[].seed] | sort | join(",")')"
  if [ "$seeds" != "1,2,3" ]; then
    die "variants seeds=$seeds (expected 1,2,3)" "$log_file"
  fi
  echo "$res" | jq -r '.items[].id' | tr '\n' ' '
}

require_cmd curl jq

echo "HARDENING SUITE: API=$API buckets=${agentBuckets[*]}"

for agents in "${agentBuckets[@]}"; do
  bucket_start="$(date +%s%3N)"
  import_res="$(curl -fsS -X POST "$API/runs/import/spy29")" || die "POST /runs/import/spy29 failed"
  runId="$(echo "$import_res" | jq -r '.runId')"
  runId="$(echo "$runId" | tr -d '\r\n' | xargs)"
  if [ -z "$runId" ] || [ "$runId" = "null" ]; then
    die "Could not create run (no runId in response)"
  fi
  if [[ ! "$runId" =~ $UUID_REGEX ]]; then
    die "Invalid runId format (expected UUID): $(printf '%q' "$runId")"
  fi

  LOG_FILE="logs/hardening/agents-${agents}-${runId}.log"
  touch "$LOG_FILE"

  poll_run "$runId" "$POLL_TIMEOUT" "$LOG_FILE"

  if [ "$agents" -eq 50 ]; then
    pnpm -C apps/worker run backtest-v0 -- --runId "$runId" --assetSymbol SPY --steps 29 --agents 50 --seedStart 1 --seeds 3 >"$LOG_FILE" 2>&1 || die "worker CLI failed" "$LOG_FILE"
  else
    pnpm -C apps/worker run backtest-v0 -- --runId "$runId" --assetSymbol SPY --steps 29 --agents "$agents" --seedStart 1 --seeds 3 --overwrite >"$LOG_FILE" 2>&1 || die "worker CLI failed" "$LOG_FILE"
  fi

  poll_run "$runId" "$POLL_TIMEOUT" "$LOG_FILE"

  histogramTotal="$(validate_summary_compact "$runId" "$LOG_FILE")"
  variantIds="$(validate_variants "$runId" "$LOG_FILE")"

  bucket_end="$(date +%s%3N)"
  durationMs=$((bucket_end - bucket_start))
  echo "BUCKET agents=$agents durationMs=$durationMs runId=$runId variants=3 histogramTotal=$histogramTotal variantIds=$variantIds"
done

echo "HARDENING SUITE PASSED"
