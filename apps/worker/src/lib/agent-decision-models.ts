/**
 * CV-ARCH-005 / CV-VAL-022–025: Base signal + constrained diversity; CV-VAL-024 ablations;
 * **CV-VAL-025** gold: soft normalized weights + discrete step lag (no mask, no mixed noise).
 * **CV-VAL-027**: shared global weight presets + delay-only path (no 025/026 extras).
 */

import { clamp11, hashToUnitFloat } from "./exposure";

export type AgentDecisionModelKind =
  | "trend_follower"
  | "mean_reversion"
  | "news_driven"
  | "passive_low_attention";

const MODELS: AgentDecisionModelKind[] = [
  "trend_follower",
  "mean_reversion",
  "news_driven",
  "passive_low_attention",
];

/** ~25% each, stable across runs for a given agent id. */
export function decisionModelKindForAgent(agentId: string): AgentDecisionModelKind {
  const u = hashToUnitFloat(`cv-arch-005:model:${agentId}`);
  const idx = Math.min(MODELS.length - 1, Math.floor(u * MODELS.length));
  return MODELS[idx]!;
}

export interface DecisionModelChannelInput {
  synthetic_i: number;
  regime_i: number;
  infoSignal: number;
  eventSignal: number;
  attentionLevel: number;
}

/** Same linear mix as legacy CV-ARCH-001 composite (all models start here). */
const W_SYN = 0.38;
const W_INFO = 0.38;
const W_EVT = 0.14;
const W_REG = 0.5;

/** Regime dominance softening + minority boosts; weights normalized before blend. */
const DOMINANCE_PENALTY = 0.6;

function blendChannelsWithRegimeRebalance(
  synthetic: number,
  info: number,
  event: number,
  regime: number,
  weights: { synthetic: number; info: number; event: number; regime: number },
): number {
  const sumW = weights.synthetic + weights.info + weights.event + weights.regime;
  if (sumW < 1e-9) return 0;

  const wSynthetic = weights.synthetic / sumW;
  const wInfo = weights.info / sumW;
  const wEvent = weights.event / sumW;
  const wRegime = weights.regime / sumW;

  const adjustedRegime =
    Math.abs(regime) > 0.4 ? regime * (1 - DOMINANCE_PENALTY) : regime;
  const adjustedInfo = info * (1 + 0.2);
  const adjustedEvent = event * (1 + 0.3);

  return clamp11(
    synthetic * wSynthetic +
      adjustedInfo * wInfo +
      adjustedEvent * wEvent +
      adjustedRegime * wRegime,
  );
}

export function computeBaseSignal(
  i: Pick<
    DecisionModelChannelInput,
    "synthetic_i" | "regime_i" | "infoSignal" | "eventSignal"
  >,
): number {
  return blendChannelsWithRegimeRebalance(
    i.synthetic_i,
    i.infoSignal,
    i.eventSignal,
    i.regime_i,
    { synthetic: W_SYN, info: W_INFO, event: W_EVT, regime: W_REG },
  );
}

/** CV-VAL-027: fixed presets; same preset for all agents in a run. */
export const CV_VAL027_PRESET_NAMES = [
  "baseline",
  "low_regime",
  "balanced",
  "info_heavy",
] as const;
export type SharedWeightPresetName = (typeof CV_VAL027_PRESET_NAMES)[number];

export interface SharedWeightPreset {
  syn: number;
  info: number;
  evt: number;
  reg: number;
}

export function getSharedWeightPreset(presetName: string): SharedWeightPreset {
  const key = presetName.trim().toLowerCase().replace(/-/g, "_");
  switch (key) {
    case "baseline":
      // CV-ARCH-031: W_SYN = 0.4, W_INFO = 0.4, W_EVT = 0.2, W_REG = 0.2
      return { syn: 0.4, info: 0.4, evt: 0.2, reg: 0.2 };
    case "low_regime":
      return { syn: 0.38, info: 0.38, evt: 0.14, reg: 0.25 };
    case "balanced":
      return { syn: 0.3, info: 0.3, evt: 0.15, reg: 0.3 };
    case "info_heavy":
      return { syn: 0.25, info: 0.45, evt: 0.15, reg: 0.25 };
    default:
      throw new Error(
        `Unknown weight preset "${presetName}". Use: ${CV_VAL027_PRESET_NAMES.join(", ")}`,
      );
  }
}

export function computeBaseSignalWithSharedPreset(
  i: Pick<
    DecisionModelChannelInput,
    "synthetic_i" | "regime_i" | "infoSignal" | "eventSignal"
  >,
  presetName: string,
): number {
  const w = getSharedWeightPreset(presetName);
  return blendChannelsWithRegimeRebalance(
    i.synthetic_i,
    i.infoSignal,
    i.eventSignal,
    i.regime_i,
    { synthetic: w.syn, info: w.info, event: w.evt, regime: w.reg },
  );
}

/** CV-VAL-025: per-agent convex weights (normalized), all channels strictly positive. */
export interface GoldSoftWeights {
  wSyn: number;
  wInfo: number;
  wEvt: number;
  wReg: number;
}

function goldUnit(agentId: string, key: string, lo: number, hi: number): number {
  return lo + (hi - lo) * hashToUnitFloat(`cv-val-025:w:${agentId}:${key}`);
}

export function goldSoftWeights(agentId: string): GoldSoftWeights {
  const a = goldUnit(agentId, "syn", 0.32, 0.44);
  const b = goldUnit(agentId, "info", 0.32, 0.44);
  const c = goldUnit(agentId, "evt", 0.10, 0.18);
  const d = goldUnit(agentId, "reg", 0.4, 0.6);
  const s = a + b + c + d;
  return { wSyn: a / s, wInfo: b / s, wEvt: c / s, wReg: d / s };
}

/** CV-VAL-025: discrete information lag in steps, ∈ {0,1,2,3,4}. */
export function goldDelaySteps(agentId: string): number {
  return Math.min(4, Math.floor(5 * hashToUnitFloat(`cv-val-025:lag:${agentId}`)));
}

export function computeBaseSignalWithWeights(
  i: Pick<
    DecisionModelChannelInput,
    "synthetic_i" | "regime_i" | "infoSignal" | "eventSignal"
  >,
  w: GoldSoftWeights,
): number {
  return blendChannelsWithRegimeRebalance(
    i.synthetic_i,
    i.infoSignal,
    i.eventSignal,
    i.regime_i,
    { synthetic: w.wSyn, info: w.wInfo, event: w.wEvt, regime: w.wReg },
  );
}

/** CV-VAL-026: deterministic fractional lag in steps, ∈ [0, 4]. */
export function goldDelayFloat(agentId: string): number {
  return 4 * hashToUnitFloat(`cv-val-026:delayf:${agentId}`);
}

/** CV-VAL-026: deterministic temporal blend strength, ∈ [0, 0.30]. */
export function goldLagAlpha(agentId: string): number {
  return 0.3 * hashToUnitFloat(`cv-val-026:lagAlpha:${agentId}`);
}

/**
 * CV-VAL-026: `history[i]` = base at step i. Linear interpolation at fractional `index`;
 * clamps before first / after last.
 */
export function interpolateHistory(history: number[], index: number): number {
  if (history.length === 0) return 0;
  if (!Number.isFinite(index)) return history[0]!;
  const last = history.length - 1;
  if (index <= 0) return history[0]!;
  if (index >= last) return history[last]!;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return history[lo]!;
  const t = index - lo;
  return history[lo]! * (1 - t) + history[hi]! * t;
}

/** Which price/info/regime channels enter the linear base (CV-VAL-023). */
export interface FeatureMask {
  syn: boolean;
  info: boolean;
  evt: boolean;
  reg: boolean;
}

/**
 * Deterministic mask per agent: each channel ~78% on; at least two channels active
 * (renormalized convex weights).
 */
export function featureMaskForAgent(agentId: string): FeatureMask {
  const on = (tag: string) => hashToUnitFloat(`cv-val-023:mask:${agentId}:${tag}`) > 0.22;
  let syn = on("syn");
  let info = on("info");
  let evt = on("evt");
  let reg = on("reg");
  const n = (syn ? 1 : 0) + (info ? 1 : 0) + (evt ? 1 : 0) + (reg ? 1 : 0);
  if (n < 2) {
    syn = true;
    info = true;
    if (!evt && !reg) reg = true;
  }
  return { syn, info, evt, reg };
}

export function computeBaseSignalMasked(
  i: Pick<
    DecisionModelChannelInput,
    "synthetic_i" | "regime_i" | "infoSignal" | "eventSignal"
  >,
  mask: FeatureMask,
): number {
  const ws = mask.syn ? W_SYN : 0;
  const wi = mask.info ? W_INFO : 0;
  const we = mask.evt ? W_EVT : 0;
  const wr = mask.reg ? W_REG : 0;
  return blendChannelsWithRegimeRebalance(i.synthetic_i, i.infoSignal, i.eventSignal, i.regime_i, {
    synthetic: ws,
    info: wi,
    event: we,
    regime: wr,
  });
}

/** Per-agent delay aggressiveness ∈ ~[0.55, 1.42] (CV-VAL-023 `delay_i`). */
export function delayMultiplierForAgent(agentId: string): number {
  return 0.55 + 0.87 * hashToUnitFloat(`cv-val-023:delayi:${agentId}`);
}

export type AgentNoiseKind = "gaussian" | "uniform" | "laplace" | "mixture";

function noiseKindFromUnit(u: number): AgentNoiseKind {
  if (u < 0.25) return "gaussian";
  if (u < 0.5) return "uniform";
  if (u < 0.75) return "laplace";
  return "mixture";
}

export function noiseKindForRationality(agentId: string): AgentNoiseKind {
  return noiseKindFromUnit(hashToUnitFloat(`cv-val-023:noise:r:${agentId}`));
}

export function noiseKindForPrivate(agentId: string): AgentNoiseKind {
  return noiseKindFromUnit(hashToUnitFloat(`cv-val-023:noise:p:${agentId}`));
}

function randn(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  if (u1 < 1e-10) return randn(rng);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Laplace with variance ~1 when scaled downstream like N(0,1). */
function randLaplaceUnit(rng: () => number): number {
  const u = rng() - 0.5;
  const edge = Math.max(1e-9, 0.5 - Math.abs(u));
  return -Math.sign(u) * (1 / Math.SQRT2) * Math.log(4 * edge);
}

/** Uniform on [-sqrt(3), sqrt(3)] → variance 1. */
function randUniformUnit(rng: () => number): number {
  return (rng() - 0.5) * 2 * Math.sqrt(3);
}

function drawNoiseUnit(kind: AgentNoiseKind, rng: () => number): number {
  switch (kind) {
    case "gaussian":
      return randn(rng);
    case "uniform":
      return randUniformUnit(rng);
    case "laplace":
      return randLaplaceUnit(rng);
    case "mixture":
      return rng() < 0.85 ? randUniformUnit(rng) * 0.45 : randn(rng) * 1.35;
    default: {
      const _e: never = kind;
      return _e;
    }
  }
}

/**
 * Rationality + private shocks with **independent noise families** per agent (CV-VAL-023).
 */
export function decorrelationShock(
  agentId: string,
  rationality: number,
  understanding: number,
  ratScale: number,
  privScale: number,
  rng: () => number,
): number {
  const r = Math.max(0, Math.min(1, rationality));
  const u = Math.max(0, Math.min(1, understanding));
  const a = drawNoiseUnit(noiseKindForRationality(agentId), rng) * ratScale * (1 - r);
  const b = drawNoiseUnit(noiseKindForPrivate(agentId), rng) * privScale * (1 - u);
  return a + b;
}

/** CV-VAL-024 ablation letters (A–H). */
export const CV_VAL024_MODE_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export type CvVal024ModeLetter = (typeof CV_VAL024_MODE_LETTERS)[number];

export function parseCvVal024Mode(s: string | undefined): CvVal024ModeLetter | undefined {
  if (s == null || String(s).trim() === "") return undefined;
  const c = String(s).trim().toUpperCase();
  if (c.length === 1 && c >= "A" && c <= "H") return c as CvVal024ModeLetter;
  return undefined;
}

export interface CvVal024AblationFlags {
  useFeatureMask: boolean;
  useDelayI: boolean;
  useDecorrelationNoise: boolean;
}

/**
 * Isolated decorrelation toggles on top of constrained diversity (CV-VAL-024).
 * A baseline, B delay_i, C mask, D noise, …, H all three.
 */
export function cvVal024Ablation(mode: CvVal024ModeLetter): CvVal024AblationFlags {
  switch (mode) {
    case "A":
      return { useFeatureMask: false, useDelayI: false, useDecorrelationNoise: false };
    case "B":
      return { useFeatureMask: false, useDelayI: true, useDecorrelationNoise: false };
    case "C":
      return { useFeatureMask: true, useDelayI: false, useDecorrelationNoise: false };
    case "D":
      return { useFeatureMask: false, useDelayI: false, useDecorrelationNoise: true };
    case "E":
      return { useFeatureMask: true, useDelayI: true, useDecorrelationNoise: false };
    case "F":
      return { useFeatureMask: false, useDelayI: true, useDecorrelationNoise: true };
    case "G":
      return { useFeatureMask: true, useDelayI: false, useDecorrelationNoise: true };
    case "H":
      return { useFeatureMask: true, useDelayI: true, useDecorrelationNoise: true };
  }
}

/** Omitting --cvVal024 keeps full decorrelation (mode H), matching pre-024 CLI behavior. */
export const CV_VAL024_DEFAULT_FULL: CvVal024ModeLetter = "H";

export function cvVal024FlagsForArgv(
  mode: CvVal024ModeLetter | undefined,
): CvVal024AblationFlags {
  return cvVal024Ablation(mode ?? CV_VAL024_DEFAULT_FULL);
}

export interface ConstrainedDiversityState {
  /** Previous step raw base_signal (for delay blend). */
  prevBase?: number;
  /** Previous step post-smoothing intermediate (EMA tap). */
  prevSmoothedMid?: number;
}

function paramsForModel(
  kind: AgentDecisionModelKind,
  agentId: string,
): { scale: number; bias: number; smooth: number; delay: number } {
  const u = (tag: string) => hashToUnitFloat(`cv-val-022:${kind}:${agentId}:${tag}`);
  switch (kind) {
    case "trend_follower":
      return {
        scale: 0.92 + 0.2 * u("sc"),
        bias: (u("bi") - 0.5) * 0.07,
        smooth: 0.08 + 0.2 * u("sm"),
        delay: 0.03 + 0.12 * u("dl"),
      };
    case "mean_reversion":
      return {
        scale: 0.65 + 0.22 * u("sc"),
        bias: -0.028 - 0.045 * u("bi"),
        smooth: 0.2 + 0.3 * u("sm"),
        delay: 0.1 + 0.22 * u("dl"),
      };
    case "news_driven":
      return {
        scale: 0.86 + 0.24 * u("sc"),
        bias: (u("bi") - 0.5) * 0.065,
        smooth: 0.06 + 0.16 * u("sm"),
        delay: 0.02 + 0.09 * u("dl"),
      };
    case "passive_low_attention":
      return {
        scale: 0.5 + 0.22 * u("sc"),
        bias: (u("bi") - 0.5) * 0.045,
        smooth: 0.32 + 0.3 * u("sm"),
        delay: 0.15 + 0.26 * u("dl"),
      };
  }
}

/**
 * Pipeline (CV-VAL-022): **scale + slight bias** → **smoothing** (EMA on intermediate) → **delay**
 * (blend with prior step raw base). All scales ∈ (0, ~1.15]; bias small; no mirroring of base.
 */
export function applyConstrainedDiversityTransform(
  kind: AgentDecisionModelKind,
  agentId: string,
  base: number,
  state: ConstrainedDiversityState,
  /** CV-VAL-023: per-agent delay multiplier (`delay_i`). */
  delayScale = 1,
): { signal: number; nextSmoothedMid: number } {
  const { scale, bias, smooth, delay } = paramsForModel(kind, agentId);
  const dEff = clamp11(delay * delayScale);
  const x = base * scale + bias;
  const smoothed =
    state.prevSmoothedMid === undefined
      ? x
      : (1 - smooth) * x + smooth * state.prevSmoothedMid;
  const delayed =
    state.prevBase === undefined
      ? smoothed
      : (1 - dEff) * smoothed + dEff * state.prevBase;
  return { signal: clamp11(delayed), nextSmoothedMid: smoothed };
}

export function emptyModelActionHistogram(): Record<
  AgentDecisionModelKind,
  { BUY: number; SELL: number; HOLD: number }
> {
  return {
    trend_follower: { BUY: 0, SELL: 0, HOLD: 0 },
    mean_reversion: { BUY: 0, SELL: 0, HOLD: 0 },
    news_driven: { BUY: 0, SELL: 0, HOLD: 0 },
    passive_low_attention: { BUY: 0, SELL: 0, HOLD: 0 },
  };
}
