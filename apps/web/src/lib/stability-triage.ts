export type StabilityCause = "SIGN" | "CORR" | "ACC" | "MIXED" | "SINGLE" | "LEGACY";

export function stabilityCause(args: {
  isLegacyTiming?: boolean;
  label?: string | null;
  corrSpread?: number | null;
  accStdDev?: number | null;
  signAgreementRate?: number | null;
}): StabilityCause {
  const { isLegacyTiming, label } = args;
  if (isLegacyTiming) return "LEGACY";
  if (label === "single-seed") return "SINGLE";

  const cs = args.corrSpread ?? 0;
  const asd = args.accStdDev ?? 0;
  const sar = args.signAgreementRate ?? 1;

  const hits: StabilityCause[] = [];
  if (sar < 1) hits.push("SIGN");
  if (cs >= 0.3) hits.push("CORR");
  if (asd >= 0.03) hits.push("ACC");

  if (hits.length === 0) return "MIXED"; // "clean"
  if (hits.length === 1) return hits[0];
  return "MIXED";
}

// Score 0..100 (higher = worse). Tuned to your current thresholds.
// - sign disagreement is dominant signal
// - corrSpread and accStdDev add weight
export function stabilityRiskScore(args: {
  isLegacyTiming?: boolean;
  label?: string | null;
  corrSpread?: number | null;
  accStdDev?: number | null;
  signAgreementRate?: number | null;
}): number {
  if (args.isLegacyTiming) return 5; // legacy: low score but flagged
  if (args.label === "single-seed") return 10;

  const cs = Math.max(0, args.corrSpread ?? 0);
  const asd = Math.max(0, args.accStdDev ?? 0);
  const sar = Math.min(1, Math.max(0, args.signAgreementRate ?? 1));

  // sign penalty: 0 when 100%, 100 when 0%
  const signPenalty = (1 - sar) * 100;

  // corr penalty: 0 at 0.0, 60 at 0.30, 100 at 0.50+
  let corrPenalty = 0;
  if (cs >= 0.5) corrPenalty = 100;
  else if (cs >= 0.3) corrPenalty = 60 + ((cs - 0.3) / 0.2) * 40;
  else corrPenalty = (cs / 0.3) * 60;

  // acc penalty: 0 at 0.0, 60 at 0.03, 100 at 0.06+
  let accPenalty = 0;
  if (asd >= 0.06) accPenalty = 100;
  else if (asd >= 0.03) accPenalty = 60 + ((asd - 0.03) / 0.03) * 40;
  else accPenalty = (asd / 0.03) * 60;

  // Weighted blend
  const score = 0.55 * signPenalty + 0.25 * corrPenalty + 0.2 * accPenalty;

  // clamp
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function riskBand(score: number): "OK" | "DIVERGING" | "UNSTABLE" {
  if (score >= 70) return "UNSTABLE";
  if (score >= 40) return "DIVERGING";
  return "OK";
}
