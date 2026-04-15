/**
 * Reaction Engine: human-like event response layer applied AFTER scalar signalI is computed,
 * BEFORE discrete BUY/SELL/HOLD. Does not alter upstream channel math.
 *
 * Deterministic: uses hashToUnitFloat / fixed profile tables only (no Math.random).
 */

import { clamp01, clamp11, hashToUnitFloat, type InfoEventInput } from "./exposure";

export type ReactionMode = "panic_sell" | "panic_buy" | "ignore" | "delay" | "bias_only";

export type EventImpact = {
  /** Signed aggregate from event sentiment, [-1, 1]. */
  valence: number;
  /** reach + urgency proxy (volatilityImpact), [0, 1]. */
  attention: number;
  /** Mean credibility of visible events, [0, 1]. */
  credibility: number;
  /** Scalar reaction potential in [0, 1]. */
  salience: number;
};

export type ReactionProfile = {
  archetypeKey: string;
  sensitivityValence: number;
  sensitivityAttention: number;
  sensitivityCredibility: number;
  /** Salience at/above which panic modes are allowed. */
  panicSalienceMin: number;
  /** |valence| minimum to consider directional panic. */
  panicValenceMin: number;
  /** Scale for additive bias to signal (non-panic). */
  biasScale: number;
  /** Steps to defer when mode is delay. */
  delaySteps: number;
  /** Salience window where delay is considered (inclusive-ish via gate). */
  delaySalienceLow: number;
  delaySalienceHigh: number;
  /** Unit-float gate; delay only if hash < this (deterministic per agent/step). */
  delayGateU: number;
  /** If true, flip panic side (contrarian-style). */
  contrarianFlip: boolean;
};

export type ReactionState = {
  mode: ReactionMode;
  /** Additive adjustment to signal before threshold / sign rule (0 if panic override). */
  bias: number;
  /** When set, decision must use this action and bypass threshold/sign band. */
  actionOverride: "BUY" | "SELL" | null;
};

export type PendingReaction = {
  activateStep: number;
  override: "BUY" | "SELL" | null;
  bias: number;
};

const DEFAULT_PROFILE: ReactionProfile = {
  archetypeKey: "default",
  sensitivityValence: 0.42,
  sensitivityAttention: 0.33,
  sensitivityCredibility: 0.28,
  panicSalienceMin: 0.5,
  panicValenceMin: 0.22,
  biasScale: 0.1,
  delaySteps: 2,
  delaySalienceLow: 0.32,
  delaySalienceHigh: 0.48,
  delayGateU: 0.35,
  contrarianFlip: false,
};

/** Hardcoded v1 profiles keyed by archetype config id (`archetypes.config.json` id). */
const REACTION_PROFILES: Record<string, Partial<ReactionProfile>> = {
  event_sniper: {
    sensitivityValence: 0.62,
    sensitivityAttention: 0.45,
    sensitivityCredibility: 0.25,
    panicSalienceMin: 0.38,
    panicValenceMin: 0.14,
    biasScale: 0.06,
    delaySteps: 1,
    delaySalienceLow: 0.2,
    delaySalienceHigh: 0.37,
    delayGateU: 0.2,
  },
  news_reactor: {
    sensitivityValence: 0.55,
    sensitivityAttention: 0.5,
    sensitivityCredibility: 0.35,
    panicSalienceMin: 0.42,
    panicValenceMin: 0.16,
    biasScale: 0.11,
    delaySteps: 2,
    delaySalienceLow: 0.3,
    delaySalienceHigh: 0.45,
    delayGateU: 0.28,
  },
  passive_low_attention: {
    sensitivityValence: 0.22,
    sensitivityAttention: 0.55,
    sensitivityCredibility: 0.4,
    panicSalienceMin: 0.72,
    panicValenceMin: 0.35,
    biasScale: 0.05,
    delaySteps: 3,
    delaySalienceLow: 0.28,
    delaySalienceHigh: 0.55,
    delayGateU: 0.55,
  },
  info_skeptic: {
    sensitivityValence: 0.25,
    sensitivityAttention: 0.2,
    sensitivityCredibility: 0.55,
    panicSalienceMin: 0.78,
    panicValenceMin: 0.4,
    biasScale: 0.04,
    delaySteps: 2,
    delaySalienceLow: 0.34,
    delaySalienceHigh: 0.5,
    delayGateU: 0.4,
  },
  momentum_trader: {
    sensitivityValence: 0.48,
    sensitivityAttention: 0.38,
    sensitivityCredibility: 0.22,
    panicSalienceMin: 0.44,
    panicValenceMin: 0.18,
    biasScale: 0.14,
    delaySteps: 1,
    delaySalienceLow: 0.25,
    delaySalienceHigh: 0.42,
    delayGateU: 0.22,
  },
  mean_reversion: {
    sensitivityValence: 0.4,
    sensitivityAttention: 0.3,
    sensitivityCredibility: 0.32,
    panicSalienceMin: 0.52,
    panicValenceMin: 0.24,
    biasScale: 0.12,
    contrarianFlip: true,
    delaySteps: 2,
    delaySalienceLow: 0.33,
    delaySalienceHigh: 0.5,
    delayGateU: 0.32,
  },
  noise: {
    sensitivityValence: 0.5,
    sensitivityAttention: 0.6,
    sensitivityCredibility: 0.15,
    panicSalienceMin: 0.35,
    panicValenceMin: 0.1,
    biasScale: 0.15,
    delaySteps: 1,
    delaySalienceLow: 0.22,
    delaySalienceHigh: 0.4,
    delayGateU: 0.45,
  },
  trend_follower: {
    sensitivityValence: 0.44,
    sensitivityAttention: 0.36,
    sensitivityCredibility: 0.26,
    panicSalienceMin: 0.48,
    panicValenceMin: 0.2,
    biasScale: 0.09,
    delaySteps: 2,
    delaySalienceLow: 0.3,
    delaySalienceHigh: 0.46,
    delayGateU: 0.3,
  },
};

export function reactionProfileForArchetypeId(archetypeId: string): ReactionProfile {
  const p = REACTION_PROFILES[archetypeId];
  if (!p) return { ...DEFAULT_PROFILE, archetypeKey: archetypeId };
  return { ...DEFAULT_PROFILE, ...p, archetypeKey: archetypeId };
}

export function computeEventImpactFromEvents(events: InfoEventInput[]): EventImpact {
  if (events.length === 0) {
    return { valence: 0, attention: 0, credibility: 0, salience: 0 };
  }
  let vSum = 0;
  let cSum = 0;
  let attSum = 0;
  for (const e of events) {
    const sent = clamp11(e.sentiment);
    vSum += sent;
    cSum += clamp01(e.credibility);
    const urg = e.volatilityImpact != null && Number.isFinite(e.volatilityImpact) ? clamp01(e.volatilityImpact) : 0.35;
    attSum += clamp01(0.65 * clamp01(e.reach) + 0.35 * urg);
  }
  const n = events.length;
  const valence = clamp11(vSum / n);
  const credibility = clamp01(cSum / n);
  const attention = clamp01(attSum / n);
  const salience = clamp01(
    0.45 * Math.abs(valence) + 0.32 * attention + 0.23 * credibility,
  );
  return { valence, attention, credibility, salience };
}

function pickPanicOverride(
  valence: number,
  salience: number,
  profile: ReactionProfile,
): "BUY" | "SELL" | null {
  if (salience < profile.panicSalienceMin) return null;
  if (Math.abs(valence) < profile.panicValenceMin) return null;
  let side: "BUY" | "SELL" = valence > 0 ? "BUY" : "SELL";
  if (profile.contrarianFlip) {
    side = side === "BUY" ? "SELL" : "BUY";
  }
  return side;
}

function computeBiasOnly(impact: EventImpact, profile: ReactionProfile): number {
  const w =
    profile.sensitivityValence * Math.abs(impact.valence) +
    profile.sensitivityAttention * impact.attention +
    profile.sensitivityCredibility * impact.credibility;
  const gate = clamp01(w / 1.2);
  return clamp11(profile.biasScale * impact.valence * gate);
}

export type ApplyReactionEngineInput = {
  agentId: string;
  step: number;
  eventsForAgent: InfoEventInput[];
  archetypeId: string;
  pending: Map<string, PendingReaction>;
  globalSeed: number;
};

/**
 * Apply reaction layer: may set actionOverride (panic), schedule delay, or return bias for signal.
 * Mutates `pending` when scheduling or consuming delayed reactions.
 */
export function applyReactionEngine(input: ApplyReactionEngineInput): ReactionState {
  const { agentId, step, eventsForAgent, archetypeId, pending } = input;
  const profile = reactionProfileForArchetypeId(archetypeId);

  const pend = pending.get(agentId);
  if (pend != null && step >= pend.activateStep) {
    pending.delete(agentId);
    if (pend.override != null) {
      return {
        mode: pend.override === "BUY" ? "panic_buy" : "panic_sell",
        bias: 0,
        actionOverride: pend.override,
      };
    }
    return { mode: "bias_only", bias: pend.bias, actionOverride: null };
  }

  if (eventsForAgent.length === 0) {
    return { mode: "ignore", bias: 0, actionOverride: null };
  }

  const impact = computeEventImpactFromEvents(eventsForAgent);
  if (impact.salience < 1e-6) {
    return { mode: "ignore", bias: 0, actionOverride: null };
  }

  const panic = pickPanicOverride(impact.valence, impact.salience, profile);
  if (panic != null) {
    return { mode: panic === "BUY" ? "panic_buy" : "panic_sell", bias: 0, actionOverride: panic };
  }

  const delayU = hashToUnitFloat(`reaction-delay:${input.globalSeed}:${agentId}:${step}`);
  const inDelayBand =
    impact.salience >= profile.delaySalienceLow &&
    impact.salience <= profile.delaySalienceHigh &&
    delayU < profile.delayGateU;

  if (inDelayBand && profile.delaySteps > 0) {
    const biasDeferred = computeBiasOnly(impact, profile);
    if (Math.abs(biasDeferred) > 1e-5) {
      pending.set(agentId, {
        activateStep: step + profile.delaySteps,
        override: null,
        bias: biasDeferred,
      });
      return { mode: "delay", bias: 0, actionOverride: null };
    }
  }

  const bias = computeBiasOnly(impact, profile);
  if (Math.abs(bias) < 1e-6) {
    return { mode: "ignore", bias: 0, actionOverride: null };
  }
  return { mode: "bias_only", bias, actionOverride: null };
}
