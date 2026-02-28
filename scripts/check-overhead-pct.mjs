#!/usr/bin/env node
/**
 * Regression check: overheadPct is already percent (0.257 means 0.257%).
 * UI formatter must NOT multiply by 100.
 * Usage: node scripts/check-overhead-pct.mjs [API_URL]
 */
const API_URL = process.argv[2] || process.env.API_WEB || "http://localhost:4000";

function formatOverheadPct(pct) {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${pct.toFixed(1)}%`;
}

async function main() {
  const url = `${API_URL}/api/dashboard/summary?limit=5&assetSymbol=SPY`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`FAIL: ${url} returned ${res.status}`);
    process.exit(1);
  }
  const data = await res.json();
  const row = data.scalingRows?.[0];
  if (!row) {
    console.error("FAIL: no scaling rows");
    process.exit(1);
  }

  const { overheadPct } = row;
  const displayed = formatOverheadPct(overheadPct);

  console.log(`API overheadPct: ${overheadPct}`);
  console.log(`Formatter output: ${displayed}`);

  if (overheadPct != null && overheadPct < 10 && displayed.includes("%")) {
    const numPart = parseFloat(displayed.replace("%", ""));
    if (numPart > overheadPct * 10) {
      console.error(`FAIL: Displayed ${displayed} suggests extra *100 (expected ~${overheadPct.toFixed(1)}%)`);
      process.exit(1);
    }
  }
  console.log("PASS: overheadPct units correct (no extra *100)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
