/**
 * Derive step returns for non-canonical symbols from SPY step returns.
 * Used when PriceSeriesPoint has no data for symbol; SPY returns come from PriceSeriesPoint.
 */
import { createHash } from "crypto";

const STEPS = 29;

/** Deterministic hash to [0,1] from string. */
function hashToFloat(s: string): number {
  const h = createHash("sha256").update(s).digest("hex");
  return parseInt(h.slice(0, 8), 16) / 0xffffffff;
}

/** Derive step returns for symbol from SPY step returns. Deterministic. */
export function deriveStepReturnsFromSpy(spyStepReturns: number[], symbol: string): number[] {
  const sym = symbol.trim().toUpperCase() || "SPY";
  if (sym === "SPY") return [...spyStepReturns];
  const f = hashToFloat(sym);
  const scale = 0.96 + (f * 0.08);
  const out: number[] = [];
  for (let i = 0; i < spyStepReturns.length; i++) {
    const r = spyStepReturns[i]!;
    const phase = (hashToFloat(sym + i) - 0.5) * 0.04;
    out.push(r * scale + phase);
  }
  return out;
}

export { STEPS };
