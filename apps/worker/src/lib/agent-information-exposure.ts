/**
 * CV-ARCH-001: Information exposure layer — social / crowd effects enter only here (subset + worldview),
 * not in the decision stage. Deterministic given seed + agentId + step + event ids.
 */

import { clamp01, clamp11, hashToUnitFloat, type InfoEventInput } from "./exposure";

/** Deterministic source quality in ~[0.38, 1] from source id (CV-VAL-018). */
export function signalQualityFromSource(source: string | null | undefined): number {
  if (source == null || String(source).trim() === "") return 0.82;
  return clamp01(0.38 + 0.62 * hashToUnitFloat(`sigq:${source}`));
}

/** Fraction of distinct topics ignored as blind spots (target band 20–40%). */
export function blindTopicFraction(agentId: string, step: number, seed: number): number {
  return 0.2 + 0.2 * hashToUnitFloat(`blindfrac:${seed}:${agentId}:${step}`);
}

export function blindTopicsForAgent(
  distinctTopics: string[],
  agentId: string,
  step: number,
  seed: number,
): Set<string> {
  if (distinctTopics.length <= 1) return new Set();
  const frac = blindTopicFraction(agentId, step, seed);
  const k = Math.min(
    distinctTopics.length - 1,
    Math.max(1, Math.ceil(distinctTopics.length * frac)),
  );
  const scored = distinctTopics.map((t) => ({
    t,
    h: hashToUnitFloat(`blindpick:${seed}:${agentId}:${step}:${t}`),
  }));
  scored.sort((a, b) => a.h - b.h);
  return new Set(scored.slice(0, k).map((x) => x.t));
}

export function filterEventsVisibleToAgent(
  events: InfoEventInput[],
  blindTopics: Set<string>,
): InfoEventInput[] {
  return events.filter((e) => !blindTopics.has(e.topic ?? ""));
}

export function approxMeanPairwiseJaccard(
  sets: ReadonlyArray<ReadonlySet<string>>,
  sampleCount: number,
  rng: () => number,
): number {
  const n = sets.length;
  if (n < 2) return n === 1 && sets[0]!.size > 0 ? 1 : 0;
  let sum = 0;
  let cnt = 0;
  for (let s = 0; s < sampleCount; s++) {
    let i = Math.floor(rng() * n);
    let j = Math.floor(rng() * n);
    if (i === j) j = (j + 1 + Math.floor(rng() * (n - 1))) % n;
    const A = sets[i]!;
    const B = sets[j]!;
    if (A.size === 0 && B.size === 0) continue;
    let inter = 0;
    for (const x of A) if (B.has(x)) inter++;
    const uni = A.size + B.size - inter;
    if (uni > 0) {
      sum += inter / uni;
      cnt++;
    }
  }
  return cnt > 0 ? sum / cnt : 0;
}

export function selectAgentEventSubset(input: {
  events: InfoEventInput[];
  agentId: string;
  step: number;
  seed: number;
  archetypeName: string | null;
  attentionLevel: number;
  /** CV-VAL-018: <1 tightens exposure to increase heterogeneity (with blind spots). */
  targetFracScale?: number;
}): InfoEventInput[] {
  const {
    events,
    agentId,
    step,
    seed,
    archetypeName,
    attentionLevel,
    targetFracScale = 1,
  } = input;
  if (events.length === 0) return [];

  const archetypeBoost = archetypeName
    ? 0.55 + 0.45 * hashToUnitFloat(`${seed}:${agentId}:arch:${archetypeName}`)
    : 0.75;
  const targetFrac = clamp01(
    attentionLevel * (0.25 + 0.55 * archetypeBoost) * targetFracScale,
  );
  const n = Math.max(1, Math.ceil(events.length * targetFrac));

  const scored = events.map((e) => ({
    e,
    h: hashToUnitFloat(`${seed}:${agentId}:${step}:${e.id}`),
  }));
  scored.sort((a, b) => a.h - b.h);
  return scored.slice(0, n).map((x) => x.e);
}

/**
 * Worldview + perception noise applied after aggregating exposed events.
 * optimisticBias, politicalLean, economicLean ∈ [-1, 1] (trait-derived).
 */
export function applyInformationExposureLayer(input: {
  rawInfoSignal: number;
  syntheticSignal: number;
  optimisticBias: number;
  politicalLean: number;
  economicLean: number;
  rng: () => number;
}): number {
  const {
    rawInfoSignal,
    syntheticSignal,
    optimisticBias,
    politicalLean,
    economicLean,
    rng,
  } = input;

  let x = rawInfoSignal;
  x *= 1 + 0.18 * optimisticBias;
  x += 0.1 * politicalLean * (syntheticSignal !== 0 ? Math.sign(syntheticSignal) : politicalLean > 0 ? 0.15 : -0.15);
  x += 0.08 * economicLean * clamp11(syntheticSignal);
  x += (rng() - 0.5) * 0.08;
  return clamp11(x);
}

/**
 * CV-ARCH-002: Non-experts dilute structured info with random opinion when understanding is low.
 * info_i = info_raw * understanding + noise * (1 - understanding), noise ~ U[-1, 1].
 */
export function blendInfoWithUnderstanding(input: {
  infoRaw: number;
  understanding: number;
  rng: () => number;
}): number {
  const { infoRaw, understanding, rng } = input;
  const u = clamp01(understanding);
  const noise = (rng() - 0.5) * 2;
  return clamp11(infoRaw * u + noise * (1 - u));
}

/** Per-agent synthetic channel: common move + small private noise / risk scaling. */
export function computeAgentSyntheticSignal(input: {
  syntheticSignal: number;
  riskTolerance: number;
  rng: () => number;
}): number {
  const { syntheticSignal, riskTolerance, rng } = input;
  const scale = 0.9 + 0.2 * clamp01(riskTolerance);
  const noise = (rng() - 0.5) * 0.05;
  return clamp11(syntheticSignal * scale + noise);
}

/** Per-agent regime weighting (interpretation of same macro regime). */
export function computeAgentRegimeSignal(input: {
  regimeSignal: number;
  newsSensitivity: number;
  rng: () => number;
}): number {
  const { regimeSignal, newsSensitivity, rng } = input;
  const w = 0.75 + 0.35 * clamp01(newsSensitivity);
  const noise = (rng() - 0.5) * 0.04;
  return clamp11(regimeSignal * w + noise);
}
