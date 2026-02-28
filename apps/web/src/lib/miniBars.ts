/**
 * P95 normalization for mini-bar widths.
 * Prevents outliers from compressing other bars to near-zero.
 */

/** Compute 95th percentile of numeric values. Returns 0 if empty. */
export function p95(values: number[]): number {
  const valid = values.filter((v) => Number.isFinite(v) && v >= 0);
  if (valid.length === 0) return 0;
  const sorted = [...valid].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

/**
 * Normalize value for bar width 0..100 using P95 as reference.
 * value / p95 capped at 1, then scaled to 0..100.
 * If p95 is 0, returns 0.
 */
export function normToP95(value: number, p95Val: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (p95Val <= 0) return 0;
  const ratio = value / p95Val;
  const clamped = Math.min(1, Math.max(0, ratio));
  return Math.round(clamped * 100);
}
