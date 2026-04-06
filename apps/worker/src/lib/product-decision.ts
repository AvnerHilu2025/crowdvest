/**
 * Product decision layer: maps four channel scalars to action + diagnostics.
 * Deterministic; no RNG; no legacy decision transforms.
 */

export type ProductDecisionInput = {
  synthetic: number;
  info: number;
  event: number;
  regime: number;
};

export type ProductDecisionOutput = {
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  coherentSignal: number;
  agreement: number;
  strength: number;
  dominantChannel: "synthetic" | "info" | "event" | "regime";
};

const W_S = 0.35;
const W_I = 0.35;
const W_E = 0.15;
const W_R = 0.15;
const T = 0.15;

function sign(x: number): number {
  if (x > 0) return 1;
  if (x < 0) return -1;
  return 0;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function clamp11(x: number): number {
  return Math.max(-1, Math.min(1, x));
}

export function computeProductDecision(input: ProductDecisionInput): ProductDecisionOutput {
  const { synthetic, info, event, regime } = input;

  const signs = [sign(synthetic), sign(info), sign(event), sign(regime)].filter((s) => s !== 0);
  const totalNonZero = signs.length;
  let agreement = 0;
  if (totalNonZero > 0) {
    const positives = signs.filter((s) => s === 1).length;
    const negatives = signs.filter((s) => s === -1).length;
    const same = Math.max(positives, negatives);
    const opposite = Math.min(positives, negatives);
    agreement = (same - opposite) / totalNonZero;
  }

  const strengthRaw =
    W_S * Math.abs(synthetic) + W_I * Math.abs(info) + W_E * Math.abs(event) + W_R * Math.abs(regime);
  const strength = clamp01(strengthRaw);

  const signedBlend =
    W_S * synthetic + W_I * info + W_E * event + W_R * regime;
  let coherentSignal = signedBlend * agreement;
  coherentSignal = clamp11(coherentSignal);

  let action: ProductDecisionOutput["action"];
  if (coherentSignal > T) action = "BUY";
  else if (coherentSignal < -T) action = "SELL";
  else action = "HOLD";

  const confidence = clamp01(Math.abs(coherentSignal) * (0.5 + 0.5 * agreement));

  const ordered: Array<{ name: ProductDecisionOutput["dominantChannel"]; abs: number }> = [
    { name: "synthetic", abs: Math.abs(synthetic) },
    { name: "info", abs: Math.abs(info) },
    { name: "event", abs: Math.abs(event) },
    { name: "regime", abs: Math.abs(regime) },
  ];
  let dominantChannel = ordered[0]!.name;
  let maxAbs = ordered[0]!.abs;
  for (let k = 1; k < ordered.length; k++) {
    const o = ordered[k]!;
    if (o.abs > maxAbs) {
      maxAbs = o.abs;
      dominantChannel = o.name;
    }
  }

  return {
    action,
    confidence,
    coherentSignal,
    agreement,
    strength,
    dominantChannel,
  };
}
