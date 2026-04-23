/**
 * InfoFeed exposure + perception model.
 * Deterministic: same seed + agentId + eventId + step => same exposure.
 */

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function clamp11(x: number): number {
  return Math.max(-1, Math.min(1, x));
}

/** Clamp scenario sensitivity override multipliers (deterministic). */
export function scenarioChannelMul(
  overrides: Record<string, number> | undefined,
  channel: "info" | "event",
): number {
  if (!overrides) return 1;
  const v = overrides[channel];
  if (v == null || !Number.isFinite(v)) return 1;
  return Math.max(0.25, Math.min(1.75, v));
}

/** Hash string to unit float [0, 1) for deterministic exposure. */
export function hashToUnitFloat(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
    h = h | 0;
  }
  const u32 = h >>> 0;
  return u32 / 4294967296;
}

export interface InfoEventInput {
  id: string;
  sentiment: number;
  credibility: number;
  reach: number;
  /** Topic / category (InfoEvent.topic). */
  topic?: string;
  source?: string | null;
  /** Per-source quality in [0, 1]; scales perceived info / events (CV-VAL-018). */
  signalQuality?: number;
  /** InfoEvent.volatilityImpact — dampens high-volatility items in demo feed (deterministic). */
  volatilityImpact?: number | null;
  /** From `--scenarioFile`: synthetic injection merged into the same pipeline as DB InfoEvents. */
  scenarioInjected?: boolean;
  /** If set, only agents matching one of these archetype ids/names (case-insensitive) receive this event. */
  scenarioTargetArchetypes?: string[];
  /** Optional per-channel multipliers on top of normal perception (keys: `info`, `event`). */
  scenarioSensitivityOverrides?: Record<string, number>;
  /** Simulated platform label from LIVE_JSON (demo only): x | facebook | reddit | sec | newswire. */
  simulationPlatform?: string;
  /** Per archetype config id: multiplies base sentiment for that agent (decide.ts). */
  archetypeSentimentScale?: Record<string, number>;
  /** Fallback multiplier when archetype id is not in archetypeSentimentScale. */
  defaultArchetypeSentimentScale?: number;
}

/**
 * Deterministic exposure: agent sees event if pseudoRand < reach * attentionLevel (clamped).
 */
export function isExposed(
  agentId: string,
  eventId: string,
  step: number,
  seed: number | string,
  reach: number,
  attentionLevel: number,
): boolean {
  const key = `${seed}:${agentId}:${eventId}:${step}`;
  const pseudoRand = hashToUnitFloat(key);
  const threshold = clamp01(reach * attentionLevel);
  return pseudoRand < threshold;
}

export interface PerceptionInput {
  event: InfoEventInput;
  agentId: string;
  step: number;
  seed: number | string;
  attentionLevel: number;
  confirmationBias: number;
  overconfidence: number;
  /** Agent's prior belief / anchor (e.g. last distorted signal or crowd sample). */
  anchorSign: number;
}

/**
 * Per-event perceived sentiment: applies confirmation bias, overconfidence, credibility.
 */
export function perceivedSentiment(input: PerceptionInput): number {
  const {
    event,
    agentId,
    step,
    seed,
    attentionLevel,
    confirmationBias,
    overconfidence,
    anchorSign,
  } = input;

  if (!isExposed(agentId, event.id, step, seed, event.reach, attentionLevel)) {
    return 0;
  }

  const sigQ = clamp01(event.signalQuality ?? 1);

  let base = clamp11(event.sentiment);
  let weight = event.credibility;

  // Confirmation bias: if same sign as anchor, weight *= (1 + confirmationBias * 0.5)
  const sameSign = (base > 0 && anchorSign > 0) || (base < 0 && anchorSign < 0);
  if (sameSign && Math.abs(anchorSign) > 0.01) {
    weight *= 1 + confirmationBias * 0.5;
  }

  // Overconfidence: increases magnitude slightly (clamp)
  const magBoost = 1 + 0.2 * overconfidence;
  base = clamp11(base * magBoost);

  const mul = scenarioChannelMul(event.scenarioSensitivityOverrides, "info");
  return clamp11(base * clamp01(weight) * sigQ * mul);
}

export interface AggregatePerceptionInput {
  events: InfoEventInput[];
  agentId: string;
  step: number;
  seed: number | string;
  attentionLevel: number;
  confirmationBias: number;
  overconfidence: number;
  anchorSign: number;
}

/**
 * Aggregate exposed events into a single infoSignal in [-1, 1].
 */
export function aggregateInfoSignal(input: AggregatePerceptionInput): {
  infoSignal: number;
  exposedCount: number;
} {
  const { events, agentId, step, seed, attentionLevel, confirmationBias, overconfidence, anchorSign } =
    input;

  let sum = 0;
  let exposedCount = 0;

  for (const event of events) {
    const ps = perceivedSentiment({
      event,
      agentId,
      step,
      seed,
      attentionLevel,
      confirmationBias,
      overconfidence,
      anchorSign,
    });
    if (ps !== 0) {
      sum += ps;
      exposedCount++;
    }
  }

  const infoSignal =
    exposedCount > 0 ? clamp11(sum / exposedCount) : 0;

  return { infoSignal, exposedCount };
}

export interface EventSignalInput {
  events: InfoEventInput[];
  confirmationBias: number;
  herding: number;
  attentionLevel: number;
  fatigue: number;
  emotionalVolatility: number;
  /** Current crowd consensus direction (-1 to 1). */
  crowdConsensusDirection: number;
}

/**
 * Compute direct eventSignal from InfoEvents per agent.
 * Formula: base = sum(e.sentiment * e.reach * e.credibility)
 * Then modulate by agent biases/humanState.
 * Returns eventSignal to be added to existing signal.
 */
export function computeEventSignal(input: EventSignalInput): number {
  const {
    events,
    confirmationBias,
    herding,
    attentionLevel,
    fatigue,
    emotionalVolatility,
    crowdConsensusDirection,
  } = input;

  if (events.length === 0) return 0;

  // Base: sum over events: sentiment * reach * credibility
  let base = 0;
  for (const e of events) {
    const m = scenarioChannelMul(e.scenarioSensitivityOverrides, "event");
    base += e.sentiment * e.reach * e.credibility * m;
  }

  // Modulate by agent biases/humanState
  // signMatchFactor: how much event sentiment matches crowd direction
  const signMatchFactor =
    Math.abs(crowdConsensusDirection) > 0.01
      ? Math.max(0, (base * crowdConsensusDirection) / Math.max(Math.abs(base), 0.01))
      : 0;

  let applied = base;
  // Confirmation bias: boost if matches prior belief
  applied *= 1 + confirmationBias * signMatchFactor * 0.3;
  // Herding: boost if aligns with crowd
  applied *= 1 + herding * Math.abs(crowdConsensusDirection) * 0.2;
  // Attention level: agents pay more attention when alert
  applied *= attentionLevel;
  // Fatigue: reduces signal impact
  applied *= 1 - fatigue * 0.3;
  // Emotional volatility: amplifies strong sentiment
  const avgSentimentMagnitude =
    events.length > 0
      ? events.reduce((sum, e) => sum + Math.abs(e.sentiment), 0) / events.length
      : 0;
  applied *= 1 + emotionalVolatility * avgSentimentMagnitude * 0.2;

  return clamp11(applied);
}

/** Event-channel signal without crowd or herding (CV-ARCH-001 decision independence). */
export function computeEventSignalIndependent(input: {
  events: InfoEventInput[];
  attentionLevel: number;
  fatigue: number;
  emotionalVolatility: number;
}): number {
  const { events, attentionLevel, fatigue, emotionalVolatility } = input;

  if (events.length === 0) return 0;

  let base = 0;
  for (const e of events) {
    const q = clamp01(e.signalQuality ?? 1);
    const m = scenarioChannelMul(e.scenarioSensitivityOverrides, "event");
    base += e.sentiment * e.reach * e.credibility * q * m;
  }

  let applied = base;
  applied *= attentionLevel;
  applied *= 1 - fatigue * 0.3;
  const avgSentimentMagnitude =
    events.length > 0
      ? events.reduce((sum, e) => sum + Math.abs(e.sentiment), 0) / events.length
      : 0;
  applied *= 1 + emotionalVolatility * avgSentimentMagnitude * 0.2;

  return clamp11(applied);
}
