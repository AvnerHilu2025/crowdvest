export type StabilityLabel = "single-seed" | "multi-seed";

export type StabilityRisk = "STABLE" | "DIVERGING" | "UNSTABLE" | "LEGACY";

export function classifyStabilityRisk(args: {
  isLegacyTiming?: boolean;
  label?: StabilityLabel | string;
  corrSpread?: number | null; // 0..1
  accStdDev?: number | null; // 0..1 (fraction)
  signAgreementRate?: number | null; // 0..1
}): StabilityRisk {
  const { isLegacyTiming, label, corrSpread, accStdDev, signAgreementRate } = args;

  if (isLegacyTiming) return "LEGACY";
  if (label === "single-seed") return "STABLE"; // nothing to compare
  if (label === "missing-variants") return "LEGACY";

  const cs = corrSpread ?? 0;
  const asd = accStdDev ?? 0;
  const sar = signAgreementRate ?? 1;

  // UNSTABLE if sign disagreement OR very high corr spread OR very high acc std dev
  if (sar < 1) return "UNSTABLE";
  if (cs >= 0.5) return "UNSTABLE";
  if (asd >= 0.06) return "UNSTABLE"; // 6%+

  // DIVERGING if moderate corr spread or moderate acc std dev
  if (cs >= 0.3) return "DIVERGING";
  if (asd >= 0.03) return "DIVERGING"; // 3%+

  return "STABLE";
}

export function stabilityReason(args: {
  label?: StabilityLabel | string;
  corrSpread?: number | null;
  accStdDev?: number | null;
  signAgreementRate?: number | null;
}): string {
  const label = args.label;
  if (label === "single-seed") return "single seed (no cross-seed comparison)";
  if (label === "missing-variants") return "missing variants (no cross-seed data)";

  const cs = args.corrSpread ?? 0;
  const asd = args.accStdDev ?? 0;
  const sar = args.signAgreementRate ?? 1;

  const reasons: string[] = [];
  if (sar < 1) reasons.push(`sign disagreement (${Math.round(sar * 100)}%)`);
  if (cs >= 0.5) reasons.push(`high corr spread (${cs.toFixed(3)})`);
  else if (cs >= 0.3) reasons.push(`moderate corr spread (${cs.toFixed(3)})`);

  if (asd >= 0.06) reasons.push(`high acc std dev (${(asd * 100).toFixed(2)}%)`);
  else if (asd >= 0.03) reasons.push(`moderate acc std dev (${(asd * 100).toFixed(2)}%)`);

  if (reasons.length === 0) return "consistent across seeds";
  return reasons.join(" • ");
}

export function riskScore(args: {
  isLegacyTiming?: boolean;
  label?: StabilityLabel | string;
  corrSpread?: number | null;
  accStdDev?: number | null;
  signAgreementRate?: number | null;
}): number {
  const risk = classifyStabilityRisk(args);
  if (risk === "LEGACY") return -1; // keep legacy last by default
  if (risk === "UNSTABLE") return 3;
  if (risk === "DIVERGING") return 2;
  return 1;
}

export function fmtPct(x?: number | null, digits = 2): string {
  if (x == null || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtNum(x?: number | null, digits = 4): string {
  if (x == null || Number.isNaN(x)) return "—";
  return x.toFixed(digits);
}
