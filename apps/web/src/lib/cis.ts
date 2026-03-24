/**
 * Crowd Intelligence Score (CIS) computation.
 * Reusable across variant page and stability analysis.
 */
export function computeCis({
  corr,
  directionalAccuracy,
  percentileScore = 0.5,
  convictionPenalty = 0,
}: {
  corr: number | null;
  directionalAccuracy: number | null;
  percentileScore?: number;
  convictionPenalty?: number;
}): number {
  const accuracyScore = directionalAccuracy ?? 0;
  const corrScore = ((corr ?? 0) + 1) / 2;

  const cis =
    0.4 * accuracyScore +
    0.25 * corrScore +
    0.25 * percentileScore +
    0.1 * (1 - convictionPenalty);

  return Math.max(0, Math.min(1, cis));
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdDev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  const variance = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}
