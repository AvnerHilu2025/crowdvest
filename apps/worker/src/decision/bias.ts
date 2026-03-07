/**
 * Cognitive Bias Layer v1 – pure functions for human-like signal distortion and decision.
 * Deterministic given same RNG seed.
 */

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function clamp11(x: number): number {
  return Math.max(-1, Math.min(1, x));
}

/** Box-Muller for deterministic gaussian. */
export function randn(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  if (u1 < 1e-10) return randn(rng);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export interface Biases {
  herding: number;
  lossAversion: number;
  overconfidence: number;
  recencyBias: number;
  confirmationBias: number;
  fomo: number;
  anchoring: number;
}

export interface HumanState {
  attentionLevel: number;
  emotionalVolatility: number;
  fatigue: number;
}

export interface DistortInput {
  baseSignal: number;
  crowdSampleSignal: number;
  lastSignal: number | null;
  momentum: number;
  lastAction: "BUY" | "SELL" | "HOLD" | null;
  biases: Biases;
  humanState: HumanState;
  rng: () => number;
}

/** Apply cognitive biases to distort the base signal. */
export function distortSignal(input: DistortInput): number {
  const {
    baseSignal,
    crowdSampleSignal,
    lastSignal,
    momentum,
    lastAction,
    biases,
    humanState,
    rng,
  } = input;

  let distorted = baseSignal;

  distorted += biases.herding * crowdSampleSignal;
  if (lastSignal != null) {
    distorted += biases.recencyBias * lastSignal;
  }

  if (distorted < 0) {
    distorted *= 1 + biases.lossAversion;
  }

  if (lastSignal != null && lastSignal > 0 && momentum > 0) {
    distorted += biases.fomo * momentum;
  }

  const anchorPull = lastAction === "BUY" ? 0.3 : lastAction === "SELL" ? -0.3 : 0;
  distorted = distorted * (1 - 0.3 * biases.anchoring) + anchorPull * 0.3 * biases.anchoring;

  const noiseScale =
    (1 - humanState.attentionLevel) * 0.15 + humanState.emotionalVolatility * 0.1;
  distorted += noiseScale * randn(rng);

  return clamp11(distorted);
}

export type Action = "BUY" | "SELL" | "HOLD";

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export interface DecisionInput {
  distorted: number;
  attentionLevel: number;
  overconfidence: number;
  fatigue: number;
  uncertainty: number;
  rng: () => number;
}

/** Map distorted signal to action via softmax-like probabilities and sample. */
export function decisionFromSignal(input: DecisionInput): Action {
  const { distorted, attentionLevel, overconfidence, fatigue, uncertainty, rng } = input;

  const k = 2.5 * (0.5 + 0.5 * attentionLevel) * (1 - 0.3 * fatigue);
  const pBuy = sigmoid(k * distorted);
  const pSell = sigmoid(-k * distorted);
  const pHoldRaw = Math.max(0, 1 - Math.max(pBuy, pSell));
  const sum = pBuy + pSell + pHoldRaw;
  const pb = pBuy / sum;
  const ps = pSell / sum;
  const ph = pHoldRaw / sum;

  const u = rng();
  if (u < pb) return "BUY";
  if (u < pb + ps) return "SELL";
  return "HOLD";
}

/** Compute confidence from distorted signal, uncertainty, overconfidence, fatigue. */
export function computeConfidence(input: {
  distorted: number;
  action: Action;
  uncertainty: number;
  overconfidence: number;
  fatigue: number;
}): number {
  const { distorted, action, uncertainty, overconfidence, fatigue } = input;

  let baseConf = 0.5 + 0.4 * Math.abs(distorted) - 0.3 * uncertainty;
  baseConf *= 1 + 0.5 * overconfidence;
  baseConf *= 1 - 0.4 * fatigue;

  let conf = clamp01(baseConf);
  if (action === "HOLD") {
    conf = Math.min(conf, 0.65);
  } else {
    conf = Math.min(conf, 0.95);
  }
  return conf;
}

export interface ExperienceModulationInput {
  confidence: number;
  wasWithMajority: boolean | null;
  lossAversion: number;
  overconfidence: number;
}

/**
 * Modulate confidence based on previous step experience.
 * - wasWithMajority=true: increase confidence (validation).
 * - wasWithMajority=false: decrease confidence (lossAversion amplifies the drop; overconfidence dampens it).
 * Deterministic (no RNG).
 */
export function applyExperienceModulation(input: ExperienceModulationInput): number {
  const { confidence, wasWithMajority, lossAversion, overconfidence } = input;
  if (wasWithMajority == null) return confidence;

  if (wasWithMajority) {
    const boost = 0.08 * (1 + 0.3 * overconfidence);
    return clamp01(confidence + boost);
  }
  const drop = 0.12 * (1 + 0.5 * lossAversion) * (1 - 0.3 * overconfidence);
  return clamp01(confidence - drop);
}

/** Clamp preference delta asymmetrically: limit downside [-0.18, 0.3]. */
export function clampPref(x: number): number {
  return Math.max(-0.18, Math.min(0.3, x));
}

/** Clamp belief drift asymmetrically: limit negative drag [-0.12, +0.20]. */
function clampDrift(x: number): number {
  return Math.max(-0.12, Math.min(0.2, x));
}

export interface BeliefDriftEntry {
  step: number;
  action: Action;
  outcomePositive: boolean;
  confidence: number;
}

export interface BeliefBiasDriftInput {
  experiences: BeliefDriftEntry[];
  /** Map step -> crowd weighted signal [-1,1]. */
  crowdSignalByStep: Map<number, number>;
  currentStep: number;
  recencyBias: number;
  herding: number;
  lossAversion: number;
  /** Time decay factor per step back (e.g. 0.9). */
  decayFactor?: number;
}

/**
 * Compute deterministic beliefBias drift from recent experiences.
 * drift = clamp(k1*recencyBias*avgRecentSignal + k2*herding*avgRecentCrowdSignal - k3*lossAversion*recentLosses, -0.2, +0.2)
 */
export function computeBeliefBiasDrift(input: BeliefBiasDriftInput): number {
  const {
    experiences,
    crowdSignalByStep,
    currentStep,
    recencyBias,
    herding,
    lossAversion,
    decayFactor = 0.9,
  } = input;

  const K1 = 0.15;
  const K2 = 0.12;
  const K3 = 0.08;

  let weightedSignalSum = 0;
  let weightSum = 0;
  let crowdSum = 0;
  let crowdWeight = 0;
  let recentLosses = 0;

  for (const e of experiences) {
    const w = Math.pow(decayFactor, currentStep - e.step) * (0.5 + 0.5 * e.confidence);
    const actionVal = e.action === "BUY" ? 1 : e.action === "SELL" ? -1 : 0;
    weightedSignalSum += w * actionVal;
    weightSum += w;
    if (!e.outcomePositive) recentLosses += 1;

    const cs = crowdSignalByStep.get(e.step);
    if (cs != null && Number.isFinite(cs)) {
      crowdSum += w * clamp11(cs);
      crowdWeight += w;
    }
  }

  const avgRecentSignal = weightSum > 0 ? weightedSignalSum / weightSum : 0;
  const avgRecentCrowdSignal = crowdWeight > 0 ? crowdSum / crowdWeight : 0;

  const drift =
    K1 * recencyBias * avgRecentSignal +
    K2 * herding * avgRecentCrowdSignal -
    K3 * lossAversion * Math.min(recentLosses, 5);

  return clampDrift(drift);
}

export interface ExperienceEntry {
  step: number;
  action: Action;
  /** Outcome: positive = good for that action (e.g. BUY + price up). */
  outcomePositive: boolean;
}

export interface PreferenceDeltasInput {
  experiences: ExperienceEntry[];
  learningRate: number;
  lossAversion: number;
  overconfidence: number;
  /** Volatility proxy [0,1]; high => strengthen HOLD. */
  volatility: number;
  /** Uncertainty [0,1]; high => strengthen HOLD. */
  uncertainty: number;
}

/**
 * Compute per-agent action preference deltas from reinforcement learning over past experiences.
 * Deterministic (no RNG).
 */
export function computePreferenceDeltas(input: PreferenceDeltasInput): {
  prefBUY: number;
  prefSELL: number;
  prefHOLD: number;
} {
  const {
    experiences,
    learningRate,
    lossAversion,
    overconfidence,
    volatility,
    uncertainty,
  } = input;

  let prefBUY = 0;
  let prefSELL = 0;
  let prefHOLD = 0;

  for (const e of experiences) {
    const kPos = learningRate * (1 + 0.5 * overconfidence);
    const kNeg = learningRate * (0.65 + 0.35 * lossAversion);
    const kHold = learningRate * 0.2 * (volatility + uncertainty);

    if (e.action === "BUY") {
      if (e.outcomePositive) prefBUY += kPos;
      else prefBUY -= kNeg;
    } else if (e.action === "SELL") {
      if (e.outcomePositive) prefSELL += kPos;
      else prefSELL -= kNeg;
    } else {
      prefHOLD += kHold;
    }
  }

  return {
    prefBUY: clampPref(prefBUY),
    prefSELL: clampPref(prefSELL),
    prefHOLD: clampPref(prefHOLD),
  };
}

export interface DecisionWithPreferencesInput {
  /** Base distorted signal (from bias pipeline). */
  distorted: number;
  /** Preference deltas from experience-driven reinforcement. */
  prefBUY: number;
  prefSELL: number;
  prefHOLD: number;
  attentionLevel: number;
  overconfidence: number;
  fatigue: number;
  uncertainty: number;
  rng: () => number;
  regimeSignal?: number;
  regimeStrength?: number;
}

/**
 * Map signal + preference deltas to action via softmax.
 * Logits: BUY = +distorted + prefBUY, SELL = -distorted + prefSELL, HOLD = prefHOLD.
 */
const REGIME_LOGIT_WEIGHT = 1.2;

export function decisionFromSignalWithPreferences(
  input: DecisionWithPreferencesInput,
): Action {
  const {
    distorted,
    prefBUY,
    prefSELL,
    prefHOLD,
    attentionLevel,
    overconfidence,
    fatigue,
    uncertainty,
    rng,
    regimeSignal,
    regimeStrength,
  } = input;

  const k = 2.5 * (0.5 + 0.5 * attentionLevel) * (1 - 0.3 * fatigue);
  let logitBUY = k * distorted + prefBUY;
  let logitSELL = -k * distorted + prefSELL;
  const logitHOLD = prefHOLD;

  const rs = clamp11(regimeSignal ?? 0);
  logitBUY += REGIME_LOGIT_WEIGHT * rs;
  logitSELL -= REGIME_LOGIT_WEIGHT * rs;

  if (
    distorted >= -0.05 &&
    distorted <= 0.1 &&
    prefBUY < 0 &&
    prefHOLD > 0
  ) {
    logitBUY += 0.05 * (0.1 - Math.abs(distorted)) / 0.1;
  }

  const maxL = Math.max(logitBUY, logitSELL, logitHOLD);
  const eB = Math.exp(logitBUY - maxL);
  const eS = Math.exp(logitSELL - maxL);
  const eH = Math.exp(logitHOLD - maxL);
  const sum = eB + eS + eH;
  const pb = eB / sum;
  const ps = eS / sum;

  const u = rng();
  if (u < pb) return "BUY";
  if (u < pb + ps) return "SELL";
  return "HOLD";
}

export interface RationaleInput {
  action: Action;
  distorted: number;
  crowdSampleSignal: number;
  biases: Biases;
  humanState: HumanState;
  /** When > 0, include "saw X events (sentiment=...)" in rationale. */
  exposedCount?: number;
  infoSignal?: number;
  /** When true, append "based on prior gains/losses". */
  fromReinforcement?: boolean;
}

/** Build human-readable rationale mentioning applied biases and info influence. */
export function buildRationale(input: RationaleInput): string {
  const {
    action,
    distorted,
    crowdSampleSignal,
    biases,
    humanState,
    exposedCount,
    infoSignal,
    fromReinforcement,
  } = input;

  let infoPrefix = "";
  if ((exposedCount ?? 0) > 0 && infoSignal != null) {
    const sent = infoSignal >= 0 ? `+${infoSignal.toFixed(2)}` : infoSignal.toFixed(2);
    infoPrefix = `saw ${exposedCount} events (sentiment=${sent}), `;
  }

  let actionReason = "";
  if (action === "BUY") {
    if (biases.herding > 0.5 && crowdSampleSignal > 0.1) actionReason = "following crowd";
    else if (biases.fomo > 0.5 && distorted > 0) actionReason = "FOMO buy";
    else actionReason = "buying on positive signal";
  } else if (action === "SELL") {
    if (biases.lossAversion > 0.5 && distorted < 0) actionReason = "loss-averse sell";
    else if (biases.herding > 0.5 && crowdSampleSignal < -0.1) actionReason = "following crowd down";
    else actionReason = "selling on negative signal";
  } else {
    if (humanState.attentionLevel < 0.4) actionReason = "low attention hold";
    else if (humanState.fatigue > 0.5) actionReason = "fatigued, holding";
    else if (biases.anchoring > 0.5) actionReason = "anchored, waiting";
    else actionReason = "waiting for clearer signal";
  }

  let suffix = "";
  if (fromReinforcement) {
    suffix = ", based on prior gains/losses";
  }
  return infoPrefix + actionReason + suffix;
}

/** Update fatigue for next step. */
export function updateFatigue(
  fatigue: number,
  attentionLevel: number,
): number {
  return clamp01(fatigue + 0.02 * (1 - attentionLevel));
}

/** Slight decay of attention with fatigue. */
export function updateAttention(attentionLevel: number, fatigue: number): number {
  return clamp01(attentionLevel - 0.02 * fatigue);
}
