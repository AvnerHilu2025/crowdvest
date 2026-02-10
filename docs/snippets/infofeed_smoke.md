# InfoFeed Layer — Smoke Test Commands

Run from WSL (API + DB must be up).

## Migrations

```bash
cd packages/db && pnpm exec prisma migrate deploy
pnpm exec prisma generate
```

## 1. Create info events (3 events for steps 0..2)

```bash
RUN_ID="<your-run-id>"
API_BASE="http://localhost:4001"

# Step 0: positive sentiment +0.8
curl -sS -X POST "$API_BASE/runs/$RUN_ID/info-events" \
  -H "Content-Type: application/json" \
  -d '{"assetSymbol":"RUN","step":0,"topic":"earnings","sentiment":0.8,"credibility":0.9,"reach":0.9}' | jq .

# Step 1: negative sentiment -0.7
curl -sS -X POST "$API_BASE/runs/$RUN_ID/info-events" \
  -H "Content-Type: application/json" \
  -d '{"assetSymbol":"RUN","step":1,"topic":"rates","sentiment":-0.7,"credibility":0.9,"reach":0.9}' | jq .

# Step 2: slightly positive +0.2
curl -sS -X POST "$API_BASE/runs/$RUN_ID/info-events" \
  -H "Content-Type: application/json" \
  -d '{"assetSymbol":"RUN","step":2,"topic":"geopolitics","sentiment":0.2,"credibility":0.9,"reach":0.9}' | jq .
```

## 2. List info events

```bash
curl -sS "$API_BASE/runs/$RUN_ID/info-events?assetSymbol=RUN&fromStep=0&toStep=10" | jq .
```

## 3. Run decide with events

```bash
pnpm -C apps/worker run decide -- --runId $RUN_ID --steps 3 --seed 123 --overwrite
```

## 4. Compare with no events (baseline)

```bash
# Delete events
curl -sS -X DELETE "$API_BASE/runs/$RUN_ID/info-events?assetSymbol=RUN"

# Run decide (no events)
pnpm -C apps/worker run decide -- --runId $RUN_ID --steps 3 --seed 123 --overwrite

# Re-create events and run again to compare histograms
```

## 5. Determinism check

```bash
pnpm -C apps/worker run decide -- --runId $RUN_ID --steps 3 --seed 123 --overwrite
# Capture step 0 output

pnpm -C apps/worker run decide -- --runId $RUN_ID --steps 3 --seed 123 --overwrite
# Step 0 histogram and avgConfidence must be identical
```

## 6. Spot check rationales

```bash
curl -sS "$API_BASE/results/decisions?run_id=$RUN_ID&step=0&assetSymbol=RUN" | jq '.sample[0:5][] | .rationale'
# Expect at least some "saw X events (sentiment=...)" when events exist
```

## Full smoke script

```bash
./scripts/infofeed_smoke.sh [http://localhost:4001]
# Or with existing RUN_ID:
RUN_ID=<uuid> ./scripts/infofeed_smoke.sh
```
