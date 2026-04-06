/**
 * Deterministic sanity checks for product-decision.ts
 */
import { computeProductDecision } from "./product-decision";

let failed = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (!ok) {
    failed++;
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`PASS: ${name}`);
  }
}

// 1. fully aligned bullish
{
  const o = computeProductDecision({
    synthetic: 0.4,
    info: 0.5,
    event: 0.2,
    regime: 0.3,
  });
  check("1 bullish action=BUY", o.action === "BUY");
  check("1 bullish agreement=1", Math.abs(o.agreement - 1) < 1e-9);
  check("1 bullish confidence>0.15", o.confidence > 0.15);
}

// 2. fully aligned bearish
{
  const o = computeProductDecision({
    synthetic: -0.4,
    info: -0.5,
    event: -0.2,
    regime: -0.3,
  });
  check("2 bearish action=SELL", o.action === "SELL");
  check("2 bearish agreement=1", Math.abs(o.agreement - 1) < 1e-9);
  check("2 bearish confidence>0.15", o.confidence > 0.15);
}

// 3. strong conflict
{
  const o = computeProductDecision({
    synthetic: 0.7,
    info: -0.7,
    event: 0,
    regime: 0,
  });
  check("3 conflict agreement=0", Math.abs(o.agreement - 0) < 1e-9);
  check("3 conflict action=HOLD", o.action === "HOLD");
  check("3 conflict confidence near 0", o.confidence < 1e-6);
}

// 4. weak aligned
{
  const o = computeProductDecision({
    synthetic: 0.05,
    info: 0.04,
    event: 0,
    regime: 0.03,
  });
  check("4 weak agreement=1", Math.abs(o.agreement - 1) < 1e-9);
  check("4 weak action=HOLD", o.action === "HOLD");
  check("4 weak confidence low", o.confidence < 0.1);
}

// 5. dominant channel
{
  const o = computeProductDecision({
    synthetic: 0.2,
    info: 0.6,
    event: 0.1,
    regime: 0.05,
  });
  check("5 dominant=info", o.dominantChannel === "info");
}

if (failed > 0) {
  console.error(`\nproduct-decision.selftest: ${failed} failure(s)`);
  process.exit(1);
}
console.log("\nproduct-decision.selftest: all passed");
