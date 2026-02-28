export const DASH_THRESHOLDS = {
  // Stability thresholds (tune later, but make explicit and visible in legend)
  corrSpreadWarn: 0.2,
  corrSpreadHigh: 0.5,
  accStdDevWarn: 0.02,
  signAgreementWarn: 0.9, // below => instability risk
} as const;

export function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function fmtPct01(x: number, digits = 0) {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtNum(x: number, digits = 4) {
  if (x == null || !Number.isFinite(x)) return "—";
  return x.toFixed(digits);
}

/**
 * overheadPct is already percent (0.257 means 0.257%).
 * Do NOT multiply by 100.
 */
export function formatOverheadPct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${pct.toFixed(1)}%`;
}
