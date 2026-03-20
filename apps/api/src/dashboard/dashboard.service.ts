import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RunQueueService } from "../jobs/run-queue.service";
import { BenchService } from "../bench/bench.service";
import { LaunchPlanService } from "../launch-plan/launch-plan.service";
import { MarketDataService } from "../market-data/market-data.service";
import { StrategyProfilesService } from "../strategy-profiles/strategy-profiles.service";
import { SignalsService } from "../signals/signals.service";

function parseMs(iso?: string | Date | null): number | null {
  if (iso == null) return null;
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function diffMs(startIso?: string | Date | null, endIso?: string | Date | null): number | null {
  const start = parseMs(startIso);
  const end = parseMs(endIso);
  if (start == null || end == null) return null;
  const d = end - start;
  return Number.isFinite(d) && d >= 0 ? d : null;
}

function deriveRunDurationMs(run: {
  runDurationMs: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  completedAt: Date | null;
}): number | null {
  if (run.runDurationMs != null && Number.isFinite(run.runDurationMs) && run.runDurationMs > 0) {
    return run.runDurationMs;
  }
  const end = run.finishedAt ?? run.completedAt ?? null;
  return diffMs(run.startedAt, end);
}

function deriveVariantDurationMs(v: {
  durationMs: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
}): number | null {
  if (v.durationMs != null && Number.isFinite(v.durationMs) && v.durationMs > 0) {
    return v.durationMs;
  }
  return diffMs(v.startedAt, v.completedAt);
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map((v) => (v - mean) ** 2);
  const variance = sqDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function stabilityRiskScore(args: {
  isLegacyTiming?: boolean;
  label?: string | null;
  corrSpread?: number | null;
  accStdDev?: number | null;
  signAgreementRate?: number | null;
}): number {
  if (args.isLegacyTiming) return 5;
  if (args.label === "single-seed") return 10;

  const cs = Math.max(0, args.corrSpread ?? 0);
  const asd = Math.max(0, args.accStdDev ?? 0);
  const sar = Math.min(1, Math.max(0, args.signAgreementRate ?? 1));

  const signPenalty = (1 - sar) * 100;
  let corrPenalty = 0;
  if (cs >= 0.5) corrPenalty = 100;
  else if (cs >= 0.3) corrPenalty = 60 + ((cs - 0.3) / 0.2) * 40;
  else corrPenalty = (cs / 0.3) * 60;

  let accPenalty = 0;
  if (asd >= 0.06) accPenalty = 100;
  else if (asd >= 0.03) accPenalty = 60 + ((asd - 0.03) / 0.03) * 40;
  else accPenalty = (asd / 0.03) * 60;

  const score = 0.55 * signPenalty + 0.25 * corrPenalty + 0.2 * accPenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function riskBand(score: number): "OK" | "DIVERGING" | "UNSTABLE" | "LEGACY" {
  if (score >= 70) return "UNSTABLE";
  if (score >= 40) return "DIVERGING";
  return "OK";
}

/** Deterministic string hash for RNG seed. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

/** Mulberry32 deterministic PRNG. Returns [0, 1). */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Agent information profile for heterogeneous behavior. */
type AgentProfileType = "trendFollower" | "contrarian" | "balanced";

/** Information exposure weights. Must sum ~1. Phase 29: sourceWeights + trustBias + recencySensitivity. */
interface InformationProfile {
  technicalWeight: number;
  macroWeight: number;
  sentimentWeight: number;
  noiseWeight: number;
  attentionSpan: number;
  trustDecay: number;
  /** Phase 29: per-source trust bias [0.5, 1.5]. */
  trustBias: { technical: number; macro: number; sentiment: number };
  /** Phase 29: recency sensitivity [0.5, 1.5]. */
  recencySensitivity: number;
  /** Phase 29: canonical source weights (mirrors technicalWeight etc.). */
  sourceWeights: { technical: number; macro: number; sentiment: number; noise: number };
}

interface AgentProfile {
  type: AgentProfileType;
  sensitivity: { momentum: number; trend: number; volatility: number };
  bias: { bullishBias: number; contrarianFactor: number };
  informationProfile: InformationProfile;
}

/** Generate N agent profiles deterministically from seed. */
function generateAgentProfiles(seed: number, n: number): AgentProfile[] {
  const rng = mulberry32(seed);
  const profiles: AgentProfile[] = [];

  for (let i = 0; i < n; i++) {
    const typeRoll = rng();
    let type: AgentProfileType;
    if (typeRoll < 0.4) type = "trendFollower";
    else if (typeRoll < 0.7) type = "contrarian";
    else type = "balanced";

    let sensitivity: AgentProfile["sensitivity"];
    if (type === "trendFollower") {
      sensitivity = {
        momentum: 0.5 + rng() * 0.4,
        trend: 0.7 + rng() * 0.3,
        volatility: 0.1 + rng() * 0.3,
      };
    } else if (type === "contrarian") {
      sensitivity = {
        momentum: 0.2 + rng() * 0.3,
        trend: 0.2 + rng() * 0.3,
        volatility: 0.5 + rng() * 0.3,
      };
    } else {
      sensitivity = {
        momentum: 0.4 + rng() * 0.3,
        trend: 0.4 + rng() * 0.3,
        volatility: 0.4 + rng() * 0.3,
      };
    }

    const bullishBias =
      type === "contrarian" ? (rng() - 0.5) * 0.6 : (rng() - 0.5) * 0.4;
    const contrarianFactor =
      type === "contrarian"
        ? 0.6 + rng() * 0.4
        : type === "trendFollower"
          ? rng() * 0.2
          : rng() * 0.3;

    const rawTech = 0.2 + rng() * 0.5;
    const rawMacro = 0.1 + rng() * 0.4;
    const rawSent = 0.1 + rng() * 0.4;
    const rawNoise = 0.05 + rng() * 0.25;
    const sum = rawTech + rawMacro + rawSent + rawNoise;
    const trustBias = {
      technical: 0.5 + rng(),
      macro: 0.5 + rng(),
      sentiment: 0.5 + rng(),
    };
    const recencySensitivity = 0.5 + rng();
    const technicalWeight = rawTech / sum;
    const macroWeight = rawMacro / sum;
    const sentimentWeight = rawSent / sum;
    const noiseWeight = rawNoise / sum;
    const informationProfile: InformationProfile = {
      technicalWeight,
      macroWeight,
      sentimentWeight,
      noiseWeight,
      attentionSpan: 5 + 10 * rng(),
      trustDecay: 0.1 + rng() * 0.4,
      trustBias,
      recencySensitivity,
      sourceWeights: { technical: technicalWeight, macro: macroWeight, sentiment: sentimentWeight, noise: noiseWeight },
    };

    profiles.push({
      type,
      sensitivity,
      bias: { bullishBias, contrarianFactor },
      informationProfile,
    });
  }
  return profiles;
}

const AGENT_PROFILE_SEED = 0x27b0;
const NUM_AGENTS = 11;

/** Raw features from computeMarketFeatures (index-aligned). */
interface RawMarketFeatures {
  return5d: number;
  return20d: number;
  priceVsMa20: number;
  priceVsMa50: number;
  volatility10d: number;
}

/** Phase 29: Apply information profile to partial signals. Returns adjusted signals for weighted combination. */
function applyInformationProfile(
  technicalSignal: number,
  macroSignal: number,
  sentimentSignal: number,
  noiseSignal: number,
  agent: AgentProfile,
  agentIndex: number,
  contextSeed: number,
): { adjustedTechnical: number; adjustedMacro: number; adjustedSentiment: number; adjustedNoise: number; deterministicNoise: number } {
  const ip = agent.informationProfile;
  const rs = ip.recencySensitivity;
  const tb = ip.trustBias;

  const adjustedTechnical = technicalSignal * tb.technical * rs;
  const adjustedMacro = macroSignal * tb.macro * rs;
  const adjustedSentiment = sentimentSignal * tb.sentiment * rs;
  const adjustedNoise = noiseSignal;

  const noiseSeed = (contextSeed ^ (agentIndex * 0x9e3779b9)) >>> 0;
  const rng = mulberry32(noiseSeed);
  rng();
  rng();
  const deterministicNoise = (rng() - 0.5) * 0.08;

  return { adjustedTechnical, adjustedMacro, adjustedSentiment, adjustedNoise, deterministicNoise };
}

/** Bounded, seeded, slightly autocorrelated noise. Deterministic. Uses prevContextSeed for temporal correlation. */
function computeNoiseSignal(
  contextSeed: number,
  agentIndex: number,
  prevContextSeed?: number,
): number {
  const baseSeed = (contextSeed ^ (agentIndex * 0x9e3779b9)) >>> 0;
  const rng = mulberry32(baseSeed);
  const raw = 2 * (rng() - 0.5);
  let autocorr = raw;
  if (prevContextSeed != null && prevContextSeed !== 0) {
    const prevRng = mulberry32((prevContextSeed ^ (agentIndex * 0x9e3779b9)) >>> 0);
    prevRng();
    const prevRaw = 2 * (prevRng() - 0.5);
    autocorr = 0.35 * prevRaw + 0.65 * raw;
  } else {
    autocorr = 0.3 * Math.sin(contextSeed * 0.01 + agentIndex * 0.7) + 0.7 * raw;
  }
  return Math.max(-0.4, Math.min(0.4, autocorr));
}

/** Phase 29.1: Compute signal decomposition for direction bias diagnostics. Same logic as aggregation but returns breakdown. */
function computeSignalDecomposition(
  feat: RawMarketFeatures,
  agents: AgentProfile[],
  contextSeed: number,
  prevContextSeed?: number,
): {
  baseSignal: number;
  meanSignal: number;
  technicalContribution: number;
  macroContribution: number;
  sentimentContribution: number;
  noiseContribution: number;
  byAgentType: Record<AgentProfileType, { sumSignal: number; count: number; positiveCount: number; negativeCount: number }>;
} {
  const momentum = Math.max(-1, Math.min(1, feat.return5d * 2));
  const trend = Math.max(-1, Math.min(1, feat.priceVsMa20 * 2));

  const macroRaw = feat.return20d * 0.5 + feat.priceVsMa50 * 0.3;
  const macroSignal = Math.max(-0.2, Math.min(0.2, macroRaw));

  const technicalSignal = momentum * 0.4 + trend * 0.6;
  const sentimentRaw =
    feat.return5d * 0.35 + feat.return20d * 0.25 + feat.priceVsMa20 * 0.2;
  const sentimentSignal = Math.max(-0.15, Math.min(0.15, sentimentRaw));

  const baseSignalRaw =
    feat.return5d * 0.35 +
    feat.return20d * 0.25 +
    feat.priceVsMa20 * 0.2 +
    feat.priceVsMa50 * 0.2;
  const baseSignal = Math.max(-0.25, Math.min(0.25, baseSignalRaw));

  let sumTechnical = 0;
  let sumMacro = 0;
  let sumSentiment = 0;
  let sumNoise = 0;
  const byAgentType: Record<AgentProfileType, { sumSignal: number; count: number; positiveCount: number; negativeCount: number }> = {
    trendFollower: { sumSignal: 0, count: 0, positiveCount: 0, negativeCount: 0 },
    contrarian: { sumSignal: 0, count: 0, positiveCount: 0, negativeCount: 0 },
    balanced: { sumSignal: 0, count: 0, positiveCount: 0, negativeCount: 0 },
  };

  for (let ai = 0; ai < agents.length; ai++) {
    const agent = agents[ai]!;
    const ip = agent.informationProfile;
    const noiseSignal = computeNoiseSignal(contextSeed, ai, prevContextSeed);

    const { adjustedTechnical, adjustedMacro, adjustedSentiment, adjustedNoise, deterministicNoise } =
      applyInformationProfile(technicalSignal, macroSignal, sentimentSignal, noiseSignal, agent, ai, contextSeed);

    const techCont = adjustedTechnical * ip.technicalWeight;
    const macroCont = adjustedMacro * ip.macroWeight;
    const sentCont = adjustedSentiment * ip.sentimentWeight;
    const noiseCont = adjustedNoise * ip.noiseWeight + deterministicNoise;

    sumTechnical += techCont;
    sumMacro += macroCont;
    sumSentiment += sentCont;
    sumNoise += noiseCont;

    let agentSignal = techCont + macroCont + sentCont + noiseCont;
    agentSignal *= agent.sensitivity.momentum * 0.4 + agent.sensitivity.trend * 0.4 + agent.sensitivity.volatility * 0.2 + 0.2;

    if (agent.type === "contrarian" && agent.bias.contrarianFactor > 0) {
      agentSignal *= 1 - 2 * agent.bias.contrarianFactor;
    }
    agentSignal += agent.bias.bullishBias;
    const clamped = Math.max(-1, Math.min(1, agentSignal));

    const bt = byAgentType[agent.type];
    bt.sumSignal += clamped;
    bt.count++;
    if (clamped > 0.01) bt.positiveCount++;
    else if (clamped < -0.01) bt.negativeCount++;
  }

  const n = agents.length;
  const meanSignal =
    (byAgentType.trendFollower.sumSignal + byAgentType.contrarian.sumSignal + byAgentType.balanced.sumSignal) / n;

  return {
    baseSignal,
    meanSignal,
    technicalContribution: sumTechnical / n,
    macroContribution: sumMacro / n,
    sentimentContribution: sumSentiment / n,
    noiseContribution: sumNoise / n,
    byAgentType,
  };
}

/** Compute agent-aggregated signal for a single timestamp. Deterministic. Uses information exposure model. */
function computeAgentAggregatedSignalForFeatures(
  feat: RawMarketFeatures,
  agents: AgentProfile[],
  contextSeed: number,
  prevContextSeed?: number,
): { meanSignal: number; disagreement: number; signalStrength: number; agentSignals: number[] } {
  const momentum = Math.max(-1, Math.min(1, feat.return5d * 2));
  const trend = Math.max(-1, Math.min(1, feat.priceVsMa20 * 2));

  const macroRaw = feat.return20d * 0.5 + feat.priceVsMa50 * 0.3;
  const macroSignal = Math.max(-0.2, Math.min(0.2, macroRaw));

  const technicalSignal = momentum * 0.4 + trend * 0.6;
  const sentimentRaw =
    feat.return5d * 0.35 + feat.return20d * 0.25 + feat.priceVsMa20 * 0.2;
  const sentimentSignal = Math.max(-0.15, Math.min(0.15, sentimentRaw));

  const agentSignals: number[] = [];
  for (let ai = 0; ai < agents.length; ai++) {
    const agent = agents[ai]!;
    const ip = agent.informationProfile;
    const noiseSignal = computeNoiseSignal(contextSeed, ai, prevContextSeed);

    const { adjustedTechnical, adjustedMacro, adjustedSentiment, adjustedNoise, deterministicNoise } =
      applyInformationProfile(technicalSignal, macroSignal, sentimentSignal, noiseSignal, agent, ai, contextSeed);

    let agentSignal =
      adjustedTechnical * ip.technicalWeight +
      adjustedMacro * ip.macroWeight +
      adjustedSentiment * ip.sentimentWeight +
      adjustedNoise * ip.noiseWeight +
      deterministicNoise;

    agentSignal *= agent.sensitivity.momentum * 0.4 + agent.sensitivity.trend * 0.4 + agent.sensitivity.volatility * 0.2 + 0.2;

    if (agent.type === "contrarian" && agent.bias.contrarianFactor > 0) {
      agentSignal *= 1 - 2 * agent.bias.contrarianFactor;
    }
    agentSignal += agent.bias.bullishBias;
    agentSignals.push(Math.max(-1, Math.min(1, agentSignal)));
  }

  const meanSignal = agentSignals.reduce((a, b) => a + b, 0) / agentSignals.length;
  const variance =
    agentSignals.length >= 2
      ? agentSignals.reduce((s, v) => s + (v - meanSignal) ** 2, 0) / agentSignals.length
      : 0;
  const disagreement = Math.max(0, Math.min(1, Math.sqrt(variance) * 2));
  const signalStrength = Math.max(0, Math.min(1, Math.abs(meanSignal)));

  return { meanSignal, disagreement, signalStrength, agentSignals };
}

type SignalMagnitudeBucketKey =
  | "0_to_0_01"
  | "0_01_to_0_02"
  | "0_02_to_0_03"
  | "0_03_to_0_04"
  | "0_04_to_0_05"
  | "0_05_to_0_075"
  | "0_075_to_0_10"
  | "0_10_plus";

function absoluteSignalMagnitudeBucket(absMag: number): SignalMagnitudeBucketKey {
  const a = Math.abs(absMag);
  if (a < 0.01) return "0_to_0_01";
  if (a < 0.02) return "0_01_to_0_02";
  if (a < 0.03) return "0_02_to_0_03";
  if (a < 0.04) return "0_03_to_0_04";
  if (a < 0.05) return "0_04_to_0_05";
  if (a < 0.075) return "0_05_to_0_075";
  if (a < 0.1) return "0_075_to_0_10";
  return "0_10_plus";
}

function emptySignalBucketDiagnostics(): Record<
  SignalMagnitudeBucketKey,
  { longCount: number; shortCount: number }
> {
  const z = (): { longCount: number; shortCount: number } => ({ longCount: 0, shortCount: 0 });
  return {
    "0_to_0_01": z(),
    "0_01_to_0_02": z(),
    "0_02_to_0_03": z(),
    "0_03_to_0_04": z(),
    "0_04_to_0_05": z(),
    "0_05_to_0_075": z(),
    "0_075_to_0_10": z(),
    "0_10_plus": z(),
  };
}

function emptyAcceptanceSideRow(): NonNullable<
  DashboardSummary["directionMappingDiagnostics"]
>["acceptanceBySide"]["LONG"] {
  return {
    preMappingCount: 0,
    passedSignalThresholdCount: 0,
    failedSignalThresholdCount: 0,
    passedConvictionCount: 0,
    failedConvictionCount: 0,
    finalAcceptedCount: 0,
    acceptanceRateFromPreMapping: 0,
    acceptanceRateAfterThreshold: 0,
  };
}

function emptySymbolDirectionRow(): NonNullable<
  DashboardSummary["directionMappingDiagnostics"]
>["symbolDirectionAcceptance"][string] {
  return {
    preMappingLongCount: 0,
    preMappingShortCount: 0,
    finalLongCount: 0,
    finalShortCount: 0,
    avgLongSignal: null,
    avgShortSignal: null,
    avgLongConviction: null,
    avgShortConviction: null,
  };
}

/** Phase 29.7: ensure API JSON always includes nested diagnostics (never null/omitted). */
function normalizeDirectionMappingDiagnostics(
  d: DashboardSummary["directionMappingDiagnostics"] | null | undefined,
): NonNullable<DashboardSummary["directionMappingDiagnostics"]> {
  const base =
    d != null && typeof d === "object" && !Array.isArray(d)
      ? (d as NonNullable<DashboardSummary["directionMappingDiagnostics"]>)
      : ({} as NonNullable<DashboardSummary["directionMappingDiagnostics"]>);

  const mergeSide = (
    raw: unknown,
  ): NonNullable<DashboardSummary["directionMappingDiagnostics"]>["acceptanceBySide"]["LONG"] => {
    const o = raw != null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const e = emptyAcceptanceSideRow();
    const num = (k: string, def: number) => (typeof o[k] === "number" && Number.isFinite(o[k] as number) ? (o[k] as number) : def);
    const pre = num("preMappingCount", e.preMappingCount);
    const passedSig = num("passedSignalThresholdCount", e.passedSignalThresholdCount);
    const failedSig = num("failedSignalThresholdCount", e.failedSignalThresholdCount);
    const passedConv = num("passedConvictionCount", e.passedConvictionCount);
    const failedConv = num("failedConvictionCount", e.failedConvictionCount);
    const finalAcc = num("finalAcceptedCount", e.finalAcceptedCount);
    let ratePre = num("acceptanceRateFromPreMapping", e.acceptanceRateFromPreMapping);
    let rateAfter = num("acceptanceRateAfterThreshold", e.acceptanceRateAfterThreshold);
    if (pre > 0) ratePre = finalAcc / pre;
    if (passedSig > 0) rateAfter = finalAcc / passedSig;
    return {
      preMappingCount: pre,
      passedSignalThresholdCount: passedSig,
      failedSignalThresholdCount: failedSig,
      passedConvictionCount: passedConv,
      failedConvictionCount: failedConv,
      finalAcceptedCount: finalAcc,
      acceptanceRateFromPreMapping: ratePre,
      acceptanceRateAfterThreshold: rateAfter,
    };
  };

  const absRaw = (base as { acceptanceBySide?: unknown }).acceptanceBySide;
  const acceptanceBySide = {
    LONG: mergeSide(
      absRaw != null && typeof absRaw === "object" && !Array.isArray(absRaw)
        ? (absRaw as { LONG?: unknown }).LONG
        : undefined,
    ),
    SHORT: mergeSide(
      absRaw != null && typeof absRaw === "object" && !Array.isArray(absRaw)
        ? (absRaw as { SHORT?: unknown }).SHORT
        : undefined,
    ),
  };

  const buckets = emptySignalBucketDiagnostics();
  const sbRaw = (base as { signalBucketDiagnostics?: unknown }).signalBucketDiagnostics;
  if (sbRaw != null && typeof sbRaw === "object" && !Array.isArray(sbRaw)) {
    const sb = sbRaw as Record<string, { longCount?: number; shortCount?: number }>;
    for (const k of Object.keys(buckets) as SignalMagnitudeBucketKey[]) {
      const b = sb[k];
      if (b != null && typeof b === "object") {
        buckets[k] = {
          longCount: typeof b.longCount === "number" ? b.longCount : 0,
          shortCount: typeof b.shortCount === "number" ? b.shortCount : 0,
        };
      }
    }
  }

  const symbolDirectionAcceptance: NonNullable<
    DashboardSummary["directionMappingDiagnostics"]
  >["symbolDirectionAcceptance"] = {};
  const symKeys = new Set<string>(["SPY", "QQQ", "IWM"]);
  for (const k of Object.keys(base.symbolDirectionAcceptance ?? {})) symKeys.add(k);
  for (const sym of symKeys) {
    const raw = base.symbolDirectionAcceptance?.[sym];
    const e = emptySymbolDirectionRow();
    if (raw != null && typeof raw === "object") {
      symbolDirectionAcceptance[sym] = {
        preMappingLongCount: typeof raw.preMappingLongCount === "number" ? raw.preMappingLongCount : e.preMappingLongCount,
        preMappingShortCount: typeof raw.preMappingShortCount === "number" ? raw.preMappingShortCount : e.preMappingShortCount,
        finalLongCount: typeof raw.finalLongCount === "number" ? raw.finalLongCount : e.finalLongCount,
        finalShortCount: typeof raw.finalShortCount === "number" ? raw.finalShortCount : e.finalShortCount,
        avgLongSignal: typeof raw.avgLongSignal === "number" ? raw.avgLongSignal : raw.avgLongSignal === null ? null : e.avgLongSignal,
        avgShortSignal: typeof raw.avgShortSignal === "number" ? raw.avgShortSignal : raw.avgShortSignal === null ? null : e.avgShortSignal,
        avgLongConviction: typeof raw.avgLongConviction === "number" ? raw.avgLongConviction : raw.avgLongConviction === null ? null : e.avgLongConviction,
        avgShortConviction: typeof raw.avgShortConviction === "number" ? raw.avgShortConviction : raw.avgShortConviction === null ? null : e.avgShortConviction,
      };
    } else {
      symbolDirectionAcceptance[sym] = e;
    }
  }

  const rrRaw = (base as { rejectionReasonSummary?: unknown }).rejectionReasonSummary;
  const rr =
    rrRaw != null && typeof rrRaw === "object" && !Array.isArray(rrRaw)
      ? (rrRaw as Record<string, unknown>)
      : {};
  const rnum = (k: string) => (typeof rr[k] === "number" ? (rr[k] as number) : 0);
  const rejectionReasonSummary = {
    rejectedLongBelowSignalThreshold: rnum("rejectedLongBelowSignalThreshold"),
    rejectedLongBelowConvictionThreshold: rnum("rejectedLongBelowConvictionThreshold"),
    rejectedShortBelowSignalThreshold: rnum("rejectedShortBelowSignalThreshold"),
    rejectedShortBelowConvictionThreshold: rnum("rejectedShortBelowConvictionThreshold"),
  };

  return {
    ...base,
    acceptanceBySide,
    signalBucketDiagnostics: buckets,
    symbolDirectionAcceptance,
    rejectionReasonSummary,
  };
}

/** Market features for agent signal interpretation (normalized for [-1,1] or [0,1]). */
interface MarketFeaturesForAgent {
  momentum: number;
  trend: number;
  volatility: number;
}

export interface DashboardSummary {
  consensus: {
    buyPct: number;
    sellPct: number;
    holdPct: number;
    majorityPct: number;
    entropy: number;
    polarization: number;
  } | null;
  latestRun: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    runDurationMs: number | null;
    assetSymbol: string;
    steps: number;
    agents: number;
    variants: number;
    corrDefault: number | null;
    accuracyDefault: number | null;
  } | null;
  health: {
    queueLength: number;
    running: boolean;
    statusText: "Idle" | "Running" | "Error";
    error?: string;
    runningRunId: string | null;
    lastEvents: Array<{ ts: string; type: string; runId?: string; msg?: string }>;
  };
  scalingRows: Array<{
    runId: string;
    agents: number;
    variants: number;
    steps: number;
    runDurationMs: number | null;
    decisionsTotal: number;
    decisionsPerSec: number | null;
    sumVariantMs?: number;
    overheadMs: number | null;
    overheadPct: number | null;
    efficiencyMsPerDecision: number | null;
    isLegacyTiming?: boolean;
    computeMs?: number | null;
    totalMs?: number | null;
    engineInitMs?: number | null;
    orchestrationMs?: number | null;
    dbCommitMs?: number | null;
    stabilityBand?: "OK" | "DIVERGING" | "UNSTABLE" | "LEGACY" | null;
    stabilityScore?: number | null;
  }>;
  stabilityRows: Array<{
    runId: string;
    agents: number;
    variants: number;
    seeds: number;
    steps: number;
    corrSpread: number | null;
    corrStdDev: number | null;
    accStdDev: number | null;
    signAgreementRate: number | null;
    label: "multi-seed" | "single-seed";
  }>;
  driftAsset: {
    window: number;
    count: number;
    regimeShift: boolean;
    reason: string;
    riskMean: number;
    riskDelta: number;
    deltaRisk: number;
    deltaSign: number;
    deltaCorr: number;
    direction: "UP" | "DOWN" | "STABLE";
    riskSeries: number[];
  };
  driftGlobal: {
    window: number;
    count: number;
    regimeShift: boolean;
    reason: string;
    riskMean: number;
    riskDelta: number;
    deltaRisk: number;
    deltaSign: number;
    deltaCorr: number;
    direction: "UP" | "DOWN" | "STABLE";
    riskSeries: number[];
  };
  forecastAccuracy: {
    runId: string | null;
    items: Array<{
      assetSymbol: string;
      overall: { accuracyRate: number; totalEvaluations: number; correctCount: number };
      rolling10: { accuracyRate: number; totalEvaluations: number; correctCount: number };
      baselines: {
        alwaysBuy: { accuracyRate: number; totalEvaluations: number; correctCount: number };
        random: { accuracyRate: number; totalEvaluations: number; correctCount: number };
      };
    }>;
  };
  productionAggregationMode: {
    aggregationMode: string;
    snapshotId: string;
    datasetVersion: string | null;
    modelVersion: string | null;
  } | null;
  aggregationModeRanking: Array<{
    aggregationMode: string;
    rawScore: number;
  }>;
  strategyProfile: {
    key: string;
    name: string;
    aggregationMode: string;
    selectionPolicy: string;
    intendedUse: string;
  };
  strategyDefaults: {
    benchmarkDefaults: {
      aggregationMode: string;
      selectionPolicy: string;
      symbols: string[];
      windows: number[];
      n: number;
    };
    runDefaults: {
      aggregationMode: string;
      selectionPolicy: string;
      assetSymbols: string[];
      points: number;
    };
  };
  runFlowDefaults: {
    assetSymbols: string[];
    points: number;
    aggregationMode: string;
    selectionPolicy: string;
  };
  executionPreset: {
    runPreset: {
      assetSymbols: string[];
      points: number;
      aggregationMode: string;
      selectionPolicy: string;
    };
    benchmarkPreset: {
      symbols: string[];
      windows: number[];
      n: number;
      aggregationMode: string;
      selectionPolicy: string;
      baselineTag: string;
    };
  };
  launchPlan: {
    runPlan: {
      endpoint: string;
      method: string;
      params: { symbols: string[]; points: number };
      resolved: { aggregationMode: string; selectionPolicy: string };
    };
    benchmarkPlan: {
      endpoint: string;
      method: string;
      params: {
        symbols: string[];
        windows: number[];
        n: number;
        aggregationMode: string;
        baselineTag: string;
      };
      resolved: {
        aggregationMode: string;
        selectionPolicy: string;
        baselineTag: string;
      };
    };
    governance: {
      baselineFamilyTag: string;
      candidateMode: string;
      recommendedMode: string;
      notes: string[];
    };
  };
  dataSource: {
    type: "synthetic" | "market-data";
    datasetVersion: string | null;
    provider: string | null;
  };
  crowdSignals: {
    window: number;
    items: Array<{
      symbol: string;
      signal: string;
      signalStrength?: number;
      confidence: number;
      disagreement: number;
      instability: number;
      runsUsed: number;
    }>;
  };
  signalValidation: {
    total: number;
    actionable: number;
    abstained: number;
    directionalValidated: number;
    directionalAccuracyRate: number | null;
    coverageRate: number | null;
    avgSignalStrengthActionable: number | null;
    avgSignalStrengthAll: number | null;
    validated: number;
    accuracyRate: number | null;
    latestItems: Array<{
      symbol: string;
      signal: string;
      realizedDirection: "UP" | "DOWN" | "FLAT" | null;
      actionable: boolean;
      correct: boolean | null;
      confidence: number;
      signalStrength?: number;
    }>;
  };
  signalHistoryStats?: {
    totalSnapshots: number;
    symbolsCovered: number;
  };
  signalCoverage?: {
    total: number;
    actionable: number;
    abstained: number;
    coverageRate: number;
    bySignal: Record<string, number>;
  };
  marketRegime?: {
    regime: "TRENDING" | "MIXED" | "CHAOTIC";
    avgSignalStrength: number;
    avgDisagreement: number;
    coverageRate: number;
  };
  marketTransition?: {
    trend: "IMPROVING" | "DETERIORATING" | "STABLE";
    strengthDelta: number;
    disagreementDelta: number;
    coverageDelta: number;
  };
  marketStress?: {
    state: "PANIC" | "EUPHORIA" | "FRAGILITY" | "CALM" | "NORMAL";
    buyDominance: number;
    sellDominance: number;
    interpretation: string;
  };
  marketAlerts?: Array<{
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    confidence: number;
    message: string;
  }>;
  signalProbabilities?: {
    probabilityBuy: number;
    probabilitySell: number;
    probabilityNeutral: number;
    interpretation: string;
  };
  watchlistCandidates?: Array<{
    symbol: string;
    score: number;
    status: "EMERGING" | "WATCH" | "IGNORE";
    reason: string;
  }>;
  symbolProbabilities?: Array<{
    symbol: string;
    probabilityBuy: number;
    probabilitySell: number;
    probabilityNeutral: number;
    interpretation: string;
  }>;
  tradeSetups?: Array<{
    symbol: string;
    status: "PREPARE_LONG" | "PREPARE_SHORT" | "WATCH" | "IGNORE";
    confidence: number;
    reason: string;
  }>;
  crowdDivergence?: Array<{
    symbol: string;
    type: "BULLISH_DIVERGENCE" | "BEARISH_DIVERGENCE" | "NONE";
    strength: number;
    momentum: number;
    crowdBias: number;
    reason: string;
  }>;
  crowdAcceleration?: Array<{
    symbol: string;
    type: "BULLISH_ACCELERATION" | "BEARISH_ACCELERATION" | "NONE";
    strength: number;
    velocity: number;
    acceleration: number;
    reason: string;
  }>;
  crowdConfidence?: {
    regime: "LOW_CONFIDENCE" | "BUILDING_CONFIDENCE" | "HIGH_CONFIDENCE";
    conviction: number;
    disagreement: number;
    coverageRate: number;
    neutralProbability: number;
    interpretation: string;
  };
  signalValidationMetrics?: {
    totalSignals: number;
    actionableSignals: number;
    correctPredictions: number;
    accuracy: number;
    avgReturn: number;
    benchmarkReturn: number;
    edge: number;
  };
  backtestMetrics?: {
    trades: number;
    winRate: number | null;
    avgTradeReturn: number | null;
    cumulativeReturn: number | null;
    benchmarkReturn: number | null;
    edge: number | null;
    maxDrawdown: number | null;
  };
  backtestDiagnostics?: {
    candidateRows: number;
    skippedNonPrepare: number;
    skippedLowSignalStrength: number;
    skippedHighNeutral: number;
    skippedLowConviction: number;
    executedTrades: number;
  };
  calibrationSweep?: {
    totalRuns: number;
    results: Array<{
      signalStrengthThreshold: number;
      convictionThreshold: number;
      neutralThreshold: number;
      trades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    }>;
  };
  agentProfileDiagnostics?: {
    agentCount: number;
    typeCounts: { trendFollower: number; contrarian: number; balanced: number };
    sampleAgents: Array<{
      type: string;
      momentumSensitivity: number;
      trendSensitivity: number;
      volatilitySensitivity: number;
      bullishBias: number;
      contrarianFactor: number;
    }>;
  };
  historicalSignalDiagnostics?: {
    setupCandidateCountAfterProfiles: number;
    avgSignalStrengthAfterProfiles: number;
    avgDisagreementAfterProfiles: number;
    avgConvictionAfterProfiles: number;
  };
  runtimeWiringDiagnostics?: {
    usedProfileAggregationInBacktest: boolean;
    usedProfileAggregationInCalibration: boolean;
    profileAwareHistoricalRows: number;
  };
  backtestMeasurementDiagnostics?: {
    avgStrategyReturn: number | null;
    avgBenchmarkReturn: number | null;
    cumulativeStrategyReturn: number | null;
    cumulativeBenchmarkReturn: number | null;
    comparedTradeWindows: number;
  };
  tradeDirectionDiagnostics?: {
    executedLongTrades: number;
    executedShortTrades: number;
    longShare: number | null;
    shortShare: number | null;
    sampleTradeDirections: Array<{
      symbol: string;
      direction: "LONG" | "SHORT";
      entryTimestamp: string;
      exitTimestamp: string;
      strategyReturn: number;
      benchmarkReturn: number;
    }>;
  };
  informationExposureDiagnostics?: {
    avgTechnicalWeight: number;
    avgMacroWeight: number;
    avgSentimentWeight: number;
    avgNoiseWeight: number;
    sampleAgents: Array<{
      technicalWeight: number;
      macroWeight: number;
      sentimentWeight: number;
      noiseWeight: number;
      attentionSpan: number;
      trustDecay: number;
    }>;
  };
  calibrationDirectionSummary?: {
    totalRuns: number;
    runsWithOnlyLongs: number;
    runsWithOnlyShorts: number;
    runsWithMixedDirections: number;
  };
  convictionDiagnostics?: {
    sample: Array<{
      signalStrength: number;
      disagreement: number;
      rawConviction: number;
      normalizedConviction: number;
    }>;
    avgRawConviction: number;
    avgNormalizedConviction: number;
  };
  decisionFunnelDiagnostics?: {
    totalSignals: number;
    passedSignalStrength: number;
    passedConviction: number;
    passedFinalDecision: number;
    signalStrengthPassRate: number;
    convictionPassRate: number;
    executionRate: number;
  };
  informationDiagnostics?: {
    avgRecencySensitivity: number;
    avgTechnicalWeight: number;
    avgSentimentWeight: number;
  };
  sampleSourceAudit?: {
    sourceDescription: string;
    rowCounts: {
      fullHistoryRowsConsidered: number | null;
      rowsAfterInitialSelection: number | null;
      rowsAfterFeatureAvailabilityFilter: number | null;
      rowsAfterRunOrSummaryFilter: number | null;
      rowsUsedForDirectionBiasDiagnostics: number | null;
      rowsUsedForDirectionMappingDiagnostics: number | null;
      executedTradeRowsIfRelevant: number | null;
    };
    filterStages: Array<{ stage: string; count: number | null; description: string }>;
    symbolCountsIfAvailable: {
      SPY: number | null;
      QQQ: number | null;
      IWM: number | null;
    };
  };
  historyVsSampleRegimeAudit?: {
    sampled: {
      priceVsMa20PositiveShare: number | null;
      priceVsMa20NegativeShare: number | null;
      return5dPositiveShare: number | null;
      return5dNegativeShare: number | null;
    };
    fullHistory: {
      priceVsMa20PositiveShare: number | null;
      priceVsMa20NegativeShare: number | null;
      return5dPositiveShare: number | null;
      return5dNegativeShare: number | null;
    };
    bySymbol: {
      SPY: {
        sampledPriceVsMa20PositiveShare: number | null;
        sampledPriceVsMa20NegativeShare: number | null;
        fullHistoryPriceVsMa20PositiveShare: number | null;
        fullHistoryPriceVsMa20NegativeShare: number | null;
        sampledReturn5dPositiveShare: number | null;
        sampledReturn5dNegativeShare: number | null;
        fullHistoryReturn5dPositiveShare: number | null;
        fullHistoryReturn5dNegativeShare: number | null;
      };
      QQQ: {
        sampledPriceVsMa20PositiveShare: number | null;
        sampledPriceVsMa20NegativeShare: number | null;
        fullHistoryPriceVsMa20PositiveShare: number | null;
        fullHistoryPriceVsMa20NegativeShare: number | null;
        sampledReturn5dPositiveShare: number | null;
        sampledReturn5dNegativeShare: number | null;
        fullHistoryReturn5dPositiveShare: number | null;
        fullHistoryReturn5dNegativeShare: number | null;
      };
      IWM: {
        sampledPriceVsMa20PositiveShare: number | null;
        sampledPriceVsMa20NegativeShare: number | null;
        fullHistoryPriceVsMa20PositiveShare: number | null;
        fullHistoryPriceVsMa20NegativeShare: number | null;
        sampledReturn5dPositiveShare: number | null;
        sampledReturn5dNegativeShare: number | null;
        fullHistoryReturn5dPositiveShare: number | null;
        fullHistoryReturn5dNegativeShare: number | null;
      };
    };
  };
  sampleSelectionBiasAudit?: {
    priceVsMa20SignShare: {
      positiveCount: number;
      negativeCount: number;
      positiveShare: number | null;
      negativeShare: number | null;
    };
    return5dSignShare: {
      positiveCount: number;
      negativeCount: number;
      positiveShare: number | null;
      negativeShare: number | null;
    };
    bySymbol: {
      SPY: {
        priceVsMa20PositiveShare: number | null;
        priceVsMa20NegativeShare: number | null;
        return5dPositiveShare: number | null;
        return5dNegativeShare: number | null;
      };
      QQQ: {
        priceVsMa20PositiveShare: number | null;
        priceVsMa20NegativeShare: number | null;
        return5dPositiveShare: number | null;
        return5dNegativeShare: number | null;
      };
      IWM: {
        priceVsMa20PositiveShare: number | null;
        priceVsMa20NegativeShare: number | null;
        return5dPositiveShare: number | null;
        return5dNegativeShare: number | null;
      };
    };
  };
  momentumAudit?: {
    formulaShape: string;
    inputs: {
      currentPriceIfExists: {
        name: string;
        avg: number | null;
        min: number | null;
        max: number | null;
      } | null;
      referencePriceIfExists: {
        name: string;
        avg: number | null;
        min: number | null;
        max: number | null;
      } | null;
      rawDifferenceIfExists: {
        name: string;
        avg: number | null;
        min: number | null;
        max: number | null;
        positiveCount?: number;
        negativeCount?: number;
      } | null;
      normalizedValueIfExists: {
        name: string;
        avg: number | null;
        min: number | null;
        max: number | null;
        positiveCount?: number;
        negativeCount?: number;
      } | null;
    };
  };
  priceVsMa20Audit?: {
    formulaShape: string;
    inputs: {
      price: { avg: number | null; min: number | null; max: number | null } | null;
      ma20: { avg: number | null; min: number | null; max: number | null } | null;
      rawDifferenceIfExists: {
        name: string;
        avg: number | null;
        min: number | null;
        max: number | null;
        positiveCount?: number;
        negativeCount?: number;
      } | null;
      normalizedValueIfExists: {
        name: string;
        avg: number | null;
        min: number | null;
        max: number | null;
        positiveCount?: number;
        negativeCount?: number;
      } | null;
    };
  };
  trendAudit?: {
    formulaShape: string;
    components: Array<{
      name: string;
      avg: number | null;
      min: number | null;
      max: number | null;
      positiveCount: number;
      negativeCount: number;
    }>;
  };
  technicalContributionAudit?: {
    formulaShape: string;
    components: Array<{
      name: string;
      avg: number | null;
      min: number | null;
      max: number | null;
      positiveCount: number;
      negativeCount: number;
    }>;
  };
  totalInfoContributionAudit?: {
    formulaShape: string;
    components: Array<{
      name: string;
      avg: number | null;
      min: number | null;
      max: number | null;
      positiveCount: number;
      negativeCount: number;
    }>;
  };
  informationAdjustmentFormulaAudit?: {
    formulaShape: string;
    terms: {
      baseSignal: { avg: number | null; min: number | null; max: number | null };
      termA: {
        name: string;
        avg: number | null;
        min: number | null;
        max: number | null;
        positiveCount?: number;
        negativeCount?: number;
      } | null;
      termB: {
        name: string;
        avg: number | null;
        min: number | null;
        max: number | null;
        positiveCount?: number;
        negativeCount?: number;
      } | null;
      termC: {
        name: string;
        avg: number | null;
        min: number | null;
        max: number | null;
        positiveCount?: number;
        negativeCount?: number;
      } | null;
    };
  };
  informationAdjustmentDecomposition?: {
    adjustmentValue: {
      avg: number | null;
      min: number | null;
      max: number | null;
      positiveCount: number;
      negativeCount: number;
    };
    multiplierOrScaleIfExists: {
      avg: number | null;
      min: number | null;
      max: number | null;
    } | null;
    exposureOrModifierIfExists: {
      avg: number | null;
      min: number | null;
      max: number | null;
      positiveCount: number;
      negativeCount: number;
    } | null;
  };
  informationAttenuationShadowAudit?: {
    shadow25: { avgSignal: number | null; positiveCount: number; negativeCount: number };
    shadow50: { avgSignal: number | null; positiveCount: number; negativeCount: number };
    shadow75: { avgSignal: number | null; positiveCount: number; negativeCount: number };
    shadow100: { avgSignal: number | null; positiveCount: number; negativeCount: number };
  };
  informationAdjustmentDiagnostics?: {
    avgDeltaPostMinusBase: number | null;
    positiveDeltaCount: number;
    negativeDeltaCount: number;
    nearZeroDeltaCount: number;
    avgDeltaWhenBasePositive: number | null;
    avgDeltaWhenBaseNegative: number | null;
    basePositiveToPostPositiveCount: number;
    basePositiveToPostNegativeCount: number;
    baseNegativeToPostNegativeCount: number;
    baseNegativeToPostPositiveCount: number;
  };
  directionBiasDiagnosticsPreFilter?: {
    avgBaseSignal: number | null;
    avgPostInformationSignal: number | null;
    avgTechnicalContribution: number | null;
    avgMacroContribution: number | null;
    avgSentimentContribution: number | null;
    avgNoiseContribution: number | null;
    positiveSignalCount: number;
    negativeSignalCount: number;
    nearZeroSignalCount: number;
  };
  directionBiasDiagnosticsPostFilter?: {
    avgBaseSignal: number | null;
    avgPostInformationSignal: number | null;
    avgTechnicalContribution: number | null;
    avgMacroContribution: number | null;
    avgSentimentContribution: number | null;
    avgNoiseContribution: number | null;
    positiveSignalCount: number;
    negativeSignalCount: number;
    nearZeroSignalCount: number;
  };
  directionBiasPopulationComparison?: {
    preFilterRowCount: number | null;
    postFilterRowCount: number | null;
    preFilterPositiveShare: number | null;
    preFilterNegativeShare: number | null;
    postFilterPositiveShare: number | null;
    postFilterNegativeShare: number | null;
  };
  directionBiasDiagnostics?: {
    avgBaseSignal: number;
    avgPostInformationSignal: number;
    avgTechnicalContribution: number;
    avgMacroContribution: number;
    avgSentimentContribution: number;
    avgNoiseContribution: number;
    positiveSignalCount: number;
    negativeSignalCount: number;
    nearZeroSignalCount: number;
  };
  directionBiasComponentExtremes?: {
    baseSignal: { min: number | null; max: number | null; avg: number | null; positiveCount: number; negativeCount: number };
    postInformationSignal: { min: number | null; max: number | null; avg: number | null; positiveCount: number; negativeCount: number };
    technicalContribution: { min: number | null; max: number | null; avg: number | null; positiveCount: number; negativeCount: number };
    macroContribution: { min: number | null; max: number | null; avg: number | null; positiveCount: number; negativeCount: number };
    sentimentContribution: { min: number | null; max: number | null; avg: number | null; positiveCount: number; negativeCount: number };
    noiseContribution: { min: number | null; max: number | null; avg: number | null; positiveCount: number; negativeCount: number };
  };
  directionBiasDiagnosticsBySymbol?: Record<
    string,
    {
      avgBaseSignal: number | null;
      avgPostInformationSignal: number | null;
      avgTechnicalContribution: number | null;
      avgMacroContribution: number | null;
      avgSentimentContribution: number | null;
      avgNoiseContribution: number | null;
      positiveSignalCount: number;
      negativeSignalCount: number;
      nearZeroSignalCount: number;
    }
  >;
  directionBiasByAgentType?: {
    trendFollower: { avgSignal: number; positiveCount: number; negativeCount: number };
    contrarian: { avgSignal: number; positiveCount: number; negativeCount: number };
    balanced: { avgSignal: number; positiveCount: number; negativeCount: number };
  };
  directionBiasSamples?: Array<{
    symbol: string;
    timestamp: string;
    baseSignal: number;
    technicalContribution: number;
    macroContribution: number;
    sentimentContribution: number;
    noiseContribution: number;
    finalSignal: number;
    chosenDirection: "LONG" | "SHORT" | "NONE";
  }>;
  aggregationDiagnostics?: {
    avgAgentSignalMean: number;
    avgAgentSignalMedian: number;
    avgFinalAggregatedSignal: number;
    avgPositiveAgentShare: number;
    avgNegativeAgentShare: number;
    aggregatedPositiveCount: number;
    aggregatedNegativeCount: number;
    aggregatedNearZeroCount: number;
    totalAgents: number;
    sumScore: number;
    positiveScore: number;
    negativeScore: number;
    zeroScore: number;
    positiveCount: number;
    negativeCount: number;
    zeroCount: number;
    weightedPositive: number;
    weightedNegative: number;
    sample: Array<{ score: number; weight: number; direction: "LONG" | "SHORT" | "NONE" }>;
  };
  directionMappingDiagnostics?: {
    longConditionCount: number;
    shortConditionCount: number;
    noneConditionCount: number;
    longThresholdUsed: number;
    shortThresholdUsed: number;
    convictionThresholdUsed: number;
    finalScore: number;
    positiveScore: number;
    negativeScore: number;
    positiveCount: number;
    negativeCount: number;
    weightedPositive: number;
    weightedNegative: number;
    preMappingLongCount: number;
    preMappingShortCount: number;
    preMappingNeutralCount: number;
    finalDirectionLongCount: number;
    finalDirectionShortCount: number;
    finalDirectionNoneCount: number;
    sampleLongCandidatesRejected: Array<{
      symbol: string;
      timestamp: string;
      aggregatedSignal: number;
      conviction: number;
      preMappingDirection: "LONG" | "SHORT" | "NEUTRAL";
      finalDirection: "LONG" | "SHORT" | "NONE";
    }>;
    sampleShortCandidatesRejected: Array<{
      symbol: string;
      timestamp: string;
      aggregatedSignal: number;
      conviction: number;
      preMappingDirection: "LONG" | "SHORT" | "NEUTRAL";
      finalDirection: "LONG" | "SHORT" | "NONE";
    }>;
    sampleLongCandidatesAccepted: Array<{
      symbol: string;
      timestamp: string;
      aggregatedSignal: number;
      conviction: number;
      preMappingDirection: "LONG" | "SHORT" | "NEUTRAL";
      finalDirection: "LONG" | "SHORT" | "NONE";
    }>;
    sampleShortCandidatesAccepted: Array<{
      symbol: string;
      timestamp: string;
      aggregatedSignal: number;
      conviction: number;
      preMappingDirection: "LONG" | "SHORT" | "NEUTRAL";
      finalDirection: "LONG" | "SHORT" | "NONE";
    }>;
    sampleMappings: Array<{
      symbol: string;
      timestamp: string;
      aggregatedSignal: number;
      conviction: number;
      chosenDirection: "LONG" | "SHORT" | "NONE";
      finalScore: number;
      positiveScore: number;
      negativeScore: number;
      positiveCount: number;
      negativeCount: number;
      weightedPositive: number;
      weightedNegative: number;
      preMappingDirection: "LONG" | "SHORT" | "NEUTRAL";
      finalDirection: "LONG" | "SHORT" | "NONE";
    }>;
    acceptanceBySide: {
      LONG: {
        preMappingCount: number;
        passedSignalThresholdCount: number;
        failedSignalThresholdCount: number;
        passedConvictionCount: number;
        failedConvictionCount: number;
        finalAcceptedCount: number;
        acceptanceRateFromPreMapping: number;
        acceptanceRateAfterThreshold: number;
      };
      SHORT: {
        preMappingCount: number;
        passedSignalThresholdCount: number;
        failedSignalThresholdCount: number;
        passedConvictionCount: number;
        failedConvictionCount: number;
        finalAcceptedCount: number;
        acceptanceRateFromPreMapping: number;
        acceptanceRateAfterThreshold: number;
      };
    };
    signalBucketDiagnostics: {
      "0_to_0_01": { longCount: number; shortCount: number };
      "0_01_to_0_02": { longCount: number; shortCount: number };
      "0_02_to_0_03": { longCount: number; shortCount: number };
      "0_03_to_0_04": { longCount: number; shortCount: number };
      "0_04_to_0_05": { longCount: number; shortCount: number };
      "0_05_to_0_075": { longCount: number; shortCount: number };
      "0_075_to_0_10": { longCount: number; shortCount: number };
      "0_10_plus": { longCount: number; shortCount: number };
    };
    symbolDirectionAcceptance: Record<
      string,
      {
        preMappingLongCount: number;
        preMappingShortCount: number;
        finalLongCount: number;
        finalShortCount: number;
        avgLongSignal: number | null;
        avgShortSignal: number | null;
        avgLongConviction: number | null;
        avgShortConviction: number | null;
      }
    >;
    rejectionReasonSummary: {
      rejectedLongBelowSignalThreshold: number;
      rejectedLongBelowConvictionThreshold: number;
      rejectedShortBelowSignalThreshold: number;
      rejectedShortBelowConvictionThreshold: number;
    };
  };
  setupDirectionAudit?: {
    sourceDescription: string;
    rowCounts: {
      featureAvailableRows: number | null;
      rowsEvaluatedForSetup: number | null;
      longSetupCount: number;
      shortSetupCount: number;
      noneSetupCount: number;
    };
    bySymbol: {
      SPY: { longSetupCount: number; shortSetupCount: number; noneSetupCount: number };
      QQQ: { longSetupCount: number; shortSetupCount: number; noneSetupCount: number };
      IWM: { longSetupCount: number; shortSetupCount: number; noneSetupCount: number };
    };
    sampleLongSetups: Array<{
      symbol: string;
      timestamp: string;
      setupDirection: string;
      baseSignal?: number | null;
      postInformationSignal?: number | null;
      conviction?: number | null;
    }>;
    sampleShortSetups: Array<{
      symbol: string;
      timestamp: string;
      setupDirection: string;
      baseSignal?: number | null;
      postInformationSignal?: number | null;
      conviction?: number | null;
    }>;
    sampleNoneSetups: Array<{
      symbol: string;
      timestamp: string;
      setupDirection: string;
      baseSignal?: number | null;
      postInformationSignal?: number | null;
      conviction?: number | null;
    }>;
  };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runQueue: RunQueueService,
    private readonly benchService: BenchService,
    private readonly launchPlanService: LaunchPlanService,
    private readonly marketDataService: MarketDataService,
    private readonly strategyProfilesService: StrategyProfilesService,
    private readonly signalsService: SignalsService,
  ) {}

  async getSummary(limit = 10, assetSymbol = "SPY"): Promise<DashboardSummary> {
    const sym = (assetSymbol ?? "SPY").trim() || "SPY";
    const LOOKBACK = Math.max(limit * 5, 200);

    const [latestRun, health, completedRuns] = await Promise.all([
      this.fetchLatestRun(sym),
      this.fetchHealth(),
      this.prisma.simulationRun.findMany({
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: LOOKBACK,
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          startedAt: true,
          finishedAt: true,
          completedAt: true,
          runDurationMs: true,
        },
      }),
    ]);

    const runIds = completedRuns.map((r) => r.id);
    const variantsByRunId = new Map<
      string,
      Array<{
        seed: number;
        agents: number;
        steps: number;
        durationMs: number | null;
        startedAt: Date | null;
        completedAt: Date | null;
        summary: { corr: number; directionalAccuracy: number } | null;
      }>
    >();

    if (runIds.length > 0) {
      const variantRows = await this.prisma.runVariant.findMany({
        where: { runId: { in: runIds }, assetSymbol: sym },
        select: {
          runId: true,
          seed: true,
          agents: true,
          steps: true,
          durationMs: true,
          startedAt: true,
          completedAt: true,
          summary: { select: { corr: true, directionalAccuracy: true } },
        },
      });
      for (const v of variantRows) {
        const list = variantsByRunId.get(v.runId) ?? [];
        list.push({
          seed: v.seed,
          agents: v.agents,
          steps: v.steps,
          durationMs: v.durationMs,
          startedAt: v.startedAt,
          completedAt: v.completedAt,
          summary: v.summary,
        });
        variantsByRunId.set(v.runId, list);
      }
    }

    const scalingRows: DashboardSummary["scalingRows"] = [];
    const stabilityRows: DashboardSummary["stabilityRows"] = [];

    for (const run of completedRuns) {
      if (scalingRows.length >= limit) break;

      const variants = variantsByRunId.get(run.id) ?? [];
      if (variants.length === 0) continue;

      const seedVals = variants
        .map((v) => v.seed)
        .filter((x): x is number => typeof x === "number");
      const distinctSeeds = new Set<number>(seedVals);
      const seedsCount =
        distinctSeeds.size > 0 ? distinctSeeds.size : variants.length;

      const agents = Math.max(...variants.map((v) => v.agents));
      const steps = Math.max(...variants.map((v) => v.steps));
      const variantsCount = variants.length;
      const decisionsTotal = variants.reduce((s, v) => s + v.agents * v.steps, 0);

      const sumVariantMs = variants.reduce(
        (s, v) => s + (v.durationMs != null && Number.isFinite(v.durationMs) ? v.durationMs : 0),
        0,
      );
      const isLegacyTiming = variantsCount > 0 && sumVariantMs === 0;

      const runDurationMs =
        run.runDurationMs != null && run.runDurationMs > 0 ? run.runDurationMs : null;

      const canComputeRates =
        runDurationMs != null && runDurationMs > 0 && decisionsTotal > 0;
      const decisionsPerSec =
        !isLegacyTiming && canComputeRates
          ? decisionsTotal / (runDurationMs! / 1000)
          : null;

      const canComputeOverhead =
        !isLegacyTiming &&
        sumVariantMs > 0 &&
        runDurationMs != null &&
        runDurationMs > 0;
      const overheadMs = canComputeOverhead
        ? Math.max(0, runDurationMs - sumVariantMs)
        : null;
      const overheadPct =
        canComputeOverhead && runDurationMs != null
          ? (overheadMs! / runDurationMs) * 100
          : null;

      const efficiencyMsPerDecision =
        !isLegacyTiming && canComputeRates
          ? runDurationMs! / decisionsTotal
          : null;

      const computeMs = sumVariantMs;
      const totalMs = runDurationMs;

      const engineInitMs =
        overheadMs != null ? Math.round(overheadMs * 0.4) : null;
      const orchestrationMs =
        overheadMs != null ? Math.round(overheadMs * 0.4) : null;
      const dbCommitMs =
        overheadMs != null ? Math.round(overheadMs * 0.2) : null;

      let stabilityBand: "OK" | "DIVERGING" | "UNSTABLE" | "LEGACY" | null = null;
      let stabilityScore: number | null = null;

      if (variants.length < 2) {
        stabilityBand = "OK";
        stabilityScore = 10;
      } else {
        const corrs = variants
          .map((v) => v.summary?.corr)
          .filter((c): c is number => c != null && Number.isFinite(c));
        const accs = variants
          .map((v) => v.summary?.directionalAccuracy)
          .filter((a): a is number => a != null && Number.isFinite(a));

        const minCorr = corrs.length > 0 ? Math.min(...corrs) : null;
        const maxCorr = corrs.length > 0 ? Math.max(...corrs) : null;
        const corrSpread = minCorr != null && maxCorr != null ? maxCorr - minCorr : null;
        const accStdDev = accs.length >= 2 ? stdDev(accs) : null;

        const medianSign = median(corrs);
        const targetSign = medianSign == null ? null : medianSign >= 0 ? 1 : -1;
        const matching =
          targetSign != null
            ? corrs.filter((c) => (c >= 0 ? 1 : -1) === targetSign).length
            : 0;
        const signAgreementRate =
          medianSign != null && corrs.length > 0 ? matching / corrs.length : null;

        stabilityScore = stabilityRiskScore({
          isLegacyTiming: false,
          label: "multi-seed",
          corrSpread,
          accStdDev,
          signAgreementRate,
        });
        stabilityBand = riskBand(stabilityScore);
      }

      scalingRows.push({
        runId: run.id,
        agents,
        variants: variantsCount,
        steps,
        runDurationMs,
        decisionsTotal,
        decisionsPerSec,
        sumVariantMs,
        overheadMs,
        overheadPct,
        efficiencyMsPerDecision,
        isLegacyTiming,
        computeMs: isLegacyTiming ? null : computeMs,
        totalMs: isLegacyTiming ? null : totalMs,
        engineInitMs: isLegacyTiming ? null : engineInitMs,
        orchestrationMs: isLegacyTiming ? null : orchestrationMs,
        dbCommitMs: isLegacyTiming ? null : dbCommitMs,
        stabilityBand,
        stabilityScore,
      });

      if (variants.length < 2) {
        stabilityRows.push({
          runId: run.id,
          agents,
          variants: variantsCount,
          seeds: seedsCount,
          steps,
          corrSpread: null,
          corrStdDev: null,
          accStdDev: null,
          signAgreementRate: null,
          label: "single-seed",
        });
        continue;
      }

      const corrs = variants
        .map((v) => v.summary?.corr)
        .filter((c): c is number => c != null && Number.isFinite(c));
      const accs = variants
        .map((v) => v.summary?.directionalAccuracy)
        .filter((a): a is number => a != null && Number.isFinite(a));

      const minCorr = corrs.length > 0 ? Math.min(...corrs) : null;
      const maxCorr = corrs.length > 0 ? Math.max(...corrs) : null;
      const corrSpread = minCorr != null && maxCorr != null ? maxCorr - minCorr : null;
      const corrStdDev = corrs.length >= 2 ? stdDev(corrs) : null;
      const accStdDev = accs.length >= 2 ? stdDev(accs) : null;

      const medianSign = median(corrs);
      const targetSign = medianSign == null ? null : medianSign >= 0 ? 1 : -1;
      const matching =
        targetSign != null
          ? corrs.filter((c) => (c >= 0 ? 1 : -1) === targetSign).length
          : 0;
      const signAgreementRate =
        medianSign != null && corrs.length > 0 ? matching / corrs.length : null;

      stabilityRows.push({
        runId: run.id,
        agents,
        variants: variantsCount,
        seeds: seedsCount,
        steps,
        corrSpread,
        corrStdDev,
        accStdDev,
        signAgreementRate,
        label: "multi-seed",
      });
    }

    const safeProductionMode = (async (): Promise<DashboardSummary["productionAggregationMode"]> => {
      try {
        const r = await this.benchService.getProductionAggregationMode();
        return r?.snapshot
          ? {
              aggregationMode: r.snapshot.aggregationMode,
              snapshotId: r.snapshot.id,
              datasetVersion: r.snapshot.datasetVersion ?? null,
              modelVersion: r.snapshot.modelVersion ?? null,
            }
          : null;
      } catch {
        return null;
      }
    })();

    const safeRanking = (async (): Promise<DashboardSummary["aggregationModeRanking"]> => {
      try {
        const r = await this.benchService.getModeLeaderboard({
          symbols: ["SPY", "QQQ", "IWM"],
          windows: [29, 60, 120],
          n: 20,
        });
        return Array.isArray(r?.ranking) ? r.ranking : [];
      } catch {
        return [];
      }
    })();

    const safeCrowdSignals = (async () => {
      try {
        const d = this.strategyProfilesService.getDefaults();
        const symbols = d.runDefaults?.assetSymbols ?? ["SPY", "QQQ", "IWM"];
        return this.signalsService.getCrowdSignalsForSummary(symbols);
      } catch {
        return { window: 20, items: [] };
      }
    })().catch(() => ({ window: 20, items: [] }));

    const safeSignalValidation = (async () => {
      try {
        const d = this.strategyProfilesService.getDefaults();
        const symbols = d.runDefaults?.assetSymbols ?? ["SPY", "QQQ", "IWM"];
        return this.signalsService.getSignalValidationForSummary(symbols);
      } catch {
        return {
          total: 0,
          actionable: 0,
          abstained: 0,
          directionalValidated: 0,
          directionalAccuracyRate: null,
          coverageRate: null,
          avgSignalStrengthActionable: null,
          avgSignalStrengthAll: null,
          validated: 0,
          accuracyRate: null,
          latestItems: [],
        };
      }
    })().catch(() => ({
      total: 0,
      actionable: 0,
      abstained: 0,
      directionalValidated: 0,
      directionalAccuracyRate: null,
      coverageRate: null,
      avgSignalStrengthActionable: null,
      avgSignalStrengthAll: null,
      validated: 0,
      accuracyRate: null,
      latestItems: [],
    }));

    const safeSignalCoverage = (async () => {
      try {
        const d = this.strategyProfilesService.getDefaults();
        const symbols = d.runDefaults?.assetSymbols ?? ["SPY", "QQQ", "IWM"];
        const diag = await this.signalsService.getCoverageDiagnostics(symbols.join(","), 100);
        return {
          total: diag.summary.total,
          actionable: diag.summary.actionable,
          abstained: diag.summary.abstained,
          coverageRate: diag.summary.coverageRate,
          bySignal: diag.bySignal,
        };
      } catch {
        return {
          total: 0,
          actionable: 0,
          abstained: 0,
          coverageRate: 0,
          bySignal: { STRONG_BUY: 0, BUY: 0, NEUTRAL: 0, SELL: 0, STRONG_SELL: 0 },
        };
      }
    })().catch(() => ({
      total: 0,
      actionable: 0,
      abstained: 0,
      coverageRate: 0,
      bySignal: { STRONG_BUY: 0, BUY: 0, NEUTRAL: 0, SELL: 0, STRONG_SELL: 0 },
    }));

    const safeSignalHistoryStats = (async () => {
      try {
        return this.signalsService.getSignalHistoryStats();
      } catch {
        return { totalSnapshots: 0, symbolsCovered: 0 };
      }
    })().catch(() => ({ totalSnapshots: 0, symbolsCovered: 0 }));

    const safeMarketTransition = (async () => {
      try {
        const d = this.strategyProfilesService.getDefaults();
        const symbols = d.runDefaults?.assetSymbols ?? ["SPY", "QQQ", "IWM"];
        const { items } = await this.signalsService.getHistory(symbols.join(","), 20);
        return this.computeMarketTransition(items);
      } catch {
        return {
          trend: "STABLE" as const,
          strengthDelta: 0,
          disagreementDelta: 0,
          coverageDelta: 0,
        };
      }
    })().catch(() => ({
      trend: "STABLE" as const,
      strengthDelta: 0,
      disagreementDelta: 0,
      coverageDelta: 0,
    }));

    const [consensus, driftAsset, driftGlobal, forecastAccuracy, productionAggregationMode, aggregationModeRanking, crowdSignals, signalValidation, signalHistoryStats, signalCoverage, marketTransition, momentumTilts, priceMomentums] =
      await Promise.all([
        this.fetchConsensus(latestRun?.id ?? null, sym),
        this.getDrift({ assetSymbol: sym, window: 30 }).catch(() => ({
        window: 0,
        count: 0,
        regimeShift: false,
        reason: "error",
        riskMean: 0,
        riskDelta: 0,
        deltaRisk: 0,
        deltaSign: 0,
        deltaCorr: 0,
        direction: "STABLE" as const,
        riskSeries: [] as number[],
      })),
      this.getDrift({ window: 30 }).catch(() => ({
        window: 0,
        count: 0,
        regimeShift: false,
        reason: "error",
        riskMean: 0,
        riskDelta: 0,
        deltaRisk: 0,
        deltaSign: 0,
        deltaCorr: 0,
        direction: "STABLE" as const,
        riskSeries: [] as number[],
      })),
      this.fetchForecastAccuracy(latestRun?.id ?? null),
      safeProductionMode,
      safeRanking,
      safeCrowdSignals,
      safeSignalValidation,
      safeSignalHistoryStats,
      safeSignalCoverage,
      safeMarketTransition,
      (async () => {
        try {
          const d = this.strategyProfilesService.getDefaults();
          const syms = d.runDefaults?.assetSymbols ?? ["SPY", "QQQ", "IWM"];
          return this.fetchMomentumTilts(syms);
        } catch {
          return this.fetchMomentumTilts(["SPY", "QQQ", "IWM"]);
        }
      })(),
      (async () => {
        try {
          const d = this.strategyProfilesService.getDefaults();
          const syms = d.runDefaults?.assetSymbols ?? ["SPY", "QQQ", "IWM"];
          return this.fetchPriceMomentums(syms);
        } catch {
          return this.fetchPriceMomentums(["SPY", "QQQ", "IWM"]);
        }
      })(),
      (async () => {
        try {
          const d = this.strategyProfilesService.getDefaults();
          const syms = d.runDefaults?.assetSymbols ?? ["SPY", "QQQ", "IWM"];
          return this.fetchMarketFeaturesForSymbols(syms);
        } catch {
          return new Map<string, MarketFeaturesForAgent | null>();
        }
      })(),
    ]);

    let strategyProfile: DashboardSummary["strategyProfile"];
    try {
      const p = this.strategyProfilesService.getActiveProfile();
      strategyProfile = {
        key: p.key,
        name: p.name,
        aggregationMode: p.aggregationMode,
        selectionPolicy: p.selectionPolicy,
        intendedUse: p.intendedUse,
      };
    } catch {
      strategyProfile = {
        key: "conservative",
        name: "Conservative",
        aggregationMode: "top_20pct_only",
        selectionPolicy: "top_20pct_agents",
        intendedUse: "production",
      };
    }

    let strategyDefaults: DashboardSummary["strategyDefaults"];
    let runFlowDefaults: DashboardSummary["runFlowDefaults"];
    try {
      const d = this.strategyProfilesService.getDefaults();
      strategyDefaults = {
        benchmarkDefaults: d.benchmarkDefaults,
        runDefaults: d.runDefaults,
      };
      runFlowDefaults = {
        assetSymbols: d.runDefaults.assetSymbols,
        points: d.runDefaults.points,
        aggregationMode: d.runDefaults.aggregationMode,
        selectionPolicy: d.runDefaults.selectionPolicy,
      };
    } catch {
      strategyDefaults = {
        benchmarkDefaults: {
          aggregationMode: "top_20pct_only",
          selectionPolicy: "top_20pct_agents",
          symbols: ["SPY", "QQQ", "IWM"],
          windows: [29, 60, 120],
          n: 20,
        },
        runDefaults: {
          aggregationMode: "top_20pct_only",
          selectionPolicy: "top_20pct_agents",
          assetSymbols: ["SPY", "QQQ", "IWM"],
          points: 29,
        },
      };
      runFlowDefaults = {
        assetSymbols: ["SPY", "QQQ", "IWM"],
        points: 29,
        aggregationMode: "top_20pct_only",
        selectionPolicy: "top_20pct_agents",
      };
    }

    let executionPreset: DashboardSummary["executionPreset"];
    try {
      const d = this.strategyProfilesService.getDefaults();
      const baselineTag = d.benchmarkDefaults.aggregationMode === "top_20pct_only" ? "baseline-top20-v1" : "baseline-v2";
      executionPreset = {
        runPreset: {
          assetSymbols: [...d.runDefaults.assetSymbols],
          points: d.runDefaults.points,
          aggregationMode: d.runDefaults.aggregationMode,
          selectionPolicy: d.runDefaults.selectionPolicy,
        },
        benchmarkPreset: {
          symbols: [...d.benchmarkDefaults.symbols],
          windows: [...d.benchmarkDefaults.windows],
          n: d.benchmarkDefaults.n,
          aggregationMode: d.benchmarkDefaults.aggregationMode,
          selectionPolicy: d.benchmarkDefaults.selectionPolicy,
          baselineTag,
        },
      };
    } catch {
      executionPreset = {
        runPreset: {
          assetSymbols: ["SPY", "QQQ", "IWM"],
          points: 29,
          aggregationMode: "top_20pct_only",
          selectionPolicy: "top_20pct_agents",
        },
        benchmarkPreset: {
          symbols: ["SPY", "QQQ", "IWM"],
          windows: [29, 60, 120],
          n: 20,
          aggregationMode: "top_20pct_only",
          selectionPolicy: "top_20pct_agents",
          baselineTag: "baseline-top20-v1",
        },
      };
    }

    let launchPlan: DashboardSummary["launchPlan"];
    try {
      const lp = await this.launchPlanService.getLaunchPlan();
      launchPlan = {
        runPlan: lp.runPlan,
        benchmarkPlan: lp.benchmarkPlan,
        governance: lp.governance,
      };
    } catch {
      launchPlan = {
        runPlan: {
          endpoint: "/runs/import/prices",
          method: "POST",
          params: { symbols: ["SPY", "QQQ", "IWM"], points: 29 },
          resolved: { aggregationMode: "top_20pct_only", selectionPolicy: "top_20pct_agents" },
        },
        benchmarkPlan: {
          endpoint: "/bench/windows/run-and-compare",
          method: "POST",
          params: {
            symbols: ["SPY", "QQQ", "IWM"],
            windows: [29, 60, 120],
            n: 20,
            aggregationMode: "top_20pct_only",
            baselineTag: "baseline-top20-v1",
          },
          resolved: {
            aggregationMode: "top_20pct_only",
            selectionPolicy: "top_20pct_agents",
            baselineTag: "baseline-top20-v1",
          },
        },
        governance: {
          baselineFamilyTag: "baseline-top20-v1",
          candidateMode: "top_20pct_only",
          recommendedMode: "top_20pct_only",
          notes: ["Launch plan fallback (strategy/profile unavailable)."],
        },
      };
    }

    let dataSource: DashboardSummary["dataSource"];
    try {
      dataSource = await this.marketDataService.getDataSourceInfo();
    } catch {
      dataSource = { type: "synthetic", datasetVersion: null, provider: null };
    }

    const marketRegime = this.computeMarketRegime(crowdSignals, signalCoverage);
    const marketAlerts = this.computeMarketAlerts(marketRegime, marketTransition);
    const symbolProbabilities = this.computeSymbolProbabilities(
      strategyDefaults.runDefaults.assetSymbols,
      crowdSignals,
      signalValidation,
      momentumTilts,
      marketTransition,
      marketAlerts,
    );
    const watchlistCandidates = this.computeWatchlistCandidates(
      strategyDefaults.runDefaults.assetSymbols,
      crowdSignals,
      marketTransition,
      marketAlerts,
      symbolProbabilities,
    );
    const tradeSetups = this.computeTradeSetups(symbolProbabilities, watchlistCandidates, marketTransition);

    return {
      consensus,
      latestRun,
      health,
      scalingRows,
      stabilityRows,
      driftAsset,
      driftGlobal,
      forecastAccuracy,
      productionAggregationMode,
      aggregationModeRanking,
      strategyProfile,
      strategyDefaults,
      runFlowDefaults,
      executionPreset,
      launchPlan,
      dataSource,
      crowdSignals,
      signalValidation,
      signalHistoryStats,
      signalCoverage,
      marketRegime,
      marketTransition,
      marketStress: this.computeMarketStress(marketRegime, marketTransition, signalCoverage),
      marketAlerts,
      signalProbabilities: this.computeSignalProbabilities(
        marketRegime,
        marketTransition,
        this.computeMarketStress(marketRegime, marketTransition, signalCoverage),
      ),
      symbolProbabilities,
      watchlistCandidates,
      tradeSetups,
      crowdDivergence: this.computeCrowdDivergence(
        symbolProbabilities,
        priceMomentums,
        watchlistCandidates,
        tradeSetups,
      ),
      crowdAcceleration: await this.computeCrowdAcceleration(
        symbolProbabilities,
        strategyDefaults.runDefaults.assetSymbols,
      ),
      crowdConfidence: this.computeCrowdConfidence(
        marketRegime,
        this.computeSignalProbabilities(
          marketRegime,
          marketTransition,
          this.computeMarketStress(marketRegime, marketTransition, signalCoverage),
        ),
        marketTransition,
      ),
      signalValidationMetrics: await this.computeSignalValidationMetrics(
        strategyDefaults.runDefaults.assetSymbols,
      ),
      ...(await (async () => {
        const r = await this.computeBacktestAndCalibration(
          strategyDefaults.runDefaults.assetSymbols,
        );
        return {
          backtestMetrics: r.backtestMetrics,
          backtestDiagnostics: r.backtestDiagnostics,
          calibrationSweep: r.calibrationSweep,
          agentProfileDiagnostics: r.agentProfileDiagnostics,
          historicalSignalDiagnostics: r.historicalSignalDiagnostics,
          runtimeWiringDiagnostics: r.runtimeWiringDiagnostics,
          backtestMeasurementDiagnostics: r.backtestMeasurementDiagnostics,
          tradeDirectionDiagnostics: r.tradeDirectionDiagnostics,
          calibrationDirectionSummary: r.calibrationDirectionSummary,
          informationExposureDiagnostics: r.informationExposureDiagnostics,
          convictionDiagnostics: r.convictionDiagnostics,
          decisionFunnelDiagnostics: r.decisionFunnelDiagnostics,
          informationDiagnostics: r.informationDiagnostics,
          directionBiasDiagnostics: r.directionBiasDiagnostics,
          directionBiasDiagnosticsPreFilter: r.directionBiasDiagnosticsPreFilter,
          directionBiasDiagnosticsPostFilter: r.directionBiasDiagnosticsPostFilter,
          directionBiasPopulationComparison: r.directionBiasPopulationComparison,
          informationAdjustmentDiagnostics: r.informationAdjustmentDiagnostics,
          informationAttenuationShadowAudit: r.informationAttenuationShadowAudit,
          informationAdjustmentDecomposition: r.informationAdjustmentDecomposition,
          informationAdjustmentFormulaAudit: r.informationAdjustmentFormulaAudit,
          totalInfoContributionAudit: r.totalInfoContributionAudit,
          technicalContributionAudit: r.technicalContributionAudit,
          trendAudit: r.trendAudit,
          priceVsMa20Audit: r.priceVsMa20Audit,
          momentumAudit: r.momentumAudit,
          sampleSelectionBiasAudit: r.sampleSelectionBiasAudit,
          historyVsSampleRegimeAudit: r.historyVsSampleRegimeAudit,
          sampleSourceAudit: r.sampleSourceAudit,
          directionBiasDiagnosticsBySymbol: r.directionBiasDiagnosticsBySymbol,
          directionBiasComponentExtremes: r.directionBiasComponentExtremes,
          directionBiasByAgentType: r.directionBiasByAgentType,
          directionBiasSamples: r.directionBiasSamples,
          aggregationDiagnostics: r.aggregationDiagnostics,
          directionMappingDiagnostics: normalizeDirectionMappingDiagnostics(r.directionMappingDiagnostics),
          setupDirectionAudit: r.setupDirectionAudit,
        };
      })()),
    };
  }

  private static readonly PREDICTION_HORIZON_DAYS = 5;
  private static readonly HOLDING_PERIOD_DAYS = 5;
  private static readonly MOMENTUM_THRESHOLD_SETUP = 0.01;
  /** Phase 29.6: symmetric LONG/SHORT gate; matches directionThreshold in runBacktestWithThresholds. */
  private static readonly SIGNAL_STRENGTH_MIN = 0.05;
  private static readonly PROBABILITY_NEUTRAL_MAX = 0.7;
  private static readonly LOCAL_CONVICTION_MIN = 0.25;
  private static readonly NEUTRAL_LOOKBACK = 20;

  private static readonly SIGNAL_STRENGTH_THRESHOLDS = [0.05, 0.1, 0.12, 0.15, 0.18];
  private static readonly CONVICTION_THRESHOLDS = [0.2, 0.25, 0.3];
  private static readonly NEUTRAL_THRESHOLDS = [0.7, 0.8];
  private static readonly CALIBRATION_TOP_N = 20;
  private static readonly MIN_LOOKBACK_FOR_FEATURES = 50;

  /** Compute market features from price series. Returns array aligned by index; null where insufficient data. */
  private computeMarketFeatures(closes: number[]): Array<{
    return5d: number;
    return20d: number;
    priceVsMa20: number;
    priceVsMa50: number;
    volatility10d: number;
  } | null> {
    const result: Array<{
      return5d: number;
      return20d: number;
      priceVsMa20: number;
      priceVsMa50: number;
      volatility10d: number;
    } | null> = [];

    for (let i = 0; i < closes.length; i++) {
      if (i < DashboardService.MIN_LOOKBACK_FOR_FEATURES) {
        result.push(null);
        continue;
      }

      const p = closes[i]!;
      const p5 = closes[i - 5]!;
      const p20 = closes[i - 20]!;
      if (p5 <= 0 || p20 <= 0 || !Number.isFinite(p) || !Number.isFinite(p5) || !Number.isFinite(p20)) {
        result.push(null);
        continue;
      }

      const return5d = (p - p5) / p5;
      const return20d = (p - p20) / p20;

      let sum20 = 0;
      for (let j = i - 19; j <= i; j++) sum20 += closes[j]!;
      const ma20 = sum20 / 20;
      if (ma20 <= 0) {
        result.push(null);
        continue;
      }

      let sum50 = 0;
      for (let j = i - 49; j <= i; j++) sum50 += closes[j]!;
      const ma50 = sum50 / 50;
      if (ma50 <= 0) {
        result.push(null);
        continue;
      }

      const priceVsMa20 = (p - ma20) / ma20;
      const priceVsMa50 = (p - ma50) / ma50;

      const dailyReturns: number[] = [];
      for (let j = i - 9; j <= i && j >= 1; j++) {
        const prev = closes[j - 1]!;
        if (prev <= 0) continue;
        const r = (closes[j]! - prev) / prev;
        if (Number.isFinite(r)) dailyReturns.push(r);
      }
      const meanRet = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
      const variance =
        dailyReturns.length >= 2
          ? dailyReturns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / dailyReturns.length
          : 0;
      const volatility10d = Math.sqrt(variance);

      result.push({ return5d, return20d, priceVsMa20, priceVsMa50, volatility10d });
    }
    return result;
  }

  /** Fetch and cache price data per symbol. Single DB round-trip per symbol. Returns closes and timestamps. */
  private async fetchCachedPriceData(
    symbols: string[],
  ): Promise<Map<string, { closes: number[]; timestamps: Date[] }>> {
    const cache = new Map<string, { closes: number[]; timestamps: Date[] }>();
    const syms = symbols?.length ? symbols : ["SPY", "QQQ", "IWM"];

    for (const symbol of syms) {
      const latest = await this.prisma.marketPrice.findFirst({
        where: { symbol },
        orderBy: { timestamp: "desc" },
        select: { datasetVersion: true },
      });
      const dv = latest?.datasetVersion ?? null;
      if (!dv) continue;

      const rows = await this.prisma.marketPrice.findMany({
        where: { symbol, datasetVersion: dv },
        orderBy: { timestamp: "asc" },
        select: { close: true, timestamp: true },
      });
      const closes = rows.map((r) => r.close);
      const timestamps = rows.map((r) => r.timestamp);
      const minLen =
        DashboardService.MIN_LOOKBACK_FOR_FEATURES +
        DashboardService.HOLDING_PERIOD_DAYS +
        6 +
        DashboardService.NEUTRAL_LOOKBACK;
      if (closes.length >= minLen) {
        cache.set(symbol, { closes, timestamps });
      }
    }
    return cache;
  }

  /** Build features cache from price cache. Compute once per symbol. */
  private buildFeaturesCache(
    cachedData: Map<string, { closes: number[]; timestamps: Date[] }>,
  ): Map<string, Array<{ return5d: number; return20d: number; priceVsMa20: number; priceVsMa50: number; volatility10d: number } | null>> {
    const featuresCache = new Map<
      string,
      Array<{ return5d: number; return20d: number; priceVsMa20: number; priceVsMa50: number; volatility10d: number } | null>
    >();
    for (const [symbol, { closes }] of cachedData) {
      featuresCache.set(symbol, this.computeMarketFeatures(closes));
    }
    return featuresCache;
  }

  /** Fetch latest market features for symbols (for agent layer). Returns normalized features for agent signal interpretation. */
  private async fetchMarketFeaturesForSymbols(
    symbols: string[],
  ): Promise<Map<string, MarketFeaturesForAgent | null>> {
    const result = new Map<string, MarketFeaturesForAgent | null>();
    const syms = symbols?.length ? symbols : ["SPY", "QQQ", "IWM"];

    for (const symbol of syms) {
      const latest = await this.prisma.marketPrice.findFirst({
        where: { symbol },
        orderBy: { timestamp: "desc" },
        select: { datasetVersion: true },
      });
      const dv = latest?.datasetVersion ?? null;
      if (!dv) {
        result.set(symbol, null);
        continue;
      }

      const rows = await this.prisma.marketPrice.findMany({
        where: { symbol, datasetVersion: dv },
        orderBy: { timestamp: "asc" },
        select: { close: true },
      });
      const closes = rows.map((r) => r.close);
      const features = this.computeMarketFeatures(closes);
      const lastFeat = features.length > 0 ? features[features.length - 1] : null;

      if (!lastFeat) {
        result.set(symbol, null);
        continue;
      }

      const momentum = Math.max(-1, Math.min(1, lastFeat.return5d * 2));
      const trend = Math.max(-1, Math.min(1, lastFeat.priceVsMa20 * 2));
      const volatility = Math.max(0, Math.min(1, lastFeat.volatility10d * 5));
      result.set(symbol, { momentum, trend, volatility });
    }
    return result;
  }

  /** Compute agent-aggregated signals from market features and agent profiles. Deterministic. */
  private computeAgentAggregatedSignals(
    symbols: string[],
    marketFeatures: Map<string, MarketFeaturesForAgent | null>,
    momentumTilts: Map<string, number>,
    rawCrowdSignals: DashboardSummary["crowdSignals"],
   ): DashboardSummary["crowdSignals"] {
    const AGENT_PROFILE_SEED = 0x27b0;
    const NUM_AGENTS = 11;
    const agents = generateAgentProfiles(AGENT_PROFILE_SEED, NUM_AGENTS);

    const syms = symbols?.length ? symbols : ["SPY", "QQQ", "IWM"];
    const items = rawCrowdSignals?.items ?? [];
    const itemBySymbol = new Map(items.map((i) => [i.symbol, i]));

    const aggregatedItems: Array<{
      symbol: string;
      signal: string;
      signalStrength: number;
      confidence: number;
      disagreement: number;
      instability: number;
      runsUsed: number;
    }> = [];

    for (const symbol of syms) {
      const feat = marketFeatures.get(symbol);
      const rawItem = itemBySymbol.get(symbol);
      const momentumTilt = momentumTilts.get(symbol);

      let momentum: number;
      let trend: number;
      let volatility: number;

      if (feat) {
        momentum = feat.momentum;
        trend = feat.trend;
        volatility = feat.volatility;
      } else {
        const tilt = momentumTilt ?? 0;
        momentum = Math.max(-1, Math.min(1, tilt * 3));
        trend = rawItem ? (rawItem.signal.includes("BUY") ? 0.3 : rawItem.signal.includes("SELL") ? -0.3 : 0) : 0;
        volatility = Math.max(0, Math.min(1, rawItem?.disagreement ?? 0.5));
      }

      const technicalSignal = momentum * 0.4 + trend * 0.6;
      const macroRaw = trend * 0.5 + momentum * 0.3;
      const macroSignal = Math.max(-0.2, Math.min(0.2, macroRaw));
      const sentimentRaw = momentum * 0.35 + trend * 0.45;
      const sentimentSignal = Math.max(-0.15, Math.min(0.15, sentimentRaw));
      const contextSeed = hashString(symbol);

      const agentSignals: number[] = [];
      for (let ai = 0; ai < agents.length; ai++) {
        const agent = agents[ai]!;
        const ip = agent.informationProfile;
        const noiseSignal = computeNoiseSignal(contextSeed, ai);

        const { adjustedTechnical, adjustedMacro, adjustedSentiment, adjustedNoise, deterministicNoise } =
          applyInformationProfile(technicalSignal, macroSignal, sentimentSignal, noiseSignal, agent, ai, contextSeed);

        let agentSignal =
          adjustedTechnical * ip.technicalWeight +
          adjustedMacro * ip.macroWeight +
          adjustedSentiment * ip.sentimentWeight +
          adjustedNoise * ip.noiseWeight +
          deterministicNoise;

        agentSignal *= agent.sensitivity.momentum * 0.4 + agent.sensitivity.trend * 0.4 + agent.sensitivity.volatility * 0.2 + 0.2;

        if (agent.type === "contrarian" && agent.bias.contrarianFactor > 0) {
          agentSignal *= 1 - 2 * agent.bias.contrarianFactor;
        }
        agentSignal += agent.bias.bullishBias;
        agentSignals.push(Math.max(-1, Math.min(1, agentSignal)));
      }

      const meanSignal = agentSignals.reduce((a, b) => a + b, 0) / agentSignals.length;
      const variance =
        agentSignals.length >= 2
          ? agentSignals.reduce((s, v) => s + (v - meanSignal) ** 2, 0) / agentSignals.length
          : 0;
      const disagreement = Math.max(0, Math.min(1, Math.sqrt(variance) * 2));
      const confidence = Math.max(0, Math.min(1, 1 - disagreement));
      const signalStrength = Math.max(0, Math.min(1, Math.abs(meanSignal)));

      const signal =
        meanSignal > 0.5 ? "STRONG_BUY" :
        meanSignal > 0.15 ? "BUY" :
        meanSignal < -0.5 ? "STRONG_SELL" :
        meanSignal < -0.15 ? "SELL" : "NEUTRAL";

      aggregatedItems.push({
        symbol,
        signal,
        signalStrength,
        confidence,
        disagreement,
        instability: rawItem?.instability ?? disagreement * 0.5,
        runsUsed: rawItem?.runsUsed ?? 0,
      });
    }

    return {
      window: rawCrowdSignals?.window ?? 20,
      items: aggregatedItems,
    };
  }

  /** Pure backtest run with cached data and configurable thresholds. No DB calls. Uses profile-based aggregation. */
  private runBacktestWithThresholds(
    cachedData: Map<string, { closes: number[]; timestamps: Date[] }>,
    featuresCache: Map<string, Array<{ return5d: number; return20d: number; priceVsMa20: number; priceVsMa50: number; volatility10d: number } | null>>,
    agents: AgentProfile[],
    params: {
      signalStrengthThreshold: number;
      convictionThreshold: number;
      neutralThreshold: number;
    },
  ): {
    trades: number;
    winRate: number | null;
    avgTradeReturn: number | null;
    cumulativeReturn: number | null;
    benchmarkReturn: number | null;
    edge: number | null;
    maxDrawdown: number | null;
    backtestMeasurementDiagnostics: NonNullable<DashboardSummary["backtestMeasurementDiagnostics"]>;
    tradeDirectionDiagnostics: NonNullable<DashboardSummary["tradeDirectionDiagnostics"]>;
    decisionFunnelDiagnostics: NonNullable<DashboardSummary["decisionFunnelDiagnostics"]>;
    directionBiasDiagnostics: NonNullable<DashboardSummary["directionBiasDiagnostics"]>;
    directionBiasDiagnosticsPreFilter: NonNullable<DashboardSummary["directionBiasDiagnosticsPreFilter"]>;
    directionBiasDiagnosticsPostFilter: NonNullable<DashboardSummary["directionBiasDiagnosticsPostFilter"]>;
    directionBiasPopulationComparison: NonNullable<DashboardSummary["directionBiasPopulationComparison"]>;
    directionBiasDiagnosticsBySymbol: NonNullable<DashboardSummary["directionBiasDiagnosticsBySymbol"]>;
    directionBiasComponentExtremes: NonNullable<DashboardSummary["directionBiasComponentExtremes"]>;
    informationAdjustmentDiagnostics: NonNullable<DashboardSummary["informationAdjustmentDiagnostics"]>;
    informationAttenuationShadowAudit: NonNullable<DashboardSummary["informationAttenuationShadowAudit"]>;
    informationAdjustmentDecomposition: NonNullable<DashboardSummary["informationAdjustmentDecomposition"]>;
    informationAdjustmentFormulaAudit: NonNullable<DashboardSummary["informationAdjustmentFormulaAudit"]>;
    totalInfoContributionAudit: NonNullable<DashboardSummary["totalInfoContributionAudit"]>;
    technicalContributionAudit: NonNullable<DashboardSummary["technicalContributionAudit"]>;
    trendAudit: NonNullable<DashboardSummary["trendAudit"]>;
    priceVsMa20Audit: NonNullable<DashboardSummary["priceVsMa20Audit"]>;
    momentumAudit: NonNullable<DashboardSummary["momentumAudit"]>;
    sampleSelectionBiasAudit: NonNullable<DashboardSummary["sampleSelectionBiasAudit"]>;
    historyVsSampleRegimeAudit: NonNullable<DashboardSummary["historyVsSampleRegimeAudit"]>;
    sampleSourceAudit: NonNullable<DashboardSummary["sampleSourceAudit"]>;
    directionBiasByAgentType: NonNullable<DashboardSummary["directionBiasByAgentType"]>;
    directionBiasSamples: NonNullable<DashboardSummary["directionBiasSamples"]>;
    aggregationDiagnostics: NonNullable<DashboardSummary["aggregationDiagnostics"]>;
    directionMappingDiagnostics: NonNullable<DashboardSummary["directionMappingDiagnostics"]>;
  } {
    const horizon = DashboardService.HOLDING_PERIOD_DAYS;
    const { signalStrengthThreshold, convictionThreshold, neutralThreshold } = params;

    const tradeReturns: number[] = [];
    const benchmarkReturns: number[] = [];
    let executedLongTrades = 0;
    let executedShortTrades = 0;
    const sampleTradeDirections: NonNullable<DashboardSummary["tradeDirectionDiagnostics"]>["sampleTradeDirections"] = [];

    let totalSignals = 0;
    let passedSignalStrength = 0;
    let passedConviction = 0;

    let sumBaseSignal = 0;
    let sumPostInformationSignal = 0;
    let sumTechnicalContribution = 0;
    let sumMacroContribution = 0;
    let sumSentimentContribution = 0;
    let sumNoiseContribution = 0;
    let positiveSignalCount = 0;
    let negativeSignalCount = 0;
    let nearZeroSignalCount = 0;
    let preFilterSumBaseSignal = 0;
    let preFilterSumPostInformationSignal = 0;
    let preFilterSumTechnicalContribution = 0;
    let preFilterSumMacroContribution = 0;
    let preFilterSumSentimentContribution = 0;
    let preFilterSumNoiseContribution = 0;
    let preFilterPositiveSignalCount = 0;
    let preFilterNegativeSignalCount = 0;
    let preFilterNearZeroSignalCount = 0;
    let preFilterCount = 0;
    let sumDelta = 0;
    let positiveDeltaCount = 0;
    let negativeDeltaCount = 0;
    let nearZeroDeltaCount = 0;
    let sumDeltaWhenBasePositive = 0;
    let countBasePositive = 0;
    let sumDeltaWhenBaseNegative = 0;
    let countBaseNegative = 0;
    let basePositiveToPostPositiveCount = 0;
    let basePositiveToPostNegativeCount = 0;
    let baseNegativeToPostNegativeCount = 0;
    let baseNegativeToPostPositiveCount = 0;
    const adjValAcc = { min: Infinity, max: -Infinity, sum: 0, count: 0, positiveCount: 0, negativeCount: 0 };
    const exposureAcc = { min: Infinity, max: -Infinity, sum: 0, count: 0, positiveCount: 0, negativeCount: 0 };
    const momentumAcc = { min: Infinity, max: -Infinity, sum: 0, count: 0, positiveCount: 0, negativeCount: 0 };
    const trendAcc = { min: Infinity, max: -Infinity, sum: 0, count: 0, positiveCount: 0, negativeCount: 0 };
    const priceVsMa20Acc = { min: Infinity, max: -Infinity, sum: 0, count: 0, positiveCount: 0, negativeCount: 0 };
    const priceAcc = { min: Infinity, max: -Infinity, sum: 0, count: 0 };
    const ma20Acc = { min: Infinity, max: -Infinity, sum: 0, count: 0 };
    const rawDiffAcc = { min: Infinity, max: -Infinity, sum: 0, count: 0, positiveCount: 0, negativeCount: 0 };
    const prevClose5Acc = { min: Infinity, max: -Infinity, sum: 0, count: 0 };
    const momentumRawDiffAcc = { min: Infinity, max: -Infinity, sum: 0, count: 0, positiveCount: 0, negativeCount: 0 };
    const return5dAcc = { min: Infinity, max: -Infinity, sum: 0, count: 0, positiveCount: 0, negativeCount: 0 };
    const technicalSignalAcc = { min: Infinity, max: -Infinity, sum: 0, count: 0, positiveCount: 0, negativeCount: 0 };
    const byTypeSums: Record<AgentProfileType, { sumSignal: number; positiveCount: number; negativeCount: number }> = {
      trendFollower: { sumSignal: 0, positiveCount: 0, negativeCount: 0 },
      contrarian: { sumSignal: 0, positiveCount: 0, negativeCount: 0 },
      balanced: { sumSignal: 0, positiveCount: 0, negativeCount: 0 },
    };
    const directionBiasSamples: NonNullable<DashboardSummary["directionBiasSamples"]> = [];

    type DirBiasBySymAcc = {
      sumBaseSignal: number;
      sumPostInformationSignal: number;
      sumTechnicalContribution: number;
      sumMacroContribution: number;
      sumSentimentContribution: number;
      sumNoiseContribution: number;
      count: number;
      positiveSignalCount: number;
      negativeSignalCount: number;
      nearZeroSignalCount: number;
    };
    const dirBiasBySym: Record<string, DirBiasBySymAcc> = {};
    for (const s of ["SPY", "QQQ", "IWM"]) {
      dirBiasBySym[s] = {
        sumBaseSignal: 0,
        sumPostInformationSignal: 0,
        sumTechnicalContribution: 0,
        sumMacroContribution: 0,
        sumSentimentContribution: 0,
        sumNoiseContribution: 0,
        count: 0,
        positiveSignalCount: 0,
        negativeSignalCount: 0,
        nearZeroSignalCount: 0,
      };
    }
    let pvMa20PosCount = 0;
    let pvMa20NegCount = 0;
    let ret5dPosCount = 0;
    let ret5dNegCount = 0;
    const sampleBiasBySym: Record<string, { pvMa20Pos: number; pvMa20Neg: number; ret5dPos: number; ret5dNeg: number }> = {};
    for (const s of ["SPY", "QQQ", "IWM"]) {
      sampleBiasBySym[s] = { pvMa20Pos: 0, pvMa20Neg: 0, ret5dPos: 0, ret5dNeg: 0 };
    }
    const shadow25Acc = { sum: 0, count: 0, positiveCount: 0, negativeCount: 0 };
    const shadow50Acc = { sum: 0, count: 0, positiveCount: 0, negativeCount: 0 };
    const shadow75Acc = { sum: 0, count: 0, positiveCount: 0, negativeCount: 0 };
    const shadow100Acc = { sum: 0, count: 0, positiveCount: 0, negativeCount: 0 };

    type CompExtremeAcc = { min: number; max: number; sum: number; count: number; positiveCount: number; negativeCount: number };
    const compExtremes = {
      baseSignal: { min: Infinity, max: -Infinity, sum: 0, count: 0, positiveCount: 0, negativeCount: 0 } as CompExtremeAcc,
      postInformationSignal: { min: Infinity, max: -Infinity, sum: 0, count: 0, positiveCount: 0, negativeCount: 0 } as CompExtremeAcc,
      technicalContribution: { min: Infinity, max: -Infinity, sum: 0, count: 0, positiveCount: 0, negativeCount: 0 } as CompExtremeAcc,
      macroContribution: { min: Infinity, max: -Infinity, sum: 0, count: 0, positiveCount: 0, negativeCount: 0 } as CompExtremeAcc,
      sentimentContribution: { min: Infinity, max: -Infinity, sum: 0, count: 0, positiveCount: 0, negativeCount: 0 } as CompExtremeAcc,
      noiseContribution: { min: Infinity, max: -Infinity, sum: 0, count: 0, positiveCount: 0, negativeCount: 0 } as CompExtremeAcc,
    };

    let longConditionCount = 0;
    let shortConditionCount = 0;
    let noneConditionCount = 0;
    let preMappingLongCount = 0;
    let preMappingShortCount = 0;
    let preMappingNeutralCount = 0;
    let aggregatedPositiveCount = 0;
    let aggregatedNegativeCount = 0;
    let aggregatedNearZeroCount = 0;
    const meanSignalsForMedian: number[] = [];
    let sumMeanSignal = 0;
    let meanSignalCount = 0;
    let sumPositiveAgentShare = 0;
    let sumNegativeAgentShare = 0;
    let executedWithDecompCount = 0;
    const directionMappingSamples: NonNullable<NonNullable<DashboardSummary["directionMappingDiagnostics"]>["sampleMappings"]> = [];
    const sampleLongRejected: NonNullable<NonNullable<DashboardSummary["directionMappingDiagnostics"]>["sampleLongCandidatesRejected"]> = [];
    const sampleShortRejected: NonNullable<NonNullable<DashboardSummary["directionMappingDiagnostics"]>["sampleShortCandidatesRejected"]> = [];
    const sampleLongAccepted: NonNullable<NonNullable<DashboardSummary["directionMappingDiagnostics"]>["sampleLongCandidatesAccepted"]> = [];
    const sampleShortAccepted: NonNullable<NonNullable<DashboardSummary["directionMappingDiagnostics"]>["sampleShortCandidatesAccepted"]> = [];
    let aggSumScore = 0;
    let aggPositiveScore = 0;
    let aggNegativeScore = 0;
    let aggZeroScore = 0;
    let aggPositiveCount = 0;
    let aggNegativeCount = 0;
    let aggZeroCount = 0;
    let aggWeightedPositive = 0;
    let aggWeightedNegative = 0;
    const aggSample: Array<{ score: number; weight: number; direction: "LONG" | "SHORT" | "NONE" }> = [];

    const acceptLong = {
      preMappingCount: 0,
      passedSignalThresholdCount: 0,
      failedSignalThresholdCount: 0,
      passedConvictionCount: 0,
      failedConvictionCount: 0,
      finalAcceptedCount: 0,
    };
    const acceptShort = {
      preMappingCount: 0,
      passedSignalThresholdCount: 0,
      failedSignalThresholdCount: 0,
      passedConvictionCount: 0,
      failedConvictionCount: 0,
      finalAcceptedCount: 0,
    };
    const signalBuckets = emptySignalBucketDiagnostics();
    type SymAcc = {
      preMappingLongCount: number;
      preMappingShortCount: number;
      finalLongCount: number;
      finalShortCount: number;
      finalNoneCount: number;
      sumLongSignal: number;
      nPreLong: number;
      sumShortSignal: number;
      nPreShort: number;
      sumLongConviction: number;
      sumShortConviction: number;
    };
    const symAcc: Record<string, SymAcc> = {};
    const symbolKeysForDirection = new Set<string>([
      "SPY",
      "QQQ",
      "IWM",
      ...cachedData.keys(),
    ]);
    for (const s of symbolKeysForDirection) {
      symAcc[s] = {
        preMappingLongCount: 0,
        preMappingShortCount: 0,
        finalLongCount: 0,
        finalShortCount: 0,
        finalNoneCount: 0,
        sumLongSignal: 0,
        nPreLong: 0,
        sumShortSignal: 0,
        nPreShort: 0,
        sumLongConviction: 0,
        sumShortConviction: 0,
      };
    }
    const sampleLongSetups: NonNullable<DashboardSummary["setupDirectionAudit"]>["sampleLongSetups"] = [];
    const sampleShortSetups: NonNullable<DashboardSummary["setupDirectionAudit"]>["sampleShortSetups"] = [];
    const sampleNoneSetups: NonNullable<DashboardSummary["setupDirectionAudit"]>["sampleNoneSetups"] = [];
    let rejectedLongBelowSignalThreshold = 0;
    let rejectedLongBelowConvictionThreshold = 0;
    let rejectedShortBelowSignalThreshold = 0;
    let rejectedShortBelowConvictionThreshold = 0;
    let loopIterationCount = 0;
    let featAvailableCount = 0;

    const fullHistoryBySym: Record<string, { pvMa20Pos: number; pvMa20Neg: number; ret5dPos: number; ret5dNeg: number }> = {};
    for (const s of ["SPY", "QQQ", "IWM"]) {
      fullHistoryBySym[s] = { pvMa20Pos: 0, pvMa20Neg: 0, ret5dPos: 0, ret5dNeg: 0 };
    }
    let fullPvMa20Pos = 0;
    let fullPvMa20Neg = 0;
    let fullRet5dPos = 0;
    let fullRet5dNeg = 0;
    let fullHistoryRowsConsidered = 0;
    for (const [sym, features] of featuresCache) {
      if (!["SPY", "QQQ", "IWM"].includes(sym)) continue;
      const acc = fullHistoryBySym[sym];
      if (!acc) continue;
      for (const feat of features) {
        if (!feat) continue;
        fullHistoryRowsConsidered++;
        if (feat.priceVsMa20 > 0) {
          fullPvMa20Pos++;
          acc.pvMa20Pos++;
        } else if (feat.priceVsMa20 < 0) {
          fullPvMa20Neg++;
          acc.pvMa20Neg++;
        }
        if (feat.return5d > 0) {
          fullRet5dPos++;
          acc.ret5dPos++;
        } else if (feat.return5d < 0) {
          fullRet5dNeg++;
          acc.ret5dNeg++;
        }
      }
    }

    for (const [symbol, { closes, timestamps }] of cachedData) {
      const features = featuresCache.get(symbol);
      if (!features) continue;

      for (let i = 5 + DashboardService.NEUTRAL_LOOKBACK; i < closes.length - horizon; i++) {
        if (i >= features.length) break;
        loopIterationCount++;
        const feat = features[i];
        if (!feat) continue;
        featAvailableCount++;

        const contextSeed = hashString(symbol + ":" + String(i));
        const prevContextSeed =
          i > 5 + DashboardService.NEUTRAL_LOOKBACK
            ? hashString(symbol + ":" + String(i - 1))
            : undefined;
        const { meanSignal, disagreement, signalStrength, agentSignals } =
          computeAgentAggregatedSignalForFeatures(feat, agents, contextSeed, prevContextSeed);

        let iterPosScore = 0;
        let iterNegScore = 0;
        let iterPosCount = 0;
        let iterNegCount = 0;
        let iterWeightedPos = 0;
        let iterWeightedNeg = 0;
        agentSignals.forEach((score) => {
          const weight = 1;
          aggSumScore += score;
          if (score > 0) {
            aggPositiveScore += score;
            aggPositiveCount += 1;
            aggWeightedPositive += score * weight;
            iterPosScore += score;
            iterPosCount += 1;
            iterWeightedPos += score * weight;
          } else if (score < 0) {
            aggNegativeScore += score;
            aggNegativeCount += 1;
            aggWeightedNegative += score * weight;
            iterNegScore += score;
            iterNegCount += 1;
            iterWeightedNeg += score * weight;
          } else {
            aggZeroScore += score;
            aggZeroCount += 1;
          }
          if (aggSample.length < 10) {
            aggSample.push({
              score,
              weight,
              direction: score > 0 ? "LONG" : score < 0 ? "SHORT" : "NONE",
            });
          }
        });

        const preMappingDirection: "LONG" | "SHORT" | "NEUTRAL" =
          meanSignal > 0 ? "LONG" : meanSignal < 0 ? "SHORT" : "NEUTRAL";
        if (preMappingDirection === "LONG") preMappingLongCount++;
        else if (preMappingDirection === "SHORT") preMappingShortCount++;
        else preMappingNeutralCount++;

        const directionThreshold = signalStrengthThreshold;
        let setup: "LONG" | "SHORT" | null = null;
        if (meanSignal >= directionThreshold) setup = "LONG";
        else if (meanSignal <= -directionThreshold) setup = "SHORT";

        if (setup === "LONG") longConditionCount++;
        else if (setup === "SHORT") shortConditionCount++;
        else noneConditionCount++;

        if (meanSignal > 0.01) aggregatedPositiveCount++;
        else if (meanSignal < -0.01) aggregatedNegativeCount++;
        else aggregatedNearZeroCount++;

        meanSignalsForMedian.push(meanSignal);
        sumMeanSignal += meanSignal;
        meanSignalCount++;

        let probabilityNeutral = 0.5;
        if (setup != null) {
          let neutralCount = 0;
          let validLookbackDays = 0;
          for (let k = i - DashboardService.NEUTRAL_LOOKBACK; k < i && k >= DashboardService.MIN_LOOKBACK_FOR_FEATURES; k++) {
            const fk = features[k];
            if (!fk) continue;
            validLookbackDays++;
            const kSeed = hashString(symbol + ":" + String(k));
            const kPrevSeed =
              k > DashboardService.MIN_LOOKBACK_FOR_FEATURES
                ? hashString(symbol + ":" + String(k - 1))
                : undefined;
            const { meanSignal: mk } = computeAgentAggregatedSignalForFeatures(fk, agents, kSeed, kPrevSeed);
            if (Math.abs(mk) < signalStrengthThreshold) neutralCount++;
          }
          probabilityNeutral = validLookbackDays > 0 ? neutralCount / validLookbackDays : 0.5;
        }
        const conviction =
          signalStrength * 0.5 +
          (1 - disagreement) * 0.3 +
          (1 - probabilityNeutral) * 0.2;

        const bucketKey = absoluteSignalMagnitudeBucket(meanSignal);
        if (meanSignal > 0) signalBuckets[bucketKey].longCount++;
        else if (meanSignal < 0) signalBuckets[bucketKey].shortCount++;

        const sa = symAcc[symbol]!;
        if (preMappingDirection === "LONG") {
          sa.preMappingLongCount++;
          sa.sumLongSignal += meanSignal;
          sa.nPreLong++;
          sa.sumLongConviction += conviction;
        } else if (preMappingDirection === "SHORT") {
          sa.preMappingShortCount++;
          sa.sumShortSignal += meanSignal;
          sa.nPreShort++;
          sa.sumShortConviction += conviction;
        }
        if (setup === "LONG") sa.finalLongCount++;
        if (setup === "SHORT") sa.finalShortCount++;
        if (setup == null) sa.finalNoneCount++;

        const decompForSample = computeSignalDecomposition(feat, agents, contextSeed, prevContextSeed);
        const setupSampleEntry = {
          symbol,
          timestamp: (i < timestamps.length ? timestamps[i] : null)?.toISOString() ?? "",
          setupDirection: setup ?? "NONE",
          baseSignal: decompForSample.baseSignal,
          postInformationSignal: decompForSample.meanSignal,
          conviction: conviction,
        };
        if (setup === "LONG" && sampleLongSetups.length < 10) sampleLongSetups.push(setupSampleEntry);
        if (setup === "SHORT" && sampleShortSetups.length < 10) sampleShortSetups.push(setupSampleEntry);
        if (setup == null && sampleNoneSetups.length < 10) sampleNoneSetups.push(setupSampleEntry);

        if (preMappingDirection === "LONG") {
          acceptLong.preMappingCount++;
          if (setup !== "LONG") {
            acceptLong.failedSignalThresholdCount++;
            rejectedLongBelowSignalThreshold++;
          } else if (signalStrength <= signalStrengthThreshold) {
            acceptLong.failedSignalThresholdCount++;
            rejectedLongBelowSignalThreshold++;
          } else {
            acceptLong.passedSignalThresholdCount++;
            if (probabilityNeutral >= neutralThreshold) {
              /* neutral gate; not counted as conviction failure */
            } else if (conviction < convictionThreshold) {
              acceptLong.failedConvictionCount++;
              rejectedLongBelowConvictionThreshold++;
            } else {
              acceptLong.passedConvictionCount++;
            }
          }
        }
        if (preMappingDirection === "SHORT") {
          acceptShort.preMappingCount++;
          if (setup !== "SHORT") {
            acceptShort.failedSignalThresholdCount++;
            rejectedShortBelowSignalThreshold++;
          } else if (signalStrength <= signalStrengthThreshold) {
            acceptShort.failedSignalThresholdCount++;
            rejectedShortBelowSignalThreshold++;
          } else {
            acceptShort.passedSignalThresholdCount++;
            if (probabilityNeutral >= neutralThreshold) {
              /* neutral gate */
            } else if (conviction < convictionThreshold) {
              acceptShort.failedConvictionCount++;
              rejectedShortBelowConvictionThreshold++;
            } else {
              acceptShort.passedConvictionCount++;
            }
          }
        }

        const finalDirection: "LONG" | "SHORT" | "NONE" = setup ?? "NONE";
        const sampleEntry = {
          symbol,
          timestamp: (i < timestamps.length ? timestamps[i] : null)?.toISOString() ?? "",
          aggregatedSignal: meanSignal,
          conviction,
          preMappingDirection,
          finalDirection,
        };
        if (directionMappingSamples.length < 10) {
          directionMappingSamples.push({
            ...sampleEntry,
            chosenDirection: finalDirection,
            finalScore: meanSignal,
            positiveScore: iterPosScore,
            negativeScore: iterNegScore,
            positiveCount: iterPosCount,
            negativeCount: iterNegCount,
            weightedPositive: iterWeightedPos,
            weightedNegative: iterWeightedNeg,
          });
        }
        if (preMappingDirection === "LONG" && finalDirection === "NONE" && sampleLongRejected.length < 10) {
          sampleLongRejected.push(sampleEntry);
        }
        if (preMappingDirection === "SHORT" && finalDirection === "NONE" && sampleShortRejected.length < 10) {
          sampleShortRejected.push(sampleEntry);
        }
        if (preMappingDirection === "LONG" && finalDirection === "LONG" && sampleLongAccepted.length < 10) {
          sampleLongAccepted.push(sampleEntry);
        }
        if (preMappingDirection === "SHORT" && finalDirection === "SHORT" && sampleShortAccepted.length < 10) {
          sampleShortAccepted.push(sampleEntry);
        }

        if (setup == null) continue;
        totalSignals++;
        if (signalStrength <= signalStrengthThreshold) continue;
        passedSignalStrength++;

        const decompPre = computeSignalDecomposition(feat, agents, contextSeed, prevContextSeed);
        preFilterSumBaseSignal += decompPre.baseSignal;
        preFilterSumPostInformationSignal += decompPre.meanSignal;
        preFilterSumTechnicalContribution += decompPre.technicalContribution;
        preFilterSumMacroContribution += decompPre.macroContribution;
        preFilterSumSentimentContribution += decompPre.sentimentContribution;
        preFilterSumNoiseContribution += decompPre.noiseContribution;
        preFilterCount++;
        if (decompPre.meanSignal > 0.01) preFilterPositiveSignalCount++;
        else if (decompPre.meanSignal < -0.01) preFilterNegativeSignalCount++;
        else preFilterNearZeroSignalCount++;

        if (probabilityNeutral >= neutralThreshold) continue;

        if (conviction < convictionThreshold) continue;
        passedConviction++;

        const priceT0 = closes[i]!;
        const priceT1 = closes[i + horizon]!;
        if (priceT0 <= 0 || !Number.isFinite(priceT0) || !Number.isFinite(priceT1)) continue;

        const decomp = computeSignalDecomposition(feat, agents, contextSeed, prevContextSeed);
        sumBaseSignal += decomp.baseSignal;
        sumPostInformationSignal += decomp.meanSignal;
        sumTechnicalContribution += decomp.technicalContribution;
        sumMacroContribution += decomp.macroContribution;
        sumSentimentContribution += decomp.sentimentContribution;
        sumNoiseContribution += decomp.noiseContribution;
        if (meanSignal > 0.01) positiveSignalCount++;
        else if (meanSignal < -0.01) negativeSignalCount++;
        else nearZeroSignalCount++;
        const updateComp = (acc: CompExtremeAcc, v: number) => {
          acc.min = Math.min(acc.min, v);
          acc.max = Math.max(acc.max, v);
          acc.sum += v;
          acc.count++;
          if (v > 0) acc.positiveCount++;
          else if (v < 0) acc.negativeCount++;
        };
        const momentum = Math.max(-1, Math.min(1, feat.return5d * 2));
        const priceVsMa20 = feat.priceVsMa20;
        const trend = Math.max(-1, Math.min(1, priceVsMa20 * 2));
        const technicalSignal = momentum * 0.4 + trend * 0.6;
        const p = closes[i]!;
        const p5 = closes[i - 5]!;
        const momentumRawDiff = p - p5;
        const return5d = feat.return5d;
        prevClose5Acc.min = Math.min(prevClose5Acc.min, p5);
        prevClose5Acc.max = Math.max(prevClose5Acc.max, p5);
        prevClose5Acc.sum += p5;
        prevClose5Acc.count++;
        updateComp(momentumRawDiffAcc, momentumRawDiff);
        updateComp(return5dAcc, return5d);
        let sum20 = 0;
        for (let j = i - 19; j <= i; j++) sum20 += closes[j]!;
        const ma20 = sum20 / 20;
        const rawDiff = p - ma20;
        priceAcc.min = Math.min(priceAcc.min, p);
        priceAcc.max = Math.max(priceAcc.max, p);
        priceAcc.sum += p;
        priceAcc.count++;
        ma20Acc.min = Math.min(ma20Acc.min, ma20);
        ma20Acc.max = Math.max(ma20Acc.max, ma20);
        ma20Acc.sum += ma20;
        ma20Acc.count++;
        updateComp(rawDiffAcc, rawDiff);
        updateComp(momentumAcc, momentum);
        updateComp(trendAcc, trend);
        updateComp(priceVsMa20Acc, priceVsMa20);
        updateComp(technicalSignalAcc, technicalSignal);
        if (priceVsMa20 > 0) pvMa20PosCount++;
        else if (priceVsMa20 < 0) pvMa20NegCount++;
        if (return5d > 0) ret5dPosCount++;
        else if (return5d < 0) ret5dNegCount++;
        const sb = sampleBiasBySym[symbol];
        if (sb) {
          if (priceVsMa20 > 0) sb.pvMa20Pos++;
          else if (priceVsMa20 < 0) sb.pvMa20Neg++;
          if (return5d > 0) sb.ret5dPos++;
          else if (return5d < 0) sb.ret5dNeg++;
        }
        updateComp(compExtremes.baseSignal, decomp.baseSignal);
        updateComp(compExtremes.postInformationSignal, decomp.meanSignal);
        const delta = decomp.meanSignal - decomp.baseSignal;
        const baseSignal = decomp.baseSignal;
        const shadow25 = baseSignal + delta * 0.25;
        const shadow50 = baseSignal + delta * 0.5;
        const shadow75 = baseSignal + delta * 0.75;
        const shadow100 = decomp.meanSignal;
        shadow25Acc.sum += shadow25;
        shadow25Acc.count++;
        if (shadow25 > 0.01) shadow25Acc.positiveCount++;
        else if (shadow25 < -0.01) shadow25Acc.negativeCount++;
        shadow50Acc.sum += shadow50;
        shadow50Acc.count++;
        if (shadow50 > 0.01) shadow50Acc.positiveCount++;
        else if (shadow50 < -0.01) shadow50Acc.negativeCount++;
        shadow75Acc.sum += shadow75;
        shadow75Acc.count++;
        if (shadow75 > 0.01) shadow75Acc.positiveCount++;
        else if (shadow75 < -0.01) shadow75Acc.negativeCount++;
        shadow100Acc.sum += shadow100;
        shadow100Acc.count++;
        if (shadow100 > 0.01) shadow100Acc.positiveCount++;
        else if (shadow100 < -0.01) shadow100Acc.negativeCount++;
        sumDelta += delta;
        if (Math.abs(delta) < 1e-12) nearZeroDeltaCount++;
        else if (delta > 0) positiveDeltaCount++;
        else negativeDeltaCount++;
        adjValAcc.min = Math.min(adjValAcc.min, delta);
        adjValAcc.max = Math.max(adjValAcc.max, delta);
        adjValAcc.sum += delta;
        adjValAcc.count++;
        if (delta > 0) adjValAcc.positiveCount++;
        else if (delta < 0) adjValAcc.negativeCount++;
        const totalInfoContribution =
          decomp.technicalContribution +
          decomp.macroContribution +
          decomp.sentimentContribution +
          decomp.noiseContribution;
        exposureAcc.min = Math.min(exposureAcc.min, totalInfoContribution);
        exposureAcc.max = Math.max(exposureAcc.max, totalInfoContribution);
        exposureAcc.sum += totalInfoContribution;
        exposureAcc.count++;
        if (totalInfoContribution > 0) exposureAcc.positiveCount++;
        else if (totalInfoContribution < 0) exposureAcc.negativeCount++;
        if (decomp.baseSignal > 0.01) {
          sumDeltaWhenBasePositive += delta;
          countBasePositive++;
          if (decomp.meanSignal > 0.01) basePositiveToPostPositiveCount++;
          else if (decomp.meanSignal < -0.01) basePositiveToPostNegativeCount++;
        } else if (decomp.baseSignal < -0.01) {
          sumDeltaWhenBaseNegative += delta;
          countBaseNegative++;
          if (decomp.meanSignal < -0.01) baseNegativeToPostNegativeCount++;
          else if (decomp.meanSignal > 0.01) baseNegativeToPostPositiveCount++;
        }
        updateComp(compExtremes.technicalContribution, decomp.technicalContribution);
        updateComp(compExtremes.macroContribution, decomp.macroContribution);
        updateComp(compExtremes.sentimentContribution, decomp.sentimentContribution);
        updateComp(compExtremes.noiseContribution, decomp.noiseContribution);
        const dbs = dirBiasBySym[symbol];
        if (dbs) {
          dbs.sumBaseSignal += decomp.baseSignal;
          dbs.sumPostInformationSignal += decomp.meanSignal;
          dbs.sumTechnicalContribution += decomp.technicalContribution;
          dbs.sumMacroContribution += decomp.macroContribution;
          dbs.sumSentimentContribution += decomp.sentimentContribution;
          dbs.sumNoiseContribution += decomp.noiseContribution;
          dbs.count++;
          if (meanSignal > 0.01) dbs.positiveSignalCount++;
          else if (meanSignal < -0.01) dbs.negativeSignalCount++;
          else dbs.nearZeroSignalCount++;
        }
        const totalPos =
          decomp.byAgentType.trendFollower.positiveCount +
          decomp.byAgentType.contrarian.positiveCount +
          decomp.byAgentType.balanced.positiveCount;
        const totalNeg =
          decomp.byAgentType.trendFollower.negativeCount +
          decomp.byAgentType.contrarian.negativeCount +
          decomp.byAgentType.balanced.negativeCount;
        sumPositiveAgentShare += totalPos / agents.length;
        sumNegativeAgentShare += totalNeg / agents.length;
        executedWithDecompCount++;
        for (const t of ["trendFollower", "contrarian", "balanced"] as const) {
          const bt = decomp.byAgentType[t];
          byTypeSums[t].sumSignal += bt.sumSignal;
          byTypeSums[t].positiveCount += bt.positiveCount;
          byTypeSums[t].negativeCount += bt.negativeCount;
        }
        if (directionBiasSamples.length < 10) {
          const ts = i < timestamps.length ? timestamps[i] : null;
          directionBiasSamples.push({
            symbol,
            timestamp: ts ? ts.toISOString() : "",
            baseSignal: decomp.baseSignal,
            technicalContribution: decomp.technicalContribution,
            macroContribution: decomp.macroContribution,
            sentimentContribution: decomp.sentimentContribution,
            noiseContribution: decomp.noiseContribution,
            finalSignal: decomp.meanSignal,
            chosenDirection: setup,
          });
        }

        const rawReturn = (priceT1 - priceT0) / priceT0;
        const tradeReturn = setup === "LONG" ? rawReturn : -rawReturn;
        tradeReturns.push(tradeReturn);
        benchmarkReturns.push(rawReturn);

        if (setup === "LONG") {
          executedLongTrades++;
          acceptLong.finalAcceptedCount++;
        } else {
          executedShortTrades++;
          acceptShort.finalAcceptedCount++;
        }

        if (sampleTradeDirections.length < 10 && i < timestamps.length && i + horizon < timestamps.length) {
          sampleTradeDirections.push({
            symbol,
            direction: setup,
            entryTimestamp: timestamps[i]!.toISOString(),
            exitTimestamp: timestamps[i + horizon]!.toISOString(),
            strategyReturn: tradeReturn,
            benchmarkReturn: rawReturn,
          });
        }
      }
    }

    const totalExecuted = executedLongTrades + executedShortTrades;
    const emptyDirectionDiag: NonNullable<DashboardSummary["tradeDirectionDiagnostics"]> = {
      executedLongTrades: 0,
      executedShortTrades: 0,
      longShare: null,
      shortShare: null,
      sampleTradeDirections: [],
    };

    const passedFinalDecision = tradeReturns.length;
    const execCount = tradeReturns.length;
    const directionBiasDiagnostics: NonNullable<DashboardSummary["directionBiasDiagnostics"]> = {
      avgBaseSignal: execCount > 0 ? sumBaseSignal / execCount : 0,
      avgPostInformationSignal: execCount > 0 ? sumPostInformationSignal / execCount : 0,
      avgTechnicalContribution: execCount > 0 ? sumTechnicalContribution / execCount : 0,
      avgMacroContribution: execCount > 0 ? sumMacroContribution / execCount : 0,
      avgSentimentContribution: execCount > 0 ? sumSentimentContribution / execCount : 0,
      avgNoiseContribution: execCount > 0 ? sumNoiseContribution / execCount : 0,
      positiveSignalCount,
      negativeSignalCount,
      nearZeroSignalCount,
    };
    const directionBiasDiagnosticsPreFilter: NonNullable<
      DashboardSummary["directionBiasDiagnosticsPreFilter"]
    > = {
      avgBaseSignal: preFilterCount > 0 ? preFilterSumBaseSignal / preFilterCount : null,
      avgPostInformationSignal: preFilterCount > 0 ? preFilterSumPostInformationSignal / preFilterCount : null,
      avgTechnicalContribution: preFilterCount > 0 ? preFilterSumTechnicalContribution / preFilterCount : null,
      avgMacroContribution: preFilterCount > 0 ? preFilterSumMacroContribution / preFilterCount : null,
      avgSentimentContribution: preFilterCount > 0 ? preFilterSumSentimentContribution / preFilterCount : null,
      avgNoiseContribution: preFilterCount > 0 ? preFilterSumNoiseContribution / preFilterCount : null,
      positiveSignalCount: preFilterPositiveSignalCount,
      negativeSignalCount: preFilterNegativeSignalCount,
      nearZeroSignalCount: preFilterNearZeroSignalCount,
    };
    const directionBiasDiagnosticsPostFilter: NonNullable<
      DashboardSummary["directionBiasDiagnosticsPostFilter"]
    > = {
      avgBaseSignal: execCount > 0 ? sumBaseSignal / execCount : null,
      avgPostInformationSignal: execCount > 0 ? sumPostInformationSignal / execCount : null,
      avgTechnicalContribution: execCount > 0 ? sumTechnicalContribution / execCount : null,
      avgMacroContribution: execCount > 0 ? sumMacroContribution / execCount : null,
      avgSentimentContribution: execCount > 0 ? sumSentimentContribution / execCount : null,
      avgNoiseContribution: execCount > 0 ? sumNoiseContribution / execCount : null,
      positiveSignalCount,
      negativeSignalCount,
      nearZeroSignalCount,
    };
    const directionBiasPopulationComparison: NonNullable<
      DashboardSummary["directionBiasPopulationComparison"]
    > = {
      preFilterRowCount: preFilterCount,
      postFilterRowCount: execCount,
      preFilterPositiveShare: preFilterCount > 0 ? preFilterPositiveSignalCount / preFilterCount : null,
      preFilterNegativeShare: preFilterCount > 0 ? preFilterNegativeSignalCount / preFilterCount : null,
      postFilterPositiveShare: execCount > 0 ? positiveSignalCount / execCount : null,
      postFilterNegativeShare: execCount > 0 ? negativeSignalCount / execCount : null,
    };
    const informationAttenuationShadowAudit: NonNullable<
      DashboardSummary["informationAttenuationShadowAudit"]
    > = {
      shadow25: {
        avgSignal: shadow25Acc.count > 0 ? shadow25Acc.sum / shadow25Acc.count : null,
        positiveCount: shadow25Acc.positiveCount,
        negativeCount: shadow25Acc.negativeCount,
      },
      shadow50: {
        avgSignal: shadow50Acc.count > 0 ? shadow50Acc.sum / shadow50Acc.count : null,
        positiveCount: shadow50Acc.positiveCount,
        negativeCount: shadow50Acc.negativeCount,
      },
      shadow75: {
        avgSignal: shadow75Acc.count > 0 ? shadow75Acc.sum / shadow75Acc.count : null,
        positiveCount: shadow75Acc.positiveCount,
        negativeCount: shadow75Acc.negativeCount,
      },
      shadow100: {
        avgSignal: shadow100Acc.count > 0 ? shadow100Acc.sum / shadow100Acc.count : null,
        positiveCount: shadow100Acc.positiveCount,
        negativeCount: shadow100Acc.negativeCount,
      },
    };
    const informationAdjustmentDiagnostics: NonNullable<
      DashboardSummary["informationAdjustmentDiagnostics"]
    > = {
      avgDeltaPostMinusBase: execCount > 0 ? sumDelta / execCount : null,
      positiveDeltaCount,
      negativeDeltaCount,
      nearZeroDeltaCount,
      avgDeltaWhenBasePositive: countBasePositive > 0 ? sumDeltaWhenBasePositive / countBasePositive : null,
      avgDeltaWhenBaseNegative: countBaseNegative > 0 ? sumDeltaWhenBaseNegative / countBaseNegative : null,
      basePositiveToPostPositiveCount,
      basePositiveToPostNegativeCount,
      baseNegativeToPostNegativeCount,
      baseNegativeToPostPositiveCount,
    };
    const informationAdjustmentDecomposition: NonNullable<
      DashboardSummary["informationAdjustmentDecomposition"]
    > = {
      adjustmentValue: {
        avg: adjValAcc.count > 0 ? adjValAcc.sum / adjValAcc.count : null,
        min: adjValAcc.count > 0 ? adjValAcc.min : null,
        max: adjValAcc.count > 0 ? adjValAcc.max : null,
        positiveCount: adjValAcc.positiveCount,
        negativeCount: adjValAcc.negativeCount,
      },
      multiplierOrScaleIfExists: null,
      exposureOrModifierIfExists: {
        avg: exposureAcc.count > 0 ? exposureAcc.sum / exposureAcc.count : null,
        min: exposureAcc.count > 0 ? exposureAcc.min : null,
        max: exposureAcc.count > 0 ? exposureAcc.max : null,
        positiveCount: exposureAcc.positiveCount,
        negativeCount: exposureAcc.negativeCount,
      },
    };
    const informationAdjustmentFormulaAudit: NonNullable<
      DashboardSummary["informationAdjustmentFormulaAudit"]
    > = {
      formulaShape: "post = base + delta",
      terms: {
        baseSignal: {
          avg: compExtremes.baseSignal.count > 0 ? compExtremes.baseSignal.sum / compExtremes.baseSignal.count : null,
          min: compExtremes.baseSignal.count > 0 ? compExtremes.baseSignal.min : null,
          max: compExtremes.baseSignal.count > 0 ? compExtremes.baseSignal.max : null,
        },
        termA: {
          name: "delta",
          avg: adjValAcc.count > 0 ? adjValAcc.sum / adjValAcc.count : null,
          min: adjValAcc.count > 0 ? adjValAcc.min : null,
          max: adjValAcc.count > 0 ? adjValAcc.max : null,
          positiveCount: adjValAcc.positiveCount,
          negativeCount: adjValAcc.negativeCount,
        },
        termB: {
          name: "totalInfoContribution",
          avg: exposureAcc.count > 0 ? exposureAcc.sum / exposureAcc.count : null,
          min: exposureAcc.count > 0 ? exposureAcc.min : null,
          max: exposureAcc.count > 0 ? exposureAcc.max : null,
          positiveCount: exposureAcc.positiveCount,
          negativeCount: exposureAcc.negativeCount,
        },
        termC: null,
      },
    };
    const directionBiasDiagnosticsBySymbol: NonNullable<
      DashboardSummary["directionBiasDiagnosticsBySymbol"]
    > = {};
    for (const [sym, acc] of Object.entries(dirBiasBySym)) {
      directionBiasDiagnosticsBySymbol[sym] = {
        avgBaseSignal: acc.count > 0 ? acc.sumBaseSignal / acc.count : null,
        avgPostInformationSignal: acc.count > 0 ? acc.sumPostInformationSignal / acc.count : null,
        avgTechnicalContribution: acc.count > 0 ? acc.sumTechnicalContribution / acc.count : null,
        avgMacroContribution: acc.count > 0 ? acc.sumMacroContribution / acc.count : null,
        avgSentimentContribution: acc.count > 0 ? acc.sumSentimentContribution / acc.count : null,
        avgNoiseContribution: acc.count > 0 ? acc.sumNoiseContribution / acc.count : null,
        positiveSignalCount: acc.positiveSignalCount,
        negativeSignalCount: acc.negativeSignalCount,
        nearZeroSignalCount: acc.nearZeroSignalCount,
      };
    }
    const toCompRow = (a: CompExtremeAcc) => ({
      min: a.count > 0 ? a.min : null,
      max: a.count > 0 ? a.max : null,
      avg: a.count > 0 ? a.sum / a.count : null,
      positiveCount: a.positiveCount,
      negativeCount: a.negativeCount,
    });
    const totalInfoContributionAudit: NonNullable<
      DashboardSummary["totalInfoContributionAudit"]
    > = {
      formulaShape: "totalInfoContribution = technicalContribution + macroContribution + sentimentContribution + noiseContribution",
      components: [
        { name: "technicalContribution", ...toCompRow(compExtremes.technicalContribution) },
        { name: "macroContribution", ...toCompRow(compExtremes.macroContribution) },
        { name: "sentimentContribution", ...toCompRow(compExtremes.sentimentContribution) },
        { name: "noiseContribution", ...toCompRow(compExtremes.noiseContribution) },
      ],
    };
    const technicalContributionAudit: NonNullable<
      DashboardSummary["technicalContributionAudit"]
    > = {
      formulaShape: "technicalSignal = momentum * 0.4 + trend * 0.6",
      components: [
        { name: "momentum", ...toCompRow(momentumAcc) },
        { name: "trend", ...toCompRow(trendAcc) },
        { name: "technicalSignal", ...toCompRow(technicalSignalAcc) },
      ],
    };
    const trendAudit: NonNullable<DashboardSummary["trendAudit"]> = {
      formulaShape: "trend = clamp(priceVsMa20 * 2, -1, 1)",
      components: [{ name: "priceVsMa20", ...toCompRow(priceVsMa20Acc) }],
    };
    const totalSample = pvMa20PosCount + pvMa20NegCount;
    const totalRet5d = ret5dPosCount + ret5dNegCount;
    const totalFullPvMa20 = fullPvMa20Pos + fullPvMa20Neg;
    const totalFullRet5d = fullRet5dPos + fullRet5dNeg;
    const historyVsSampleRegimeAudit: NonNullable<DashboardSummary["historyVsSampleRegimeAudit"]> = {
      sampled: {
        priceVsMa20PositiveShare: totalSample > 0 ? pvMa20PosCount / totalSample : null,
        priceVsMa20NegativeShare: totalSample > 0 ? pvMa20NegCount / totalSample : null,
        return5dPositiveShare: totalRet5d > 0 ? ret5dPosCount / totalRet5d : null,
        return5dNegativeShare: totalRet5d > 0 ? ret5dNegCount / totalRet5d : null,
      },
      fullHistory: {
        priceVsMa20PositiveShare: totalFullPvMa20 > 0 ? fullPvMa20Pos / totalFullPvMa20 : null,
        priceVsMa20NegativeShare: totalFullPvMa20 > 0 ? fullPvMa20Neg / totalFullPvMa20 : null,
        return5dPositiveShare: totalFullRet5d > 0 ? fullRet5dPos / totalFullRet5d : null,
        return5dNegativeShare: totalFullRet5d > 0 ? fullRet5dNeg / totalFullRet5d : null,
      },
      bySymbol: {
        SPY: (() => {
          const sb = sampleBiasBySym["SPY"]!;
          const fb = fullHistoryBySym["SPY"]!;
          const st = sb.pvMa20Pos + sb.pvMa20Neg;
          const str = sb.ret5dPos + sb.ret5dNeg;
          const ft = fb.pvMa20Pos + fb.pvMa20Neg;
          const ftr = fb.ret5dPos + fb.ret5dNeg;
          return {
            sampledPriceVsMa20PositiveShare: st > 0 ? sb.pvMa20Pos / st : null,
            sampledPriceVsMa20NegativeShare: st > 0 ? sb.pvMa20Neg / st : null,
            fullHistoryPriceVsMa20PositiveShare: ft > 0 ? fb.pvMa20Pos / ft : null,
            fullHistoryPriceVsMa20NegativeShare: ft > 0 ? fb.pvMa20Neg / ft : null,
            sampledReturn5dPositiveShare: str > 0 ? sb.ret5dPos / str : null,
            sampledReturn5dNegativeShare: str > 0 ? sb.ret5dNeg / str : null,
            fullHistoryReturn5dPositiveShare: ftr > 0 ? fb.ret5dPos / ftr : null,
            fullHistoryReturn5dNegativeShare: ftr > 0 ? fb.ret5dNeg / ftr : null,
          };
        })(),
        QQQ: (() => {
          const sb = sampleBiasBySym["QQQ"]!;
          const fb = fullHistoryBySym["QQQ"]!;
          const st = sb.pvMa20Pos + sb.pvMa20Neg;
          const str = sb.ret5dPos + sb.ret5dNeg;
          const ft = fb.pvMa20Pos + fb.pvMa20Neg;
          const ftr = fb.ret5dPos + fb.ret5dNeg;
          return {
            sampledPriceVsMa20PositiveShare: st > 0 ? sb.pvMa20Pos / st : null,
            sampledPriceVsMa20NegativeShare: st > 0 ? sb.pvMa20Neg / st : null,
            fullHistoryPriceVsMa20PositiveShare: ft > 0 ? fb.pvMa20Pos / ft : null,
            fullHistoryPriceVsMa20NegativeShare: ft > 0 ? fb.pvMa20Neg / ft : null,
            sampledReturn5dPositiveShare: str > 0 ? sb.ret5dPos / str : null,
            sampledReturn5dNegativeShare: str > 0 ? sb.ret5dNeg / str : null,
            fullHistoryReturn5dPositiveShare: ftr > 0 ? fb.ret5dPos / ftr : null,
            fullHistoryReturn5dNegativeShare: ftr > 0 ? fb.ret5dNeg / ftr : null,
          };
        })(),
        IWM: (() => {
          const sb = sampleBiasBySym["IWM"]!;
          const fb = fullHistoryBySym["IWM"]!;
          const st = sb.pvMa20Pos + sb.pvMa20Neg;
          const str = sb.ret5dPos + sb.ret5dNeg;
          const ft = fb.pvMa20Pos + fb.pvMa20Neg;
          const ftr = fb.ret5dPos + fb.ret5dNeg;
          return {
            sampledPriceVsMa20PositiveShare: st > 0 ? sb.pvMa20Pos / st : null,
            sampledPriceVsMa20NegativeShare: st > 0 ? sb.pvMa20Neg / st : null,
            fullHistoryPriceVsMa20PositiveShare: ft > 0 ? fb.pvMa20Pos / ft : null,
            fullHistoryPriceVsMa20NegativeShare: ft > 0 ? fb.pvMa20Neg / ft : null,
            sampledReturn5dPositiveShare: str > 0 ? sb.ret5dPos / str : null,
            sampledReturn5dNegativeShare: str > 0 ? sb.ret5dNeg / str : null,
            fullHistoryReturn5dPositiveShare: ftr > 0 ? fb.ret5dPos / ftr : null,
            fullHistoryReturn5dNegativeShare: ftr > 0 ? fb.ret5dNeg / ftr : null,
          };
        })(),
      },
    };
    const sampleSourceAudit: NonNullable<DashboardSummary["sampleSourceAudit"]> = {
      sourceDescription:
        "Executed trade rows: backtest loop (index range, non-null features), direction LONG/SHORT, signal strength, conviction, neutral probability, and price validity filters.",
      rowCounts: {
        fullHistoryRowsConsidered: fullHistoryRowsConsidered,
        rowsAfterInitialSelection: loopIterationCount,
        rowsAfterFeatureAvailabilityFilter: featAvailableCount,
        rowsAfterRunOrSummaryFilter: totalSignals,
        rowsUsedForDirectionBiasDiagnostics: executedWithDecompCount,
        rowsUsedForDirectionMappingDiagnostics: featAvailableCount,
        executedTradeRowsIfRelevant: execCount,
      },
      filterStages: [
        { stage: "fullHistory", count: fullHistoryRowsConsidered, description: "All non-null features in featuresCache for SPY/QQQ/IWM" },
        { stage: "loopBounds", count: loopIterationCount, description: "Rows in backtest loop range (i from 5+NEUTRAL_LOOKBACK to closes.length-horizon)" },
        { stage: "featureAvailable", count: featAvailableCount, description: "Rows with non-null feat" },
        { stage: "hasDirection", count: totalSignals, description: "Rows with setup LONG or SHORT" },
        { stage: "passedSignalStrength", count: passedSignalStrength, description: "Rows passing signal strength threshold" },
        { stage: "passedConviction", count: passedConviction, description: "Rows passing conviction and neutral filters" },
        { stage: "directionBiasDiagnostics", count: executedWithDecompCount, description: "Rows reaching decomp block (used for direction bias)" },
        { stage: "executedTrades", count: execCount, description: "Final executed trade rows" },
      ],
      symbolCountsIfAvailable: {
        SPY: (() => {
          const sb = sampleBiasBySym["SPY"]!;
          const t = sb.pvMa20Pos + sb.pvMa20Neg;
          return t > 0 ? t : null;
        })(),
        QQQ: (() => {
          const sb = sampleBiasBySym["QQQ"]!;
          const t = sb.pvMa20Pos + sb.pvMa20Neg;
          return t > 0 ? t : null;
        })(),
        IWM: (() => {
          const sb = sampleBiasBySym["IWM"]!;
          const t = sb.pvMa20Pos + sb.pvMa20Neg;
          return t > 0 ? t : null;
        })(),
      },
    };
    const sampleSelectionBiasAudit: NonNullable<DashboardSummary["sampleSelectionBiasAudit"]> = {
      priceVsMa20SignShare: {
        positiveCount: pvMa20PosCount,
        negativeCount: pvMa20NegCount,
        positiveShare: totalSample > 0 ? pvMa20PosCount / totalSample : null,
        negativeShare: totalSample > 0 ? pvMa20NegCount / totalSample : null,
      },
      return5dSignShare: {
        positiveCount: ret5dPosCount,
        negativeCount: ret5dNegCount,
        positiveShare: totalRet5d > 0 ? ret5dPosCount / totalRet5d : null,
        negativeShare: totalRet5d > 0 ? ret5dNegCount / totalRet5d : null,
      },
      bySymbol: {
        SPY: (() => {
          const sb = sampleBiasBySym["SPY"]!;
          const t = sb.pvMa20Pos + sb.pvMa20Neg;
          const tr = sb.ret5dPos + sb.ret5dNeg;
          return {
            priceVsMa20PositiveShare: t > 0 ? sb.pvMa20Pos / t : null,
            priceVsMa20NegativeShare: t > 0 ? sb.pvMa20Neg / t : null,
            return5dPositiveShare: tr > 0 ? sb.ret5dPos / tr : null,
            return5dNegativeShare: tr > 0 ? sb.ret5dNeg / tr : null,
          };
        })(),
        QQQ: (() => {
          const sb = sampleBiasBySym["QQQ"]!;
          const t = sb.pvMa20Pos + sb.pvMa20Neg;
          const tr = sb.ret5dPos + sb.ret5dNeg;
          return {
            priceVsMa20PositiveShare: t > 0 ? sb.pvMa20Pos / t : null,
            priceVsMa20NegativeShare: t > 0 ? sb.pvMa20Neg / t : null,
            return5dPositiveShare: tr > 0 ? sb.ret5dPos / tr : null,
            return5dNegativeShare: tr > 0 ? sb.ret5dNeg / tr : null,
          };
        })(),
        IWM: (() => {
          const sb = sampleBiasBySym["IWM"]!;
          const t = sb.pvMa20Pos + sb.pvMa20Neg;
          const tr = sb.ret5dPos + sb.ret5dNeg;
          return {
            priceVsMa20PositiveShare: t > 0 ? sb.pvMa20Pos / t : null,
            priceVsMa20NegativeShare: t > 0 ? sb.pvMa20Neg / t : null,
            return5dPositiveShare: tr > 0 ? sb.ret5dPos / tr : null,
            return5dNegativeShare: tr > 0 ? sb.ret5dNeg / tr : null,
          };
        })(),
      },
    };
    const momentumAudit: NonNullable<DashboardSummary["momentumAudit"]> = {
      formulaShape: "return5d = (price - prevClose5) / prevClose5; momentum = clamp(return5d * 2, -1, 1)",
      inputs: {
        currentPriceIfExists:
          priceAcc.count > 0
            ? {
                name: "price",
                avg: priceAcc.sum / priceAcc.count,
                min: priceAcc.min,
                max: priceAcc.max,
              }
            : null,
        referencePriceIfExists:
          prevClose5Acc.count > 0
            ? {
                name: "prevClose5",
                avg: prevClose5Acc.sum / prevClose5Acc.count,
                min: prevClose5Acc.min,
                max: prevClose5Acc.max,
              }
            : null,
        rawDifferenceIfExists: {
          name: "price - prevClose5",
          avg: momentumRawDiffAcc.count > 0 ? momentumRawDiffAcc.sum / momentumRawDiffAcc.count : null,
          min: momentumRawDiffAcc.count > 0 ? momentumRawDiffAcc.min : null,
          max: momentumRawDiffAcc.count > 0 ? momentumRawDiffAcc.max : null,
          positiveCount: momentumRawDiffAcc.positiveCount,
          negativeCount: momentumRawDiffAcc.negativeCount,
        },
        normalizedValueIfExists: {
          name: "return5d",
          avg: return5dAcc.count > 0 ? return5dAcc.sum / return5dAcc.count : null,
          min: return5dAcc.count > 0 ? return5dAcc.min : null,
          max: return5dAcc.count > 0 ? return5dAcc.max : null,
          positiveCount: return5dAcc.positiveCount,
          negativeCount: return5dAcc.negativeCount,
        },
      },
    };
    const priceVsMa20Audit: NonNullable<DashboardSummary["priceVsMa20Audit"]> = {
      formulaShape: "priceVsMa20 = (price - ma20) / ma20",
      inputs: {
        price:
          priceAcc.count > 0
            ? {
                avg: priceAcc.sum / priceAcc.count,
                min: priceAcc.min,
                max: priceAcc.max,
              }
            : null,
        ma20:
          ma20Acc.count > 0
            ? {
                avg: ma20Acc.sum / ma20Acc.count,
                min: ma20Acc.min,
                max: ma20Acc.max,
              }
            : null,
        rawDifferenceIfExists: {
          name: "price - ma20",
          avg: rawDiffAcc.count > 0 ? rawDiffAcc.sum / rawDiffAcc.count : null,
          min: rawDiffAcc.count > 0 ? rawDiffAcc.min : null,
          max: rawDiffAcc.count > 0 ? rawDiffAcc.max : null,
          positiveCount: rawDiffAcc.positiveCount,
          negativeCount: rawDiffAcc.negativeCount,
        },
        normalizedValueIfExists: {
          name: "priceVsMa20",
          avg: priceVsMa20Acc.count > 0 ? priceVsMa20Acc.sum / priceVsMa20Acc.count : null,
          min: priceVsMa20Acc.count > 0 ? priceVsMa20Acc.min : null,
          max: priceVsMa20Acc.count > 0 ? priceVsMa20Acc.max : null,
          positiveCount: priceVsMa20Acc.positiveCount,
          negativeCount: priceVsMa20Acc.negativeCount,
        },
      },
    };
    const directionBiasComponentExtremes: NonNullable<
      DashboardSummary["directionBiasComponentExtremes"]
    > = {
      baseSignal: toCompRow(compExtremes.baseSignal),
      postInformationSignal: toCompRow(compExtremes.postInformationSignal),
      technicalContribution: toCompRow(compExtremes.technicalContribution),
      macroContribution: toCompRow(compExtremes.macroContribution),
      sentimentContribution: toCompRow(compExtremes.sentimentContribution),
      noiseContribution: toCompRow(compExtremes.noiseContribution),
    };
    const nTf = agents.filter((a) => a.type === "trendFollower").length || 1;
    const nContr = agents.filter((a) => a.type === "contrarian").length || 1;
    const nBal = agents.filter((a) => a.type === "balanced").length || 1;
    const directionBiasByAgentType: NonNullable<DashboardSummary["directionBiasByAgentType"]> = {
      trendFollower: {
        avgSignal: execCount > 0 && nTf > 0 ? byTypeSums.trendFollower.sumSignal / (execCount * nTf) : 0,
        positiveCount: byTypeSums.trendFollower.positiveCount,
        negativeCount: byTypeSums.trendFollower.negativeCount,
      },
      contrarian: {
        avgSignal: execCount > 0 && nContr > 0 ? byTypeSums.contrarian.sumSignal / (execCount * nContr) : 0,
        positiveCount: byTypeSums.contrarian.positiveCount,
        negativeCount: byTypeSums.contrarian.negativeCount,
      },
      balanced: {
        avgSignal: execCount > 0 && nBal > 0 ? byTypeSums.balanced.sumSignal / (execCount * nBal) : 0,
        positiveCount: byTypeSums.balanced.positiveCount,
        negativeCount: byTypeSums.balanced.negativeCount,
      },
    };
    const decisionFunnelDiagnostics: NonNullable<DashboardSummary["decisionFunnelDiagnostics"]> = {
      totalSignals,
      passedSignalStrength,
      passedConviction,
      passedFinalDecision,
      signalStrengthPassRate: totalSignals > 0 ? passedSignalStrength / totalSignals : 0,
      convictionPassRate: passedSignalStrength > 0 ? passedConviction / passedSignalStrength : 0,
      executionRate: passedConviction > 0 ? passedFinalDecision / passedConviction : 0,
    };

    const sortedMeanSignals = [...meanSignalsForMedian].sort((a, b) => a - b);
    const mid = sortedMeanSignals.length >> 1;
    const avgAgentSignalMedian =
      sortedMeanSignals.length > 0
        ? sortedMeanSignals.length % 2 === 1
          ? sortedMeanSignals[mid]!
          : (sortedMeanSignals[mid - 1]! + sortedMeanSignals[mid]!) / 2
        : 0;

    const aggregationDiagnostics: NonNullable<DashboardSummary["aggregationDiagnostics"]> = {
      avgAgentSignalMean: meanSignalCount > 0 ? sumMeanSignal / meanSignalCount : 0,
      avgAgentSignalMedian,
      avgFinalAggregatedSignal: meanSignalCount > 0 ? sumMeanSignal / meanSignalCount : 0,
      avgPositiveAgentShare:
        executedWithDecompCount > 0 ? sumPositiveAgentShare / executedWithDecompCount : 0,
      avgNegativeAgentShare:
        executedWithDecompCount > 0 ? sumNegativeAgentShare / executedWithDecompCount : 0,
      aggregatedPositiveCount,
      aggregatedNegativeCount,
      aggregatedNearZeroCount,
      totalAgents: agents.length,
      sumScore: aggSumScore,
      positiveScore: aggPositiveScore,
      negativeScore: aggNegativeScore,
      zeroScore: aggZeroScore,
      positiveCount: aggPositiveCount,
      negativeCount: aggNegativeCount,
      zeroCount: aggZeroCount,
      weightedPositive: aggWeightedPositive,
      weightedNegative: aggWeightedNegative,
      sample: aggSample,
    };

    const buildSideAcceptance = (s: {
      preMappingCount: number;
      passedSignalThresholdCount: number;
      failedSignalThresholdCount: number;
      passedConvictionCount: number;
      failedConvictionCount: number;
      finalAcceptedCount: number;
    }): NonNullable<DashboardSummary["directionMappingDiagnostics"]>["acceptanceBySide"]["LONG"] => ({
      preMappingCount: s.preMappingCount,
      passedSignalThresholdCount: s.passedSignalThresholdCount,
      failedSignalThresholdCount: s.failedSignalThresholdCount,
      passedConvictionCount: s.passedConvictionCount,
      failedConvictionCount: s.failedConvictionCount,
      finalAcceptedCount: s.finalAcceptedCount,
      acceptanceRateFromPreMapping:
        s.preMappingCount > 0 ? s.finalAcceptedCount / s.preMappingCount : 0,
      acceptanceRateAfterThreshold:
        s.passedSignalThresholdCount > 0
          ? s.finalAcceptedCount / s.passedSignalThresholdCount
          : 0,
    });

    const symbolDirectionAcceptance: NonNullable<
      DashboardSummary["directionMappingDiagnostics"]
    >["symbolDirectionAcceptance"] = {};
    for (const [k, v] of Object.entries(symAcc)) {
      symbolDirectionAcceptance[k] = {
        preMappingLongCount: v.preMappingLongCount,
        preMappingShortCount: v.preMappingShortCount,
        finalLongCount: v.finalLongCount,
        finalShortCount: v.finalShortCount,
        avgLongSignal: v.nPreLong > 0 ? v.sumLongSignal / v.nPreLong : null,
        avgShortSignal: v.nPreShort > 0 ? v.sumShortSignal / v.nPreShort : null,
        avgLongConviction: v.nPreLong > 0 ? v.sumLongConviction / v.nPreLong : null,
        avgShortConviction: v.nPreShort > 0 ? v.sumShortConviction / v.nPreShort : null,
      };
    }

    const directionMappingDiagnostics: NonNullable<DashboardSummary["directionMappingDiagnostics"]> = {
      longConditionCount,
      shortConditionCount,
      noneConditionCount,
      longThresholdUsed: signalStrengthThreshold,
      shortThresholdUsed: signalStrengthThreshold,
      convictionThresholdUsed: convictionThreshold,
      finalScore: meanSignalCount > 0 ? sumMeanSignal / meanSignalCount : 0,
      positiveScore: aggPositiveScore,
      negativeScore: aggNegativeScore,
      positiveCount: aggPositiveCount,
      negativeCount: aggNegativeCount,
      weightedPositive: aggWeightedPositive,
      weightedNegative: aggWeightedNegative,
      preMappingLongCount,
      preMappingShortCount,
      preMappingNeutralCount,
      finalDirectionLongCount: longConditionCount,
      finalDirectionShortCount: shortConditionCount,
      finalDirectionNoneCount: noneConditionCount,
      sampleLongCandidatesRejected: sampleLongRejected,
      sampleShortCandidatesRejected: sampleShortRejected,
      sampleLongCandidatesAccepted: sampleLongAccepted,
      sampleShortCandidatesAccepted: sampleShortAccepted,
      sampleMappings: directionMappingSamples,
      acceptanceBySide: {
        LONG: buildSideAcceptance(acceptLong),
        SHORT: buildSideAcceptance(acceptShort),
      },
      signalBucketDiagnostics: signalBuckets,
      symbolDirectionAcceptance,
      rejectionReasonSummary: {
        rejectedLongBelowSignalThreshold,
        rejectedLongBelowConvictionThreshold,
        rejectedShortBelowSignalThreshold,
        rejectedShortBelowConvictionThreshold,
      },
    };

    const emptyDirectionBias: NonNullable<DashboardSummary["directionBiasDiagnostics"]> = {
      avgBaseSignal: 0,
      avgPostInformationSignal: 0,
      avgTechnicalContribution: 0,
      avgMacroContribution: 0,
      avgSentimentContribution: 0,
      avgNoiseContribution: 0,
      positiveSignalCount: 0,
      negativeSignalCount: 0,
      nearZeroSignalCount: 0,
    };
    const emptyDirectionBiasByType: NonNullable<DashboardSummary["directionBiasByAgentType"]> = {
      trendFollower: { avgSignal: 0, positiveCount: 0, negativeCount: 0 },
      contrarian: { avgSignal: 0, positiveCount: 0, negativeCount: 0 },
      balanced: { avgSignal: 0, positiveCount: 0, negativeCount: 0 },
    };
    const emptyDirBiasBySym: NonNullable<DashboardSummary["directionBiasDiagnosticsBySymbol"]> = {};
    const emptyRow = {
      avgBaseSignal: null as number | null,
      avgPostInformationSignal: null as number | null,
      avgTechnicalContribution: null as number | null,
      avgMacroContribution: null as number | null,
      avgSentimentContribution: null as number | null,
      avgNoiseContribution: null as number | null,
      positiveSignalCount: 0,
      negativeSignalCount: 0,
      nearZeroSignalCount: 0,
    };
    for (const s of ["SPY", "QQQ", "IWM"]) emptyDirBiasBySym[s] = { ...emptyRow };
    const emptyCompRow = {
      min: null as number | null,
      max: null as number | null,
      avg: null as number | null,
      positiveCount: 0,
      negativeCount: 0,
    };
    const emptyDirectionBiasComponentExtremes: NonNullable<
      DashboardSummary["directionBiasComponentExtremes"]
    > = {
      baseSignal: { ...emptyCompRow },
      postInformationSignal: { ...emptyCompRow },
      technicalContribution: { ...emptyCompRow },
      macroContribution: { ...emptyCompRow },
      sentimentContribution: { ...emptyCompRow },
      noiseContribution: { ...emptyCompRow },
    };

    if (tradeReturns.length === 0) {
      return {
        trades: 0,
        winRate: null,
        avgTradeReturn: null,
        cumulativeReturn: null,
        benchmarkReturn: null,
        edge: null,
        maxDrawdown: null,
        backtestMeasurementDiagnostics: {
          avgStrategyReturn: null,
          avgBenchmarkReturn: null,
          cumulativeStrategyReturn: null,
          cumulativeBenchmarkReturn: null,
          comparedTradeWindows: 0,
        },
        tradeDirectionDiagnostics: emptyDirectionDiag,
        decisionFunnelDiagnostics,
        directionBiasDiagnostics: emptyDirectionBias,
        directionBiasDiagnosticsPreFilter: {
          avgBaseSignal: null,
          avgPostInformationSignal: null,
          avgTechnicalContribution: null,
          avgMacroContribution: null,
          avgSentimentContribution: null,
          avgNoiseContribution: null,
          positiveSignalCount: 0,
          negativeSignalCount: 0,
          nearZeroSignalCount: 0,
        },
        directionBiasDiagnosticsPostFilter: {
          avgBaseSignal: null,
          avgPostInformationSignal: null,
          avgTechnicalContribution: null,
          avgMacroContribution: null,
          avgSentimentContribution: null,
          avgNoiseContribution: null,
          positiveSignalCount: 0,
          negativeSignalCount: 0,
          nearZeroSignalCount: 0,
        },
        directionBiasPopulationComparison: {
          preFilterRowCount: null,
          postFilterRowCount: null,
          preFilterPositiveShare: null,
          preFilterNegativeShare: null,
          postFilterPositiveShare: null,
          postFilterNegativeShare: null,
        },
        directionBiasDiagnosticsBySymbol: emptyDirBiasBySym,
        directionBiasComponentExtremes: emptyDirectionBiasComponentExtremes,
        informationAdjustmentDiagnostics: {
          avgDeltaPostMinusBase: null,
          positiveDeltaCount: 0,
          negativeDeltaCount: 0,
          nearZeroDeltaCount: 0,
          avgDeltaWhenBasePositive: null,
          avgDeltaWhenBaseNegative: null,
          basePositiveToPostPositiveCount: 0,
          basePositiveToPostNegativeCount: 0,
          baseNegativeToPostNegativeCount: 0,
          baseNegativeToPostPositiveCount: 0,
        },
        informationAttenuationShadowAudit: {
          shadow25: { avgSignal: null, positiveCount: 0, negativeCount: 0 },
          shadow50: { avgSignal: null, positiveCount: 0, negativeCount: 0 },
          shadow75: { avgSignal: null, positiveCount: 0, negativeCount: 0 },
          shadow100: { avgSignal: null, positiveCount: 0, negativeCount: 0 },
        },
        informationAdjustmentDecomposition: {
          adjustmentValue: { avg: null, min: null, max: null, positiveCount: 0, negativeCount: 0 },
          multiplierOrScaleIfExists: null,
          exposureOrModifierIfExists: { avg: null, min: null, max: null, positiveCount: 0, negativeCount: 0 },
        },
        informationAdjustmentFormulaAudit: {
          formulaShape: "post = base + delta",
          terms: {
            baseSignal: { avg: null, min: null, max: null },
            termA: null,
            termB: null,
            termC: null,
          },
        },
        totalInfoContributionAudit: {
          formulaShape: "totalInfoContribution = technicalContribution + macroContribution + sentimentContribution + noiseContribution",
          components: [],
        },
        technicalContributionAudit: {
          formulaShape: "technicalSignal = momentum * 0.4 + trend * 0.6",
          components: [],
        },
        trendAudit: {
          formulaShape: "trend = clamp(priceVsMa20 * 2, -1, 1)",
          components: [],
        },
        priceVsMa20Audit: {
          formulaShape: "priceVsMa20 = (price - ma20) / ma20",
          inputs: { price: null, ma20: null, rawDifferenceIfExists: null, normalizedValueIfExists: null },
        },
        momentumAudit: {
          formulaShape: "return5d = (price - prevClose5) / prevClose5; momentum = clamp(return5d * 2, -1, 1)",
          inputs: {
            currentPriceIfExists: null,
            referencePriceIfExists: null,
            rawDifferenceIfExists: null,
            normalizedValueIfExists: null,
          },
        },
        sampleSelectionBiasAudit: {
          priceVsMa20SignShare: { positiveCount: 0, negativeCount: 0, positiveShare: null, negativeShare: null },
          return5dSignShare: { positiveCount: 0, negativeCount: 0, positiveShare: null, negativeShare: null },
          bySymbol: {
            SPY: { priceVsMa20PositiveShare: null, priceVsMa20NegativeShare: null, return5dPositiveShare: null, return5dNegativeShare: null },
            QQQ: { priceVsMa20PositiveShare: null, priceVsMa20NegativeShare: null, return5dPositiveShare: null, return5dNegativeShare: null },
            IWM: { priceVsMa20PositiveShare: null, priceVsMa20NegativeShare: null, return5dPositiveShare: null, return5dNegativeShare: null },
          },
        },
        historyVsSampleRegimeAudit: {
          sampled: { priceVsMa20PositiveShare: null, priceVsMa20NegativeShare: null, return5dPositiveShare: null, return5dNegativeShare: null },
          fullHistory: { priceVsMa20PositiveShare: null, priceVsMa20NegativeShare: null, return5dPositiveShare: null, return5dNegativeShare: null },
          bySymbol: {
            SPY: { sampledPriceVsMa20PositiveShare: null, sampledPriceVsMa20NegativeShare: null, fullHistoryPriceVsMa20PositiveShare: null, fullHistoryPriceVsMa20NegativeShare: null, sampledReturn5dPositiveShare: null, sampledReturn5dNegativeShare: null, fullHistoryReturn5dPositiveShare: null, fullHistoryReturn5dNegativeShare: null },
            QQQ: { sampledPriceVsMa20PositiveShare: null, sampledPriceVsMa20NegativeShare: null, fullHistoryPriceVsMa20PositiveShare: null, fullHistoryPriceVsMa20NegativeShare: null, sampledReturn5dPositiveShare: null, sampledReturn5dNegativeShare: null, fullHistoryReturn5dPositiveShare: null, fullHistoryReturn5dNegativeShare: null },
            IWM: { sampledPriceVsMa20PositiveShare: null, sampledPriceVsMa20NegativeShare: null, fullHistoryPriceVsMa20PositiveShare: null, fullHistoryPriceVsMa20NegativeShare: null, sampledReturn5dPositiveShare: null, sampledReturn5dNegativeShare: null, fullHistoryReturn5dPositiveShare: null, fullHistoryReturn5dNegativeShare: null },
          },
        },
        sampleSourceAudit: {
          sourceDescription: "Executed trade rows: backtest loop (index range, non-null features), direction LONG/SHORT, signal strength, conviction, neutral probability, and price validity filters.",
          rowCounts: {
            fullHistoryRowsConsidered: fullHistoryRowsConsidered,
            rowsAfterInitialSelection: loopIterationCount,
            rowsAfterFeatureAvailabilityFilter: featAvailableCount,
            rowsAfterRunOrSummaryFilter: totalSignals,
            rowsUsedForDirectionBiasDiagnostics: executedWithDecompCount,
            rowsUsedForDirectionMappingDiagnostics: featAvailableCount,
            executedTradeRowsIfRelevant: execCount,
          },
          filterStages: [
            { stage: "fullHistory", count: fullHistoryRowsConsidered, description: "All non-null features in featuresCache for SPY/QQQ/IWM" },
            { stage: "loopBounds", count: loopIterationCount, description: "Rows in backtest loop range" },
            { stage: "featureAvailable", count: featAvailableCount, description: "Rows with non-null feat" },
            { stage: "hasDirection", count: totalSignals, description: "Rows with setup LONG or SHORT" },
            { stage: "passedSignalStrength", count: passedSignalStrength, description: "Rows passing signal strength threshold" },
            { stage: "passedConviction", count: passedConviction, description: "Rows passing conviction and neutral filters" },
            { stage: "directionBiasDiagnostics", count: executedWithDecompCount, description: "Rows reaching decomp block" },
            { stage: "executedTrades", count: execCount, description: "Final executed trade rows" },
          ],
          symbolCountsIfAvailable: { SPY: null, QQQ: null, IWM: null },
        },
        directionBiasByAgentType: emptyDirectionBiasByType,
        directionBiasSamples: [],
        aggregationDiagnostics,
        directionMappingDiagnostics,
        setupDirectionAudit: {
          sourceDescription: "Rows with non-null features evaluated for setup; setup assigned from meanSignal vs directionThreshold before conviction/neutral/execution filters.",
          rowCounts: {
            featureAvailableRows: featAvailableCount,
            rowsEvaluatedForSetup: featAvailableCount,
            longSetupCount: longConditionCount,
            shortSetupCount: shortConditionCount,
            noneSetupCount: noneConditionCount,
          },
          bySymbol: {
            SPY: { longSetupCount: symAcc["SPY"]?.finalLongCount ?? 0, shortSetupCount: symAcc["SPY"]?.finalShortCount ?? 0, noneSetupCount: symAcc["SPY"]?.finalNoneCount ?? 0 },
            QQQ: { longSetupCount: symAcc["QQQ"]?.finalLongCount ?? 0, shortSetupCount: symAcc["QQQ"]?.finalShortCount ?? 0, noneSetupCount: symAcc["QQQ"]?.finalNoneCount ?? 0 },
            IWM: { longSetupCount: symAcc["IWM"]?.finalLongCount ?? 0, shortSetupCount: symAcc["IWM"]?.finalShortCount ?? 0, noneSetupCount: symAcc["IWM"]?.finalNoneCount ?? 0 },
          },
          sampleLongSetups,
          sampleShortSetups,
          sampleNoneSetups,
        },
      };
    }

    const trades = tradeReturns.length;
    const wins = tradeReturns.filter((r) => r > 0).length;
    const winRate = trades > 0 ? wins / trades : null;
    const avgStrategyReturn = tradeReturns.reduce((a, b) => a + b, 0) / tradeReturns.length;
    const avgBenchmarkReturn =
      benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length;
    const cumulativeStrategyReturn = tradeReturns.reduce((a, b) => a + b, 0);
    const cumulativeBenchmarkReturn = benchmarkReturns.reduce((a, b) => a + b, 0);
    const benchmarkReturn = cumulativeBenchmarkReturn;
    const cumulativeReturn = cumulativeStrategyReturn;
    const edge = cumulativeStrategyReturn - cumulativeBenchmarkReturn;

    let equity = 1;
    let peak = 1;
    let maxDrawdown = 0;
    for (const r of tradeReturns) {
      equity *= 1 + r;
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? (peak - equity) / peak : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const tradeDirectionDiagnostics: NonNullable<DashboardSummary["tradeDirectionDiagnostics"]> = {
      executedLongTrades,
      executedShortTrades,
      longShare: totalExecuted > 0 ? executedLongTrades / totalExecuted : null,
      shortShare: totalExecuted > 0 ? executedShortTrades / totalExecuted : null,
      sampleTradeDirections,
    };

    const setupDirectionAudit: NonNullable<DashboardSummary["setupDirectionAudit"]> = {
      sourceDescription: "Rows with non-null features evaluated for setup; setup assigned from meanSignal vs directionThreshold before conviction/neutral/execution filters.",
      rowCounts: {
        featureAvailableRows: featAvailableCount,
        rowsEvaluatedForSetup: featAvailableCount,
        longSetupCount: longConditionCount,
        shortSetupCount: shortConditionCount,
        noneSetupCount: noneConditionCount,
      },
      bySymbol: {
        SPY: { longSetupCount: symAcc["SPY"]?.finalLongCount ?? 0, shortSetupCount: symAcc["SPY"]?.finalShortCount ?? 0, noneSetupCount: symAcc["SPY"]?.finalNoneCount ?? 0 },
        QQQ: { longSetupCount: symAcc["QQQ"]?.finalLongCount ?? 0, shortSetupCount: symAcc["QQQ"]?.finalShortCount ?? 0, noneSetupCount: symAcc["QQQ"]?.finalNoneCount ?? 0 },
        IWM: { longSetupCount: symAcc["IWM"]?.finalLongCount ?? 0, shortSetupCount: symAcc["IWM"]?.finalShortCount ?? 0, noneSetupCount: symAcc["IWM"]?.finalNoneCount ?? 0 },
      },
      sampleLongSetups,
      sampleShortSetups,
      sampleNoneSetups,
    };

    return {
      trades,
      winRate,
      avgTradeReturn: avgStrategyReturn,
      cumulativeReturn,
      benchmarkReturn,
      edge,
      maxDrawdown,
      backtestMeasurementDiagnostics: {
        avgStrategyReturn,
        avgBenchmarkReturn,
        cumulativeStrategyReturn,
        cumulativeBenchmarkReturn,
        comparedTradeWindows: trades,
      },
      tradeDirectionDiagnostics,
      decisionFunnelDiagnostics,
      directionBiasDiagnostics,
      directionBiasDiagnosticsPreFilter,
      directionBiasDiagnosticsPostFilter,
      directionBiasPopulationComparison,
      informationAdjustmentDiagnostics,
      informationAttenuationShadowAudit,
      informationAdjustmentDecomposition,
      informationAdjustmentFormulaAudit,
      totalInfoContributionAudit,
      technicalContributionAudit,
      trendAudit,
      priceVsMa20Audit,
      momentumAudit,
      sampleSelectionBiasAudit,
      historyVsSampleRegimeAudit,
      sampleSourceAudit,
      directionBiasDiagnosticsBySymbol,
      directionBiasComponentExtremes,
      directionBiasByAgentType,
      directionBiasSamples,
      aggregationDiagnostics,
      directionMappingDiagnostics,
      setupDirectionAudit,
    };
  }

  /** Run backtest + calibration sweep. Fetches price data once, reuses for all runs. Uses profile-based aggregation. */
  private async computeBacktestAndCalibration(
    symbols: string[],
  ): Promise<{
    backtestMetrics: NonNullable<DashboardSummary["backtestMetrics"]>;
    backtestDiagnostics: DashboardSummary["backtestDiagnostics"];
    calibrationSweep: NonNullable<DashboardSummary["calibrationSweep"]>;
    agentProfileDiagnostics: NonNullable<DashboardSummary["agentProfileDiagnostics"]>;
    historicalSignalDiagnostics: NonNullable<DashboardSummary["historicalSignalDiagnostics"]>;
    runtimeWiringDiagnostics: NonNullable<DashboardSummary["runtimeWiringDiagnostics"]>;
    backtestMeasurementDiagnostics: NonNullable<DashboardSummary["backtestMeasurementDiagnostics"]>;
    tradeDirectionDiagnostics: NonNullable<DashboardSummary["tradeDirectionDiagnostics"]>;
    calibrationDirectionSummary: NonNullable<DashboardSummary["calibrationDirectionSummary"]>;
    informationExposureDiagnostics: NonNullable<DashboardSummary["informationExposureDiagnostics"]>;
    convictionDiagnostics: NonNullable<DashboardSummary["convictionDiagnostics"]>;
    decisionFunnelDiagnostics: NonNullable<DashboardSummary["decisionFunnelDiagnostics"]>;
    informationDiagnostics: NonNullable<DashboardSummary["informationDiagnostics"]>;
    directionBiasDiagnostics: NonNullable<DashboardSummary["directionBiasDiagnostics"]>;
    directionBiasDiagnosticsPreFilter: NonNullable<DashboardSummary["directionBiasDiagnosticsPreFilter"]>;
    directionBiasDiagnosticsPostFilter: NonNullable<DashboardSummary["directionBiasDiagnosticsPostFilter"]>;
    directionBiasPopulationComparison: NonNullable<DashboardSummary["directionBiasPopulationComparison"]>;
    directionBiasDiagnosticsBySymbol: NonNullable<DashboardSummary["directionBiasDiagnosticsBySymbol"]>;
    directionBiasComponentExtremes: NonNullable<DashboardSummary["directionBiasComponentExtremes"]>;
    informationAdjustmentDiagnostics: NonNullable<DashboardSummary["informationAdjustmentDiagnostics"]>;
    informationAttenuationShadowAudit: NonNullable<DashboardSummary["informationAttenuationShadowAudit"]>;
    informationAdjustmentDecomposition: NonNullable<DashboardSummary["informationAdjustmentDecomposition"]>;
    informationAdjustmentFormulaAudit: NonNullable<DashboardSummary["informationAdjustmentFormulaAudit"]>;
    totalInfoContributionAudit: NonNullable<DashboardSummary["totalInfoContributionAudit"]>;
    technicalContributionAudit: NonNullable<DashboardSummary["technicalContributionAudit"]>;
    trendAudit: NonNullable<DashboardSummary["trendAudit"]>;
    priceVsMa20Audit: NonNullable<DashboardSummary["priceVsMa20Audit"]>;
    momentumAudit: NonNullable<DashboardSummary["momentumAudit"]>;
    sampleSelectionBiasAudit: NonNullable<DashboardSummary["sampleSelectionBiasAudit"]>;
    historyVsSampleRegimeAudit: NonNullable<DashboardSummary["historyVsSampleRegimeAudit"]>;
    sampleSourceAudit: NonNullable<DashboardSummary["sampleSourceAudit"]>;
    directionBiasByAgentType: NonNullable<DashboardSummary["directionBiasByAgentType"]>;
    directionBiasSamples: NonNullable<DashboardSummary["directionBiasSamples"]>;
    aggregationDiagnostics: NonNullable<DashboardSummary["aggregationDiagnostics"]>;
    directionMappingDiagnostics: NonNullable<DashboardSummary["directionMappingDiagnostics"]>;
    setupDirectionAudit: NonNullable<DashboardSummary["setupDirectionAudit"]>;
  }> {
    const cachedData = await this.fetchCachedPriceData(symbols);
    const featuresCache = this.buildFeaturesCache(cachedData);
    const agents = generateAgentProfiles(AGENT_PROFILE_SEED, NUM_AGENTS);

    const agentProfileDiagnostics: NonNullable<DashboardSummary["agentProfileDiagnostics"]> = {
      agentCount: agents.length,
      typeCounts: {
        trendFollower: agents.filter((a) => a.type === "trendFollower").length,
        contrarian: agents.filter((a) => a.type === "contrarian").length,
        balanced: agents.filter((a) => a.type === "balanced").length,
      },
      sampleAgents: agents.slice(0, 5).map((a) => ({
        type: a.type,
        momentumSensitivity: a.sensitivity.momentum,
        trendSensitivity: a.sensitivity.trend,
        volatilitySensitivity: a.sensitivity.volatility,
        bullishBias: a.bias.bullishBias,
        contrarianFactor: a.bias.contrarianFactor,
      })),
    };

    const informationExposureDiagnostics: NonNullable<DashboardSummary["informationExposureDiagnostics"]> = {
      avgTechnicalWeight:
        agents.reduce((s, a) => s + a.informationProfile.technicalWeight, 0) / agents.length,
      avgMacroWeight:
        agents.reduce((s, a) => s + a.informationProfile.macroWeight, 0) / agents.length,
      avgSentimentWeight:
        agents.reduce((s, a) => s + a.informationProfile.sentimentWeight, 0) / agents.length,
      avgNoiseWeight:
        agents.reduce((s, a) => s + a.informationProfile.noiseWeight, 0) / agents.length,
      sampleAgents: agents.slice(0, 5).map((a) => ({
        technicalWeight: a.informationProfile.technicalWeight,
        macroWeight: a.informationProfile.macroWeight,
        sentimentWeight: a.informationProfile.sentimentWeight,
        noiseWeight: a.informationProfile.noiseWeight,
        attentionSpan: a.informationProfile.attentionSpan,
        trustDecay: a.informationProfile.trustDecay,
      })),
    };

    const informationDiagnostics: NonNullable<DashboardSummary["informationDiagnostics"]> = {
      avgRecencySensitivity:
        agents.reduce((s, a) => s + a.informationProfile.recencySensitivity, 0) / agents.length,
      avgTechnicalWeight:
        agents.reduce((s, a) => s + a.informationProfile.technicalWeight, 0) / agents.length,
      avgSentimentWeight:
        agents.reduce((s, a) => s + a.informationProfile.sentimentWeight, 0) / agents.length,
    };

    const defaultMetrics = this.runBacktestWithThresholds(
      cachedData,
      featuresCache,
      agents,
      {
        signalStrengthThreshold: DashboardService.SIGNAL_STRENGTH_MIN,
        convictionThreshold: DashboardService.LOCAL_CONVICTION_MIN,
        neutralThreshold: DashboardService.PROBABILITY_NEUTRAL_MAX,
      },
    );

    const { diagnostics, historicalSignal, profileAwareHistoricalRows, convictionDiagnostics } =
      this.computeBacktestDiagnostics(cachedData, featuresCache, agents);

    const results: NonNullable<DashboardSummary["calibrationSweep"]>["results"] = [];
    let runsWithOnlyLongs = 0;
    let runsWithOnlyShorts = 0;
    let runsWithMixedDirections = 0;
    for (const ss of DashboardService.SIGNAL_STRENGTH_THRESHOLDS) {
      for (const cv of DashboardService.CONVICTION_THRESHOLDS) {
        for (const ne of DashboardService.NEUTRAL_THRESHOLDS) {
          const m = this.runBacktestWithThresholds(
            cachedData,
            featuresCache,
            agents,
            {
              signalStrengthThreshold: ss,
              convictionThreshold: cv,
              neutralThreshold: ne,
            },
          );
          const { executedLongTrades, executedShortTrades } = m.tradeDirectionDiagnostics;
          if (m.trades > 0) {
            if (executedShortTrades === 0) runsWithOnlyLongs++;
            else if (executedLongTrades === 0) runsWithOnlyShorts++;
            else runsWithMixedDirections++;
          }
          results.push({
            signalStrengthThreshold: ss,
            convictionThreshold: cv,
            neutralThreshold: ne,
            trades: m.trades,
            winRate: m.winRate,
            avgTradeReturn: m.avgTradeReturn,
            cumulativeReturn: m.cumulativeReturn,
            benchmarkReturn: m.benchmarkReturn,
            edge: m.edge,
            maxDrawdown: m.maxDrawdown,
          });
        }
      }
    }

    results.sort((a, b) => {
      const edgeA = a.edge ?? -Infinity;
      const edgeB = b.edge ?? -Infinity;
      if (edgeB !== edgeA) return edgeB - edgeA;
      const wrA = a.winRate ?? 0;
      const wrB = b.winRate ?? 0;
      if (wrB !== wrA) return wrB - wrA;
      const ddA = a.maxDrawdown ?? Infinity;
      const ddB = b.maxDrawdown ?? Infinity;
      return ddA - ddB;
    });

    const topResults = results.slice(0, DashboardService.CALIBRATION_TOP_N);

    const totalRuns =
      DashboardService.SIGNAL_STRENGTH_THRESHOLDS.length *
      DashboardService.CONVICTION_THRESHOLDS.length *
      DashboardService.NEUTRAL_THRESHOLDS.length;

    const {
      backtestMeasurementDiagnostics: measurementDiag,
      tradeDirectionDiagnostics: directionDiag,
      decisionFunnelDiagnostics: funnelDiag,
      directionBiasDiagnostics: dirBiasDiag,
      directionBiasDiagnosticsPreFilter: dirBiasPreFilter,
      directionBiasDiagnosticsPostFilter: dirBiasPostFilter,
      directionBiasPopulationComparison: dirBiasPopComp,
      directionBiasDiagnosticsBySymbol: dirBiasBySym,
      directionBiasComponentExtremes: dirBiasCompExtremes,
      informationAdjustmentDiagnostics: dirInfoAdjDiag,
      informationAttenuationShadowAudit: dirInfoAttenShadow,
      informationAdjustmentDecomposition: dirInfoAdjDecomp,
      informationAdjustmentFormulaAudit: dirInfoAdjFormula,
      totalInfoContributionAudit: dirTotalInfoAudit,
      technicalContributionAudit: dirTechContrAudit,
      trendAudit: dirTrendAudit,
      priceVsMa20Audit: dirPriceVsMa20Audit,
      momentumAudit: dirMomentumAudit,
      sampleSelectionBiasAudit: dirSampleBiasAudit,
      historyVsSampleRegimeAudit: dirHistoryVsSample,
      sampleSourceAudit: dirSampleSource,
      directionBiasByAgentType: dirBiasByType,
      directionBiasSamples: dirBiasSamples,
      aggregationDiagnostics: aggDiag,
      directionMappingDiagnostics: dirMapDiag,
      setupDirectionAudit: dirSetupAudit,
      ...metricsOnly
    } = defaultMetrics;

    return {
      backtestMetrics: metricsOnly,
      backtestDiagnostics: diagnostics,
      calibrationSweep: {
        totalRuns,
        results: topResults,
      },
      agentProfileDiagnostics,
      historicalSignalDiagnostics: historicalSignal,
      runtimeWiringDiagnostics: {
        usedProfileAggregationInBacktest: true,
        usedProfileAggregationInCalibration: true,
        profileAwareHistoricalRows,
      },
      backtestMeasurementDiagnostics: measurementDiag,
      tradeDirectionDiagnostics: directionDiag,
      calibrationDirectionSummary: {
        totalRuns,
        runsWithOnlyLongs,
        runsWithOnlyShorts,
        runsWithMixedDirections,
      },
      informationExposureDiagnostics,
      convictionDiagnostics,
      decisionFunnelDiagnostics: funnelDiag,
      informationDiagnostics,
      directionBiasDiagnostics: dirBiasDiag,
      directionBiasDiagnosticsPreFilter: dirBiasPreFilter,
      directionBiasDiagnosticsPostFilter: dirBiasPostFilter,
      directionBiasPopulationComparison: dirBiasPopComp,
      directionBiasDiagnosticsBySymbol: dirBiasBySym,
      directionBiasComponentExtremes: dirBiasCompExtremes,
      informationAdjustmentDiagnostics: dirInfoAdjDiag,
      informationAttenuationShadowAudit: dirInfoAttenShadow,
      informationAdjustmentDecomposition: dirInfoAdjDecomp,
      informationAdjustmentFormulaAudit: dirInfoAdjFormula,
      totalInfoContributionAudit: dirTotalInfoAudit,
      technicalContributionAudit: dirTechContrAudit,
      trendAudit: dirTrendAudit,
      priceVsMa20Audit: dirPriceVsMa20Audit,
      momentumAudit: dirMomentumAudit,
      sampleSelectionBiasAudit: dirSampleBiasAudit,
      historyVsSampleRegimeAudit: dirHistoryVsSample,
      sampleSourceAudit: dirSampleSource,
      directionBiasByAgentType: dirBiasByType,
      directionBiasSamples: dirBiasSamples,
      aggregationDiagnostics: aggDiag,
      directionMappingDiagnostics: normalizeDirectionMappingDiagnostics(dirMapDiag),
      setupDirectionAudit: dirSetupAudit,
    };
  }

  /** Compute backtest diagnostics (candidate counts) using default thresholds. Uses profile-based aggregation. */
  private computeBacktestDiagnostics(
    cachedData: Map<string, { closes: number[]; timestamps: Date[] }>,
    featuresCache: Map<string, Array<{ return5d: number; return20d: number; priceVsMa20: number; priceVsMa50: number; volatility10d: number } | null>>,
    agents: AgentProfile[],
  ): {
    diagnostics: DashboardSummary["backtestDiagnostics"];
    historicalSignal: NonNullable<DashboardSummary["historicalSignalDiagnostics"]>;
    profileAwareHistoricalRows: number;
    convictionDiagnostics: NonNullable<DashboardSummary["convictionDiagnostics"]>;
  } {
    const horizon = DashboardService.HOLDING_PERIOD_DAYS;
    let candidateRows = 0;
    let skippedNonPrepare = 0;
    let skippedLowSignalStrength = 0;
    let skippedHighNeutral = 0;
    let skippedLowConviction = 0;
    let executedTrades = 0;

    let setupCandidateCountAfterProfiles = 0;
    let sumSignalStrengthAfterProfiles = 0;
    let sumDisagreementAfterProfiles = 0;
    let sumConvictionAfterProfiles = 0;
    let convictionCount = 0;
    let profileAwareHistoricalRows = 0;

    const convictionSamples: NonNullable<DashboardSummary["convictionDiagnostics"]>["sample"] = [];
    let sumRawConviction = 0;
    let sumNormalizedConviction = 0;

    for (const [symbol, { closes }] of cachedData) {
      const features = featuresCache.get(symbol);
      if (!features) continue;

      for (let i = 5 + DashboardService.NEUTRAL_LOOKBACK; i < closes.length - horizon; i++) {
        if (i >= features.length) break;
        const feat = features[i];
        if (!feat) continue;

        profileAwareHistoricalRows++;

        const contextSeed = hashString(symbol + ":" + String(i));
        const prevContextSeed =
          i > 5 + DashboardService.NEUTRAL_LOOKBACK
            ? hashString(symbol + ":" + String(i - 1))
            : undefined;
        const { meanSignal, disagreement, signalStrength } = computeAgentAggregatedSignalForFeatures(
          feat,
          agents,
          contextSeed,
          prevContextSeed,
        );

        const directionThreshold = DashboardService.SIGNAL_STRENGTH_MIN;
        let setup: "LONG" | "SHORT" | null = null;
        if (meanSignal >= directionThreshold) setup = "LONG";
        else if (meanSignal <= -directionThreshold) setup = "SHORT";

        candidateRows++;
        if (setup == null) {
          skippedNonPrepare++;
          continue;
        }

        setupCandidateCountAfterProfiles++;
        sumSignalStrengthAfterProfiles += signalStrength;
        sumDisagreementAfterProfiles += disagreement;

        if (signalStrength <= DashboardService.SIGNAL_STRENGTH_MIN) {
          skippedLowSignalStrength++;
          continue;
        }

        let neutralCount = 0;
        let validLookbackDays = 0;
        for (let k = i - DashboardService.NEUTRAL_LOOKBACK; k < i && k >= DashboardService.MIN_LOOKBACK_FOR_FEATURES; k++) {
          const fk = features[k];
          if (!fk) continue;
          validLookbackDays++;
          const kSeed = hashString(symbol + ":" + String(k));
          const kPrevSeed =
            k > DashboardService.MIN_LOOKBACK_FOR_FEATURES
              ? hashString(symbol + ":" + String(k - 1))
              : undefined;
          const { meanSignal: mk } = computeAgentAggregatedSignalForFeatures(fk, agents, kSeed, kPrevSeed);
          if (Math.abs(mk) < DashboardService.SIGNAL_STRENGTH_MIN) neutralCount++;
        }
        const probabilityNeutral =
          validLookbackDays > 0 ? neutralCount / validLookbackDays : 0.5;

        const rawConviction =
          signalStrength * 0.5 +
          (1 - disagreement) * 0.3 +
          (1 - probabilityNeutral) * 0.2;
        const normalizedConviction = rawConviction > 1 ? 1 : rawConviction < 0 ? 0 : rawConviction;

        if (convictionSamples.length < 25) {
          convictionSamples.push({
            signalStrength,
            disagreement,
            rawConviction,
            normalizedConviction,
          });
        }
        sumRawConviction += rawConviction;
        sumNormalizedConviction += normalizedConviction;
        convictionCount++;
        sumConvictionAfterProfiles += rawConviction;

        if (probabilityNeutral >= DashboardService.PROBABILITY_NEUTRAL_MAX) {
          skippedHighNeutral++;
          continue;
        }

        if (rawConviction < DashboardService.LOCAL_CONVICTION_MIN) {
          skippedLowConviction++;
          continue;
        }
        executedTrades++;
      }
    }

    const n = setupCandidateCountAfterProfiles;
    const convictionDiagnostics: NonNullable<DashboardSummary["convictionDiagnostics"]> = {
      sample: convictionSamples,
      avgRawConviction: convictionCount > 0 ? sumRawConviction / convictionCount : 0,
      avgNormalizedConviction: convictionCount > 0 ? sumNormalizedConviction / convictionCount : 0,
    };

    return {
      diagnostics: {
        candidateRows,
        skippedNonPrepare,
        skippedLowSignalStrength,
        skippedHighNeutral,
        skippedLowConviction,
        executedTrades,
      },
      historicalSignal: {
        setupCandidateCountAfterProfiles: n,
        avgSignalStrengthAfterProfiles: n > 0 ? sumSignalStrengthAfterProfiles / n : 0,
        avgDisagreementAfterProfiles: n > 0 ? sumDisagreementAfterProfiles / n : 0,
        avgConvictionAfterProfiles: convictionCount > 0 ? sumConvictionAfterProfiles / convictionCount : 0,
      },
      profileAwareHistoricalRows,
      convictionDiagnostics,
    };
  }

  /** Historical backtest: per-symbol, per-date trade filtering. All eligibility derived from data up to that date. */
  private async computeBacktestMetrics(
    symbols: string[],
  ): Promise<NonNullable<DashboardSummary["backtestMetrics"]> & { backtestDiagnostics?: DashboardSummary["backtestDiagnostics"] }> {
    const horizon = DashboardService.HOLDING_PERIOD_DAYS;
    const syms = symbols?.length ? symbols : ["SPY", "QQQ", "IWM"];

    const tradeReturns: number[] = [];
    const benchmarkReturns: number[] = [];
    let candidateRows = 0;
    let skippedNonPrepare = 0;
    let skippedLowSignalStrength = 0;
    let skippedHighNeutral = 0;
    let skippedLowConviction = 0;

    for (const symbol of syms) {
      const latest = await this.prisma.marketPrice.findFirst({
        where: { symbol },
        orderBy: { timestamp: "desc" },
        select: { datasetVersion: true },
      });
      const dv = latest?.datasetVersion ?? null;
      if (!dv) continue;

      const rows = await this.prisma.marketPrice.findMany({
        where: { symbol, datasetVersion: dv },
        orderBy: { timestamp: "asc" },
        select: { timestamp: true, close: true },
      });
      const closes = rows.map((r) => r.close);
      const minLen =
        DashboardService.MIN_LOOKBACK_FOR_FEATURES + horizon + 6 + DashboardService.NEUTRAL_LOOKBACK;
      if (closes.length < minLen) continue;

      const features = this.computeMarketFeatures(closes);

      for (let i = 5 + DashboardService.NEUTRAL_LOOKBACK; i < closes.length - horizon; i++) {
        if (i >= features.length) continue;
        const feat = features[i];
        if (!feat) continue;

        const mean5 =
          (closes[i - 5]! + closes[i - 4]! + closes[i - 3]! + closes[i - 2]! + closes[i - 1]!) / 5;
        if (mean5 <= 0 || !Number.isFinite(mean5)) continue;

        const momentum = (closes[i - 1]! - mean5) / mean5;
        let setup: "LONG" | "SHORT" | null = null;
        if (momentum > DashboardService.MOMENTUM_THRESHOLD_SETUP) setup = "LONG";
        else if (momentum < -DashboardService.MOMENTUM_THRESHOLD_SETUP) setup = "SHORT";

        candidateRows++;

        if (setup == null) {
          skippedNonPrepare++;
          continue;
        }

        const bullishBias = feat.return5d > 0 && feat.priceVsMa20 > 0;
        const bearishBias = feat.return5d < 0 && feat.priceVsMa20 < 0;
        if (setup === "LONG" && bearishBias) continue;
        if (setup === "SHORT" && bullishBias) continue;

        const existingSignalStrength = Math.abs(momentum);
        const momentumComponent = Math.abs(feat.return5d) * 0.4;
        const trendComponent = Math.abs(feat.priceVsMa20) * 0.3;
        const volatilityComponent = feat.volatility10d * 0.3;
        const signalStrength =
          existingSignalStrength * 0.5 + (momentumComponent + trendComponent + volatilityComponent);
        if (signalStrength <= DashboardService.SIGNAL_STRENGTH_MIN) {
          skippedLowSignalStrength++;
          continue;
        }

        let neutralCount = 0;
        let validLookbackDays = 0;
        for (let k = i - DashboardService.NEUTRAL_LOOKBACK; k < i && k >= 5; k++) {
          const m5 =
            (closes[k - 5]! + closes[k - 4]! + closes[k - 3]! + closes[k - 2]! + closes[k - 1]!) / 5;
          if (m5 <= 0) continue;
          validLookbackDays++;
          const mom = (closes[k - 1]! - m5) / m5;
          if (Math.abs(mom) < DashboardService.SIGNAL_STRENGTH_MIN) neutralCount++;
        }
        const probabilityNeutral =
          validLookbackDays > 0 ? neutralCount / validLookbackDays : 0.5;
        if (probabilityNeutral >= DashboardService.PROBABILITY_NEUTRAL_MAX) {
          skippedHighNeutral++;
          continue;
        }

        const returns: number[] = [];
        for (let j = i - 4; j < i && j >= 1; j++) {
          const r = (closes[j]! - closes[j - 1]!) / closes[j - 1]!;
          if (Number.isFinite(r)) returns.push(r);
        }
        const meanRet = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
        const variance =
          returns.length >= 2
            ? returns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / returns.length
            : 0;
        const volatility = Math.sqrt(variance);
        const disagreement = Math.min(1, Math.max(0, volatility * 10));

        const localConviction =
          signalStrength * 0.5 +
          (1 - disagreement) * 0.3 +
          (1 - probabilityNeutral) * 0.2;
        if (localConviction < DashboardService.LOCAL_CONVICTION_MIN) {
          skippedLowConviction++;
          continue;
        }

        const priceT0 = closes[i]!;
        const priceT1 = closes[i + horizon]!;
        if (priceT0 <= 0 || !Number.isFinite(priceT0) || !Number.isFinite(priceT1)) continue;

        const rawReturn = (priceT1 - priceT0) / priceT0;
        const tradeReturn = setup === "LONG" ? rawReturn : -rawReturn;
        tradeReturns.push(tradeReturn);
        benchmarkReturns.push(rawReturn);
      }
    }

    const executedTrades = tradeReturns.length;
    const diagnostics: DashboardSummary["backtestDiagnostics"] = {
      candidateRows,
      skippedNonPrepare,
      skippedLowSignalStrength,
      skippedHighNeutral,
      skippedLowConviction,
      executedTrades,
    };

    if (tradeReturns.length === 0) {
      return {
        trades: 0,
        winRate: null,
        avgTradeReturn: null,
        cumulativeReturn: null,
        benchmarkReturn: null,
        edge: null,
        maxDrawdown: null,
        backtestDiagnostics: diagnostics,
      };
    }

    const trades = tradeReturns.length;
    const wins = tradeReturns.filter((r) => r > 0).length;
    const winRate = trades > 0 ? wins / trades : null;
    const avgStrategyReturn = tradeReturns.reduce((a, b) => a + b, 0) / tradeReturns.length;
    const avgBenchmarkReturn =
      benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length;
    const cumulativeStrategyReturn = tradeReturns.reduce((a, b) => a + b, 0);
    const cumulativeBenchmarkReturn = benchmarkReturns.reduce((a, b) => a + b, 0);
    const benchmarkReturn = cumulativeBenchmarkReturn;
    const cumulativeReturn = cumulativeStrategyReturn;
    const edge = cumulativeStrategyReturn - cumulativeBenchmarkReturn;

    let equity = 1;
    let peak = 1;
    let maxDrawdown = 0;
    for (const r of tradeReturns) {
      equity *= 1 + r;
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? (peak - equity) / peak : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    return {
      trades,
      winRate,
      avgTradeReturn: avgStrategyReturn,
      cumulativeReturn,
      benchmarkReturn,
      edge,
      maxDrawdown,
      backtestDiagnostics: diagnostics,
    };
  }

  /** Evaluate predictive performance of crowd signals over a 5-day horizon. Uses SignalHistory (actionable: BUY/SELL). */
  private async computeSignalValidationMetrics(
    symbols: string[],
  ): Promise<NonNullable<DashboardSummary["signalValidationMetrics"]>> {
    const horizon = DashboardService.PREDICTION_HORIZON_DAYS;
    const syms = symbols?.length ? symbols : ["SPY", "QQQ", "IWM"];
    const limit = 100;

    const rows = await this.prisma.signalHistory.findMany({
      where: { symbol: { in: syms } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { symbol: true, signal: true, createdAt: true, datasetVersion: true },
    });

    const actionableSignals = ["STRONG_BUY", "BUY", "STRONG_SELL", "SELL"];
    const filtered = rows.filter((r) => actionableSignals.includes(r.signal));
    const totalSignals = rows.length;

    if (filtered.length === 0) {
      return {
        totalSignals,
        actionableSignals: 0,
        correctPredictions: 0,
        accuracy: 0,
        avgReturn: 0,
        benchmarkReturn: 0,
        edge: 0,
      };
    }

    const symbolSet = new Set(filtered.map((r) => r.symbol));
    const pricesBySymbol = new Map<string, Array<{ timestamp: Date; close: number; datasetVersion: string }>>();

    for (const symbol of symbolSet) {
      const latest = await this.prisma.marketPrice.findFirst({
        where: { symbol },
        orderBy: { timestamp: "desc" },
        select: { datasetVersion: true },
      });
      const dv = latest?.datasetVersion ?? null;
      if (!dv) continue;

      const prices = await this.prisma.marketPrice.findMany({
        where: { symbol, datasetVersion: dv },
        orderBy: { timestamp: "asc" },
        select: { timestamp: true, close: true, datasetVersion: true },
      });
      pricesBySymbol.set(symbol, prices);
    }

    let correctPredictions = 0;
    const returns: number[] = [];
    const benchmarkReturns: number[] = [];

    for (const h of filtered) {
      const prices = pricesBySymbol.get(h.symbol);
      if (!prices || prices.length < horizon + 1) continue;

      const createdAt = h.createdAt;
      const fromIdx = prices.findIndex((p) => p.timestamp >= createdAt);
      if (fromIdx < 0 || fromIdx + horizon >= prices.length) continue;

      const priceT0 = prices[fromIdx]!.close;
      const priceT1 = prices[fromIdx + horizon]!.close;
      if (priceT0 <= 0 || !Number.isFinite(priceT0) || !Number.isFinite(priceT1)) continue;

      const isLong = h.signal === "STRONG_BUY" || h.signal === "BUY";
      const rawReturn = (priceT1 - priceT0) / priceT0;
      const signalReturn = isLong ? rawReturn : -rawReturn;

      const correct = isLong ? priceT1 > priceT0 : priceT1 < priceT0;
      if (correct) correctPredictions++;

      returns.push(signalReturn);
      benchmarkReturns.push(rawReturn);
    }

    const actionableEvaluated = returns.length;
    const accuracy = actionableEvaluated > 0 ? correctPredictions / actionableEvaluated : 0;
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const benchmarkReturn =
      benchmarkReturns.length > 0
        ? benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length
        : 0;
    const edge = avgReturn - benchmarkReturn;

    return {
      totalSignals,
      actionableSignals: actionableEvaluated,
      correctPredictions,
      accuracy,
      avgReturn,
      benchmarkReturn,
      edge,
    };
  }

  /** Compute crowd confidence regime from market regime, signal probabilities, and transition. Deterministic. */
  private computeCrowdConfidence(
    marketRegime: DashboardSummary["marketRegime"],
    signalProbabilities: DashboardSummary["signalProbabilities"],
    marketTransition: DashboardSummary["marketTransition"],
  ): NonNullable<DashboardSummary["crowdConfidence"]> {
    const avgSignalStrength = marketRegime?.avgSignalStrength ?? 0;
    const avgDisagreement = marketRegime?.avgDisagreement ?? 0;
    const coverageRate = marketRegime?.coverageRate ?? 0;
    const probabilityNeutral = signalProbabilities?.probabilityNeutral ?? 0;
    const trend = marketTransition?.trend ?? "STABLE";

    const conviction =
      avgSignalStrength * 0.45 +
      (1 - avgDisagreement) * 0.25 +
      (1 - probabilityNeutral) * 0.2 +
      coverageRate * 0.1;
    const convictionClamped = Math.max(0, Math.min(1, conviction));

    let regime: "LOW_CONFIDENCE" | "BUILDING_CONFIDENCE" | "HIGH_CONFIDENCE";
    if (
      avgDisagreement < 0.35 &&
      probabilityNeutral < 0.6 &&
      convictionClamped >= 0.5
    ) {
      regime = "HIGH_CONFIDENCE";
    } else if (
      trend === "IMPROVING" &&
      convictionClamped >= 0.25 &&
      convictionClamped < 0.5
    ) {
      regime = "BUILDING_CONFIDENCE";
    } else if (
      avgDisagreement >= 0.45 ||
      probabilityNeutral >= 0.8 ||
      convictionClamped < 0.25
    ) {
      regime = "LOW_CONFIDENCE";
    } else {
      regime = "LOW_CONFIDENCE";
    }

    const interpretations: Record<typeof regime, string> = {
      LOW_CONFIDENCE:
        "Crowd signals are currently weak and should be interpreted cautiously.",
      BUILDING_CONFIDENCE:
        "Crowd conviction is improving, but signals remain early-stage.",
      HIGH_CONFIDENCE:
        "Crowd consensus is strong enough to support higher-confidence interpretation.",
    };

    return {
      regime,
      conviction: convictionClamped,
      disagreement: avgDisagreement,
      coverageRate,
      neutralProbability: probabilityNeutral,
      interpretation: interpretations[regime],
    };
  }

  /** Derive bias from signal and confidence. Returns value in [-1, 1]. */
  private signalToBias(signal: string, confidence: number): number {
    const dir: Record<string, number> = {
      STRONG_BUY: 1,
      BUY: 0.5,
      NEUTRAL: 0,
      SELL: -0.5,
      STRONG_SELL: -1,
    };
    return (dir[signal] ?? 0) * Math.max(0, Math.min(1, confidence));
  }

  /** Fetch historical bias per symbol from SignalHistory. Returns Map<symbol, bias[]>. */
  private async fetchBiasHistory(symbols: string[]): Promise<Map<string, number[]>> {
    const map = new Map<string, number[]>();
    try {
      const { items } = await this.signalsService.getHistory(symbols.join(","), 50);
      for (const symbol of symbols) {
        const symbolItems = items.filter((i) => i.symbol === symbol);
        const biases = symbolItems.map((r) =>
          this.signalToBias(r.signal, r.confidence),
        );
        if (biases.length > 0) map.set(symbol, biases);
      }
    } catch {
      /* skip */
    }
    return map;
  }

  /** Compute crowd acceleration from symbol probabilities and SignalHistory. */
  private async computeCrowdAcceleration(
    symbolProbabilities: NonNullable<DashboardSummary["symbolProbabilities"]>,
    symbols: string[],
  ): Promise<NonNullable<DashboardSummary["crowdAcceleration"]>> {
    const biasHistory = await this.fetchBiasHistory(symbols);
    const probBySymbol = new Map(symbolProbabilities.map((p) => [p.symbol, p]));

    const accelerations = symbolProbabilities.map((p) => {
      const currentBias = p.probabilityBuy - p.probabilitySell;
      const history = biasHistory.get(p.symbol) ?? [];

      if (history.length < 2) {
        return {
          symbol: p.symbol,
          type: "NONE" as const,
          strength: 0,
          velocity: 0,
          acceleration: 0,
          reason: "Insufficient history for acceleration analysis.",
        };
      }

      const bias_t1 = history[0]!;
      const bias_t2 = history[1]!;
      const velocity = currentBias - bias_t1;
      const prevVelocity = bias_t1 - bias_t2;
      const acceleration = velocity - prevVelocity;

      let type: "BULLISH_ACCELERATION" | "BEARISH_ACCELERATION" | "NONE";
      let reason: string;

      if (acceleration > 0 && currentBias > 0) {
        type = "BULLISH_ACCELERATION";
        reason = "Bullish crowd bias is accelerating.";
      } else if (acceleration < 0 && currentBias < 0) {
        type = "BEARISH_ACCELERATION";
        reason = "Bearish crowd bias is accelerating.";
      } else {
        type = "NONE";
        reason = "No significant acceleration detected.";
      }

      const strength = Math.max(0, Math.min(1, Math.abs(acceleration)));

      return { symbol: p.symbol, type, strength, velocity, acceleration, reason };
    });

    return accelerations.sort((a, b) => {
      if (b.strength !== a.strength) return b.strength - a.strength;
      return a.symbol.localeCompare(b.symbol);
    });
  }

  /** Fetch raw price momentum per symbol from MarketPrice. Returns Map<symbol, { momentum, hasData }>. */
  private async fetchPriceMomentums(symbols: string[]): Promise<Map<string, { momentum: number; hasData: boolean }>> {
    const map = new Map<string, { momentum: number; hasData: boolean }>();
    for (const symbol of symbols) {
      try {
        const result = await this.computePriceMomentum(symbol);
        if (result != null) {
          map.set(symbol, { momentum: result.momentum, hasData: true });
        } else {
          map.set(symbol, { momentum: 0, hasData: false });
        }
      } catch {
        map.set(symbol, { momentum: 0, hasData: false });
      }
    }
    return map;
  }

  /** Compute raw price momentum for a symbol from last 6 closes. Returns { momentum } or null if insufficient data. */
  private async computePriceMomentum(symbol: string): Promise<{ momentum: number } | null> {
    const latest = await this.prisma.marketPrice.findFirst({
      where: { symbol },
      orderBy: { timestamp: "desc" },
      select: { datasetVersion: true },
    });
    if (!latest?.datasetVersion) return null;

    const rows = await this.prisma.marketPrice.findMany({
      where: { symbol, datasetVersion: latest.datasetVersion },
      orderBy: { timestamp: "desc" },
      take: 6,
      select: { close: true },
    });
    if (rows.length < 6) return null;

    const lastClose = rows[0]!.close;
    const meanLast5 =
      (rows[1]!.close + rows[2]!.close + rows[3]!.close + rows[4]!.close + rows[5]!.close) / 5;
    if (meanLast5 <= 0 || !Number.isFinite(meanLast5)) return null;

    const momentum = (lastClose - meanLast5) / meanLast5;
    return { momentum };
  }

  /** Compute crowd divergence from symbol probabilities, price momentum, watchlist, and trade setups. Deterministic. */
  private computeCrowdDivergence(
    symbolProbabilities: NonNullable<DashboardSummary["symbolProbabilities"]>,
    priceMomentums: Map<string, { momentum: number; hasData: boolean }>,
    watchlistCandidates: NonNullable<DashboardSummary["watchlistCandidates"]>,
    tradeSetups: NonNullable<DashboardSummary["tradeSetups"]>,
  ): NonNullable<DashboardSummary["crowdDivergence"]> {
    const watchlistBySymbol = new Map(watchlistCandidates.map((c) => [c.symbol, c]));
    const setupBySymbol = new Map(tradeSetups.map((s) => [s.symbol, s]));

    const divergences = symbolProbabilities.map((p) => {
      const pm = priceMomentums.get(p.symbol) ?? { momentum: 0, hasData: false };
      const momentum = pm.hasData ? pm.momentum : 0;
      const crowdBias = p.probabilityBuy - p.probabilitySell;

      let type: "BULLISH_DIVERGENCE" | "BEARISH_DIVERGENCE" | "NONE";
      let reason: string;

      if (!pm.hasData) {
        type = "NONE";
        reason = "Insufficient price history for divergence analysis.";
      } else if (momentum < 0 && crowdBias > 0) {
        type = "BULLISH_DIVERGENCE";
        reason = "Crowd is tilting bullish while recent price momentum remains negative.";
      } else if (momentum > 0 && crowdBias < 0) {
        type = "BEARISH_DIVERGENCE";
        reason = "Crowd is tilting bearish while recent price momentum remains positive.";
      } else {
        type = "NONE";
        reason = "No meaningful divergence between price momentum and crowd bias.";
      }

      let strength = Math.abs(momentum) * Math.abs(crowdBias);
      const watchlist = watchlistBySymbol.get(p.symbol);
      const setup = setupBySymbol.get(p.symbol);
      const isEmerging = watchlist?.status === "EMERGING";
      const isPrepare = setup?.status === "PREPARE_LONG" || setup?.status === "PREPARE_SHORT";
      if (type !== "NONE" && (isEmerging || isPrepare)) {
        strength = Math.min(1, strength * 1.1);
      }
      strength = Math.max(0, Math.min(1, strength));

      return { symbol: p.symbol, type, strength, momentum, crowdBias, reason };
    });

    return divergences.sort((a, b) => {
      if (b.strength !== a.strength) return b.strength - a.strength;
      return a.symbol.localeCompare(b.symbol);
    });
  }

  /** Compute trade setups from symbol probabilities, watchlist, and market transition. Deterministic. */
  private computeTradeSetups(
    symbolProbabilities: NonNullable<DashboardSummary["symbolProbabilities"]>,
    watchlistCandidates: NonNullable<DashboardSummary["watchlistCandidates"]>,
    marketTransition: DashboardSummary["marketTransition"],
  ): NonNullable<DashboardSummary["tradeSetups"]> {
    const probBySymbol = new Map(symbolProbabilities.map((p) => [p.symbol, p]));
    const trend = marketTransition?.trend ?? "STABLE";
    const improving = trend === "IMPROVING";

    const setups = watchlistCandidates.map((c) => {
      const score = c.score;
      const prob = probBySymbol.get(c.symbol);
      const probabilityBuy = prob?.probabilityBuy ?? 0;
      const probabilitySell = prob?.probabilitySell ?? 0;

      let status: "PREPARE_LONG" | "PREPARE_SHORT" | "WATCH" | "IGNORE";
      if (score < 0.15) {
        status = "IGNORE";
      } else if (score >= 0.25 && improving && probabilityBuy > probabilitySell) {
        status = "PREPARE_LONG";
      } else if (score >= 0.25 && improving && probabilitySell > probabilityBuy) {
        status = "PREPARE_SHORT";
      } else {
        status = "WATCH";
      }

      let reason: string;
      if (status === "PREPARE_LONG") reason = "Mild buy-side tilt with improving crowd structure.";
      else if (status === "PREPARE_SHORT") reason = "Mild sell-side tilt with improving crowd structure.";
      else if (status === "WATCH") reason = "Directional edge remains weak but symbol worth monitoring.";
      else reason = "No meaningful directional edge detected.";

      return { symbol: c.symbol, status, confidence: score, reason };
    });

    return setups.sort((a, b) => b.confidence - a.confidence);
  }

  /** Fetch momentum-based tilt for symbols from MarketPrice. Returns Map<symbol, tiltRaw> with tiltRaw in [-0.3, 0.3]. */
  private async fetchMomentumTilts(symbols: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const symbol of symbols) {
      try {
        const tilt = await this.computeMomentumTilt(symbol);
        if (tilt != null) map.set(symbol, tilt);
      } catch {
        /* skip */
      }
    }
    return map;
  }

  /** Compute momentum tilt for a symbol from last 6 closes. Returns tiltRaw in [-0.3, 0.3] or null if insufficient data. */
  private async computeMomentumTilt(symbol: string): Promise<number | null> {
    const latest = await this.prisma.marketPrice.findFirst({
      where: { symbol },
      orderBy: { timestamp: "desc" },
      select: { datasetVersion: true },
    });
    if (!latest?.datasetVersion) return null;

    const rows = await this.prisma.marketPrice.findMany({
      where: { symbol, datasetVersion: latest.datasetVersion },
      orderBy: { timestamp: "desc" },
      take: 6,
      select: { close: true },
    });
    if (rows.length < 6) return null;

    const lastClose = rows[0]!.close;
    const meanLast5 =
      (rows[1]!.close + rows[2]!.close + rows[3]!.close + rows[4]!.close + rows[5]!.close) / 5;
    if (meanLast5 <= 0 || !Number.isFinite(meanLast5)) return null;

    const momentum = (lastClose - meanLast5) / meanLast5;
    let tiltRaw = momentum * 2;
    tiltRaw = Math.max(-0.3, Math.min(0.3, tiltRaw));
    return tiltRaw;
  }

  /** Compute per-symbol directional probabilities from crowd signals, validation, momentum, and global modifiers. Deterministic. */
  private computeSymbolProbabilities(
    symbols: string[],
    crowdSignals: DashboardSummary["crowdSignals"],
    signalValidation: DashboardSummary["signalValidation"],
    momentumTilts: Map<string, number>,
    marketTransition: DashboardSummary["marketTransition"],
    marketAlerts: DashboardSummary["marketAlerts"],
  ): NonNullable<DashboardSummary["symbolProbabilities"]> {
    const syms = symbols?.length > 0 ? symbols : ["SPY", "QQQ", "IWM"];
    const items = crowdSignals?.items ?? [];
    const itemBySymbol = new Map(items.map((i) => [i.symbol, i]));
    const validationItems = signalValidation?.latestItems ?? [];

    const trend = marketTransition?.trend ?? "STABLE";
    const transitionBoost =
      trend === "IMPROVING" ? 0.05 : trend === "DETERIORATING" ? -0.03 : 0;

    return syms.map((symbol) => {
      const item = itemBySymbol.get(symbol);
      const signalStrength = Math.max(0, Math.min(1, (item as { signalStrength?: number })?.signalStrength ?? 0));
      const confidence = Math.max(0, Math.min(1, item?.confidence ?? 0));
      const disagreement = Math.max(0, Math.min(1, item?.disagreement ?? 0));
      const instability = Math.max(0, Math.min(1, item?.instability ?? 0));
      const signal = item?.signal ?? "NEUTRAL";

      const directionalMass = signalStrength * confidence * (1 - disagreement);
      const instabilityPenalty = instability * 0.25;
      let adjustedDirectionalMass = Math.max(0, directionalMass - instabilityPenalty);
      adjustedDirectionalMass = Math.max(0, Math.min(1, adjustedDirectionalMass + transitionBoost));

      let tiltRaw: number;
      const symbolValidation = validationItems.filter((v) => v.symbol === symbol);
      const upCount = symbolValidation.filter((v) => v.realizedDirection === "UP").length;
      const downCount = symbolValidation.filter((v) => v.realizedDirection === "DOWN").length;
      const directionalCount = upCount + downCount;

      if (directionalCount >= 2) {
        const recentUpRate = upCount / directionalCount;
        const recentDownRate = downCount / directionalCount;
        tiltRaw = Math.max(-0.3, Math.min(0.3, recentUpRate - recentDownRate));
      } else if (momentumTilts.has(symbol)) {
        tiltRaw = momentumTilts.get(symbol)!;
      } else {
        const signalTilt: Record<string, number> = {
          STRONG_BUY: 0.3,
          BUY: 0.15,
          NEUTRAL: 0,
          SELL: -0.15,
          STRONG_SELL: -0.3,
        };
        tiltRaw = signalTilt[signal] ?? 0;
      }

      const buyShare = Math.max(0.2, Math.min(0.8, 0.5 + tiltRaw));
      const sellShare = 1 - buyShare;

      let probabilityBuy = adjustedDirectionalMass * buyShare;
      let probabilitySell = adjustedDirectionalMass * sellShare;
      probabilityBuy = Math.max(0, Math.min(1, probabilityBuy));
      probabilitySell = Math.max(0, Math.min(1, probabilitySell));
      const probabilityNeutral = Math.max(0, 1 - probabilityBuy - probabilitySell);

      const diff = Math.abs(probabilityBuy - probabilitySell);
      let interpretation: string;
      if (!item) {
        interpretation = "Directional edge remains limited for this symbol.";
      } else if (adjustedDirectionalMass < 0.15 || diff < 0.01) {
        interpretation = "Directional edge remains weak and balanced.";
      } else if (probabilityBuy > probabilitySell) {
        interpretation = momentumTilts.has(symbol)
          ? "Mild buy-side tilt aligned with recent momentum."
          : "Neutral dominates; mild buy-side tilt is emerging.";
      } else if (probabilitySell > probabilityBuy) {
        interpretation = momentumTilts.has(symbol)
          ? "Mild sell-side tilt aligned with recent momentum."
          : "Neutral dominates; mild sell-side tilt is emerging.";
      } else {
        interpretation = "Directional edge remains weak and balanced.";
      }

      return {
        symbol,
        probabilityBuy,
        probabilitySell,
        probabilityNeutral,
        interpretation,
      };
    });
  }

  /** Compute watchlist candidates from symbols, per-symbol probabilities, and global modifiers. Deterministic. */
  private computeWatchlistCandidates(
    symbols: string[],
    crowdSignals: DashboardSummary["crowdSignals"],
    marketTransition: DashboardSummary["marketTransition"],
    marketAlerts: DashboardSummary["marketAlerts"],
    symbolProbabilities: NonNullable<DashboardSummary["symbolProbabilities"]>,
  ): NonNullable<DashboardSummary["watchlistCandidates"]> {
    const syms = symbols?.length > 0 ? symbols : ["SPY", "QQQ", "IWM"];
    const items = crowdSignals?.items ?? [];
    const itemBySymbol = new Map(items.map((i) => [i.symbol, i]));
    const probBySymbol = new Map(symbolProbabilities.map((p) => [p.symbol, p]));

    const trend = marketTransition?.trend ?? "STABLE";
    const transitionModifier =
      trend === "IMPROVING" ? 0.1 : trend === "STABLE" ? 0.03 : -0.05;

    let alertModifier = 0;
    for (const a of marketAlerts ?? []) {
      if (a.type === "CONSENSUS_FORMING") alertModifier += 0.05;
      else if (a.type === "CONSENSUS_BREAKING") alertModifier += 0.03;
      else if (a.type === "STRESS_BUILDING") alertModifier += 0.02;
    }

    const candidates = syms.map((symbol) => {
      const item = itemBySymbol.get(symbol);
      const prob = probBySymbol.get(symbol);
      const directionalMass = prob ? prob.probabilityBuy + prob.probabilitySell : 0;
      const signalStrength = Math.max(0, Math.min(1, (item as { signalStrength?: number })?.signalStrength ?? 0));
      const confidence = Math.max(0, Math.min(1, item?.confidence ?? 0));

      let score =
        directionalMass * 0.5 +
        signalStrength * 0.2 +
        confidence * 0.1 +
        transitionModifier +
        alertModifier;
      score = Math.max(0, Math.min(1, score));

      const status: "EMERGING" | "WATCH" | "IGNORE" =
        score >= 0.45 ? "EMERGING" : score >= 0.2 ? "WATCH" : "IGNORE";

      let reason: string;
      if (prob) {
        const pb = prob.probabilityBuy;
        const ps = prob.probabilitySell;
        const improving = trend === "IMPROVING";
        if (pb > ps && improving) reason = "Weak buy-side tilt with improving structure.";
        else if (ps > pb && improving) reason = "Weak sell-side tilt with improving structure.";
        else if (pb > ps) reason = "Buy-side tilt; monitor for emerging edge.";
        else if (ps > pb) reason = "Sell-side tilt; monitor for emerging edge.";
        else reason = prob.interpretation;
      } else {
        reason = item ? "Moderate metrics; monitor for emerging edge." : "No crowd signal data; monitoring only.";
      }

      return { symbol, score, status, reason, signalStrength, confidence };
    });

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.signalStrength !== a.signalStrength) return b.signalStrength - a.signalStrength;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.symbol.localeCompare(b.symbol);
    });

    return candidates.map(({ symbol, score, status, reason }) => ({ symbol, score, status, reason }));
  }

  /** Compute directional signal probabilities from regime, transition, and stress. Deterministic. */
  private computeSignalProbabilities(
    marketRegime: DashboardSummary["marketRegime"],
    marketTransition: DashboardSummary["marketTransition"],
    marketStress: DashboardSummary["marketStress"],
  ): NonNullable<DashboardSummary["signalProbabilities"]> {
    const avgSignalStrength = marketRegime?.avgSignalStrength ?? 0;
    const avgDisagreement = marketRegime?.avgDisagreement ?? 0;
    const coverageRate = marketRegime?.coverageRate ?? 0;
    const trend = marketTransition?.trend ?? "STABLE";
    const buyDominance = marketStress?.buyDominance ?? 0;
    const sellDominance = marketStress?.sellDominance ?? 0;

    const baseDirectional = avgSignalStrength * (1 - avgDisagreement);
    const improvementBoost =
      trend === "IMPROVING" ? 0.1 : trend === "DETERIORATING" ? -0.05 : 0;
    let directionalMass = Math.max(0, Math.min(1, baseDirectional + improvementBoost));

    const totalDominance = buyDominance + sellDominance;
    const buyBias = totalDominance > 0 ? buyDominance / totalDominance : 0.5;
    const sellBias = totalDominance > 0 ? sellDominance / totalDominance : 0.5;

    const neutralMass = 1 - directionalMass;
    const probabilityBuy = directionalMass * buyBias;
    const probabilitySell = directionalMass * sellBias;
    const probabilityNeutral = neutralMass;

    let interpretation: string;
    if (neutralMass > 0.6 && directionalMass < 0.2) {
      interpretation = "Neutral dominates; directional edge remains weak.";
    } else if (probabilityBuy > probabilitySell && probabilityBuy < 0.5) {
      interpretation = "Buy-side probability is rising but conviction remains limited.";
    } else if (probabilitySell > probabilityBuy && trend === "DETERIORATING") {
      interpretation = "Sell-side probability dominates under deteriorating structure.";
    } else if (probabilityBuy > probabilitySell) {
      interpretation = "Buy-side probability leads with moderate conviction.";
    } else if (probabilitySell > probabilityBuy) {
      interpretation = "Sell-side probability leads with elevated risk.";
    } else {
      interpretation = "Directional probabilities are balanced; neutral holds residual mass.";
    }

    return {
      probabilityBuy,
      probabilitySell,
      probabilityNeutral,
      interpretation,
    };
  }

  /** Compute market alerts (turning point signals) from regime and transition. Deterministic. */
  private computeMarketAlerts(
    marketRegime: DashboardSummary["marketRegime"],
    marketTransition: DashboardSummary["marketTransition"],
  ): NonNullable<DashboardSummary["marketAlerts"]> {
    const alerts: NonNullable<DashboardSummary["marketAlerts"]> = [];
    const regime = marketRegime?.regime ?? "MIXED";
    const trend = marketTransition?.trend ?? "STABLE";
    const strengthDelta = marketTransition?.strengthDelta ?? 0;
    const disagreementDelta = marketTransition?.disagreementDelta ?? 0;
    const avgDisagreement = marketRegime?.avgDisagreement ?? 0;
    const coverageRate = marketRegime?.coverageRate ?? 0;

    const confidence = Math.max(0, Math.min(1, Math.abs(strengthDelta) + Math.abs(disagreementDelta)));
    const severity: "LOW" | "MEDIUM" | "HIGH" =
      confidence < 0.2 ? "LOW" : confidence < 0.5 ? "MEDIUM" : "HIGH";

    if (
      regime === "CHAOTIC" &&
      trend === "IMPROVING" &&
      strengthDelta > 0 &&
      disagreementDelta < 0
    ) {
      alerts.push({
        type: "CONSENSUS_FORMING",
        severity,
        confidence,
        message: "Crowd consensus is forming from chaotic conditions.",
      });
    }
    if (regime === "TRENDING" && trend === "DETERIORATING") {
      alerts.push({
        type: "CONSENSUS_BREAKING",
        severity,
        confidence,
        message: "Established consensus is breaking down.",
      });
    }
    if (
      trend === "DETERIORATING" &&
      avgDisagreement >= 0.45 &&
      coverageRate >= 0.05
    ) {
      alerts.push({
        type: "STRESS_BUILDING",
        severity,
        confidence,
        message: "Crowd stress is building with elevated disagreement.",
      });
    }

    return alerts;
  }

  /** Compute market stress from regime, transition, and coverage. Deterministic. */
  private computeMarketStress(
    marketRegime: DashboardSummary["marketRegime"],
    marketTransition: DashboardSummary["marketTransition"],
    signalCoverage: DashboardSummary["signalCoverage"],
  ): DashboardSummary["marketStress"] {
    const bySignal = signalCoverage?.bySignal ?? {};
    const buyDominance =
      (bySignal["STRONG_BUY"] ?? 0) + (bySignal["BUY"] ?? 0);
    const sellDominance =
      (bySignal["STRONG_SELL"] ?? 0) + (bySignal["SELL"] ?? 0);
    const avgSignalStrength = marketRegime?.avgSignalStrength ?? 0;
    const avgDisagreement = marketRegime?.avgDisagreement ?? 0;
    const coverageRate = marketRegime?.coverageRate ?? 0;
    const trend = marketTransition?.trend ?? "STABLE";
    const regime = marketRegime?.regime ?? "MIXED";

    const sellDominates = sellDominance > buyDominance;
    const buyDominates = buyDominance > sellDominance;
    const noStrongConcentration = !buyDominates && !sellDominates;

    let state: "PANIC" | "EUPHORIA" | "FRAGILITY" | "CALM" | "NORMAL" = "NORMAL";

    if (
      trend === "DETERIORATING" &&
      avgDisagreement >= 0.5 &&
      coverageRate >= 0.05 &&
      sellDominates
    ) {
      state = "PANIC";
    } else if (
      regime === "TRENDING" &&
      avgSignalStrength >= 0.2 &&
      avgDisagreement < 0.35 &&
      buyDominates
    ) {
      state = "EUPHORIA";
    } else if (
      trend === "DETERIORATING" &&
      avgDisagreement >= 0.4 &&
      avgSignalStrength < 0.15
    ) {
      state = "FRAGILITY";
    } else if (
      trend === "STABLE" &&
      avgDisagreement < 0.35 &&
      coverageRate < 0.05 &&
      noStrongConcentration
    ) {
      state = "CALM";
    }

    const interpretations: Record<typeof state, string> = {
      PANIC: "Crowd stress is elevated and downside consensus is spreading.",
      EUPHORIA: "Crowd conviction is strong and upside consensus dominates.",
      FRAGILITY: "Consensus is weakening and market structure appears vulnerable.",
      CALM: "Crowd conditions are quiet with low stress and limited signal activity.",
      NORMAL: "No unusual crowd stress pattern detected.",
    };

    return {
      state,
      buyDominance,
      sellDominance,
      interpretation: interpretations[state],
    };
  }

  /** Compute market transition from signal history. Deterministic. */
  private computeMarketTransition(
    items: Array<{
      signal: string;
      signalStrength: number;
      disagreement: number;
    }>,
  ): NonNullable<DashboardSummary["marketTransition"]> {
    const WINDOW = 10;
    const recent = items.slice(0, WINDOW);
    const previous = items.slice(WINDOW, WINDOW * 2);

    const metrics = (group: typeof recent) => {
      const n = group.length;
      if (n === 0) return { avgSignalStrength: 0, avgDisagreement: 0, coverageRate: 0 };
      const avgSignalStrength =
        group.reduce((s, i) => s + (i.signalStrength ?? 0), 0) / n;
      const avgDisagreement =
        group.reduce((s, i) => s + (i.disagreement ?? 0), 0) / n;
      const actionable = group.filter(
        (i) =>
          i.signal === "STRONG_BUY" ||
          i.signal === "BUY" ||
          i.signal === "STRONG_SELL" ||
          i.signal === "SELL",
      ).length;
      const coverageRate = n > 0 ? actionable / n : 0;
      return { avgSignalStrength, avgDisagreement, coverageRate };
    };

    const current = metrics(recent);
    const prev = metrics(previous);

    const strengthDelta = current.avgSignalStrength - prev.avgSignalStrength;
    const disagreementDelta = current.avgDisagreement - prev.avgDisagreement;
    const coverageDelta = current.coverageRate - prev.coverageRate;

    let trend: "IMPROVING" | "DETERIORATING" | "STABLE" = "STABLE";
    if (
      strengthDelta > 0 &&
      disagreementDelta < 0 &&
      coverageDelta >= 0
    ) {
      trend = "IMPROVING";
    } else if (strengthDelta < 0 && disagreementDelta > 0) {
      trend = "DETERIORATING";
    }

    return {
      trend,
      strengthDelta,
      disagreementDelta,
      coverageDelta,
    };
  }

  /** Compute market regime from crowd consensus metrics. Deterministic. */
  private computeMarketRegime(
    crowdSignals: DashboardSummary["crowdSignals"],
    signalCoverage: DashboardSummary["signalCoverage"],
  ): DashboardSummary["marketRegime"] {
    const items = crowdSignals?.items ?? [];
    const n = items.length;
    const avgSignalStrength =
      n > 0
        ? items.reduce((s, i) => s + ((i as { signalStrength?: number }).signalStrength ?? 0), 0) / n
        : 0;
    const avgDisagreement =
      n > 0 ? items.reduce((s, i) => s + (i.disagreement ?? 0), 0) / n : 0;
    const coverageRate = signalCoverage?.coverageRate ?? 0;

    let regime: "TRENDING" | "MIXED" | "CHAOTIC" = "MIXED";
    if (avgDisagreement >= 0.5 && avgSignalStrength < 0.15) {
      regime = "CHAOTIC";
    } else if (avgDisagreement >= 0.35 && avgDisagreement < 0.5) {
      regime = "MIXED";
    } else if (avgDisagreement < 0.35 && avgSignalStrength >= 0.15) {
      regime = "TRENDING";
    }

    return {
      regime,
      avgSignalStrength,
      avgDisagreement,
      coverageRate,
    };
  }

  private async fetchForecastAccuracy(
    runId: string | null,
  ): Promise<DashboardSummary["forecastAccuracy"]> {
    if (!runId) {
      return { runId: null, items: [] };
    }

    const [runAccuracies, forecastResults, stepReturns] = await Promise.all([
      this.prisma.runAccuracy.findMany({
        where: { runId },
        orderBy: { assetSymbol: "asc" },
      }),
      this.prisma.forecastResult.findMany({
        where: { runId },
        orderBy: [{ assetSymbol: "asc" }, { step: "desc" }],
      }),
      this.prisma.assetStepReturn.findMany({
        where: { runId },
        orderBy: [{ assetSymbol: "asc" }, { step: "asc" }],
        select: { assetSymbol: true, step: true, stepReturn: true },
      }),
    ]);

    const assetSymbols = [
      ...new Set([
        ...runAccuracies.map((r) => r.assetSymbol),
        ...stepReturns.map((r) => r.assetSymbol),
      ]),
    ].sort();

    const items: DashboardSummary["forecastAccuracy"]["items"] = [];

    for (const assetSymbol of assetSymbols) {
      const ra = runAccuracies.find((r) => r.assetSymbol === assetSymbol);
      const overall = ra
        ? {
            accuracyRate: ra.accuracyRate,
            totalEvaluations: ra.totalEvaluations,
            correctCount: ra.correctCount,
          }
        : { accuracyRate: 0, totalEvaluations: 0, correctCount: 0 };

      const frForAsset = forecastResults.filter((r) => r.assetSymbol === assetSymbol);
      const rolling10Rows = frForAsset.slice(0, 10);
      const rolling10Total = rolling10Rows.length;
      const rolling10Correct = rolling10Rows.filter((r) => r.isCorrect).length;
      const rolling10 = {
        accuracyRate: rolling10Total > 0 ? rolling10Correct / rolling10Total : 0,
        totalEvaluations: rolling10Total,
        correctCount: rolling10Correct,
      };

      const returnsForAsset = stepReturns.filter((r) => r.assetSymbol === assetSymbol);
      const returnByStep = new Map(returnsForAsset.map((r) => [r.step, r.stepReturn]));

      const maxStep = returnsForAsset.length > 0
        ? Math.max(...returnsForAsset.map((r) => r.step))
        : 0;

      let alwaysBuyCorrect = 0;
      let randomCorrect = 0;
      let baselineTotal = 0;
      const rng = mulberry32(hashString(runId + assetSymbol));

      for (let t = 0; t <= maxStep - 1; t++) {
        const nextRet = returnByStep.get(t + 1);
        if (nextRet == null || !Number.isFinite(nextRet)) continue;
        baselineTotal++;

        if (nextRet > 0) alwaysBuyCorrect++;

        const rand = rng();
        const pred = rand < 1 / 3 ? "BUY" : rand < 2 / 3 ? "SELL" : "HOLD";
        const actual = nextRet > 0 ? "BUY" : nextRet < 0 ? "SELL" : "HOLD";
        if (pred === actual) randomCorrect++;
      }
      const baselines = {
        alwaysBuy: {
          accuracyRate: baselineTotal > 0 ? alwaysBuyCorrect / baselineTotal : 0,
          totalEvaluations: baselineTotal,
          correctCount: alwaysBuyCorrect,
        },
        random: {
          accuracyRate: baselineTotal > 0 ? randomCorrect / baselineTotal : 0,
          totalEvaluations: baselineTotal,
          correctCount: randomCorrect,
        },
      };

      items.push({ assetSymbol, overall, rolling10, baselines });
    }

    return { runId, items };
  }

  private async fetchConsensus(
    runId: string | null,
    assetSymbol: string,
  ): Promise<DashboardSummary["consensus"]> {
    if (!runId) return null;

    const variants = await this.prisma.runVariant.findMany({
      where: { runId, assetSymbol },
      select: {
        summary: { select: { debugDecisionCounts: true } },
      },
    });

    let BUY = 0;
    let SELL = 0;
    let HOLD = 0;
    for (const v of variants) {
      const raw = v.summary?.debugDecisionCounts as
        | { BUY?: number; SELL?: number; HOLD?: number; OTHER?: number }
        | null
        | undefined;
      if (raw) {
        BUY += typeof raw.BUY === "number" ? raw.BUY : 0;
        SELL += typeof raw.SELL === "number" ? raw.SELL : 0;
        HOLD += typeof raw.HOLD === "number" ? raw.HOLD : 0;
      }
    }

    const total = BUY + SELL + HOLD;
    if (total <= 0) return null;

    const buyPct = BUY / total;
    const sellPct = SELL / total;
    const holdPct = HOLD / total;
    const majorityPct = Math.max(buyPct, sellPct, holdPct);

    let entropy = 0;
    for (const p of [buyPct, sellPct, holdPct]) {
      if (p > 0) entropy -= p * Math.log2(p);
    }

    const polarization = Math.abs(buyPct - sellPct);

    return {
      buyPct,
      sellPct,
      holdPct,
      majorityPct,
      entropy,
      polarization,
    };
  }

  private async fetchLatestRun(
    assetSymbol: string,
  ): Promise<DashboardSummary["latestRun"]> {
    const run = await this.prisma.simulationRun.findFirst({
      where: {
        status: "COMPLETED",
        runVariants: { some: { assetSymbol } },
        completedAt: { not: null },
      },
      orderBy: [{ completedAt: "desc" }, { startedAt: "desc" }],
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        completedAt: true,
        runDurationMs: true,
      },
    });

    if (!run) return null;

    const variants = await this.prisma.runVariant.findMany({
      where: { runId: run.id, assetSymbol },
      orderBy: [{ label: "asc" }, { seed: "asc" }],
      select: {
        agents: true,
        steps: true,
        summary: { select: { corr: true, directionalAccuracy: true } },
      },
    });

    const preferred =
      variants.find((v) => v.summary != null) ?? variants[0];
    const summary = preferred?.summary;

    const runDurationMs = deriveRunDurationMs(run);

    return {
      id: run.id,
      name: run.name,
      status: run.status,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? run.completedAt?.toISOString() ?? null,
      runDurationMs,
      assetSymbol,
      steps: preferred?.steps ?? 0,
      agents: preferred?.agents ?? 0,
      variants: variants.length,
      corrDefault: summary?.corr ?? null,
      accuracyDefault: summary?.directionalAccuracy ?? null,
    };
  }

  async getDrift(params: { assetSymbol?: string; window: number }) {
    const { assetSymbol, window } = params;
    const win = Math.max(1, Math.min(200, window));

    const runs = await this.prisma.simulationRun.findMany({
      where: {
        status: "COMPLETED",
        ...(assetSymbol
          ? { runVariants: { some: { assetSymbol: assetSymbol.trim() } } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: win,
      select: { id: true },
    });

    if (runs.length === 0) {
      return {
        window: win,
        count: 0,
        regimeShift: false,
        reason: "insufficient_history",
        riskMean: 0,
        riskDelta: 0,
        deltaRisk: 0,
        deltaSign: 0,
        deltaCorr: 0,
        direction: "STABLE" as const,
        riskSeries: [],
      };
    }

    const runIds = runs.map((r) => r.id);
    const sym = assetSymbol?.trim() || null;

    const variantRows = await this.prisma.runVariant.findMany({
      where: {
        runId: { in: runIds },
        ...(sym ? { assetSymbol: sym } : {}),
      },
      select: {
        runId: true,
        seed: true,
        summary: { select: { corr: true, directionalAccuracy: true } },
      },
    });

    const variantsByRunId = new Map<string, typeof variantRows>();
    for (const v of variantRows) {
      const list = variantsByRunId.get(v.runId) ?? [];
      list.push(v);
      variantsByRunId.set(v.runId, list);
    }

    const riskSeries: number[] = [];
    const signSeries: number[] = [];
    const corrSeries: number[] = [];

    for (const run of runs) {
      const variants = variantsByRunId.get(run.id) ?? [];
      if (variants.length < 2) {
        riskSeries.push(10);
        signSeries.push(1);
        corrSeries.push(0);
        continue;
      }

      const corrs = variants
        .map((v) => v.summary?.corr)
        .filter((c): c is number => c != null && Number.isFinite(c));
      const accs = variants
        .map((v) => v.summary?.directionalAccuracy)
        .filter((a): a is number => a != null && Number.isFinite(a));

      const minCorr = corrs.length > 0 ? Math.min(...corrs) : null;
      const maxCorr = corrs.length > 0 ? Math.max(...corrs) : null;
      const corrSpread = minCorr != null && maxCorr != null ? maxCorr - minCorr : null;
      const accStdDev = accs.length >= 2 ? stdDev(accs) : null;

      const medianSign = median(corrs);
      const targetSign = medianSign == null ? null : medianSign >= 0 ? 1 : -1;
      const matching =
        targetSign != null
          ? corrs.filter((c) => (c >= 0 ? 1 : -1) === targetSign).length
          : 0;
      const signAgreementRate =
        medianSign != null && corrs.length > 0 ? matching / corrs.length : null;

      const riskScore = stabilityRiskScore({
        isLegacyTiming: false,
        label: "multi-seed",
        corrSpread,
        accStdDev,
        signAgreementRate,
      });

      riskSeries.push(riskScore);
      signSeries.push(signAgreementRate ?? 1);
      corrSeries.push(corrSpread ?? 0);
    }

    function mean(arr: number[]) {
      return arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
    }

    if (riskSeries.length < 10) {
      return {
        window: Math.min(5, riskSeries.length),
        count: runs.length,
        regimeShift: false,
        reason: "insufficient_history",
        riskMean: mean(riskSeries),
        riskDelta: 0,
        deltaRisk: 0,
        deltaSign: 0,
        deltaCorr: 0,
        direction: "STABLE" as const,
        riskSeries,
      };
    }

    const windowSize = Math.min(5, Math.floor(riskSeries.length / 2));
    const recentRisk = riskSeries.slice(0, windowSize);
    const olderRisk = riskSeries.slice(-windowSize);

    const recentMean = mean(recentRisk);
    const olderMean = mean(olderRisk);

    const deltaRisk = (recentMean - olderMean) / (olderMean || 1);

    const recentSign = mean(signSeries.slice(0, windowSize));
    const olderSign = mean(signSeries.slice(-windowSize));
    const deltaSign = recentSign - olderSign;

    const recentCorr = mean(corrSeries.slice(0, windowSize));
    const olderCorr = mean(corrSeries.slice(-windowSize));
    const deltaCorr = recentCorr - olderCorr;

    /*
     * Regime Shift Conditions:
     * 1) Risk increase > 15%
     * 2) AND at least one structural metric also worsening
     */
    const regimeShift =
      deltaRisk > 0.15 && (deltaSign < -0.01 || deltaCorr > 0.02);

    let direction: "UP" | "DOWN" | "STABLE" = "STABLE";
    if (deltaRisk > 0.05) direction = "UP";
    else if (deltaRisk < -0.05) direction = "DOWN";

    return {
      window: windowSize,
      count: runs.length,
      riskMean: mean(riskSeries),
      riskDelta: deltaRisk,
      deltaRisk,
      deltaSign,
      deltaCorr,
      direction,
      regimeShift,
      reason: regimeShift ? "multi_factor_threshold" : "within_thresholds",
      riskSeries,
    };
  }

  private async fetchHealth(): Promise<DashboardSummary["health"]> {
    try {
      const q = this.runQueue.getQueueHealth();
      const running = q.runningRunId != null;
      const lastEvents = (q.lastEvents ?? []).slice(-5).reverse();
      return {
        queueLength: q.queueLen,
        running,
        statusText: running ? "Running" : "Idle",
        runningRunId: q.runningRunId,
        lastEvents,
      };
    } catch (e) {
      return {
        queueLength: 0,
        running: false,
        statusText: "Error",
        error: e instanceof Error ? e.message : String(e),
        runningRunId: null,
        lastEvents: [],
      };
    }
  }
}
