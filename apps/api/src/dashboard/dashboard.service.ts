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
  /** Crowd counts from AgentDecision (BUY/SELL/HOLD), same basis as worker backtest-v0 plurality. */
  tradeDirectionDiagnosticsCrowd?: {
    runId: string | null;
    assetSymbol: string;
    executedLongTrades: number;
    executedShortTrades: number;
    longShare: number | null;
    shortShare: number | null;
  };
  /** Model vs crowd: abs(model.longShare - crowd.longShare); optional agreement on net long bias sign. */
  tradeDirectionDivergence?: {
    divergence: number | null;
    directionAgreement: boolean | null;
  };
  /** DB-backed breakdown when model vs crowd differ; uses AgentDecision + RunAgent.archetype and signal columns. */
  tradeDirectionDivergenceExplanation?: {
    runId: string | null;
    assetSymbol: string;
    decisionRowCount: number;
    topCrowdBiasByArchetype: Array<{
      archetype: string;
      buyCount: number;
      sellCount: number;
      holdCount: number;
      netBuyMinusSell: number;
    }>;
    buySellHoldByArchetype: Array<{
      archetype: string;
      buyCount: number;
      sellCount: number;
      holdCount: number;
    }>;
    signalContributions: {
      syntheticMean: number | null;
      infoMean: number | null;
      eventMean: number | null;
      regimeMean: number | null;
      channelsByAbsoluteStrength: Array<{ channel: "synthetic" | "info" | "event" | "regime"; mean: number }>;
      /** Per-channel mean(BUY), mean(SELL), push = meanSell − meanBuy (null push if either mean missing). */
      channelDirectionalBreakdown: Array<{
        channel: "synthetic" | "info" | "event" | "regime";
        meanBuy: number | null;
        meanSell: number | null;
        directionalPush: number | null;
      }>;
      /** directionalPush = mean(SELL) − mean(BUY) per channel; SHORT crowd keeps push>0, LONG crowd keeps push<0. */
      channelsAlignedWithCrowdDirection: Array<{
        channel: "synthetic" | "info" | "event" | "regime";
        directionalPush: number;
      }>;
    };
    /** Archetypes with BUY−SELL sign matching crowd net (longShare − shortShare); |net| descending. */
    archetypesWithNetAlignedToCrowd: string[];
    /** Mean channel values per agent.archetype label (for drill-down UI). */
    archetypeChannelMeans: Array<{
      archetype: string;
      meanSynthetic: number | null;
      meanInfo: number | null;
      meanEvent: number | null;
      meanRegime: number | null;
    }>;
    summary: string | null;
  } | null;
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
    trendFollower: { avgSignal: number; positiveCount: number; negativeCount: number; neutralCount: number };
    contrarian: { avgSignal: number; positiveCount: number; negativeCount: number; neutralCount: number };
    balanced: { avgSignal: number; positiveCount: number; negativeCount: number; neutralCount: number };
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
  setupShadowAudit?: {
    sourceDescription: string;
    variants: {
      baseOnly: { longSetupCount: number; shortSetupCount: number; noneSetupCount: number };
      shadow25: { longSetupCount: number; shortSetupCount: number; noneSetupCount: number };
      shadow50: { longSetupCount: number; shortSetupCount: number; noneSetupCount: number };
      actual: { longSetupCount: number; shortSetupCount: number; noneSetupCount: number };
    };
  };
  setupScoreAudit?: {
    sourceDescription: string;
    attenuationFactor: number;
    avgSetupScore: number | null;
    positiveSetupScoreCount: number;
    negativeSetupScoreCount: number;
  };
  officialBaselineAudit?: {
    signalFlipEnabled: boolean;
    shortEnabled: boolean;
    deltaAttenuationFactor: number;
    macroExcludedFromLiveSetupScore: boolean;
    sentimentExcludedFromLiveSetupScore: boolean;
    activeSetupScoreFormula: string;
  };
  macroPrunedLiveAudit?: {
    enabled: boolean;
    macroIncludedInLiveSetupScore: boolean;
    signalFlipEnabled: boolean;
    deltaAttenuationFactor: number;
    activeSetupScoreFormula: string;
  };
  sentimentPrunedLiveAudit?: {
    enabled: boolean;
    macroIncludedInLiveSetupScore: boolean;
    sentimentIncludedInLiveSetupScore: boolean;
    signalFlipEnabled: boolean;
    deltaAttenuationFactor: number;
    activeSetupScoreFormula: string;
  };
  baselinePreservationAudit?: {
    officialBaselineName: string;
    signalFlipEnabled: boolean;
    shortEnabled: boolean;
    deltaAttenuationFactor: number;
    macroExcludedFromLiveSetupScore: boolean;
    sentimentExcludedFromLiveSetupScore: boolean;
    activeSetupScoreFormula: string;
    baselinePerformanceSnapshot: {
      trades: number | null;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
  };
  winningBaselineFeatureAudit?: {
    allExecutedTrades: {
      count: number;
      avgBaseSignal: number | null;
      avgTechnicalContribution: number | null;
      avgNoiseContribution: number | null;
      avgConviction: number | null;
    };
    winningTrades: {
      count: number;
      avgBaseSignal: number | null;
      avgTechnicalContribution: number | null;
      avgNoiseContribution: number | null;
      avgConviction: number | null;
    };
    losingTrades: {
      count: number;
      avgBaseSignal: number | null;
      avgTechnicalContribution: number | null;
      avgNoiseContribution: number | null;
      avgConviction: number | null;
    };
    comparison: {
      convictionDeltaWinningMinusLosing: number | null;
      technicalDeltaWinningMinusLosing: number | null;
      baseSignalDeltaWinningMinusLosing: number | null;
      noiseDeltaWinningMinusLosing: number | null;
    };
  };
  experimentHarnessAudit?: {
    baseline: {
      name: string;
      trades: number | null;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    candidateShadow: {
      name: string;
      configured: boolean;
      trades: number | null;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    comparison: {
      edgeDeltaCandidateMinusBaseline: number | null;
      cumulativeReturnDeltaCandidateMinusBaseline: number | null;
      drawdownDeltaCandidateMinusBaseline: number | null;
      preferredByEdge: string | null;
      preferredByCumulativeReturn: string | null;
    };
  };
  liveDirectionModeAudit?: {
    longOnlyMode: boolean;
    shortEnabled: boolean;
    signalFlipEnabled: boolean;
    deltaAttenuationFactor: number;
    activeSetupScoreFormula: string;
  };
  currentStrategyConfigAudit?: {
    longOnlyMode: boolean;
    signalFlipEnabled: boolean;
    deltaAttenuationFactor: number;
    activeSetupScoreFormula: string;
  };
  signalFlipAudit?: {
    enabled: boolean;
    scoreSource: string;
    flipped: boolean;
    avgInvertedSetupScore: number | null;
    positiveInvertedSetupScoreCount: number;
    negativeInvertedSetupScoreCount: number;
  };
  setupGateConsistencyAudit?: {
    sourceDescription: string;
    setupUses: string;
    signalStrengthUses: string;
  };
  neutralGateConsistencyAudit?: {
    sourceDescription: string;
    setupUses: string;
    signalStrengthUses: string;
    neutralUses: string;
  };
  neutralFilterAudit?: {
    sourceDescription: string;
    longPath: {
      enteredNeutralStageCount: number;
      passedNeutralCount: number;
      rejectedNeutralCount: number;
      avgConvictionAtNeutralStage: number | null;
      avgNeutralMetricIfExists: number | null;
    };
    shortPath: {
      enteredNeutralStageCount: number;
      passedNeutralCount: number;
      rejectedNeutralCount: number;
      avgConvictionAtNeutralStage: number | null;
      avgNeutralMetricIfExists: number | null;
    };
    neutralRuleDescription: string;
    sampleRejectedLongs: Array<{
      symbol: string;
      timestamp: string;
      conviction?: number | null;
      neutralMetricIfExists?: number | null;
      baseSignal?: number | null;
      postInformationSignal?: number | null;
      setupScoreIfExists?: number | null;
    }>;
    sampleRejectedShorts: Array<{
      symbol: string;
      timestamp: string;
      conviction?: number | null;
      neutralMetricIfExists?: number | null;
      baseSignal?: number | null;
      postInformationSignal?: number | null;
      setupScoreIfExists?: number | null;
    }>;
  };
  shadowBenchmarkAudit?: {
    liveBaseline: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    shadowNoMacroNoSentiment: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    comparison: {
      edgeDeltaLiveMinusShadow: number | null;
      cumulativeReturnDeltaLiveMinusShadow: number | null;
      drawdownDeltaLiveMinusShadow: number | null;
      currentPreferredMode: string;
    };
  };
  strongSignalLiveAudit?: {
    enabled: boolean;
    activeSetupScoreAbsThreshold: number;
    activeSetupScoreFormula: string;
  };
    causalRegimePolicyShadowAudit?: {
    regimeDefinition: string;
    baselineEquivalent: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    causalUptrendLong_downtrendShortOnly: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    causalUptrendOnly_flatDowntrend: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    recommendation: {
      bestVariantByEdge: string | null;
      bestVariantByCumulativeReturn: string | null;
      bestVariantByMaxDrawdown: string | null;
    };
  };
  regimePolicyShadowAudit?: {
    baselineEquivalent: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    uptrendOnly_flatDowntrend: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    uptrendLong_downtrendShortOnly: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    downtrendShortOnly_only: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    recommendation: {
      bestVariantByEdge: string | null;
      bestVariantByCumulativeReturn: string | null;
      bestVariantByMaxDrawdown: string | null;
    };
  };
  downtrendSuppressionShadowAudit?: {
    baselineEquivalent: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    noDowntrendTrades: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    comparison: {
      edgeDeltaNoDowntrendMinusBaseline: number | null;
      cumulativeReturnDeltaNoDowntrendMinusBaseline: number | null;
      drawdownDeltaNoDowntrendMinusBaseline: number | null;
    };
  };
  regimePerformanceAudit?: {
    uptrend: {
      trades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    downtrend: {
      trades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    comparison: {
      edgeDeltaUpMinusDown: number | null;
      winRateDeltaUpMinusDown: number | null;
    };
  };
  liveExitPolicyAudit?: {
    stopLossEnabled: boolean;
    stopLossPercent: number;
    takeProfitEnabled: boolean;
    methodologyDescription: string;
  };
  exitPolicyShadowAudit?: {
    methodologyDescription: string;
    baselineEquivalent: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    stopLoss_3pct: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    takeProfit_6pct: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    stopLoss_3pct_takeProfit_6pct: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    recommendation: {
      bestVariantByEdge: string | null;
      bestVariantByCumulativeReturn: string | null;
      bestVariantByMaxDrawdown: string | null;
    };
  };
  executionRealismAudit?: {
    methodologyDescription: string;
    frictionlessBaseline: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    feeOnly_10bps_roundTrip: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    slippageOnly_10bps_entry_exit: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    feeAndSlippage_10bps_each: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    comparison: {
      edgeDeltaFeeAndSlippageMinusBaseline: number | null;
      cumulativeReturnDeltaFeeAndSlippageMinusBaseline: number | null;
      drawdownDeltaFeeAndSlippageMinusBaseline: number | null;
    };
  };
  frictionSensitivityAudit?: {
    methodologyDescription: string;
    baseline_0bps: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    friction_10bps_total: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    friction_20bps_total: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    friction_30bps_total: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    friction_50bps_total: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    summary: {
      highestFrictionWithPositiveEdge: string | null;
      highestFrictionWithPositiveCumulativeReturn: string | null;
    };
  };
  concurrencyExposureAudit?: {
    methodologyDescription: string;
    totals: {
      trades: number;
      uniqueEntryDates: number | null;
      avgConcurrentOpenTrades: number | null;
      maxConcurrentOpenTrades: number | null;
    };
    concurrencyDistribution: {
      oneOpen: number | null;
      twoOpen: number | null;
      threeOrMoreOpen: number | null;
    };
    byDirectionIfAvailable: {
      avgConcurrentLongTrades: number | null;
      avgConcurrentShortTrades: number | null;
    };
    interpretation: {
      overlapRiskLevel: string | null;
    };
  };
  capitalConstraintShadowAudit?: {
    methodologyDescription: string;
    unconstrainedBaseline: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
      avgConcurrentOpenTrades: number | null;
      maxConcurrentOpenTrades: number | null;
    };
    max1OpenTrade: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
      avgConcurrentOpenTrades: number | null;
      maxConcurrentOpenTrades: number | null;
    };
    max2OpenTrades: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
      avgConcurrentOpenTrades: number | null;
      maxConcurrentOpenTrades: number | null;
    };
    max3OpenTrades: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
      avgConcurrentOpenTrades: number | null;
      maxConcurrentOpenTrades: number | null;
    };
    recommendation: {
      bestVariantByEdge: string | null;
      bestVariantByCumulativeReturn: string | null;
      bestVariantByMaxDrawdown: string | null;
      bestDeployableCandidate: string | null;
    };
  };
  deployableStrategyCandidateAudit?: {
    strategyId: string;
    versionLabel: string;
    status: string;
    constraintProfile: {
      maxConcurrentOpenTrades: number;
      selectionPriorityRule: string;
    };
    performanceSnapshot: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
      avgConcurrentOpenTrades: number | null;
      maxConcurrentOpenTrades: number | null;
    };
    relationToResearchBaseline: {
      cumulativeReturnDeltaVsUnconstrained: number | null;
      edgeDeltaVsUnconstrained: number | null;
      drawdownDeltaVsUnconstrained: number | null;
    };
  };
  strategyComparisonSummaryAudit?: {
    researchChampion: {
      strategyId: string;
      versionLabel: string;
      trades: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    deployableCandidate: {
      strategyId: string;
      versionLabel: string;
      trades: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
      maxConcurrentOpenTrades: number | null;
    };
    comparison: {
      cumulativeReturnDeltaDeployableMinusResearch: number | null;
      edgeDeltaDeployableMinusResearch: number | null;
      drawdownDeltaDeployableMinusResearch: number | null;
    };
    productInterpretation: {
      preferredForResearch: string | null;
      preferredForDeployment: string | null;
    };
  };
  strategyV2CandidateAudit?: {
    strategyId: string;
    versionLabel: string;
    status: string;
    config: {
      signalFlipEnabled: boolean;
      shortEnabled: boolean;
      deltaAttenuationFactor: number;
      macroExcludedFromLiveSetupScore: boolean;
      sentimentExcludedFromLiveSetupScore: boolean;
      activeSetupScoreAbsThreshold: number;
      sizingMode: string;
      stopLossEnabled: boolean;
      stopLossPercent: number;
      takeProfitEnabled: boolean;
    };
    performanceSnapshot: {
      trades: number | null;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    walkForwardSnapshot: {
      positiveEdgeSegmentCount: number;
      positiveCumulativeReturnSegmentCount: number;
      bestSegmentByEdge: string | null;
      worstSegmentByEdge: string | null;
    };
  };
  strategyV1CandidateAudit?: {
    strategyId: string;
    versionLabel: string;
    status: string;
    config: {
      signalFlipEnabled: boolean;
      shortEnabled: boolean;
      deltaAttenuationFactor: number;
      macroExcludedFromLiveSetupScore: boolean;
      sentimentExcludedFromLiveSetupScore: boolean;
      activeSetupScoreAbsThreshold: number;
      sizingMode: string;
    };
    performanceSnapshot: {
      trades: number | null;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    walkForwardSnapshot: {
      positiveEdgeSegmentCount: number;
      positiveCumulativeReturnSegmentCount: number;
      bestSegmentByEdge: string | null;
      worstSegmentByEdge: string | null;
    };
  };
  walkForwardAudit?: {
    splitDescription: string;
    segments: [
      { label: string; trades: number; executedLongTrades: number; executedShortTrades: number; winRate: number | null; avgTradeReturn: number | null; cumulativeReturn: number | null; benchmarkReturn: number | null; edge: number | null; maxDrawdown: number | null },
      { label: string; trades: number; executedLongTrades: number; executedShortTrades: number; winRate: number | null; avgTradeReturn: number | null; cumulativeReturn: number | null; benchmarkReturn: number | null; edge: number | null; maxDrawdown: number | null },
      { label: string; trades: number; executedLongTrades: number; executedShortTrades: number; winRate: number | null; avgTradeReturn: number | null; cumulativeReturn: number | null; benchmarkReturn: number | null; edge: number | null; maxDrawdown: number | null },
      { label: string; trades: number; executedLongTrades: number; executedShortTrades: number; winRate: number | null; avgTradeReturn: number | null; cumulativeReturn: number | null; benchmarkReturn: number | null; edge: number | null; maxDrawdown: number | null },
    ];
    summary: {
      positiveEdgeSegmentCount: number;
      positiveCumulativeReturnSegmentCount: number;
      bestSegmentByEdge: string | null;
      worstSegmentByEdge: string | null;
    };
  };
  outOfSampleAudit?: {
    splitDescription: string;
    inSample: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    outOfSample: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    comparison: {
      edgeDeltaOutMinusIn: number | null;
      cumulativeReturnDeltaOutMinusIn: number | null;
      winRateDeltaOutMinusIn: number | null;
    };
  };
  strongSignalShadowAudit?: {
    baselineEquivalent: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    strongerSignal_0_06: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    strongerSignal_0_08: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    strongerSignal_0_10: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    recommendation: {
      bestVariantByEdge: string | null;
      bestVariantByCumulativeReturn: string | null;
    };
  };
  signalRankingShadowAudit?: {
    baselineEquivalent: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    top50pctByAbsSetupScore: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    top30pctByAbsSetupScore: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    top20pctByAbsSetupScore: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    recommendation: {
      bestVariantByEdge: string | null;
      bestVariantByCumulativeReturn: string | null;
      bestVariantByMaxDrawdown: string | null;
    };
  };
  sizingBenchmarkAudit?: {
    liveEqualWeightBaseline: {
      trades: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    shadowWeightedByAbsSetupScoreTimesConviction: {
      trades: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    comparison: {
      cumulativeReturnDeltaShadowMinusLive: number | null;
      edgeDeltaShadowMinusLive: number | null;
      drawdownDeltaShadowMinusLive: number | null;
      currentPreferredSizingMode: string | null;
    };
  };
  positionSizingShadowAudit?: {
    equalWeightBaseline: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      weightedAvgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    weightByAbsSetupScore: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      weightedAvgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    weightByConviction: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      weightedAvgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    weightByAbsSetupScoreTimesConviction: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      weightedAvgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    recommendation: {
      bestVariantByEdge: string | null;
      bestVariantByCumulativeReturn: string | null;
      bestVariantByMaxDrawdown: string | null;
    };
  };
  componentPruningShadowAudit?: {
    currentFull: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    noMacro: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    noSentiment: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    noMacroNoSentiment: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    recommendation: {
      bestVariantByEdge: string | null;
      bestVariantByCumulativeReturn: string | null;
    };
  };
  shortReentryShadowAudit?: {
    longOnlyActualEquivalent: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      longShare: number | null;
      shortShare: number | null;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    longShortShadow: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      longShare: number | null;
      shortShare: number | null;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    recommendation: { keepShortDisabled: boolean | null; reason: string };
  };
  timingAlphaAudit?: {
    executedWindows: { count: number; avgBenchmarkReturnPerExecutedWindow: number | null; cumulativeBenchmarkReturnExecutedWindows: number | null };
    fullHistoryBaseline: { totalRowsConsidered: number | null; avgForwardReturnAllEligibleRows: number | null };
    selectionAlpha: { avgWindowAlphaVsEligibleBaseline: number | null; cumulativeAlphaVsEligibleBaseline: number | null };
    participation: { eligibleRowCount: number | null; executedTradeCount: number | null; executionRate: number | null };
  };
  invertedSignalPerformanceAudit?: {
    baseSignal: { trades: number | null; winRate: number | null; avgTradeReturn: number | null; cumulativeReturn: number | null; benchmarkReturn: number | null; edge: number | null };
    invertedBaseSignal: { trades: number | null; winRate: number | null; avgTradeReturn: number | null; cumulativeReturn: number | null; benchmarkReturn: number | null; edge: number | null };
    postInformationSignal: { trades: number | null; winRate: number | null; avgTradeReturn: number | null; cumulativeReturn: number | null; benchmarkReturn: number | null; edge: number | null };
    invertedPostInformationSignal: { trades: number | null; winRate: number | null; avgTradeReturn: number | null; cumulativeReturn: number | null; benchmarkReturn: number | null; edge: number | null };
  };
  componentInversionShadowAudit?: {
    baseSignal: { actualCorrelation: number | null; invertedCorrelation: number | null };
    postInformationSignal: { actualCorrelation: number | null; invertedCorrelation: number | null };
    technicalContribution: { actualCorrelation: number | null; invertedCorrelation: number | null };
    macroContribution: { actualCorrelation: number | null; invertedCorrelation: number | null };
    sentimentContribution: { actualCorrelation: number | null; invertedCorrelation: number | null };
  };
  alphaComponentAudit?: {
    baseSignal: { correlationWithForwardReturn: number | null; positiveBucketAvgForwardReturn: number | null; negativeBucketAvgForwardReturn: number | null };
    postInformationSignal: { correlationWithForwardReturn: number | null; positiveBucketAvgForwardReturn: number | null; negativeBucketAvgForwardReturn: number | null };
    technicalContribution: { correlationWithForwardReturn: number | null; positiveBucketAvgForwardReturn: number | null; negativeBucketAvgForwardReturn: number | null };
    macroContribution: { correlationWithForwardReturn: number | null; positiveBucketAvgForwardReturn: number | null; negativeBucketAvgForwardReturn: number | null };
    sentimentContribution: { correlationWithForwardReturn: number | null; positiveBucketAvgForwardReturn: number | null; negativeBucketAvgForwardReturn: number | null };
    noiseContribution: { correlationWithForwardReturn: number | null; positiveBucketAvgForwardReturn: number | null; negativeBucketAvgForwardReturn: number | null };
  };
  longOnlyModeAudit?: {
    enabled: boolean;
    skippedShortTrades: number;
    executedLongTrades: number;
  };
  directionCorrectnessAudit?: {
    longTrades: {
      count: number;
      avgReturn: number | null;
      positiveReturnRate: number | null;
      avgBenchmarkReturn: number | null;
    };
    shortTrades: {
      count: number;
      avgReturn: number | null;
      positiveReturnRate: number | null;
      avgBenchmarkReturn: number | null;
    };
    inversionCheck: {
      shortWouldBeBetterIfLong: boolean | null;
      longWouldBeBetterIfShort: boolean | null;
    };
  };
  attenuationRetestNoMacroAudit?: {
    factor_0_10: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    factor_0_25: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    factor_0_50: {
      trades: number | null;
      executedLongTrades: number;
      executedShortTrades: number;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    recommendation: {
      bestFactorByEdge: string | null;
      bestFactorByCumulativeReturn: string | null;
    };
  };
  attenuationComparisonAudit?: {
    factors: Array<{
      factor: number;
      executedLongTrades: number;
      executedShortTrades: number;
      longShare: number | null;
      shortShare: number | null;
      trades: number | null;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    }>;
    recommendedFactorByEdge: number | null;
    recommendedFactorByCumulativeReturn: number | null;
  };
  postFixPerformanceAudit?: {
    tradeMix: {
      executedLongTrades: number;
      executedShortTrades: number;
      longShare: number | null;
      shortShare: number | null;
    };
    performance: {
      trades: number | null;
      winRate: number | null;
      avgTradeReturn: number | null;
      cumulativeReturn: number | null;
      benchmarkReturn: number | null;
      edge: number | null;
      maxDrawdown: number | null;
    };
    directionalQuality: {
      longWinRateIfAvailable: number | null;
      shortWinRateIfAvailable: number | null;
      avgLongReturnIfAvailable: number | null;
      avgShortReturnIfAvailable: number | null;
    };
    scoringPopulation: {
      longSetupCount: number | null;
      shortSetupCount: number | null;
      longExecutedCount: number | null;
      shortExecutedCount: number | null;
    };
  };
  longSetupAttritionAudit?: {
    longPath: {
      setupCount: number;
      afterSignalThresholdCount: number;
      afterConvictionCount: number;
      afterNeutralFilterCount: number;
      afterPriceValidityCount: number;
      executedCount: number;
    };
    shortPath: {
      setupCount: number;
      afterSignalThresholdCount: number;
      afterConvictionCount: number;
      afterNeutralFilterCount: number;
      afterPriceValidityCount: number;
      executedCount: number;
    };
    sampleRejectedLongs: Array<{
      symbol: string;
      timestamp: string;
      rejectionStage: string;
      baseSignal?: number | null;
      postInformationSignal?: number | null;
      conviction?: number | null;
      setupDirection?: string | null;
    }>;
    sampleRejectedShorts: Array<{
      symbol: string;
      timestamp: string;
      rejectionStage: string;
      baseSignal?: number | null;
      postInformationSignal?: number | null;
      conviction?: number | null;
      setupDirection?: string | null;
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

    const tradeDirectionDiagnosticsCrowd = await this.computeTradeDirectionDiagnosticsCrowd(
      latestRun?.id ?? null,
      sym,
    );

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
        const tradeDirectionDivergence = this.computeTradeDirectionDivergence(
          r.tradeDirectionDiagnostics,
          tradeDirectionDiagnosticsCrowd,
        );
        const tradeDirectionDivergenceExplanation = await this.computeTradeDirectionDivergenceExplanation(
          latestRun?.id ?? null,
          sym,
          r.tradeDirectionDiagnostics,
          tradeDirectionDiagnosticsCrowd,
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
          tradeDirectionDiagnosticsCrowd,
          tradeDirectionDivergence,
          tradeDirectionDivergenceExplanation,
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
          setupShadowAudit: r.setupShadowAudit,
          setupScoreAudit: r.setupScoreAudit,
          signalFlipAudit: r.signalFlipAudit,
          currentStrategyConfigAudit: r.currentStrategyConfigAudit,
          liveDirectionModeAudit: r.liveDirectionModeAudit,
          macroPrunedLiveAudit: r.macroPrunedLiveAudit,
          officialBaselineAudit: r.officialBaselineAudit,
          sentimentPrunedLiveAudit: r.sentimentPrunedLiveAudit,
          baselinePreservationAudit: r.baselinePreservationAudit,
          winningBaselineFeatureAudit: r.winningBaselineFeatureAudit,
          strongSignalLiveAudit: r.strongSignalLiveAudit,
          outOfSampleAudit: r.outOfSampleAudit,
          walkForwardAudit: r.walkForwardAudit,
          strategyV1CandidateAudit: r.strategyV1CandidateAudit,
          strategyV2CandidateAudit: r.strategyV2CandidateAudit,
          liveExitPolicyAudit: r.liveExitPolicyAudit,
          exitPolicyShadowAudit: r.exitPolicyShadowAudit,
          executionRealismAudit: r.executionRealismAudit,
          frictionSensitivityAudit: r.frictionSensitivityAudit,
          concurrencyExposureAudit: r.concurrencyExposureAudit,
          capitalConstraintShadowAudit: r.capitalConstraintShadowAudit,
          deployableStrategyCandidateAudit: r.deployableStrategyCandidateAudit,
          strategyComparisonSummaryAudit: r.strategyComparisonSummaryAudit,
          regimePerformanceAudit: r.regimePerformanceAudit,
          downtrendSuppressionShadowAudit: r.downtrendSuppressionShadowAudit,
          causalRegimePolicyShadowAudit: r.causalRegimePolicyShadowAudit,
          regimePolicyShadowAudit: r.regimePolicyShadowAudit,
          experimentHarnessAudit: r.experimentHarnessAudit,
          setupGateConsistencyAudit: r.setupGateConsistencyAudit,
          neutralGateConsistencyAudit: r.neutralGateConsistencyAudit,
          neutralFilterAudit: r.neutralFilterAudit,
          longSetupAttritionAudit: r.longSetupAttritionAudit,
          postFixPerformanceAudit: r.postFixPerformanceAudit,
          attenuationComparisonAudit: r.attenuationComparisonAudit,
          attenuationRetestNoMacroAudit: r.attenuationRetestNoMacroAudit,
          directionCorrectnessAudit: r.directionCorrectnessAudit,
          longOnlyModeAudit: r.longOnlyModeAudit,
          alphaComponentAudit: r.alphaComponentAudit,
          componentInversionShadowAudit: r.componentInversionShadowAudit,
          invertedSignalPerformanceAudit: r.invertedSignalPerformanceAudit,
          timingAlphaAudit: r.timingAlphaAudit,
          shortReentryShadowAudit: r.shortReentryShadowAudit,
          componentPruningShadowAudit: r.componentPruningShadowAudit,
          signalRankingShadowAudit: r.signalRankingShadowAudit,
          positionSizingShadowAudit: r.positionSizingShadowAudit,
          sizingBenchmarkAudit: r.sizingBenchmarkAudit,
          strongSignalShadowAudit: r.strongSignalShadowAudit,
          shadowBenchmarkAudit: r.shadowBenchmarkAudit,
        };
      })()),
    };
  }

  private static readonly PREDICTION_HORIZON_DAYS = 5;
  private static readonly HOLDING_PERIOD_DAYS = 5;
  private static readonly MOMENTUM_THRESHOLD_SETUP = 0.01;
  /** Phase 29.6: symmetric LONG/SHORT gate; matches directionThreshold in runBacktestWithThresholds. */
  private static readonly SIGNAL_STRENGTH_MIN = 0.05;
  private static readonly LIVE_ACTIVE_SETUP_SCORE_ABS_THRESHOLD = 0.06;
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
    setupDirectionAudit: NonNullable<DashboardSummary["setupDirectionAudit"]>;
    setupShadowAudit: NonNullable<DashboardSummary["setupShadowAudit"]>;
    setupScoreAudit: NonNullable<DashboardSummary["setupScoreAudit"]>;
    signalFlipAudit: NonNullable<DashboardSummary["signalFlipAudit"]>;
    currentStrategyConfigAudit: NonNullable<DashboardSummary["currentStrategyConfigAudit"]>;
    liveDirectionModeAudit: NonNullable<DashboardSummary["liveDirectionModeAudit"]>;
    macroPrunedLiveAudit: NonNullable<DashboardSummary["macroPrunedLiveAudit"]>;
    officialBaselineAudit: NonNullable<DashboardSummary["officialBaselineAudit"]>;
    sentimentPrunedLiveAudit: NonNullable<DashboardSummary["sentimentPrunedLiveAudit"]>;
    baselinePreservationAudit: NonNullable<DashboardSummary["baselinePreservationAudit"]>;
    winningBaselineFeatureAudit: NonNullable<DashboardSummary["winningBaselineFeatureAudit"]>;
    strongSignalLiveAudit: NonNullable<DashboardSummary["strongSignalLiveAudit"]>;
    outOfSampleAudit: NonNullable<DashboardSummary["outOfSampleAudit"]>;
    walkForwardAudit: NonNullable<DashboardSummary["walkForwardAudit"]>;
    strategyV1CandidateAudit: NonNullable<DashboardSummary["strategyV1CandidateAudit"]>;
    strategyV2CandidateAudit: NonNullable<DashboardSummary["strategyV2CandidateAudit"]>;
    liveExitPolicyAudit: NonNullable<DashboardSummary["liveExitPolicyAudit"]>;
    exitPolicyShadowAudit: NonNullable<DashboardSummary["exitPolicyShadowAudit"]>;
    executionRealismAudit: NonNullable<DashboardSummary["executionRealismAudit"]>;
    frictionSensitivityAudit: NonNullable<DashboardSummary["frictionSensitivityAudit"]>;
    concurrencyExposureAudit: NonNullable<DashboardSummary["concurrencyExposureAudit"]>;
    capitalConstraintShadowAudit: NonNullable<DashboardSummary["capitalConstraintShadowAudit"]>;
    deployableStrategyCandidateAudit: NonNullable<DashboardSummary["deployableStrategyCandidateAudit"]>;
    strategyComparisonSummaryAudit: NonNullable<DashboardSummary["strategyComparisonSummaryAudit"]>;
    regimePerformanceAudit: NonNullable<DashboardSummary["regimePerformanceAudit"]>;
    downtrendSuppressionShadowAudit: NonNullable<DashboardSummary["downtrendSuppressionShadowAudit"]>;
    causalRegimePolicyShadowAudit: NonNullable<DashboardSummary["causalRegimePolicyShadowAudit"]>;
    regimePolicyShadowAudit: NonNullable<DashboardSummary["regimePolicyShadowAudit"]>;
    experimentHarnessAudit: NonNullable<DashboardSummary["experimentHarnessAudit"]>;
    setupGateConsistencyAudit: NonNullable<DashboardSummary["setupGateConsistencyAudit"]>;
    neutralGateConsistencyAudit: NonNullable<DashboardSummary["neutralGateConsistencyAudit"]>;
    neutralFilterAudit: NonNullable<DashboardSummary["neutralFilterAudit"]>;
    longSetupAttritionAudit: NonNullable<DashboardSummary["longSetupAttritionAudit"]>;
    postFixPerformanceAudit: NonNullable<DashboardSummary["postFixPerformanceAudit"]>;
    attenuationComparisonAudit: NonNullable<DashboardSummary["attenuationComparisonAudit"]>;
    attenuationRetestNoMacroAudit: NonNullable<DashboardSummary["attenuationRetestNoMacroAudit"]>;
    directionCorrectnessAudit: NonNullable<DashboardSummary["directionCorrectnessAudit"]>;
    longOnlyModeAudit: NonNullable<DashboardSummary["longOnlyModeAudit"]>;
    alphaComponentAudit: NonNullable<DashboardSummary["alphaComponentAudit"]>;
    componentInversionShadowAudit: NonNullable<DashboardSummary["componentInversionShadowAudit"]>;
    invertedSignalPerformanceAudit: NonNullable<DashboardSummary["invertedSignalPerformanceAudit"]>;
    timingAlphaAudit: NonNullable<DashboardSummary["timingAlphaAudit"]>;
    shortReentryShadowAudit: NonNullable<DashboardSummary["shortReentryShadowAudit"]>;
    componentPruningShadowAudit: NonNullable<DashboardSummary["componentPruningShadowAudit"]>;
    signalRankingShadowAudit: NonNullable<DashboardSummary["signalRankingShadowAudit"]>;
    positionSizingShadowAudit: NonNullable<DashboardSummary["positionSizingShadowAudit"]>;
    sizingBenchmarkAudit: NonNullable<DashboardSummary["sizingBenchmarkAudit"]>;
    strongSignalShadowAudit: NonNullable<DashboardSummary["strongSignalShadowAudit"]>;
    shadowBenchmarkAudit: NonNullable<DashboardSummary["shadowBenchmarkAudit"]>;
  } {
    const horizon = DashboardService.HOLDING_PERIOD_DAYS;
    const { signalStrengthThreshold, convictionThreshold, neutralThreshold } = params;

    const ENABLE_SIGNAL_FLIP = true;
    const ENABLE_SHORT_TRADES = true;
    const SETUP_DELTA_ATTENUATION = 0.25;
    const EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE = true;
    const EXCLUDE_SENTIMENT_FROM_LIVE_SETUP_SCORE = true;
    const LIVE_STOP_LOSS_ENABLED = true;
    const LIVE_STOP_LOSS_PERCENT = 3;

    const strongSignalLiveAudit: NonNullable<DashboardSummary["strongSignalLiveAudit"]> = {
      enabled: true,
      activeSetupScoreAbsThreshold: signalStrengthThreshold,
      activeSetupScoreFormula: `-(baseSignal + (meanSignal - macroContribution - sentimentContribution - baseSignal) * ${SETUP_DELTA_ATTENUATION})`,
    };

    const tradeReturns: number[] = [];
    const benchmarkReturns: number[] = [];
    const eligibleForwardReturns: number[] = [];
    const longTradeReturns: number[] = [];
    const shortTradeReturns: number[] = [];
    const alphaComponentVals: { baseSignal: number[]; postInformationSignal: number[]; technicalContribution: number[]; macroContribution: number[]; sentimentContribution: number[]; noiseContribution: number[]; rawReturn: number[] } = {
      baseSignal: [],
      postInformationSignal: [],
      technicalContribution: [],
      macroContribution: [],
      sentimentContribution: [],
      noiseContribution: [],
      rawReturn: [],
    };
    let executedLongTrades = 0;
    let executedShortTrades = 0;
    let skippedShortTrades = 0;
    const sampleTradeDirections: NonNullable<DashboardSummary["tradeDirectionDiagnostics"]>["sampleTradeDirections"] = [];
    const execBaseSignal: number[] = [];
    const execTechnical: number[] = [];
    const execNoise: number[] = [];
    const execConviction: number[] = [];
    const execTimestamps: number[] = [];
    const execIsLong: boolean[] = [];
    const execPriceVsMa20: number[] = [];
    const execActiveSetupScore: number[] = [];
    const execSymbol: string[] = [];
    const execEntryIndex: number[] = [];

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
    const byTypeSums: Record<
      AgentProfileType,
      { sumSignal: number; positiveCount: number; negativeCount: number; neutralCount: number }
    > = {
      trendFollower: { sumSignal: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0 },
      contrarian: { sumSignal: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0 },
      balanced: { sumSignal: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0 },
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
    const shadowCounts = {
      baseOnly: { longSetupCount: 0, shortSetupCount: 0, noneSetupCount: 0 },
      shadow25: { longSetupCount: 0, shortSetupCount: 0, noneSetupCount: 0 },
      shadow50: { longSetupCount: 0, shortSetupCount: 0, noneSetupCount: 0 },
      actual: { longSetupCount: 0, shortSetupCount: 0, noneSetupCount: 0 },
    };
    let sumSetupScore = 0;
    let setupScoreCount = 0;
    let positiveSetupScoreCount = 0;
    let negativeSetupScoreCount = 0;
    let rejectedLongBelowSignalThreshold = 0;
    let rejectedLongBelowConvictionThreshold = 0;
    let rejectedShortBelowSignalThreshold = 0;
    let rejectedShortBelowConvictionThreshold = 0;
    const attritionLong = {
      afterSignalThresholdCount: 0,
      afterNeutralFilterCount: 0,
      afterConvictionCount: 0,
      afterPriceValidityCount: 0,
    };
    const attritionShort = {
      afterSignalThresholdCount: 0,
      afterNeutralFilterCount: 0,
      afterConvictionCount: 0,
      afterPriceValidityCount: 0,
    };
    const sampleRejectedLongs: NonNullable<DashboardSummary["longSetupAttritionAudit"]>["sampleRejectedLongs"] = [];
    const sampleRejectedShorts: NonNullable<DashboardSummary["longSetupAttritionAudit"]>["sampleRejectedShorts"] = [];
    const neutralAuditLong = {
      enteredNeutralStageCount: 0,
      passedNeutralCount: 0,
      rejectedNeutralCount: 0,
      sumConviction: 0,
      sumNeutralMetric: 0,
    };
    const neutralAuditShort = {
      enteredNeutralStageCount: 0,
      passedNeutralCount: 0,
      rejectedNeutralCount: 0,
      sumConviction: 0,
      sumNeutralMetric: 0,
    };
    const sampleNeutralRejectedLongs: NonNullable<DashboardSummary["neutralFilterAudit"]>["sampleRejectedLongs"] = [];
    const sampleNeutralRejectedShorts: NonNullable<DashboardSummary["neutralFilterAudit"]>["sampleRejectedShorts"] = [];
    let loopIterationCount = 0;
    let featAvailableCount = 0;
    let cvDebugTradeDirSamples = 0;

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
        const decompForSetup = computeSignalDecomposition(feat, agents, contextSeed, prevContextSeed);
        const setupBase = decompForSetup.baseSignal;
        let setupMeanForScore = decompForSetup.meanSignal;
        if (EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE) setupMeanForScore -= decompForSetup.macroContribution;
        if (EXCLUDE_SENTIMENT_FROM_LIVE_SETUP_SCORE) setupMeanForScore -= decompForSetup.sentimentContribution;
        const setupDelta = setupMeanForScore - setupBase;
        const rawSetupScore = setupBase + setupDelta * SETUP_DELTA_ATTENUATION;
        const activeSetupScore = ENABLE_SIGNAL_FLIP ? -rawSetupScore : rawSetupScore;
        sumSetupScore += rawSetupScore;
        setupScoreCount++;
        if (rawSetupScore > 0) positiveSetupScoreCount++;
        else if (rawSetupScore < 0) negativeSetupScoreCount++;
        let setup: "LONG" | "SHORT" | null = null;
        if (activeSetupScore >= directionThreshold) setup = "LONG";
        else if (activeSetupScore <= -directionThreshold) setup = "SHORT";

        if (process.env.CV_DEBUG_TRADE_DIRECTION === "1" && cvDebugTradeDirSamples < 500) {
          cvDebugTradeDirSamples++;
          const nAgents = agents.length;
          const buyPct = nAgents > 0 ? (100 * iterPosCount) / nAgents : 0;
          const sellPct = nAgents > 0 ? (100 * iterNegCount) / nAgents : 0;
          const holdPct = nAgents > 0 ? (100 * (nAgents - iterPosCount - iterNegCount)) / nAgents : 0;
          const chosenDirection = setup ?? "NONE";
          const reason =
            setup === "LONG"
              ? `LONG: activeSetupScore (${activeSetupScore}) >= directionThreshold (${directionThreshold}); side from decomposed setup score (base + attenuated delta, optional flip), not decide BUY/SELL/HOLD plurality`
              : setup === "SHORT"
                ? `SHORT: activeSetupScore (${activeSetupScore}) <= -directionThreshold (${-directionThreshold}); side from decomposed setup score, not decide plurality`
                : `NONE: |activeSetupScore| (${Math.abs(activeSetupScore)}) did not cross threshold (${directionThreshold}); buyPct/sellPct/holdPct here are agent-score sign shares (positive/negative/zero), not decide.ts vote %`;
          console.log(
            JSON.stringify({
              tag: "TRADE_DIRECTION_CHOSEN",
              step: i,
              assetSymbol: symbol,
              crowdSignal: meanSignal,
              buyPct,
              sellPct,
              holdPct,
              chosenDirection,
              preMappingDirection,
              activeSetupScore,
              rawSetupScore,
              directionThreshold,
              signalFlipEnabled: ENABLE_SIGNAL_FLIP,
              reason,
            }),
          );
        }

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
            const decompK = computeSignalDecomposition(fk, agents, kSeed, kPrevSeed);
            let meanKForScore = decompK.meanSignal;
            if (EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE) meanKForScore -= decompK.macroContribution;
            if (EXCLUDE_SENTIMENT_FROM_LIVE_SETUP_SCORE) meanKForScore -= decompK.sentimentContribution;
            const rawK = decompK.baseSignal + (meanKForScore - decompK.baseSignal) * SETUP_DELTA_ATTENUATION;
            const activeSetupScoreK = ENABLE_SIGNAL_FLIP ? -rawK : rawK;
            if (Math.abs(activeSetupScoreK) < signalStrengthThreshold) neutralCount++;
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

        const shadowBase = decompForSetup.baseSignal;
        const shadowPost = decompForSetup.meanSignal;
        const shadowDelta = shadowPost - shadowBase;
        const applySetupRule = (score: number): "LONG" | "SHORT" | "NONE" => {
          if (score >= directionThreshold) return "LONG";
          if (score <= -directionThreshold) return "SHORT";
          return "NONE";
        };
        const dirBaseOnly = applySetupRule(shadowBase);
        const dirShadow25 = applySetupRule(shadowBase + shadowDelta * 0.25);
        const dirShadow50 = applySetupRule(shadowBase + shadowDelta * 0.5);
        const dirActual = applySetupRule(shadowPost);
        if (dirBaseOnly === "LONG") shadowCounts.baseOnly.longSetupCount++;
        else if (dirBaseOnly === "SHORT") shadowCounts.baseOnly.shortSetupCount++;
        else shadowCounts.baseOnly.noneSetupCount++;
        if (dirShadow25 === "LONG") shadowCounts.shadow25.longSetupCount++;
        else if (dirShadow25 === "SHORT") shadowCounts.shadow25.shortSetupCount++;
        else shadowCounts.shadow25.noneSetupCount++;
        if (dirShadow50 === "LONG") shadowCounts.shadow50.longSetupCount++;
        else if (dirShadow50 === "SHORT") shadowCounts.shadow50.shortSetupCount++;
        else shadowCounts.shadow50.noneSetupCount++;
        if (dirActual === "LONG") shadowCounts.actual.longSetupCount++;
        else if (dirActual === "SHORT") shadowCounts.actual.shortSetupCount++;
        else shadowCounts.actual.noneSetupCount++;
        const setupSampleEntry = {
          symbol,
          timestamp: (i < timestamps.length ? timestamps[i] : null)?.toISOString() ?? "",
          setupDirection: setup ?? "NONE",
          baseSignal: shadowBase,
          postInformationSignal: shadowPost,
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
        if (Math.abs(activeSetupScore) <= signalStrengthThreshold) {
          const rejEntry = {
            symbol,
            timestamp: (i < timestamps.length ? timestamps[i] : null)?.toISOString() ?? "",
            rejectionStage: "signalStrength",
            baseSignal: shadowBase,
            postInformationSignal: shadowPost,
            conviction,
            setupDirection: setup ?? null,
          };
          if (setup === "LONG" && sampleRejectedLongs.length < 10) sampleRejectedLongs.push(rejEntry);
          if (setup === "SHORT" && sampleRejectedShorts.length < 10) sampleRejectedShorts.push(rejEntry);
          continue;
        }
        passedSignalStrength++;
        if (setup === "LONG") attritionLong.afterSignalThresholdCount++;
        if (setup === "SHORT") attritionShort.afterSignalThresholdCount++;

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

        if (setup === "LONG") {
          neutralAuditLong.enteredNeutralStageCount++;
          neutralAuditLong.sumConviction += conviction;
          neutralAuditLong.sumNeutralMetric += probabilityNeutral;
        }
        if (setup === "SHORT") {
          neutralAuditShort.enteredNeutralStageCount++;
          neutralAuditShort.sumConviction += conviction;
          neutralAuditShort.sumNeutralMetric += probabilityNeutral;
        }
        if (probabilityNeutral >= neutralThreshold) {
          const rejEntry = {
            symbol,
            timestamp: (i < timestamps.length ? timestamps[i] : null)?.toISOString() ?? "",
            rejectionStage: "neutral",
            baseSignal: decompPre.baseSignal,
            postInformationSignal: decompPre.meanSignal,
            conviction,
            setupDirection: setup ?? null,
          };
          if (setup === "LONG" && sampleRejectedLongs.length < 10) sampleRejectedLongs.push(rejEntry);
          if (setup === "SHORT" && sampleRejectedShorts.length < 10) sampleRejectedShorts.push(rejEntry);
          const neutralRejEntry = {
            symbol,
            timestamp: (i < timestamps.length ? timestamps[i] : null)?.toISOString() ?? "",
            conviction,
            neutralMetricIfExists: probabilityNeutral,
            baseSignal: decompPre.baseSignal,
            postInformationSignal: decompPre.meanSignal,
            setupScoreIfExists: activeSetupScore,
          };
          if (setup === "LONG") {
            neutralAuditLong.rejectedNeutralCount++;
            if (sampleNeutralRejectedLongs.length < 10) sampleNeutralRejectedLongs.push(neutralRejEntry);
          }
          if (setup === "SHORT") {
            neutralAuditShort.rejectedNeutralCount++;
            if (sampleNeutralRejectedShorts.length < 10) sampleNeutralRejectedShorts.push(neutralRejEntry);
          }
          continue;
        }
        if (setup === "LONG") {
          attritionLong.afterNeutralFilterCount++;
          neutralAuditLong.passedNeutralCount++;
        }
        if (setup === "SHORT") {
          attritionShort.afterNeutralFilterCount++;
          neutralAuditShort.passedNeutralCount++;
        }

        if (conviction < convictionThreshold) {
          const rejEntry = {
            symbol,
            timestamp: (i < timestamps.length ? timestamps[i] : null)?.toISOString() ?? "",
            rejectionStage: "conviction",
            baseSignal: decompPre.baseSignal,
            postInformationSignal: decompPre.meanSignal,
            conviction,
            setupDirection: setup ?? null,
          };
          if (setup === "LONG" && sampleRejectedLongs.length < 10) sampleRejectedLongs.push(rejEntry);
          if (setup === "SHORT" && sampleRejectedShorts.length < 10) sampleRejectedShorts.push(rejEntry);
          continue;
        }
        passedConviction++;
        if (setup === "LONG") attritionLong.afterConvictionCount++;
        if (setup === "SHORT") attritionShort.afterConvictionCount++;

        const priceT0 = closes[i]!;
        const priceT1 = closes[i + horizon]!;
        if (priceT0 <= 0 || !Number.isFinite(priceT0) || !Number.isFinite(priceT1)) {
          const rejEntry = {
            symbol,
            timestamp: (i < timestamps.length ? timestamps[i] : null)?.toISOString() ?? "",
            rejectionStage: "priceValidity",
            baseSignal: decompPre.baseSignal,
            postInformationSignal: decompPre.meanSignal,
            conviction,
            setupDirection: setup ?? null,
          };
          if (setup === "LONG" && sampleRejectedLongs.length < 10) sampleRejectedLongs.push(rejEntry);
          if (setup === "SHORT" && sampleRejectedShorts.length < 10) sampleRejectedShorts.push(rejEntry);
          continue;
        }
        if (setup === "LONG") attritionLong.afterPriceValidityCount++;
        if (setup === "SHORT") attritionShort.afterPriceValidityCount++;

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
          byTypeSums[t].neutralCount += bt.count - bt.positiveCount - bt.negativeCount;
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

        let rawReturn = (priceT1 - priceT0) / priceT0;
        let effectiveStrategyReturn: number | null = null;
        if (LIVE_STOP_LOSS_ENABLED) {
          for (let d = 1; d <= horizon; d++) {
            const pd = closes[i + d]!;
            const rawD = (pd - priceT0) / priceT0;
            if (setup === "LONG" && rawD <= -0.03) {
              rawReturn = rawD;
              effectiveStrategyReturn = -0.03;
              break;
            }
            if (setup === "SHORT" && rawD >= 0.03) {
              rawReturn = rawD;
              effectiveStrategyReturn = -0.03;
              break;
            }
          }
        }
        eligibleForwardReturns.push(rawReturn);

        if (!ENABLE_SHORT_TRADES && setup === "SHORT") {
          skippedShortTrades++;
          continue;
        }

        const tradeReturn = effectiveStrategyReturn != null ? effectiveStrategyReturn : (setup === "LONG" ? rawReturn : -rawReturn);
        tradeReturns.push(tradeReturn);
        benchmarkReturns.push(rawReturn);
        execBaseSignal.push(decomp.baseSignal);
        execTechnical.push(decomp.technicalContribution);
        execNoise.push(decomp.noiseContribution);
        execConviction.push(conviction);
        execTimestamps.push((i < timestamps.length ? timestamps[i] : null)?.getTime() ?? 0);
        execIsLong.push(setup === "LONG");
        execPriceVsMa20.push(priceVsMa20);
        execActiveSetupScore.push(Math.abs(activeSetupScore));
        execSymbol.push(symbol);
        execEntryIndex.push(i);
        if (setup === "LONG") {
          longTradeReturns.push(tradeReturn);
          alphaComponentVals.baseSignal.push(decomp.baseSignal);
          alphaComponentVals.postInformationSignal.push(decomp.meanSignal);
          alphaComponentVals.technicalContribution.push(decomp.technicalContribution);
          alphaComponentVals.macroContribution.push(decomp.macroContribution);
          alphaComponentVals.sentimentContribution.push(decomp.sentimentContribution);
          alphaComponentVals.noiseContribution.push(decomp.noiseContribution);
          alphaComponentVals.rawReturn.push(rawReturn);
        } else shortTradeReturns.push(tradeReturn);

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

    const ATTENUATION_FACTORS = [0, 0.1, 0.25, 0.5, 1] as const;
    const attenuationFactorResults: NonNullable<DashboardSummary["attenuationComparisonAudit"]>["factors"] = [];
    for (const compFactor of ATTENUATION_FACTORS) {
      const compTradeReturns: number[] = [];
      const compBenchmarkReturns: number[] = [];
      let compExecutedLong = 0;
      let compExecutedShort = 0;
      for (const [symbol, { closes, timestamps }] of cachedData) {
        const features = featuresCache.get(symbol);
        if (!features) continue;
        for (let i = 5 + DashboardService.NEUTRAL_LOOKBACK; i < closes.length - horizon; i++) {
          if (i >= features.length) break;
          const feat = features[i];
          if (!feat) continue;
          const contextSeed = hashString(symbol + ":" + String(i));
          const prevContextSeed =
            i > 5 + DashboardService.NEUTRAL_LOOKBACK
              ? hashString(symbol + ":" + String(i - 1))
              : undefined;
          const { disagreement, signalStrength } =
            computeAgentAggregatedSignalForFeatures(feat, agents, contextSeed, prevContextSeed);
          const decompForSetup = computeSignalDecomposition(feat, agents, contextSeed, prevContextSeed);
          const setupBase = decompForSetup.baseSignal;
          const setupDelta = decompForSetup.meanSignal - setupBase;
          const setupScore = setupBase + setupDelta * compFactor;
          let setup: "LONG" | "SHORT" | null = null;
          if (setupScore >= signalStrengthThreshold) setup = "LONG";
          else if (setupScore <= -signalStrengthThreshold) setup = "SHORT";
          if (setup == null) continue;
          if (Math.abs(setupScore) <= signalStrengthThreshold) continue;
          let probabilityNeutral = 0.5;
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
            const decompK = computeSignalDecomposition(fk, agents, kSeed, kPrevSeed);
            const setupScoreK = decompK.baseSignal + (decompK.meanSignal - decompK.baseSignal) * compFactor;
            if (Math.abs(setupScoreK) < signalStrengthThreshold) neutralCount++;
          }
          probabilityNeutral = validLookbackDays > 0 ? neutralCount / validLookbackDays : 0.5;
          if (probabilityNeutral >= neutralThreshold) continue;
          const conviction =
            signalStrength * 0.5 +
            (1 - disagreement) * 0.3 +
            (1 - probabilityNeutral) * 0.2;
          if (conviction < convictionThreshold) continue;
          const priceT0 = closes[i]!;
          const priceT1 = closes[i + horizon]!;
          if (priceT0 <= 0 || !Number.isFinite(priceT0) || !Number.isFinite(priceT1)) continue;
          const rawReturn = (priceT1 - priceT0) / priceT0;
          const tradeReturn = setup === "LONG" ? rawReturn : -rawReturn;
          compTradeReturns.push(tradeReturn);
          compBenchmarkReturns.push(rawReturn);
          if (setup === "LONG") compExecutedLong++;
          else compExecutedShort++;
        }
      }
      const compTrades = compTradeReturns.length;
      const compWins = compTrades > 0 ? compTradeReturns.filter((r) => r > 0).length : 0;
      const compCumulativeStrategy = compTrades > 0 ? compTradeReturns.reduce((a, b) => a + b, 0) : 0;
      const compCumulativeBenchmark = compTrades > 0 ? compBenchmarkReturns.reduce((a, b) => a + b, 0) : 0;
      let compEquity = 1;
      let compPeak = 1;
      let compMaxDrawdown = 0;
      for (const r of compTradeReturns) {
        compEquity *= 1 + r;
        if (compEquity > compPeak) compPeak = compEquity;
        const dd = compPeak > 0 ? (compPeak - compEquity) / compPeak : 0;
        if (dd > compMaxDrawdown) compMaxDrawdown = dd;
      }
      const compTotal = compExecutedLong + compExecutedShort;
      attenuationFactorResults.push({
        factor: compFactor,
        executedLongTrades: compExecutedLong,
        executedShortTrades: compExecutedShort,
        longShare: compTotal > 0 ? compExecutedLong / compTotal : null,
        shortShare: compTotal > 0 ? compExecutedShort / compTotal : null,
        trades: compTrades,
        winRate: compTrades > 0 ? compWins / compTrades : null,
        avgTradeReturn: compTrades > 0 ? compTradeReturns.reduce((a, b) => a + b, 0) / compTrades : null,
        cumulativeReturn: compTrades > 0 ? compCumulativeStrategy : null,
        benchmarkReturn: compTrades > 0 ? compCumulativeBenchmark : null,
        edge: compTrades > 0 ? compCumulativeStrategy - compCumulativeBenchmark : null,
        maxDrawdown: compTrades > 0 ? compMaxDrawdown : null,
      });
    }
    const bestByEdge = attenuationFactorResults.filter((r) => r.edge != null).sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0))[0];
    const bestByCumulative = attenuationFactorResults.filter((r) => r.cumulativeReturn != null).sort((a, b) => (b.cumulativeReturn ?? 0) - (a.cumulativeReturn ?? 0))[0];
    const attenuationComparisonAudit: NonNullable<DashboardSummary["attenuationComparisonAudit"]> = {
      factors: attenuationFactorResults,
      recommendedFactorByEdge: bestByEdge?.factor ?? null,
      recommendedFactorByCumulativeReturn: bestByCumulative?.factor ?? null,
    };

    type AttenuationRetestRow = NonNullable<DashboardSummary["attenuationRetestNoMacroAudit"]>["factor_0_10"];
    const runAttenuationRetestNoMacro = (factor: number): { row: AttenuationRetestRow } => {
      const tr: number[] = [];
      const br: number[] = [];
      let nLong = 0;
      let nShort = 0;
      for (const [symbol, { closes }] of cachedData) {
        const features = featuresCache.get(symbol);
        if (!features) continue;
        for (let i = 5 + DashboardService.NEUTRAL_LOOKBACK; i < closes.length - horizon; i++) {
          if (i >= features.length) break;
          const feat = features[i];
          if (!feat) continue;
          const contextSeed = hashString(symbol + ":" + String(i));
          const prevContextSeed = i > 5 + DashboardService.NEUTRAL_LOOKBACK ? hashString(symbol + ":" + String(i - 1)) : undefined;
          const { disagreement, signalStrength } = computeAgentAggregatedSignalForFeatures(feat, agents, contextSeed, prevContextSeed);
          const decomp = computeSignalDecomposition(feat, agents, contextSeed, prevContextSeed);
          const meanForScore = decomp.meanSignal - decomp.macroContribution;
          const rawScore = decomp.baseSignal + (meanForScore - decomp.baseSignal) * factor;
          const activeScore = -rawScore;
          let setup: "LONG" | "SHORT" | null = null;
          if (activeScore >= signalStrengthThreshold) setup = "LONG";
          else if (activeScore <= -signalStrengthThreshold) setup = "SHORT";
          if (setup == null) continue;
          if (Math.abs(activeScore) <= signalStrengthThreshold) continue;
          let neutralCount = 0;
          let validLookbackDays = 0;
          for (let k = i - DashboardService.NEUTRAL_LOOKBACK; k < i && k >= DashboardService.MIN_LOOKBACK_FOR_FEATURES; k++) {
            const fk = features[k];
            if (!fk) continue;
            validLookbackDays++;
            const decompK = computeSignalDecomposition(fk, agents, hashString(symbol + ":" + String(k)), k > DashboardService.MIN_LOOKBACK_FOR_FEATURES ? hashString(symbol + ":" + String(k - 1)) : undefined);
            const meanKForScore = decompK.meanSignal - decompK.macroContribution;
            const rawK = decompK.baseSignal + (meanKForScore - decompK.baseSignal) * factor;
            const activeK = -rawK;
            if (Math.abs(activeK) < signalStrengthThreshold) neutralCount++;
          }
          const probabilityNeutral = validLookbackDays > 0 ? neutralCount / validLookbackDays : 0.5;
          if (probabilityNeutral >= neutralThreshold) continue;
          const conviction = signalStrength * 0.5 + (1 - disagreement) * 0.3 + (1 - probabilityNeutral) * 0.2;
          if (conviction < convictionThreshold) continue;
          const priceT0 = closes[i]!;
          const priceT1 = closes[i + horizon]!;
          if (priceT0 <= 0 || !Number.isFinite(priceT0) || !Number.isFinite(priceT1)) continue;
          const rawReturn = (priceT1 - priceT0) / priceT0;
          const tradeReturn = setup === "LONG" ? rawReturn : -rawReturn;
          tr.push(tradeReturn);
          br.push(rawReturn);
          if (setup === "LONG") nLong++;
          else nShort++;
        }
      }
      const n = tr.length;
      if (n === 0) {
        return {
          row: {
            trades: null,
            executedLongTrades: nLong,
            executedShortTrades: nShort,
            winRate: null,
            avgTradeReturn: null,
            cumulativeReturn: null,
            benchmarkReturn: null,
            edge: null,
            maxDrawdown: null,
          },
        };
      }
      const wins = tr.filter((r) => r > 0).length;
      const cumStrategy = tr.reduce((a, b) => a + b, 0);
      const cumBench = br.reduce((a, b) => a + b, 0);
      let equity = 1;
      let peak = 1;
      let maxDd = 0;
      for (const r of tr) {
        equity *= 1 + r;
        if (equity > peak) peak = equity;
        const dd = peak > 0 ? (peak - equity) / peak : 0;
        if (dd > maxDd) maxDd = dd;
      }
      return {
        row: {
          trades: n,
          executedLongTrades: nLong,
          executedShortTrades: nShort,
          winRate: wins / n,
          avgTradeReturn: cumStrategy / n,
          cumulativeReturn: cumStrategy,
          benchmarkReturn: cumBench,
          edge: cumStrategy - cumBench,
          maxDrawdown: maxDd,
        },
      };
    };

    const retest010 = runAttenuationRetestNoMacro(0.10);
    const retest025 = runAttenuationRetestNoMacro(0.25);
    const retest050 = runAttenuationRetestNoMacro(0.5);

    const retestVariants = [
      { key: "factor_0_10" as const, row: retest010.row },
      { key: "factor_0_25" as const, row: retest025.row },
      { key: "factor_0_50" as const, row: retest050.row },
    ];
    const retestBestByEdge = retestVariants.filter((v) => v.row.edge != null).sort((a, b) => (b.row.edge ?? 0) - (a.row.edge ?? 0))[0];
    const retestBestByCum = retestVariants.filter((v) => v.row.cumulativeReturn != null).sort((a, b) => (b.row.cumulativeReturn ?? 0) - (a.row.cumulativeReturn ?? 0))[0];

    const attenuationRetestNoMacroAudit: NonNullable<DashboardSummary["attenuationRetestNoMacroAudit"]> = {
      factor_0_10: retest010.row,
      factor_0_25: retest025.row,
      factor_0_50: retest050.row,
      recommendation: {
        bestFactorByEdge: retestBestByEdge?.key ?? null,
        bestFactorByCumulativeReturn: retestBestByCum?.key ?? null,
      },
    };

    type InvertedShadowSource = "baseSignal" | "invertedBaseSignal" | "postInformationSignal" | "invertedPostInformationSignal";
    const invertedShadowSources: Array<{ key: InvertedShadowSource; getScore: (d: { baseSignal: number; meanSignal: number }) => number; getLookbackScore: (d: { baseSignal: number; meanSignal: number }) => number }> = [
      { key: "baseSignal", getScore: (d) => d.baseSignal, getLookbackScore: (d) => d.baseSignal },
      { key: "invertedBaseSignal", getScore: (d) => -d.baseSignal, getLookbackScore: (d) => -d.baseSignal },
      { key: "postInformationSignal", getScore: (d) => d.meanSignal, getLookbackScore: (d) => d.meanSignal },
      { key: "invertedPostInformationSignal", getScore: (d) => -d.meanSignal, getLookbackScore: (d) => -d.meanSignal },
    ];
    const invertedShadowResults: Record<InvertedShadowSource, { trades: number; tradeReturns: number[]; benchmarkReturns: number[] }> = {
      baseSignal: { trades: 0, tradeReturns: [], benchmarkReturns: [] },
      invertedBaseSignal: { trades: 0, tradeReturns: [], benchmarkReturns: [] },
      postInformationSignal: { trades: 0, tradeReturns: [], benchmarkReturns: [] },
      invertedPostInformationSignal: { trades: 0, tradeReturns: [], benchmarkReturns: [] },
    };
    for (const src of invertedShadowSources) {
      const tr: number[] = [];
      const br: number[] = [];
      for (const [symbol, { closes }] of cachedData) {
        const features = featuresCache.get(symbol);
        if (!features) continue;
        for (let i = 5 + DashboardService.NEUTRAL_LOOKBACK; i < closes.length - horizon; i++) {
          if (i >= features.length) break;
          const feat = features[i];
          if (!feat) continue;
          const contextSeed = hashString(symbol + ":" + String(i));
          const prevContextSeed = i > 5 + DashboardService.NEUTRAL_LOOKBACK ? hashString(symbol + ":" + String(i - 1)) : undefined;
          const { disagreement, signalStrength } = computeAgentAggregatedSignalForFeatures(feat, agents, contextSeed, prevContextSeed);
          const decomp = computeSignalDecomposition(feat, agents, contextSeed, prevContextSeed);
          const setupScore = src.getScore(decomp);
          let setup: "LONG" | "SHORT" | null = null;
          if (setupScore >= signalStrengthThreshold) setup = "LONG";
          else if (setupScore <= -signalStrengthThreshold) setup = "SHORT";
          if (setup == null) continue;
          if (Math.abs(setupScore) <= signalStrengthThreshold) continue;
          let probabilityNeutral = 0.5;
          let neutralCount = 0;
          let validLookbackDays = 0;
          for (let k = i - DashboardService.NEUTRAL_LOOKBACK; k < i && k >= DashboardService.MIN_LOOKBACK_FOR_FEATURES; k++) {
            const fk = features[k];
            if (!fk) continue;
            validLookbackDays++;
            const kSeed = hashString(symbol + ":" + String(k));
            const kPrevSeed = k > DashboardService.MIN_LOOKBACK_FOR_FEATURES ? hashString(symbol + ":" + String(k - 1)) : undefined;
            const decompK = computeSignalDecomposition(fk, agents, kSeed, kPrevSeed);
            const lookbackScore = src.getLookbackScore(decompK);
            if (Math.abs(lookbackScore) < signalStrengthThreshold) neutralCount++;
          }
          probabilityNeutral = validLookbackDays > 0 ? neutralCount / validLookbackDays : 0.5;
          if (probabilityNeutral >= neutralThreshold) continue;
          const conviction = signalStrength * 0.5 + (1 - disagreement) * 0.3 + (1 - probabilityNeutral) * 0.2;
          if (conviction < convictionThreshold) continue;
          const priceT0 = closes[i]!;
          const priceT1 = closes[i + horizon]!;
          if (priceT0 <= 0 || !Number.isFinite(priceT0) || !Number.isFinite(priceT1)) continue;
          const rawReturn = (priceT1 - priceT0) / priceT0;
          const tradeReturn = setup === "LONG" ? rawReturn : -rawReturn;
          if (setup === "LONG") {
            tr.push(tradeReturn);
            br.push(rawReturn);
          }
        }
      }
      invertedShadowResults[src.key] = { trades: tr.length, tradeReturns: tr, benchmarkReturns: br };
    }
    const toInvertedShadowRow = (res: { trades: number; tradeReturns: number[]; benchmarkReturns: number[] }) => {
      const n = res.trades;
      if (n === 0) return { trades: null, winRate: null, avgTradeReturn: null, cumulativeReturn: null, benchmarkReturn: null, edge: null };
      const wins = res.tradeReturns.filter((r) => r > 0).length;
      const cumStrategy = res.tradeReturns.reduce((a, b) => a + b, 0);
      const cumBench = res.benchmarkReturns.reduce((a, b) => a + b, 0);
      return {
        trades: n,
        winRate: wins / n,
        avgTradeReturn: cumStrategy / n,
        cumulativeReturn: cumStrategy,
        benchmarkReturn: cumBench,
        edge: cumStrategy - cumBench,
      };
    };
    const invertedSignalPerformanceAudit: NonNullable<DashboardSummary["invertedSignalPerformanceAudit"]> = {
      baseSignal: toInvertedShadowRow(invertedShadowResults.baseSignal),
      invertedBaseSignal: toInvertedShadowRow(invertedShadowResults.invertedBaseSignal),
      postInformationSignal: toInvertedShadowRow(invertedShadowResults.postInformationSignal),
      invertedPostInformationSignal: toInvertedShadowRow(invertedShadowResults.invertedPostInformationSignal),
    };

    const execCountForTiming = benchmarkReturns.length;
    const eligibleCount = eligibleForwardReturns.length;
    const avgExecBench = execCountForTiming > 0 ? benchmarkReturns.reduce((a, b) => a + b, 0) / execCountForTiming : null;
    const cumExecBench = execCountForTiming > 0 ? benchmarkReturns.reduce((a, b) => a + b, 0) : null;
    const avgEligible = eligibleCount > 0 ? eligibleForwardReturns.reduce((a, b) => a + b, 0) / eligibleCount : null;
    const timingAlphaAudit: NonNullable<DashboardSummary["timingAlphaAudit"]> = {
      executedWindows: {
        count: execCountForTiming,
        avgBenchmarkReturnPerExecutedWindow: avgExecBench,
        cumulativeBenchmarkReturnExecutedWindows: cumExecBench,
      },
      fullHistoryBaseline: {
        totalRowsConsidered: eligibleCount > 0 ? eligibleCount : null,
        avgForwardReturnAllEligibleRows: avgEligible,
      },
      selectionAlpha: {
        avgWindowAlphaVsEligibleBaseline: avgExecBench != null && avgEligible != null ? avgExecBench - avgEligible : null,
        cumulativeAlphaVsEligibleBaseline:
          cumExecBench != null && avgEligible != null && execCountForTiming > 0
            ? cumExecBench - avgEligible * execCountForTiming
            : null,
      },
      participation: {
        eligibleRowCount: eligibleCount,
        executedTradeCount: execCountForTiming,
        executionRate: eligibleCount > 0 ? execCountForTiming / eligibleCount : null,
      },
    };

    const toShortReentryRow = (
      tr: number[],
      br: number[],
      nLong: number,
      nShort: number,
    ): NonNullable<DashboardSummary["shortReentryShadowAudit"]>["longOnlyActualEquivalent"] => {
      const n = tr.length;
      if (n === 0) {
        return {
          trades: null,
          executedLongTrades: nLong,
          executedShortTrades: nShort,
          longShare: null,
          shortShare: null,
          winRate: null,
          avgTradeReturn: null,
          cumulativeReturn: null,
          benchmarkReturn: null,
          edge: null,
          maxDrawdown: null,
        };
      }
      const total = nLong + nShort;
      const wins = tr.filter((r) => r > 0).length;
      const cumStrategy = tr.reduce((a, b) => a + b, 0);
      const cumBench = br.reduce((a, b) => a + b, 0);
      let equity = 1;
      let peak = 1;
      let maxDd = 0;
      for (const r of tr) {
        equity *= 1 + r;
        if (equity > peak) peak = equity;
        const dd = peak > 0 ? (peak - equity) / peak : 0;
        if (dd > maxDd) maxDd = dd;
      }
      return {
        trades: n,
        executedLongTrades: nLong,
        executedShortTrades: nShort,
        longShare: total > 0 ? nLong / total : null,
        shortShare: total > 0 ? nShort / total : null,
        winRate: wins / n,
        avgTradeReturn: cumStrategy / n,
        cumulativeReturn: cumStrategy,
        benchmarkReturn: cumBench,
        edge: cumStrategy - cumBench,
        maxDrawdown: maxDd,
      };
    };

    const longOnlyRow = toShortReentryRow(tradeReturns, benchmarkReturns, executedLongTrades, executedShortTrades);

    const shadowLongShortTr: number[] = [];
    const shadowLongShortBr: number[] = [];
    let shadowLongCount = 0;
    let shadowShortCount = 0;
    for (const [symbol, { closes }] of cachedData) {
      const features = featuresCache.get(symbol);
      if (!features) continue;
      for (let i = 5 + DashboardService.NEUTRAL_LOOKBACK; i < closes.length - horizon; i++) {
        if (i >= features.length) break;
        const feat = features[i];
        if (!feat) continue;
        const contextSeed = hashString(symbol + ":" + String(i));
        const prevContextSeed = i > 5 + DashboardService.NEUTRAL_LOOKBACK ? hashString(symbol + ":" + String(i - 1)) : undefined;
        const { disagreement, signalStrength } = computeAgentAggregatedSignalForFeatures(feat, agents, contextSeed, prevContextSeed);
        const decomp = computeSignalDecomposition(feat, agents, contextSeed, prevContextSeed);
        let meanForScore = decomp.meanSignal;
        if (EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE) meanForScore -= decomp.macroContribution;
        if (EXCLUDE_SENTIMENT_FROM_LIVE_SETUP_SCORE) meanForScore -= decomp.sentimentContribution;
        const rawScore = decomp.baseSignal + (meanForScore - decomp.baseSignal) * SETUP_DELTA_ATTENUATION;
        const activeScore = ENABLE_SIGNAL_FLIP ? -rawScore : rawScore;
        let setup: "LONG" | "SHORT" | null = null;
        if (activeScore >= signalStrengthThreshold) setup = "LONG";
        else if (activeScore <= -signalStrengthThreshold) setup = "SHORT";
        if (setup == null) continue;
        if (Math.abs(activeScore) <= signalStrengthThreshold) continue;
        let neutralCount = 0;
        let validLookbackDays = 0;
        for (let k = i - DashboardService.NEUTRAL_LOOKBACK; k < i && k >= DashboardService.MIN_LOOKBACK_FOR_FEATURES; k++) {
          const fk = features[k];
          if (!fk) continue;
          validLookbackDays++;
          const kSeed = hashString(symbol + ":" + String(k));
          const kPrevSeed = k > DashboardService.MIN_LOOKBACK_FOR_FEATURES ? hashString(symbol + ":" + String(k - 1)) : undefined;
          const decompK = computeSignalDecomposition(fk, agents, kSeed, kPrevSeed);
          let meanKForScore = decompK.meanSignal;
          if (EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE) meanKForScore -= decompK.macroContribution;
          if (EXCLUDE_SENTIMENT_FROM_LIVE_SETUP_SCORE) meanKForScore -= decompK.sentimentContribution;
          const rawK = decompK.baseSignal + (meanKForScore - decompK.baseSignal) * SETUP_DELTA_ATTENUATION;
          const activeK = ENABLE_SIGNAL_FLIP ? -rawK : rawK;
          if (Math.abs(activeK) < signalStrengthThreshold) neutralCount++;
        }
        const probabilityNeutral = validLookbackDays > 0 ? neutralCount / validLookbackDays : 0.5;
        if (probabilityNeutral >= neutralThreshold) continue;
        const conviction = signalStrength * 0.5 + (1 - disagreement) * 0.3 + (1 - probabilityNeutral) * 0.2;
        if (conviction < convictionThreshold) continue;
        const priceT0 = closes[i]!;
        const priceT1 = closes[i + horizon]!;
        if (priceT0 <= 0 || !Number.isFinite(priceT0) || !Number.isFinite(priceT1)) continue;
        const rawReturn = (priceT1 - priceT0) / priceT0;
        const tradeReturn = setup === "LONG" ? rawReturn : -rawReturn;
        shadowLongShortTr.push(tradeReturn);
        shadowLongShortBr.push(rawReturn);
        if (setup === "LONG") shadowLongCount++;
        else shadowShortCount++;
      }
    }
    const longShortRow = toShortReentryRow(shadowLongShortTr, shadowLongShortBr, shadowLongCount, shadowShortCount);

    const longOnlyEdge = longOnlyRow.edge ?? 0;
    const longShortEdge = longShortRow.edge ?? 0;
    const longOnlyCum = longOnlyRow.cumulativeReturn ?? 0;
    const longShortCum = longShortRow.cumulativeReturn ?? 0;
    let keepShortDisabled: boolean | null = null;
    let reason = "No recommendation (insufficient data)";
    if (longOnlyRow.trades != null && longOnlyRow.trades > 0 && longShortRow.trades != null && longShortRow.trades > 0) {
      if (longShortEdge > longOnlyEdge && longShortCum > longOnlyCum) {
        keepShortDisabled = false;
        reason = "Shadow LONG+SHORT outperforms LONG-only on edge and cumulative return; consider re-enabling SHORT.";
      } else if (longShortEdge <= longOnlyEdge || longShortCum <= longOnlyCum) {
        keepShortDisabled = true;
        reason = "LONG-only matches or beats shadow LONG+SHORT; keep SHORT disabled.";
      }
    }

    const shortReentryShadowAudit: NonNullable<DashboardSummary["shortReentryShadowAudit"]> = {
      longOnlyActualEquivalent: longOnlyRow,
      longShortShadow: longShortRow,
      recommendation: { keepShortDisabled, reason },
    };

    type ComponentPruningRow = NonNullable<DashboardSummary["componentPruningShadowAudit"]>["currentFull"];
    const toComponentPruningRow = (
      tr: number[],
      br: number[],
      nLong: number,
      nShort: number,
    ): ComponentPruningRow => {
      const n = tr.length;
      if (n === 0) {
        return {
          trades: null,
          executedLongTrades: nLong,
          executedShortTrades: nShort,
          winRate: null,
          avgTradeReturn: null,
          cumulativeReturn: null,
          benchmarkReturn: null,
          edge: null,
          maxDrawdown: null,
        };
      }
      const wins = tr.filter((r) => r > 0).length;
      const cumStrategy = tr.reduce((a, b) => a + b, 0);
      const cumBench = br.reduce((a, b) => a + b, 0);
      let equity = 1;
      let peak = 1;
      let maxDd = 0;
      for (const r of tr) {
        equity *= 1 + r;
        if (equity > peak) peak = equity;
        const dd = peak > 0 ? (peak - equity) / peak : 0;
        if (dd > maxDd) maxDd = dd;
      }
      return {
        trades: n,
        executedLongTrades: nLong,
        executedShortTrades: nShort,
        winRate: wins / n,
        avgTradeReturn: cumStrategy / n,
        cumulativeReturn: cumStrategy,
        benchmarkReturn: cumBench,
        edge: cumStrategy - cumBench,
        maxDrawdown: maxDd,
      };
    };

    const currentFullRow = toComponentPruningRow(tradeReturns, benchmarkReturns, executedLongTrades, executedShortTrades);

    const computeWinningBaselineFeatureAudit = (): NonNullable<DashboardSummary["winningBaselineFeatureAudit"]> => {
      const n = tradeReturns.length;
      const winIdx = tradeReturns.map((r, i) => (r > 0 ? i : -1)).filter((i) => i >= 0);
      const loseIdx = tradeReturns.map((r, i) => (r < 0 ? i : -1)).filter((i) => i >= 0);
      const avg = (arr: number[], indices: number[]) =>
        indices.length === 0 ? null : indices.reduce((s, i) => s + arr[i]!, 0) / indices.length;
      const allBase = n > 0 ? execBaseSignal.reduce((a, b) => a + b, 0) / n : null;
      const allTech = n > 0 ? execTechnical.reduce((a, b) => a + b, 0) / n : null;
      const allNoise = n > 0 ? execNoise.reduce((a, b) => a + b, 0) / n : null;
      const allConv = n > 0 ? execConviction.reduce((a, b) => a + b, 0) / n : null;
      const winBase = avg(execBaseSignal, winIdx);
      const winTech = avg(execTechnical, winIdx);
      const winNoise = avg(execNoise, winIdx);
      const winConv = avg(execConviction, winIdx);
      const loseBase = avg(execBaseSignal, loseIdx);
      const loseTech = avg(execTechnical, loseIdx);
      const loseNoise = avg(execNoise, loseIdx);
      const loseConv = avg(execConviction, loseIdx);
      const convD = winConv != null && loseConv != null ? winConv - loseConv : null;
      const techD = winTech != null && loseTech != null ? winTech - loseTech : null;
      const baseD = winBase != null && loseBase != null ? winBase - loseBase : null;
      const noiseD = winNoise != null && loseNoise != null ? winNoise - loseNoise : null;
      return {
        allExecutedTrades: { count: n, avgBaseSignal: allBase, avgTechnicalContribution: allTech, avgNoiseContribution: allNoise, avgConviction: allConv },
        winningTrades: { count: winIdx.length, avgBaseSignal: winBase, avgTechnicalContribution: winTech, avgNoiseContribution: winNoise, avgConviction: winConv },
        losingTrades: { count: loseIdx.length, avgBaseSignal: loseBase, avgTechnicalContribution: loseTech, avgNoiseContribution: loseNoise, avgConviction: loseConv },
        comparison: { convictionDeltaWinningMinusLosing: convD, technicalDeltaWinningMinusLosing: techD, baseSignalDeltaWinningMinusLosing: baseD, noiseDeltaWinningMinusLosing: noiseD },
      };
    };
    const winningBaselineFeatureAudit = computeWinningBaselineFeatureAudit();

    type OutOfSampleRow = NonNullable<DashboardSummary["outOfSampleAudit"]>["inSample"];
    const toOutOfSampleRow = (tr: number[], br: number[], nLong: number, nShort: number): OutOfSampleRow => {
      const n = tr.length;
      if (n === 0) return { trades: null, executedLongTrades: nLong, executedShortTrades: nShort, winRate: null, avgTradeReturn: null, cumulativeReturn: null, benchmarkReturn: null, edge: null, maxDrawdown: null };
      const wins = tr.filter((r) => r > 0).length;
      const cumStrategy = tr.reduce((a, b) => a + b, 0);
      const cumBench = br.reduce((a, b) => a + b, 0);
      let equity = 1, peak = 1, maxDd = 0;
      for (const r of tr) {
        equity *= 1 + r;
        if (equity > peak) peak = equity;
        const dd = peak > 0 ? (peak - equity) / peak : 0;
        if (dd > maxDd) maxDd = dd;
      }
      return { trades: n, executedLongTrades: nLong, executedShortTrades: nShort, winRate: wins / n, avgTradeReturn: cumStrategy / n, cumulativeReturn: cumStrategy, benchmarkReturn: cumBench, edge: cumStrategy - cumBench, maxDrawdown: maxDd };
    };
    const computeOutOfSampleAudit = (): NonNullable<DashboardSummary["outOfSampleAudit"]> => {
      const n = tradeReturns.length;
      if (n === 0) {
        const empty: OutOfSampleRow = { trades: null, executedLongTrades: 0, executedShortTrades: 0, winRate: null, avgTradeReturn: null, cumulativeReturn: null, benchmarkReturn: null, edge: null, maxDrawdown: null };
        return { splitDescription: "first 70% in-sample, last 30% out-of-sample (chronological)", inSample: empty, outOfSample: empty, comparison: { edgeDeltaOutMinusIn: null, cumulativeReturnDeltaOutMinusIn: null, winRateDeltaOutMinusIn: null } };
      }
      const indices = tradeReturns.map((_, i) => i);
      indices.sort((a, b) => execTimestamps[a]! - execTimestamps[b]!);
      const splitAt = Math.max(1, Math.floor(n * 0.7));
      const inIdx = indices.slice(0, splitAt);
      const outIdx = indices.slice(splitAt);
      const inTr = inIdx.map((i) => tradeReturns[i]!);
      const inBr = inIdx.map((i) => benchmarkReturns[i]!);
      const outTr = outIdx.map((i) => tradeReturns[i]!);
      const outBr = outIdx.map((i) => benchmarkReturns[i]!);
      const inLong = inIdx.filter((i) => execIsLong[i]).length;
      const inShort = inIdx.length - inLong;
      const outLong = outIdx.filter((i) => execIsLong[i]).length;
      const outShort = outIdx.length - outLong;
      const inRow = toOutOfSampleRow(inTr, inBr, inLong, inShort);
      const outRow = toOutOfSampleRow(outTr, outBr, outLong, outShort);
      const edgeD = inRow.edge != null && outRow.edge != null ? outRow.edge - inRow.edge : null;
      const cumD = inRow.cumulativeReturn != null && outRow.cumulativeReturn != null ? outRow.cumulativeReturn - inRow.cumulativeReturn : null;
      const wrD = inRow.winRate != null && outRow.winRate != null ? outRow.winRate - inRow.winRate : null;
      return {
        splitDescription: "first 70% in-sample, last 30% out-of-sample (chronological)",
        inSample: inRow,
        outOfSample: outRow,
        comparison: { edgeDeltaOutMinusIn: edgeD, cumulativeReturnDeltaOutMinusIn: cumD, winRateDeltaOutMinusIn: wrD },
      };
    };
    const outOfSampleAudit = computeOutOfSampleAudit();

    type WalkForwardSegmentRow = NonNullable<DashboardSummary["walkForwardAudit"]>["segments"][number];
    const toWalkForwardSegmentRow = (
      label: string,
      tr: number[],
      br: number[],
      nLong: number,
      nShort: number,
    ): WalkForwardSegmentRow => {
      const n = tr.length;
      if (n === 0) {
        return { label, trades: 0, executedLongTrades: nLong, executedShortTrades: nShort, winRate: null, avgTradeReturn: null, cumulativeReturn: null, benchmarkReturn: null, edge: null, maxDrawdown: null };
      }
      const wins = tr.filter((r) => r > 0).length;
      const cumStrategy = tr.reduce((a, b) => a + b, 0);
      const cumBench = br.reduce((a, b) => a + b, 0);
      let equity = 1;
      let peak = 1;
      let maxDd = 0;
      for (const r of tr) {
        equity *= 1 + r;
        if (equity > peak) peak = equity;
        const dd = peak > 0 ? (peak - equity) / peak : 0;
        if (dd > maxDd) maxDd = dd;
      }
      return { label, trades: n, executedLongTrades: nLong, executedShortTrades: nShort, winRate: wins / n, avgTradeReturn: cumStrategy / n, cumulativeReturn: cumStrategy, benchmarkReturn: cumBench, edge: cumStrategy - cumBench, maxDrawdown: maxDd };
    };
    const computeWalkForwardAudit = (): NonNullable<DashboardSummary["walkForwardAudit"]> => {
      const n = tradeReturns.length;
      const emptySeg: WalkForwardSegmentRow = { label: "segment", trades: 0, executedLongTrades: 0, executedShortTrades: 0, winRate: null, avgTradeReturn: null, cumulativeReturn: null, benchmarkReturn: null, edge: null, maxDrawdown: null };
      const emptySegs: [WalkForwardSegmentRow, WalkForwardSegmentRow, WalkForwardSegmentRow, WalkForwardSegmentRow] = [
        { ...emptySeg, label: "segment_1" },
        { ...emptySeg, label: "segment_2" },
        { ...emptySeg, label: "segment_3" },
        { ...emptySeg, label: "segment_4" },
      ];
      if (n === 0) {
        return {
          splitDescription: "4 consecutive chronological segments by executed trade order (sorted by entry timestamp), roughly equal trade count per segment; uses current live baseline including 3% stop-loss",
          segments: emptySegs,
          summary: { positiveEdgeSegmentCount: 0, positiveCumulativeReturnSegmentCount: 0, bestSegmentByEdge: null, worstSegmentByEdge: null },
        };
      }
      const indices = tradeReturns.map((_, i) => i);
      indices.sort((a, b) => execTimestamps[a]! - execTimestamps[b]!);
      const q = Math.max(1, Math.floor(n / 4));
      const s0 = indices.slice(0, q);
      const s1 = indices.slice(q, q * 2);
      const s2 = indices.slice(q * 2, q * 3);
      const s3 = indices.slice(q * 3);
      const seg0 = toWalkForwardSegmentRow("segment_1", s0.map((i) => tradeReturns[i]!), s0.map((i) => benchmarkReturns[i]!), s0.filter((i) => execIsLong[i]).length, s0.length - s0.filter((i) => execIsLong[i]).length);
      const seg1 = toWalkForwardSegmentRow("segment_2", s1.map((i) => tradeReturns[i]!), s1.map((i) => benchmarkReturns[i]!), s1.filter((i) => execIsLong[i]).length, s1.length - s1.filter((i) => execIsLong[i]).length);
      const seg2 = toWalkForwardSegmentRow("segment_3", s2.map((i) => tradeReturns[i]!), s2.map((i) => benchmarkReturns[i]!), s2.filter((i) => execIsLong[i]).length, s2.length - s2.filter((i) => execIsLong[i]).length);
      const seg3 = toWalkForwardSegmentRow("segment_4", s3.map((i) => tradeReturns[i]!), s3.map((i) => benchmarkReturns[i]!), s3.filter((i) => execIsLong[i]).length, s3.length - s3.filter((i) => execIsLong[i]).length);
      const segs = [seg0, seg1, seg2, seg3];
      const posEdge = segs.filter((s) => s.edge != null && s.edge > 0).length;
      const posCum = segs.filter((s) => s.cumulativeReturn != null && s.cumulativeReturn > 0).length;
      const byEdge = segs.filter((s) => s.edge != null).sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0));
      const bestByEdge = byEdge[0]?.label ?? null;
      const worstByEdge = byEdge[byEdge.length - 1]?.label ?? null;
      return {
        splitDescription: "4 consecutive chronological segments by executed trade order (sorted by entry timestamp), roughly equal trade count per segment; uses current live baseline including 3% stop-loss",
        segments: [seg0, seg1, seg2, seg3],
        summary: { positiveEdgeSegmentCount: posEdge, positiveCumulativeReturnSegmentCount: posCum, bestSegmentByEdge: bestByEdge, worstSegmentByEdge: worstByEdge },
      };
    };
    const walkForwardAudit = computeWalkForwardAudit();

    const strategyV1CandidateAudit: NonNullable<DashboardSummary["strategyV1CandidateAudit"]> = {
      strategyId: "crowdvest_strategy_v1_candidate",
      versionLabel: "v1-candidate",
      status: "frozen_for_comparison",
      config: {
        signalFlipEnabled: ENABLE_SIGNAL_FLIP,
        shortEnabled: ENABLE_SHORT_TRADES,
        deltaAttenuationFactor: SETUP_DELTA_ATTENUATION,
        macroExcludedFromLiveSetupScore: EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE,
        sentimentExcludedFromLiveSetupScore: EXCLUDE_SENTIMENT_FROM_LIVE_SETUP_SCORE,
        activeSetupScoreAbsThreshold: signalStrengthThreshold,
        sizingMode: "equal_weight",
      },
      performanceSnapshot: {
        trades: currentFullRow.trades,
        winRate: currentFullRow.winRate,
        avgTradeReturn: currentFullRow.avgTradeReturn,
        cumulativeReturn: currentFullRow.cumulativeReturn,
        benchmarkReturn: currentFullRow.benchmarkReturn,
        edge: currentFullRow.edge,
        maxDrawdown: currentFullRow.maxDrawdown,
      },
      walkForwardSnapshot: walkForwardAudit.summary,
    };

    const strategyV2CandidateAudit: NonNullable<DashboardSummary["strategyV2CandidateAudit"]> = {
      strategyId: "crowdvest_strategy_v2_candidate",
      versionLabel: "v2-candidate",
      status: "frozen_for_comparison",
      config: {
        signalFlipEnabled: ENABLE_SIGNAL_FLIP,
        shortEnabled: ENABLE_SHORT_TRADES,
        deltaAttenuationFactor: SETUP_DELTA_ATTENUATION,
        macroExcludedFromLiveSetupScore: EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE,
        sentimentExcludedFromLiveSetupScore: EXCLUDE_SENTIMENT_FROM_LIVE_SETUP_SCORE,
        activeSetupScoreAbsThreshold: signalStrengthThreshold,
        sizingMode: "equal_weight",
        stopLossEnabled: LIVE_STOP_LOSS_ENABLED,
        stopLossPercent: LIVE_STOP_LOSS_PERCENT,
        takeProfitEnabled: false,
      },
      performanceSnapshot: {
        trades: currentFullRow.trades,
        winRate: currentFullRow.winRate,
        avgTradeReturn: currentFullRow.avgTradeReturn,
        cumulativeReturn: currentFullRow.cumulativeReturn,
        benchmarkReturn: currentFullRow.benchmarkReturn,
        edge: currentFullRow.edge,
        maxDrawdown: currentFullRow.maxDrawdown,
      },
      walkForwardSnapshot: walkForwardAudit.summary,
    };

    const EXEC_REALISM_DESC = "Shadow audit of Strategy V2 Candidate under simple transaction-cost and slippage assumptions. Same executed trade set as live baseline. frictionlessBaseline: unchanged. feeOnly_10bps_roundTrip: subtract 0.10% per trade. slippageOnly_10bps_entry_exit: subtract 0.10% adverse entry + 0.10% adverse exit per trade. feeAndSlippage_10bps_each: fee + slippage combined.";
    type ExecutionRealismRow = NonNullable<DashboardSummary["executionRealismAudit"]>["frictionlessBaseline"];
    const toExecRealismRow = (tr: number[], br: number[], nLong: number, nShort: number): ExecutionRealismRow => {
      const n = tr.length;
      if (n === 0) return { trades: null, executedLongTrades: nLong, executedShortTrades: nShort, winRate: null, avgTradeReturn: null, cumulativeReturn: null, benchmarkReturn: null, edge: null, maxDrawdown: null };
      const wins = tr.filter((r) => r > 0).length;
      const cumStrategy = tr.reduce((a, b) => a + b, 0);
      const cumBench = br.reduce((a, b) => a + b, 0);
      let equity = 1, peak = 1, maxDd = 0;
      for (const r of tr) {
        equity *= 1 + r;
        if (equity > peak) peak = equity;
        const dd = peak > 0 ? (peak - equity) / peak : 0;
        if (dd > maxDd) maxDd = dd;
      }
      return { trades: n, executedLongTrades: nLong, executedShortTrades: nShort, winRate: wins / n, avgTradeReturn: cumStrategy / n, cumulativeReturn: cumStrategy, benchmarkReturn: cumBench, edge: cumStrategy - cumBench, maxDrawdown: maxDd };
    };
    const FEE_10BPS = 0.001;
    const SLIPPAGE_10BPS_ENTRY_EXIT = 0.002;
    const FEE_AND_SLIPPAGE_10BPS = FEE_10BPS + SLIPPAGE_10BPS_ENTRY_EXIT;
    const frictionlessBaseline = toExecRealismRow(tradeReturns, benchmarkReturns, executedLongTrades, executedShortTrades);
    const feeOnlyTr = tradeReturns.map((r) => r - FEE_10BPS);
    const slippageOnlyTr = tradeReturns.map((r) => r - SLIPPAGE_10BPS_ENTRY_EXIT);
    const feeAndSlippageTr = tradeReturns.map((r) => r - FEE_AND_SLIPPAGE_10BPS);
    const feeOnlyRow = toExecRealismRow(feeOnlyTr, benchmarkReturns, executedLongTrades, executedShortTrades);
    const slippageOnlyRow = toExecRealismRow(slippageOnlyTr, benchmarkReturns, executedLongTrades, executedShortTrades);
    const feeAndSlippageRow = toExecRealismRow(feeAndSlippageTr, benchmarkReturns, executedLongTrades, executedShortTrades);
    const executionRealismAudit: NonNullable<DashboardSummary["executionRealismAudit"]> = {
      methodologyDescription: EXEC_REALISM_DESC,
      frictionlessBaseline,
      feeOnly_10bps_roundTrip: feeOnlyRow,
      slippageOnly_10bps_entry_exit: slippageOnlyRow,
      feeAndSlippage_10bps_each: feeAndSlippageRow,
      comparison: {
        edgeDeltaFeeAndSlippageMinusBaseline: frictionlessBaseline.edge != null && feeAndSlippageRow.edge != null ? feeAndSlippageRow.edge - frictionlessBaseline.edge : null,
        cumulativeReturnDeltaFeeAndSlippageMinusBaseline: frictionlessBaseline.cumulativeReturn != null && feeAndSlippageRow.cumulativeReturn != null ? feeAndSlippageRow.cumulativeReturn - frictionlessBaseline.cumulativeReturn : null,
        drawdownDeltaFeeAndSlippageMinusBaseline: frictionlessBaseline.maxDrawdown != null && feeAndSlippageRow.maxDrawdown != null ? feeAndSlippageRow.maxDrawdown - frictionlessBaseline.maxDrawdown : null,
      },
    };

    const FRICTION_SENSITIVITY_DESC = "Shadow audit of Strategy V2 Candidate under increasing per-trade friction (total adverse return haircut). Same executed trade set as live baseline. baseline_0bps: unchanged. friction_*_total: subtract total bps per trade (e.g. 10bps=0.10%, 50bps=0.50%).";
    type FrictionSensitivityRow = NonNullable<DashboardSummary["frictionSensitivityAudit"]>["baseline_0bps"];
    const toFrictionSensitivityRow = (tr: number[], br: number[], nLong: number, nShort: number): FrictionSensitivityRow => {
      const n = tr.length;
      if (n === 0) return { trades: null, executedLongTrades: nLong, executedShortTrades: nShort, winRate: null, avgTradeReturn: null, cumulativeReturn: null, benchmarkReturn: null, edge: null, maxDrawdown: null };
      const wins = tr.filter((r) => r > 0).length;
      const cumStrategy = tr.reduce((a, b) => a + b, 0);
      const cumBench = br.reduce((a, b) => a + b, 0);
      let equity = 1, peak = 1, maxDd = 0;
      for (const r of tr) {
        equity *= 1 + r;
        if (equity > peak) peak = equity;
        const dd = peak > 0 ? (peak - equity) / peak : 0;
        if (dd > maxDd) maxDd = dd;
      }
      return { trades: n, executedLongTrades: nLong, executedShortTrades: nShort, winRate: wins / n, avgTradeReturn: cumStrategy / n, cumulativeReturn: cumStrategy, benchmarkReturn: cumBench, edge: cumStrategy - cumBench, maxDrawdown: maxDd };
    };
    const baseline0Row = toFrictionSensitivityRow(tradeReturns, benchmarkReturns, executedLongTrades, executedShortTrades);
    const friction10Row = toFrictionSensitivityRow(tradeReturns.map((r) => r - 0.001), benchmarkReturns, executedLongTrades, executedShortTrades);
    const friction20Row = toFrictionSensitivityRow(tradeReturns.map((r) => r - 0.002), benchmarkReturns, executedLongTrades, executedShortTrades);
    const friction30Row = toFrictionSensitivityRow(tradeReturns.map((r) => r - 0.003), benchmarkReturns, executedLongTrades, executedShortTrades);
    const friction50Row = toFrictionSensitivityRow(tradeReturns.map((r) => r - 0.005), benchmarkReturns, executedLongTrades, executedShortTrades);
    const fsVariants: { key: string; row: FrictionSensitivityRow }[] = [
      { key: "baseline_0bps", row: baseline0Row },
      { key: "friction_10bps_total", row: friction10Row },
      { key: "friction_20bps_total", row: friction20Row },
      { key: "friction_30bps_total", row: friction30Row },
      { key: "friction_50bps_total", row: friction50Row },
    ];
    const fsByEdgeDesc = [...fsVariants].reverse();
    const fsHighestPosEdge = fsByEdgeDesc.find((v) => v.row.edge != null && v.row.edge > 0)?.key ?? null;
    const fsHighestPosCum = fsByEdgeDesc.find((v) => v.row.cumulativeReturn != null && v.row.cumulativeReturn > 0)?.key ?? null;
    const frictionSensitivityAudit: NonNullable<DashboardSummary["frictionSensitivityAudit"]> = {
      methodologyDescription: FRICTION_SENSITIVITY_DESC,
      baseline_0bps: baseline0Row,
      friction_10bps_total: friction10Row,
      friction_20bps_total: friction20Row,
      friction_30bps_total: friction30Row,
      friction_50bps_total: friction50Row,
      summary: {
        highestFrictionWithPositiveEdge: fsHighestPosEdge,
        highestFrictionWithPositiveCumulativeReturn: fsHighestPosCum,
      },
    };

    const CONCURRENCY_EXPOSURE_DESC = "Measure overlap between executed trades by entry/exit windows. A trade is open from entry through exit (holding period). Overlap counted via sweep over time; totals and distribution use time-weighted metrics.";
    const computeConcurrencyExposureAudit = (): NonNullable<DashboardSummary["concurrencyExposureAudit"]> => {
      const n = tradeReturns.length;
      if (n === 0) {
        return {
          methodologyDescription: CONCURRENCY_EXPOSURE_DESC,
          totals: { trades: 0, uniqueEntryDates: null, avgConcurrentOpenTrades: null, maxConcurrentOpenTrades: null },
          concurrencyDistribution: { oneOpen: null, twoOpen: null, threeOrMoreOpen: null },
          byDirectionIfAvailable: { avgConcurrentLongTrades: null, avgConcurrentShortTrades: null },
          interpretation: { overlapRiskLevel: null },
        };
      }
      const uniqueEntryDates = new Set(execTimestamps.map((ts) => new Date(ts).toISOString().slice(0, 10))).size;
      type Event = { t: number; delta: number; deltaLong: number; deltaShort: number };
      const events: Event[] = [];
      for (let k = 0; k < n; k++) {
        const entryTs = execTimestamps[k]!;
        const sym = execSymbol[k]!;
        const idx = execEntryIndex[k]!;
        const isLong = execIsLong[k]!;
        const data = cachedData.get(sym);
        const exitTs = data && idx + horizon < data.timestamps.length ? data.timestamps[idx + horizon]!.getTime() : entryTs + horizon * 86400000;
        events.push({ t: entryTs, delta: 1, deltaLong: isLong ? 1 : 0, deltaShort: isLong ? 0 : 1 });
        events.push({ t: exitTs + 1, delta: -1, deltaLong: isLong ? -1 : 0, deltaShort: isLong ? 0 : -1 });
      }
      events.sort((a, b) => a.t - b.t);
      let totalCount = 0;
      let longCount = 0;
      let shortCount = 0;
      let maxConcurrent = 0;
      let sumWeightedTotal = 0;
      let sumWeightedLong = 0;
      let sumWeightedShort = 0;
      let totalDuration = 0;
      let oneOpenDur = 0;
      let twoOpenDur = 0;
      let threeOrMoreDur = 0;
      for (let i = 0; i < events.length - 1; i++) {
        totalCount += events[i]!.delta;
        longCount += events[i]!.deltaLong;
        shortCount += events[i]!.deltaShort;
        if (totalCount > maxConcurrent) maxConcurrent = totalCount;
        const dt = events[i + 1]!.t - events[i]!.t;
        if (totalCount > 0) {
          sumWeightedTotal += totalCount * dt;
          sumWeightedLong += longCount * dt;
          sumWeightedShort += shortCount * dt;
          totalDuration += dt;
          if (totalCount === 1) oneOpenDur += dt;
          else if (totalCount === 2) twoOpenDur += dt;
          else if (totalCount >= 3) threeOrMoreDur += dt;
        }
      }
      const avgConcurrent = totalDuration > 0 ? sumWeightedTotal / totalDuration : null;
      const avgConcurrentLong = totalDuration > 0 ? sumWeightedLong / totalDuration : null;
      const avgConcurrentShort = totalDuration > 0 ? sumWeightedShort / totalDuration : null;
      let overlapRiskLevel: string | null = null;
      if (maxConcurrent <= 1) overlapRiskLevel = "low";
      else if (maxConcurrent <= 3) overlapRiskLevel = "medium";
      else overlapRiskLevel = "high";
      return {
        methodologyDescription: CONCURRENCY_EXPOSURE_DESC,
        totals: { trades: n, uniqueEntryDates, avgConcurrentOpenTrades: avgConcurrent, maxConcurrentOpenTrades: maxConcurrent },
        concurrencyDistribution: { oneOpen: oneOpenDur, twoOpen: twoOpenDur, threeOrMoreOpen: threeOrMoreDur },
        byDirectionIfAvailable: { avgConcurrentLongTrades: avgConcurrentLong, avgConcurrentShortTrades: avgConcurrentShort },
        interpretation: { overlapRiskLevel },
      };
    };
    const concurrencyExposureAudit = computeConcurrencyExposureAudit();

    const CAPITAL_CONSTRAINT_DESC = "Shadow audit of Strategy V2 Candidate under capital constraints (max concurrent open trades). Same entry/exit logic; when capacity is exceeded, new entries are skipped. Selection rule when multiple compete: prioritize larger absolute activeSetupScore first, if tied earlier timestamp first. unconstrainedBaseline: no limit. max1OpenTrade/max2OpenTrades/max3OpenTrades: cap at 1/2/3.";
    type CapitalConstraintRow = NonNullable<DashboardSummary["capitalConstraintShadowAudit"]>["unconstrainedBaseline"];
    const runCapitalConstraintShadow = (maxOpen: number): { tr: number[]; br: number[]; nLong: number; nShort: number; avgConc: number | null; maxConc: number } => {
      const n = tradeReturns.length;
      if (n === 0) return { tr: [], br: [], nLong: 0, nShort: 0, avgConc: null, maxConc: 0 };
      type Ev = { t: number; kind: "enter" | "exit"; k: number; score: number };
      const evs: Ev[] = [];
      for (let k = 0; k < n; k++) {
        const entryTs = execTimestamps[k]!;
        const sym = execSymbol[k]!;
        const idx = execEntryIndex[k]!;
        const data = cachedData.get(sym);
        const exitTs = data && idx + horizon < data.timestamps.length ? data.timestamps[idx + horizon]!.getTime() : entryTs + horizon * 86400000;
        evs.push({ t: entryTs, kind: "enter", k, score: execActiveSetupScore[k] ?? 0 });
        evs.push({ t: exitTs + 1, kind: "exit", k, score: 0 });
      }
      evs.sort((a, b) => {
        if (a.t !== b.t) return a.t - b.t;
        if (a.kind !== b.kind) return a.kind === "exit" ? -1 : 1;
        const scoreCmp = b.score - a.score;
        if (scoreCmp !== 0) return scoreCmp;
        return (execTimestamps[a.k] ?? 0) - (execTimestamps[b.k] ?? 0);
      });
      const openSet = new Set<number>();
      const selected = new Set<number>();
      for (const e of evs) {
        if (e.kind === "exit") openSet.delete(e.k);
        else if (openSet.size < maxOpen) { openSet.add(e.k); selected.add(e.k); }
      }
      const idxs = [...selected].sort((a, b) => execTimestamps[a]! - execTimestamps[b]!);
      const tr = idxs.map((i) => tradeReturns[i]!);
      const br = idxs.map((i) => benchmarkReturns[i]!);
      const nLong = idxs.filter((i) => execIsLong[i]).length;
      const nShort = idxs.length - nLong;
      let avgConc: number | null = null;
      let maxConc = 0;
      if (idxs.length > 0) {
        const sev: { t: number; delta: number }[] = [];
        for (const i of idxs) {
          const entryTs = execTimestamps[i]!;
          const sym = execSymbol[i]!;
          const idx = execEntryIndex[i]!;
          const data = cachedData.get(sym);
          const exitTs = data && idx + horizon < data.timestamps.length ? data.timestamps[idx + horizon]!.getTime() : entryTs + horizon * 86400000;
          sev.push({ t: entryTs, delta: 1 });
          sev.push({ t: exitTs + 1, delta: -1 });
        }
        sev.sort((a, b) => a.t - b.t);
        let c = 0;
        let sumW = 0;
        let tot = 0;
        for (let i = 0; i < sev.length - 1; i++) {
          c += sev[i]!.delta;
          if (c > maxConc) maxConc = c;
          const dt = sev[i + 1]!.t - sev[i]!.t;
          if (c > 0) { sumW += c * dt; tot += dt; }
        }
        avgConc = tot > 0 ? sumW / tot : null;
      }
      return { tr, br, nLong, nShort, avgConc, maxConc };
    };
    const toCapitalConstraintRow = (res: { tr: number[]; br: number[]; nLong: number; nShort: number; avgConc: number | null; maxConc: number }): CapitalConstraintRow => {
      const { tr, br, nLong, nShort, avgConc, maxConc } = res;
      const m = tr.length;
      if (m === 0) return { trades: null, executedLongTrades: nLong, executedShortTrades: nShort, winRate: null, avgTradeReturn: null, cumulativeReturn: null, benchmarkReturn: null, edge: null, maxDrawdown: null, avgConcurrentOpenTrades: avgConc, maxConcurrentOpenTrades: maxConc };
      const wins = tr.filter((r) => r > 0).length;
      const cumStrategy = tr.reduce((a, b) => a + b, 0);
      const cumBench = br.reduce((a, b) => a + b, 0);
      let equity = 1, peak = 1, maxDd = 0;
      for (const r of tr) {
        equity *= 1 + r;
        if (equity > peak) peak = equity;
        const dd = peak > 0 ? (peak - equity) / peak : 0;
        if (dd > maxDd) maxDd = dd;
      }
      return { trades: m, executedLongTrades: nLong, executedShortTrades: nShort, winRate: wins / m, avgTradeReturn: cumStrategy / m, cumulativeReturn: cumStrategy, benchmarkReturn: cumBench, edge: cumStrategy - cumBench, maxDrawdown: maxDd, avgConcurrentOpenTrades: avgConc, maxConcurrentOpenTrades: maxConc };
    };
    const ccUnconstrained = runCapitalConstraintShadow(1e9);
    const ccMax1 = runCapitalConstraintShadow(1);
    const ccMax2 = runCapitalConstraintShadow(2);
    const ccMax3 = runCapitalConstraintShadow(3);
    const ccVariants: { key: string; row: CapitalConstraintRow }[] = [
      { key: "unconstrainedBaseline", row: toCapitalConstraintRow(ccUnconstrained) },
      { key: "max1OpenTrade", row: toCapitalConstraintRow(ccMax1) },
      { key: "max2OpenTrades", row: toCapitalConstraintRow(ccMax2) },
      { key: "max3OpenTrades", row: toCapitalConstraintRow(ccMax3) },
    ];
    const ccBestEdge = ccVariants.filter((v) => v.row.edge != null).sort((a, b) => (b.row.edge ?? 0) - (a.row.edge ?? 0))[0]?.key ?? null;
    const ccBestCum = ccVariants.filter((v) => v.row.cumulativeReturn != null).sort((a, b) => (b.row.cumulativeReturn ?? 0) - (a.row.cumulativeReturn ?? 0))[0]?.key ?? null;
    const ccBestDd = ccVariants.filter((v) => v.row.maxDrawdown != null).sort((a, b) => (a.row.maxDrawdown ?? 0) - (b.row.maxDrawdown ?? 0))[0]?.key ?? null;
    const deployableVariants = ccVariants.filter((v) => v.key !== "unconstrainedBaseline");
    const ccBestDeployable = deployableVariants.filter((v) => v.row.edge != null).sort((a, b) => (b.row.edge ?? 0) - (a.row.edge ?? 0))[0]?.key ?? null;
    const capitalConstraintShadowAudit: NonNullable<DashboardSummary["capitalConstraintShadowAudit"]> = {
      methodologyDescription: CAPITAL_CONSTRAINT_DESC,
      unconstrainedBaseline: toCapitalConstraintRow(ccUnconstrained),
      max1OpenTrade: toCapitalConstraintRow(ccMax1),
      max2OpenTrades: toCapitalConstraintRow(ccMax2),
      max3OpenTrades: toCapitalConstraintRow(ccMax3),
      recommendation: { bestVariantByEdge: ccBestEdge, bestVariantByCumulativeReturn: ccBestCum, bestVariantByMaxDrawdown: ccBestDd, bestDeployableCandidate: ccBestDeployable },
    };

    const deployableRow = capitalConstraintShadowAudit.max3OpenTrades;
    const unconstrainedRow = capitalConstraintShadowAudit.unconstrainedBaseline;
    const deployableStrategyCandidateAudit: NonNullable<DashboardSummary["deployableStrategyCandidateAudit"]> = {
      strategyId: "crowdvest_strategy_v2_deployable_candidate",
      versionLabel: "v2-deployable-candidate",
      status: "frozen_for_deployment_comparison",
      constraintProfile: {
        maxConcurrentOpenTrades: 3,
        selectionPriorityRule: "larger absolute activeSetupScore first; ties by earlier timestamp",
      },
      performanceSnapshot: {
        trades: deployableRow.trades,
        executedLongTrades: deployableRow.executedLongTrades,
        executedShortTrades: deployableRow.executedShortTrades,
        winRate: deployableRow.winRate,
        avgTradeReturn: deployableRow.avgTradeReturn,
        cumulativeReturn: deployableRow.cumulativeReturn,
        benchmarkReturn: deployableRow.benchmarkReturn,
        edge: deployableRow.edge,
        maxDrawdown: deployableRow.maxDrawdown,
        avgConcurrentOpenTrades: deployableRow.avgConcurrentOpenTrades,
        maxConcurrentOpenTrades: deployableRow.maxConcurrentOpenTrades,
      },
      relationToResearchBaseline: {
        cumulativeReturnDeltaVsUnconstrained: deployableRow.cumulativeReturn != null && unconstrainedRow.cumulativeReturn != null ? deployableRow.cumulativeReturn - unconstrainedRow.cumulativeReturn : null,
        edgeDeltaVsUnconstrained: deployableRow.edge != null && unconstrainedRow.edge != null ? deployableRow.edge - unconstrainedRow.edge : null,
        drawdownDeltaVsUnconstrained: deployableRow.maxDrawdown != null && unconstrainedRow.maxDrawdown != null ? deployableRow.maxDrawdown - unconstrainedRow.maxDrawdown : null,
      },
    };

    const researchPs = strategyV2CandidateAudit.performanceSnapshot;
    const deployablePs = deployableStrategyCandidateAudit.performanceSnapshot;
    const strategyComparisonSummaryAudit: NonNullable<DashboardSummary["strategyComparisonSummaryAudit"]> = {
      researchChampion: {
        strategyId: strategyV2CandidateAudit.strategyId,
        versionLabel: strategyV2CandidateAudit.versionLabel,
        trades: researchPs.trades,
        cumulativeReturn: researchPs.cumulativeReturn,
        benchmarkReturn: researchPs.benchmarkReturn,
        edge: researchPs.edge,
        maxDrawdown: researchPs.maxDrawdown,
      },
      deployableCandidate: {
        strategyId: deployableStrategyCandidateAudit.strategyId,
        versionLabel: deployableStrategyCandidateAudit.versionLabel,
        trades: deployablePs.trades,
        cumulativeReturn: deployablePs.cumulativeReturn,
        benchmarkReturn: deployablePs.benchmarkReturn,
        edge: deployablePs.edge,
        maxDrawdown: deployablePs.maxDrawdown,
        maxConcurrentOpenTrades: deployablePs.maxConcurrentOpenTrades,
      },
      comparison: {
        cumulativeReturnDeltaDeployableMinusResearch: researchPs.cumulativeReturn != null && deployablePs.cumulativeReturn != null ? deployablePs.cumulativeReturn - researchPs.cumulativeReturn : null,
        edgeDeltaDeployableMinusResearch: researchPs.edge != null && deployablePs.edge != null ? deployablePs.edge - researchPs.edge : null,
        drawdownDeltaDeployableMinusResearch: researchPs.maxDrawdown != null && deployablePs.maxDrawdown != null ? deployablePs.maxDrawdown - researchPs.maxDrawdown : null,
      },
      productInterpretation: {
        preferredForResearch: strategyV2CandidateAudit.strategyId,
        preferredForDeployment: deployableStrategyCandidateAudit.strategyId,
      },
    };

    const EXIT_METHODOLOGY_DESC = "Exit overlays use daily close-to-close path within the holding window (intrabar high/low unavailable); threshold hit on first close that crosses it; LONG: SL -3% when rawReturn<=-0.03, TP +6% when rawReturn>=0.06; SHORT: SL -3% when rawReturn>=0.03, TP +6% when rawReturn<=-0.06.";
    type ExitPolicyRow = NonNullable<DashboardSummary["exitPolicyShadowAudit"]>["baselineEquivalent"];
    const toExitPolicyRow = (tr: number[], br: number[], nLong: number, nShort: number): ExitPolicyRow => {
      const n = tr.length;
      if (n === 0) return { trades: null, executedLongTrades: nLong, executedShortTrades: nShort, winRate: null, avgTradeReturn: null, cumulativeReturn: null, benchmarkReturn: null, edge: null, maxDrawdown: null };
      const wins = tr.filter((r) => r > 0).length;
      const cumStrategy = tr.reduce((a, b) => a + b, 0);
      const cumBench = br.reduce((a, b) => a + b, 0);
      let equity = 1;
      let peak = 1;
      let maxDd = 0;
      for (const r of tr) {
        equity *= 1 + r;
        if (equity > peak) peak = equity;
        const dd = peak > 0 ? (peak - equity) / peak : 0;
        if (dd > maxDd) maxDd = dd;
      }
      return { trades: n, executedLongTrades: nLong, executedShortTrades: nShort, winRate: wins / n, avgTradeReturn: cumStrategy / n, cumulativeReturn: cumStrategy, benchmarkReturn: cumBench, edge: cumStrategy - cumBench, maxDrawdown: maxDd };
    };
    const epSl3Tr: number[] = [];
    const epSl3Br: number[] = [];
    const epTp6Tr: number[] = [];
    const epTp6Br: number[] = [];
    const epSl3Tp6Tr: number[] = [];
    const epSl3Tp6Br: number[] = [];
    for (let k = 0; k < tradeReturns.length; k++) {
      const sym = execSymbol[k]!;
      const i = execEntryIndex[k]!;
      const isLong = execIsLong[k]!;
      const data = cachedData.get(sym);
      if (!data || i + horizon >= data.closes.length) {
        epSl3Tr.push(tradeReturns[k]!);
        epSl3Br.push(benchmarkReturns[k]!);
        epTp6Tr.push(tradeReturns[k]!);
        epTp6Br.push(benchmarkReturns[k]!);
        epSl3Tp6Tr.push(tradeReturns[k]!);
        epSl3Tp6Br.push(benchmarkReturns[k]!);
        continue;
      }
      const closes = data.closes;
      const p0 = closes[i]!;
      let sl3Strategy: number | null = null;
      let sl3Bench: number | null = null;
      let tp6Strategy: number | null = null;
      let tp6Bench: number | null = null;
      let sl3Day = horizon + 1;
      let tp6Day = horizon + 1;
      for (let d = 1; d <= horizon; d++) {
        const pd = closes[i + d]!;
        const rawRet = (pd - p0) / p0;
        if (isLong) {
          if (rawRet <= -0.03 && sl3Strategy == null) { sl3Strategy = -0.03; sl3Bench = rawRet; }
          if (rawRet >= 0.06 && tp6Strategy == null) { tp6Strategy = 0.06; tp6Bench = rawRet; }
          if (rawRet <= -0.03 && d < sl3Day) sl3Day = d;
          if (rawRet >= 0.06 && d < tp6Day) tp6Day = d;
        } else {
          if (rawRet >= 0.03 && sl3Strategy == null) { sl3Strategy = -0.03; sl3Bench = rawRet; }
          if (rawRet <= -0.06 && tp6Strategy == null) { tp6Strategy = 0.06; tp6Bench = rawRet; }
          if (rawRet >= 0.03 && d < sl3Day) sl3Day = d;
          if (rawRet <= -0.06 && d < tp6Day) tp6Day = d;
        }
      }
      let sl3Tp6Strategy: number | null = null;
      let sl3Tp6Bench: number | null = null;
      if (sl3Day <= horizon || tp6Day <= horizon) {
        if (sl3Day <= tp6Day) {
          sl3Tp6Strategy = -0.03;
          sl3Tp6Bench = (closes[i + sl3Day]! - p0) / p0;
        } else {
          sl3Tp6Strategy = 0.06;
          sl3Tp6Bench = (closes[i + tp6Day]! - p0) / p0;
        }
      }
      const baseRaw = (closes[i + horizon]! - p0) / p0;
      const baseStrategy = isLong ? baseRaw : -baseRaw;
      epSl3Tr.push(sl3Strategy != null ? sl3Strategy : baseStrategy);
      epSl3Br.push(sl3Bench != null ? sl3Bench : baseRaw);
      epTp6Tr.push(tp6Strategy != null ? tp6Strategy : baseStrategy);
      epTp6Br.push(tp6Bench != null ? tp6Bench : baseRaw);
      epSl3Tp6Tr.push(sl3Tp6Strategy != null ? sl3Tp6Strategy : baseStrategy);
      epSl3Tp6Br.push(sl3Tp6Bench != null ? sl3Tp6Bench : baseRaw);
    }
    const epBaseRow = currentFullRow;
    const epSl3Row = toExitPolicyRow(epSl3Tr, epSl3Br, executedLongTrades, executedShortTrades);
    const epTp6Row = toExitPolicyRow(epTp6Tr, epTp6Br, executedLongTrades, executedShortTrades);
    const epSl3Tp6Row = toExitPolicyRow(epSl3Tp6Tr, epSl3Tp6Br, executedLongTrades, executedShortTrades);
    const epVariants = [
      { key: "baselineEquivalent" as const, row: epBaseRow },
      { key: "stopLoss_3pct" as const, row: epSl3Row },
      { key: "takeProfit_6pct" as const, row: epTp6Row },
      { key: "stopLoss_3pct_takeProfit_6pct" as const, row: epSl3Tp6Row },
    ];
    const epBestByEdge = epVariants.filter((v) => v.row.edge != null).sort((a, b) => (b.row.edge ?? 0) - (a.row.edge ?? 0))[0];
    const epBestByCum = epVariants.filter((v) => v.row.cumulativeReturn != null).sort((a, b) => (b.row.cumulativeReturn ?? 0) - (a.row.cumulativeReturn ?? 0))[0];
    const epBestByDd = epVariants.filter((v) => v.row.maxDrawdown != null).sort((a, b) => (a.row.maxDrawdown ?? 0) - (b.row.maxDrawdown ?? 0))[0];
    const liveExitPolicyAudit: NonNullable<DashboardSummary["liveExitPolicyAudit"]> = {
      stopLossEnabled: LIVE_STOP_LOSS_ENABLED,
      stopLossPercent: LIVE_STOP_LOSS_PERCENT,
      takeProfitEnabled: false,
      methodologyDescription: "Live stop-loss uses daily close-to-close path within holding window; LONG: exit at -3% when rawReturn<=-0.03; SHORT: exit at -3% when rawReturn>=0.03.",
    };

    const exitPolicyShadowAudit: NonNullable<DashboardSummary["exitPolicyShadowAudit"]> = {
      methodologyDescription: EXIT_METHODOLOGY_DESC,
      baselineEquivalent: epBaseRow,
      stopLoss_3pct: epSl3Row,
      takeProfit_6pct: epTp6Row,
      stopLoss_3pct_takeProfit_6pct: epSl3Tp6Row,
      recommendation: {
        bestVariantByEdge: epBestByEdge?.key ?? null,
        bestVariantByCumulativeReturn: epBestByCum?.key ?? null,
        bestVariantByMaxDrawdown: epBestByDd?.key ?? null,
      },
    };

    type RegimeRow = NonNullable<DashboardSummary["regimePerformanceAudit"]>["uptrend"];
    const toRegimeRow = (tr: number[], br: number[]): RegimeRow => {
      const n = tr.length;
      if (n === 0) return { trades: 0, winRate: null, avgTradeReturn: null, cumulativeReturn: null, benchmarkReturn: null, edge: null, maxDrawdown: null };
      const wins = tr.filter((r) => r > 0).length;
      const cumStrategy = tr.reduce((a, b) => a + b, 0);
      const cumBench = br.reduce((a, b) => a + b, 0);
      let equity = 1, peak = 1, maxDd = 0;
      for (const r of tr) {
        equity *= 1 + r;
        if (equity > peak) peak = equity;
        const dd = peak > 0 ? (peak - equity) / peak : 0;
        if (dd > maxDd) maxDd = dd;
      }
      return { trades: n, winRate: wins / n, avgTradeReturn: cumStrategy / n, cumulativeReturn: cumStrategy, benchmarkReturn: cumBench, edge: cumStrategy - cumBench, maxDrawdown: maxDd };
    };
    const computeRegimePerformanceAudit = (): NonNullable<DashboardSummary["regimePerformanceAudit"]> => {
      const upIdx = benchmarkReturns.map((br, i) => (br > 0 ? i : -1)).filter((i) => i >= 0);
      const downIdx = benchmarkReturns.map((br, i) => (br < 0 ? i : -1)).filter((i) => i >= 0);
      const upTr = upIdx.map((i) => tradeReturns[i]!);
      const upBr = upIdx.map((i) => benchmarkReturns[i]!);
      const downTr = downIdx.map((i) => tradeReturns[i]!);
      const downBr = downIdx.map((i) => benchmarkReturns[i]!);
      const upRow = toRegimeRow(upTr, upBr);
      const downRow = toRegimeRow(downTr, downBr);
      const edgeD = upRow.edge != null && downRow.edge != null ? upRow.edge - downRow.edge : null;
      const wrD = upRow.winRate != null && downRow.winRate != null ? upRow.winRate - downRow.winRate : null;
      return { uptrend: upRow, downtrend: downRow, comparison: { edgeDeltaUpMinusDown: edgeD, winRateDeltaUpMinusDown: wrD } };
    };
    const regimePerformanceAudit = computeRegimePerformanceAudit();

    const uptrendIdx = benchmarkReturns.map((br, i) => (br > 0 ? i : -1)).filter((i) => i >= 0);
    const noDowntrendTr = uptrendIdx.map((i) => tradeReturns[i]!);
    const noDowntrendBr = uptrendIdx.map((i) => benchmarkReturns[i]!);
    const noDowntrendLong = uptrendIdx.filter((i) => execIsLong[i]).length;
    const noDowntrendShort = uptrendIdx.length - noDowntrendLong;
    const noDowntrendRow = toComponentPruningRow(noDowntrendTr, noDowntrendBr, noDowntrendLong, noDowntrendShort);
    const dtsBaseEdge = currentFullRow.edge ?? null;
    const dtsBaseCum = currentFullRow.cumulativeReturn ?? null;
    const dtsBaseDd = currentFullRow.maxDrawdown ?? null;
    const dtsNoDdEdge = noDowntrendRow.edge ?? null;
    const dtsNoDdCum = noDowntrendRow.cumulativeReturn ?? null;
    const dtsNoDdDd = noDowntrendRow.maxDrawdown ?? null;
    const downtrendSuppressionShadowAudit: NonNullable<DashboardSummary["downtrendSuppressionShadowAudit"]> = {
      baselineEquivalent: currentFullRow,
      noDowntrendTrades: noDowntrendRow,
      comparison: {
        edgeDeltaNoDowntrendMinusBaseline: dtsNoDdEdge != null && dtsBaseEdge != null ? dtsNoDdEdge - dtsBaseEdge : null,
        cumulativeReturnDeltaNoDowntrendMinusBaseline: dtsNoDdCum != null && dtsBaseCum != null ? dtsNoDdCum - dtsBaseCum : null,
        drawdownDeltaNoDowntrendMinusBaseline: dtsNoDdDd != null && dtsBaseDd != null ? dtsNoDdDd - dtsBaseDd : null,
      },
    };

    const rpUpOnlyIdx = uptrendIdx;
    const rpUpLongDownShortIdx = tradeReturns.map((_, i) => {
      const br = benchmarkReturns[i]!;
      const isLong = execIsLong[i];
      return (br > 0 && isLong) || (br < 0 && !isLong) ? i : -1;
    }).filter((i) => i >= 0);
    const rpDownShortOnlyIdx = benchmarkReturns.map((br, i) => (br < 0 && !execIsLong[i] ? i : -1)).filter((i) => i >= 0);
    const rpUpOnlyTr = rpUpOnlyIdx.map((i) => tradeReturns[i]!);
    const rpUpOnlyBr = rpUpOnlyIdx.map((i) => benchmarkReturns[i]!);
    const rpUpLongDownShortTr = rpUpLongDownShortIdx.map((i) => tradeReturns[i]!);
    const rpUpLongDownShortBr = rpUpLongDownShortIdx.map((i) => benchmarkReturns[i]!);
    const rpDownShortOnlyTr = rpDownShortOnlyIdx.map((i) => tradeReturns[i]!);
    const rpDownShortOnlyBr = rpDownShortOnlyIdx.map((i) => benchmarkReturns[i]!);
    const rpUpOnlyRow = toComponentPruningRow(rpUpOnlyTr, rpUpOnlyBr, noDowntrendLong, noDowntrendShort);
    const rpUpLongDownShortRow = toComponentPruningRow(rpUpLongDownShortTr, rpUpLongDownShortBr, rpUpLongDownShortIdx.filter((i) => execIsLong[i]).length, rpUpLongDownShortIdx.length - rpUpLongDownShortIdx.filter((i) => execIsLong[i]).length);
    const rpDownShortOnlyRow = toComponentPruningRow(rpDownShortOnlyTr, rpDownShortOnlyBr, 0, rpDownShortOnlyIdx.length);
    const rpVariants = [
      { key: "baselineEquivalent" as const, row: currentFullRow },
      { key: "uptrendOnly_flatDowntrend" as const, row: rpUpOnlyRow },
      { key: "uptrendLong_downtrendShortOnly" as const, row: rpUpLongDownShortRow },
      { key: "downtrendShortOnly_only" as const, row: rpDownShortOnlyRow },
    ];
    const rpBestByEdge = rpVariants.filter((v) => v.row.edge != null).sort((a, b) => (b.row.edge ?? 0) - (a.row.edge ?? 0))[0];
    const rpBestByCum = rpVariants.filter((v) => v.row.cumulativeReturn != null).sort((a, b) => (b.row.cumulativeReturn ?? 0) - (a.row.cumulativeReturn ?? 0))[0];
    const rpBestByDd = rpVariants.filter((v) => v.row.maxDrawdown != null).sort((a, b) => (a.row.maxDrawdown ?? 0) - (b.row.maxDrawdown ?? 0))[0];
    const regimePolicyShadowAudit: NonNullable<DashboardSummary["regimePolicyShadowAudit"]> = {
      baselineEquivalent: currentFullRow,
      uptrendOnly_flatDowntrend: rpUpOnlyRow,
      uptrendLong_downtrendShortOnly: rpUpLongDownShortRow,
      downtrendShortOnly_only: rpDownShortOnlyRow,
      recommendation: {
        bestVariantByEdge: rpBestByEdge?.key ?? null,
        bestVariantByCumulativeReturn: rpBestByCum?.key ?? null,
        bestVariantByMaxDrawdown: rpBestByDd?.key ?? null,
      },
    };

    const CAUSAL_REGIME_DEF = "uptrend if priceVsMa20 > 0, downtrend if priceVsMa20 < 0 (entry-time causal; priceVsMa20 = (price - MA20) / MA20 at decision bar)";
    const cpUpLongDownShortIdx = tradeReturns.map((_, i) => {
      const pv = execPriceVsMa20[i]!;
      const isLong = execIsLong[i];
      return (pv > 0 && isLong) || (pv < 0 && !isLong) ? i : -1;
    }).filter((i) => i >= 0);
    const cpUpOnlyIdx = tradeReturns.map((_, i) => (execPriceVsMa20[i]! > 0 ? i : -1)).filter((i) => i >= 0);
    const cpUpLongDownShortTr = cpUpLongDownShortIdx.map((i) => tradeReturns[i]!);
    const cpUpLongDownShortBr = cpUpLongDownShortIdx.map((i) => benchmarkReturns[i]!);
    const cpUpOnlyTr = cpUpOnlyIdx.map((i) => tradeReturns[i]!);
    const cpUpOnlyBr = cpUpOnlyIdx.map((i) => benchmarkReturns[i]!);
    const cpUpLongDownShortRow = toComponentPruningRow(cpUpLongDownShortTr, cpUpLongDownShortBr, cpUpLongDownShortIdx.filter((i) => execIsLong[i]).length, cpUpLongDownShortIdx.length - cpUpLongDownShortIdx.filter((i) => execIsLong[i]).length);
    const cpUpOnlyLong = cpUpOnlyIdx.filter((i) => execIsLong[i]).length;
    const cpUpOnlyShort = cpUpOnlyIdx.length - cpUpOnlyLong;
    const cpUpOnlyRow = toComponentPruningRow(cpUpOnlyTr, cpUpOnlyBr, cpUpOnlyLong, cpUpOnlyShort);
    const cpVariants = [
      { key: "baselineEquivalent" as const, row: currentFullRow },
      { key: "causalUptrendLong_downtrendShortOnly" as const, row: cpUpLongDownShortRow },
      { key: "causalUptrendOnly_flatDowntrend" as const, row: cpUpOnlyRow },
    ];
    const cpBestByEdge = cpVariants.filter((v) => v.row.edge != null).sort((a, b) => (b.row.edge ?? 0) - (a.row.edge ?? 0))[0];
    const cpBestByCum = cpVariants.filter((v) => v.row.cumulativeReturn != null).sort((a, b) => (b.row.cumulativeReturn ?? 0) - (a.row.cumulativeReturn ?? 0))[0];
    const cpBestByDd = cpVariants.filter((v) => v.row.maxDrawdown != null).sort((a, b) => (a.row.maxDrawdown ?? 0) - (b.row.maxDrawdown ?? 0))[0];
    const causalRegimePolicyShadowAudit: NonNullable<DashboardSummary["causalRegimePolicyShadowAudit"]> = {
      regimeDefinition: CAUSAL_REGIME_DEF,
      baselineEquivalent: currentFullRow,
      causalUptrendLong_downtrendShortOnly: cpUpLongDownShortRow,
      causalUptrendOnly_flatDowntrend: cpUpOnlyRow,
      recommendation: {
        bestVariantByEdge: cpBestByEdge?.key ?? null,
        bestVariantByCumulativeReturn: cpBestByCum?.key ?? null,
        bestVariantByMaxDrawdown: cpBestByDd?.key ?? null,
      },
    };

    const srSortedIndices = tradeReturns.map((_, i) => i).sort((a, b) => (execActiveSetupScore[b] ?? 0) - (execActiveSetupScore[a] ?? 0));
    const srN = srSortedIndices.length;
    const srTop50Idx = srSortedIndices.slice(0, Math.max(0, Math.floor(srN * 0.5)));
    const srTop30Idx = srSortedIndices.slice(0, Math.max(0, Math.floor(srN * 0.3)));
    const srTop20Idx = srSortedIndices.slice(0, Math.max(0, Math.floor(srN * 0.2)));
    const srTop50Tr = srTop50Idx.map((i) => tradeReturns[i]!);
    const srTop50Br = srTop50Idx.map((i) => benchmarkReturns[i]!);
    const srTop30Tr = srTop30Idx.map((i) => tradeReturns[i]!);
    const srTop30Br = srTop30Idx.map((i) => benchmarkReturns[i]!);
    const srTop20Tr = srTop20Idx.map((i) => tradeReturns[i]!);
    const srTop20Br = srTop20Idx.map((i) => benchmarkReturns[i]!);
    const srTop50Row = toComponentPruningRow(srTop50Tr, srTop50Br, srTop50Idx.filter((i) => execIsLong[i]).length, srTop50Idx.length - srTop50Idx.filter((i) => execIsLong[i]).length);
    const srTop30Row = toComponentPruningRow(srTop30Tr, srTop30Br, srTop30Idx.filter((i) => execIsLong[i]).length, srTop30Idx.length - srTop30Idx.filter((i) => execIsLong[i]).length);
    const srTop20Row = toComponentPruningRow(srTop20Tr, srTop20Br, srTop20Idx.filter((i) => execIsLong[i]).length, srTop20Idx.length - srTop20Idx.filter((i) => execIsLong[i]).length);
    const srVariants = [
      { key: "baselineEquivalent" as const, row: currentFullRow },
      { key: "top50pctByAbsSetupScore" as const, row: srTop50Row },
      { key: "top30pctByAbsSetupScore" as const, row: srTop30Row },
      { key: "top20pctByAbsSetupScore" as const, row: srTop20Row },
    ];
    const srBestByEdge = srVariants.filter((v) => v.row.edge != null).sort((a, b) => (b.row.edge ?? 0) - (a.row.edge ?? 0))[0];
    const srBestByCum = srVariants.filter((v) => v.row.cumulativeReturn != null).sort((a, b) => (b.row.cumulativeReturn ?? 0) - (a.row.cumulativeReturn ?? 0))[0];
    const srBestByDd = srVariants.filter((v) => v.row.maxDrawdown != null).sort((a, b) => (a.row.maxDrawdown ?? 0) - (b.row.maxDrawdown ?? 0))[0];
    const signalRankingShadowAudit: NonNullable<DashboardSummary["signalRankingShadowAudit"]> = {
      baselineEquivalent: currentFullRow,
      top50pctByAbsSetupScore: srTop50Row,
      top30pctByAbsSetupScore: srTop30Row,
      top20pctByAbsSetupScore: srTop20Row,
      recommendation: {
        bestVariantByEdge: srBestByEdge?.key ?? null,
        bestVariantByCumulativeReturn: srBestByCum?.key ?? null,
        bestVariantByMaxDrawdown: srBestByDd?.key ?? null,
      },
    };

    type PositionSizingRow = NonNullable<DashboardSummary["positionSizingShadowAudit"]>["equalWeightBaseline"];
    const toPositionSizingRow = (
      tr: number[],
      br: number[],
      weights: number[],
      nLong: number,
      nShort: number,
      equalWeight: boolean,
    ): PositionSizingRow => {
      const n = tr.length;
      if (n === 0) {
        return {
          trades: null,
          executedLongTrades: nLong,
          executedShortTrades: nShort,
          weightedAvgTradeReturn: null,
          cumulativeReturn: null,
          benchmarkReturn: null,
          edge: null,
          maxDrawdown: null,
        };
      }
      if (equalWeight) {
        const cumStrategy = tr.reduce((a, b) => a + b, 0);
        const cumBench = br.reduce((a, b) => a + b, 0);
        let equity = 1;
        let peak = 1;
        let maxDd = 0;
        for (const r of tr) {
          equity *= 1 + r;
          if (equity > peak) peak = equity;
          const dd = peak > 0 ? (peak - equity) / peak : 0;
          if (dd > maxDd) maxDd = dd;
        }
        return {
          trades: n,
          executedLongTrades: nLong,
          executedShortTrades: nShort,
          weightedAvgTradeReturn: cumStrategy / n,
          cumulativeReturn: cumStrategy,
          benchmarkReturn: cumBench,
          edge: cumStrategy - cumBench,
          maxDrawdown: maxDd,
        };
      }
      const sumW = weights.reduce((a, b) => a + b, 0);
      const w = sumW > 0 ? weights.map((x) => (x / sumW) * n) : weights.map(() => 1);
      let cumStrategy = 0;
      let cumBench = 0;
      let equity = 1;
      let peak = 1;
      let maxDd = 0;
      for (let i = 0; i < n; i++) {
        const r = tr[i]!;
        const b = br[i]!;
        const wi = w[i]!;
        cumStrategy += wi * r;
        cumBench += wi * b;
        equity *= 1 + wi * r;
        if (equity > peak) peak = equity;
        const dd = peak > 0 ? (peak - equity) / peak : 0;
        if (dd > maxDd) maxDd = dd;
      }
      return {
        trades: n,
        executedLongTrades: nLong,
        executedShortTrades: nShort,
        weightedAvgTradeReturn: cumStrategy / n,
        cumulativeReturn: cumStrategy,
        benchmarkReturn: cumBench,
        edge: cumStrategy - cumBench,
        maxDrawdown: maxDd,
      };
    };
    const psAbsScoreWeights = execActiveSetupScore.map((s) => s);
    const psConvictionWeights = execConviction.map((c) => c);
    const psAbsScoreTimesConvictionWeights = tradeReturns.map((_, i) => (execActiveSetupScore[i] ?? 0) * (execConviction[i] ?? 0));
    const psEqualRow = toPositionSizingRow(tradeReturns, benchmarkReturns, [], executedLongTrades, executedShortTrades, true);
    const psAbsScoreRow = toPositionSizingRow(tradeReturns, benchmarkReturns, psAbsScoreWeights, executedLongTrades, executedShortTrades, false);
    const psConvictionRow = toPositionSizingRow(tradeReturns, benchmarkReturns, psConvictionWeights, executedLongTrades, executedShortTrades, false);
    const psAbsScoreTimesConvictionRow = toPositionSizingRow(tradeReturns, benchmarkReturns, psAbsScoreTimesConvictionWeights, executedLongTrades, executedShortTrades, false);
    const psVariants = [
      { key: "equalWeightBaseline" as const, row: psEqualRow },
      { key: "weightByAbsSetupScore" as const, row: psAbsScoreRow },
      { key: "weightByConviction" as const, row: psConvictionRow },
      { key: "weightByAbsSetupScoreTimesConviction" as const, row: psAbsScoreTimesConvictionRow },
    ];
    const psBestByEdge = psVariants.filter((v) => v.row.edge != null).sort((a, b) => (b.row.edge ?? 0) - (a.row.edge ?? 0))[0];
    const psBestByCum = psVariants.filter((v) => v.row.cumulativeReturn != null).sort((a, b) => (b.row.cumulativeReturn ?? 0) - (a.row.cumulativeReturn ?? 0))[0];
    const psBestByDd = psVariants.filter((v) => v.row.maxDrawdown != null).sort((a, b) => (a.row.maxDrawdown ?? 0) - (b.row.maxDrawdown ?? 0))[0];
    const positionSizingShadowAudit: NonNullable<DashboardSummary["positionSizingShadowAudit"]> = {
      equalWeightBaseline: psEqualRow,
      weightByAbsSetupScore: psAbsScoreRow,
      weightByConviction: psConvictionRow,
      weightByAbsSetupScoreTimesConviction: psAbsScoreTimesConvictionRow,
      recommendation: {
        bestVariantByEdge: psBestByEdge?.key ?? null,
        bestVariantByCumulativeReturn: psBestByCum?.key ?? null,
        bestVariantByMaxDrawdown: psBestByDd?.key ?? null,
      },
    };

    const sbbLive = psEqualRow;
    const sbbShadow = psAbsScoreTimesConvictionRow;
    const sbbCumD = sbbLive.cumulativeReturn != null && sbbShadow.cumulativeReturn != null ? sbbShadow.cumulativeReturn - sbbLive.cumulativeReturn : null;
    const sbbEdgeD = sbbLive.edge != null && sbbShadow.edge != null ? sbbShadow.edge - sbbLive.edge : null;
    const sbbDdD = sbbLive.maxDrawdown != null && sbbShadow.maxDrawdown != null ? sbbShadow.maxDrawdown - sbbLive.maxDrawdown : null;
    const MATERIAL_CUM_RETURN_ADVANTAGE = 0.01;
    let sbbPreferred: string | null = null;
    if (sbbLive.edge != null && sbbShadow.edge != null && sbbLive.maxDrawdown != null && sbbShadow.maxDrawdown != null) {
      const liveWinsEdge = sbbLive.edge >= sbbShadow.edge;
      const liveWinsDd = sbbLive.maxDrawdown <= sbbShadow.maxDrawdown;
      // Prefer liveEqualWeightBaseline if edge is higher and maxDrawdown is lower
      if (liveWinsEdge && liveWinsDd) {
        sbbPreferred = "liveEqualWeightBaseline";
      } else if (sbbCumD != null && sbbCumD >= MATERIAL_CUM_RETURN_ADVANTAGE) {
        // Otherwise prefer shadowWeightedByAbsSetupScoreTimesConviction if cumulativeReturn advantage is materially higher
        sbbPreferred = "shadowWeightedByAbsSetupScoreTimesConviction";
      }
    }
    const sizingBenchmarkAudit: NonNullable<DashboardSummary["sizingBenchmarkAudit"]> = {
      liveEqualWeightBaseline: {
        trades: sbbLive.trades,
        cumulativeReturn: sbbLive.cumulativeReturn,
        benchmarkReturn: sbbLive.benchmarkReturn,
        edge: sbbLive.edge,
        maxDrawdown: sbbLive.maxDrawdown,
      },
      shadowWeightedByAbsSetupScoreTimesConviction: {
        trades: sbbShadow.trades,
        cumulativeReturn: sbbShadow.cumulativeReturn,
        benchmarkReturn: sbbShadow.benchmarkReturn,
        edge: sbbShadow.edge,
        maxDrawdown: sbbShadow.maxDrawdown,
      },
      comparison: {
        cumulativeReturnDeltaShadowMinusLive: sbbCumD,
        edgeDeltaShadowMinusLive: sbbEdgeD,
        drawdownDeltaShadowMinusLive: sbbDdD,
        currentPreferredSizingMode: sbbPreferred,
      },
    };

    const runPruningShadow = (excludeMacro: boolean, excludeSentiment: boolean): { tr: number[]; br: number[]; nLong: number; nShort: number } => {
      const tr: number[] = [];
      const br: number[] = [];
      let nLong = 0;
      let nShort = 0;
      for (const [symbol, { closes }] of cachedData) {
        const features = featuresCache.get(symbol);
        if (!features) continue;
        for (let i = 5 + DashboardService.NEUTRAL_LOOKBACK; i < closes.length - horizon; i++) {
          if (i >= features.length) break;
          const feat = features[i];
          if (!feat) continue;
          const contextSeed = hashString(symbol + ":" + String(i));
          const prevContextSeed = i > 5 + DashboardService.NEUTRAL_LOOKBACK ? hashString(symbol + ":" + String(i - 1)) : undefined;
          const { disagreement, signalStrength } = computeAgentAggregatedSignalForFeatures(feat, agents, contextSeed, prevContextSeed);
          const decomp = computeSignalDecomposition(feat, agents, contextSeed, prevContextSeed);
          let modMean = decomp.meanSignal;
          if (excludeMacro) modMean -= decomp.macroContribution;
          if (excludeSentiment) modMean -= decomp.sentimentContribution;
          const rawScore = decomp.baseSignal + (modMean - decomp.baseSignal) * SETUP_DELTA_ATTENUATION;
          const activeScore = ENABLE_SIGNAL_FLIP ? -rawScore : rawScore;
          let setup: "LONG" | "SHORT" | null = null;
          if (activeScore >= signalStrengthThreshold) setup = "LONG";
          else if (activeScore <= -signalStrengthThreshold) setup = "SHORT";
          if (setup == null) continue;
          if (Math.abs(activeScore) <= signalStrengthThreshold) continue;
          let neutralCount = 0;
          let validLookbackDays = 0;
          for (let k = i - DashboardService.NEUTRAL_LOOKBACK; k < i && k >= DashboardService.MIN_LOOKBACK_FOR_FEATURES; k++) {
            const fk = features[k];
            if (!fk) continue;
            validLookbackDays++;
            const decompK = computeSignalDecomposition(fk, agents, hashString(symbol + ":" + String(k)), k > DashboardService.MIN_LOOKBACK_FOR_FEATURES ? hashString(symbol + ":" + String(k - 1)) : undefined);
            let modMeanK = decompK.meanSignal;
            if (excludeMacro) modMeanK -= decompK.macroContribution;
            if (excludeSentiment) modMeanK -= decompK.sentimentContribution;
            const rawK = decompK.baseSignal + (modMeanK - decompK.baseSignal) * SETUP_DELTA_ATTENUATION;
            const activeK = ENABLE_SIGNAL_FLIP ? -rawK : rawK;
            if (Math.abs(activeK) < signalStrengthThreshold) neutralCount++;
          }
          const probabilityNeutral = validLookbackDays > 0 ? neutralCount / validLookbackDays : 0.5;
          if (probabilityNeutral >= neutralThreshold) continue;
          const conviction = signalStrength * 0.5 + (1 - disagreement) * 0.3 + (1 - probabilityNeutral) * 0.2;
          if (conviction < convictionThreshold) continue;
          const priceT0 = closes[i]!;
          const priceT1 = closes[i + horizon]!;
          if (priceT0 <= 0 || !Number.isFinite(priceT0) || !Number.isFinite(priceT1)) continue;
          const rawReturn = (priceT1 - priceT0) / priceT0;
          const tradeReturn = setup === "LONG" ? rawReturn : -rawReturn;
          tr.push(tradeReturn);
          br.push(rawReturn);
          if (setup === "LONG") nLong++;
          else nShort++;
        }
      }
      return { tr, br, nLong, nShort };
    };

    const noMacroRes = runPruningShadow(true, false);
    const noSentimentRes = runPruningShadow(false, true);
    const noMacroNoSentimentRes = runPruningShadow(true, true);

    const runStrongerSignalShadow = (minThreshold: number): { tr: number[]; br: number[]; nLong: number; nShort: number } => {
      const tr: number[] = [];
      const br: number[] = [];
      let nLong = 0;
      let nShort = 0;
      for (const [symbol, { closes }] of cachedData) {
        const features = featuresCache.get(symbol);
        if (!features) continue;
        for (let i = 5 + DashboardService.NEUTRAL_LOOKBACK; i < closes.length - horizon; i++) {
          if (i >= features.length) break;
          const feat = features[i];
          if (!feat) continue;
          const contextSeed = hashString(symbol + ":" + String(i));
          const prevContextSeed = i > 5 + DashboardService.NEUTRAL_LOOKBACK ? hashString(symbol + ":" + String(i - 1)) : undefined;
          const { disagreement, signalStrength } = computeAgentAggregatedSignalForFeatures(feat, agents, contextSeed, prevContextSeed);
          const decomp = computeSignalDecomposition(feat, agents, contextSeed, prevContextSeed);
          let modMean = decomp.meanSignal;
          modMean -= decomp.macroContribution;
          modMean -= decomp.sentimentContribution;
          const rawScore = decomp.baseSignal + (modMean - decomp.baseSignal) * SETUP_DELTA_ATTENUATION;
          const activeScore = ENABLE_SIGNAL_FLIP ? -rawScore : rawScore;
          let setup: "LONG" | "SHORT" | null = null;
          if (activeScore >= minThreshold) setup = "LONG";
          else if (activeScore <= -minThreshold) setup = "SHORT";
          if (setup == null) continue;
          if (Math.abs(activeScore) <= minThreshold) continue;
          let neutralCount = 0;
          let validLookbackDays = 0;
          for (let k = i - DashboardService.NEUTRAL_LOOKBACK; k < i && k >= DashboardService.MIN_LOOKBACK_FOR_FEATURES; k++) {
            const fk = features[k];
            if (!fk) continue;
            validLookbackDays++;
            const decompK = computeSignalDecomposition(fk, agents, hashString(symbol + ":" + String(k)), k > DashboardService.MIN_LOOKBACK_FOR_FEATURES ? hashString(symbol + ":" + String(k - 1)) : undefined);
            let modMeanK = decompK.meanSignal;
            modMeanK -= decompK.macroContribution;
            modMeanK -= decompK.sentimentContribution;
            const rawK = decompK.baseSignal + (modMeanK - decompK.baseSignal) * SETUP_DELTA_ATTENUATION;
            const activeK = ENABLE_SIGNAL_FLIP ? -rawK : rawK;
            if (Math.abs(activeK) < minThreshold) neutralCount++;
          }
          const probabilityNeutral = validLookbackDays > 0 ? neutralCount / validLookbackDays : 0.5;
          if (probabilityNeutral >= neutralThreshold) continue;
          const conviction = signalStrength * 0.5 + (1 - disagreement) * 0.3 + (1 - probabilityNeutral) * 0.2;
          if (conviction < convictionThreshold) continue;
          const priceT0 = closes[i]!;
          const priceT1 = closes[i + horizon]!;
          if (priceT0 <= 0 || !Number.isFinite(priceT0) || !Number.isFinite(priceT1)) continue;
          const rawReturn = (priceT1 - priceT0) / priceT0;
          const tradeReturn = setup === "LONG" ? rawReturn : -rawReturn;
          tr.push(tradeReturn);
          br.push(rawReturn);
          if (setup === "LONG") nLong++;
          else nShort++;
        }
      }
      return { tr, br, nLong, nShort };
    };

    const strongSignalBase = toComponentPruningRow(noMacroNoSentimentRes.tr, noMacroNoSentimentRes.br, noMacroNoSentimentRes.nLong, noMacroNoSentimentRes.nShort);
    const strongSignal06Res = runStrongerSignalShadow(0.06);
    const strongSignal08Res = runStrongerSignalShadow(0.08);
    const strongSignal10Res = runStrongerSignalShadow(0.10);
    const strongSignalShadowVariants = [
      { key: "baselineEquivalent" as const, row: strongSignalBase },
      { key: "strongerSignal_0_06" as const, row: toComponentPruningRow(strongSignal06Res.tr, strongSignal06Res.br, strongSignal06Res.nLong, strongSignal06Res.nShort) },
      { key: "strongerSignal_0_08" as const, row: toComponentPruningRow(strongSignal08Res.tr, strongSignal08Res.br, strongSignal08Res.nLong, strongSignal08Res.nShort) },
      { key: "strongerSignal_0_10" as const, row: toComponentPruningRow(strongSignal10Res.tr, strongSignal10Res.br, strongSignal10Res.nLong, strongSignal10Res.nShort) },
    ];
    const strongSignalBestByEdge = strongSignalShadowVariants.filter((v) => v.row.edge != null).sort((a, b) => (b.row.edge ?? 0) - (a.row.edge ?? 0))[0];
    const strongSignalBestByCum = strongSignalShadowVariants.filter((v) => v.row.cumulativeReturn != null).sort((a, b) => (b.row.cumulativeReturn ?? 0) - (a.row.cumulativeReturn ?? 0))[0];
    const strongSignalShadowAudit: NonNullable<DashboardSummary["strongSignalShadowAudit"]> = {
      baselineEquivalent: strongSignalBase,
      strongerSignal_0_06: toComponentPruningRow(strongSignal06Res.tr, strongSignal06Res.br, strongSignal06Res.nLong, strongSignal06Res.nShort),
      strongerSignal_0_08: toComponentPruningRow(strongSignal08Res.tr, strongSignal08Res.br, strongSignal08Res.nLong, strongSignal08Res.nShort),
      strongerSignal_0_10: toComponentPruningRow(strongSignal10Res.tr, strongSignal10Res.br, strongSignal10Res.nLong, strongSignal10Res.nShort),
      recommendation: {
        bestVariantByEdge: strongSignalBestByEdge?.key ?? null,
        bestVariantByCumulativeReturn: strongSignalBestByCum?.key ?? null,
      },
    };

    const NOISE_ONLY_SCALE = 5;
    const runNoiseOnlyShadow = (): { tr: number[]; br: number[]; nLong: number; nShort: number } => {
      const tr: number[] = [];
      const br: number[] = [];
      let nLong = 0;
      let nShort = 0;
      for (const [symbol, { closes }] of cachedData) {
        const features = featuresCache.get(symbol);
        if (!features) continue;
        for (let i = 5 + DashboardService.NEUTRAL_LOOKBACK; i < closes.length - horizon; i++) {
          if (i >= features.length) break;
          const feat = features[i];
          if (!feat) continue;
          const contextSeed = hashString(symbol + ":" + String(i));
          const prevContextSeed = i > 5 + DashboardService.NEUTRAL_LOOKBACK ? hashString(symbol + ":" + String(i - 1)) : undefined;
          const { disagreement, signalStrength } = computeAgentAggregatedSignalForFeatures(feat, agents, contextSeed, prevContextSeed);
          const decomp = computeSignalDecomposition(feat, agents, contextSeed, prevContextSeed);
          const rawNoiseScore = decomp.noiseContribution * NOISE_ONLY_SCALE;
          const activeScore = ENABLE_SIGNAL_FLIP ? -rawNoiseScore : rawNoiseScore;
          let setup: "LONG" | "SHORT" | null = null;
          if (activeScore >= signalStrengthThreshold) setup = "LONG";
          else if (activeScore <= -signalStrengthThreshold) setup = "SHORT";
          if (setup == null) continue;
          if (Math.abs(activeScore) <= signalStrengthThreshold) continue;
          let neutralCount = 0;
          let validLookbackDays = 0;
          for (let k = i - DashboardService.NEUTRAL_LOOKBACK; k < i && k >= DashboardService.MIN_LOOKBACK_FOR_FEATURES; k++) {
            const fk = features[k];
            if (!fk) continue;
            validLookbackDays++;
            const decompK = computeSignalDecomposition(fk, agents, hashString(symbol + ":" + String(k)), k > DashboardService.MIN_LOOKBACK_FOR_FEATURES ? hashString(symbol + ":" + String(k - 1)) : undefined);
            const rawK = decompK.noiseContribution * NOISE_ONLY_SCALE;
            const activeK = ENABLE_SIGNAL_FLIP ? -rawK : rawK;
            if (Math.abs(activeK) < signalStrengthThreshold) neutralCount++;
          }
          const probabilityNeutral = validLookbackDays > 0 ? neutralCount / validLookbackDays : 0.5;
          if (probabilityNeutral >= neutralThreshold) continue;
          const conviction = signalStrength * 0.5 + (1 - disagreement) * 0.3 + (1 - probabilityNeutral) * 0.2;
          if (conviction < convictionThreshold) continue;
          const priceT0 = closes[i]!;
          const priceT1 = closes[i + horizon]!;
          if (priceT0 <= 0 || !Number.isFinite(priceT0) || !Number.isFinite(priceT1)) continue;
          const rawReturn = (priceT1 - priceT0) / priceT0;
          const tradeReturn = setup === "LONG" ? rawReturn : -rawReturn;
          tr.push(tradeReturn);
          br.push(rawReturn);
          if (setup === "LONG") nLong++;
          else nShort++;
        }
      }
      return { tr, br, nLong, nShort };
    };

    const noiseOnlyRes = runNoiseOnlyShadow();
    const noiseOnlyRow = toComponentPruningRow(noiseOnlyRes.tr, noiseOnlyRes.br, noiseOnlyRes.nLong, noiseOnlyRes.nShort);

    const variants: Array<{ key: "currentFull" | "noMacro" | "noSentiment" | "noMacroNoSentiment"; row: ComponentPruningRow }> = [
      { key: "currentFull", row: currentFullRow },
      { key: "noMacro", row: toComponentPruningRow(noMacroRes.tr, noMacroRes.br, noMacroRes.nLong, noMacroRes.nShort) },
      { key: "noSentiment", row: toComponentPruningRow(noSentimentRes.tr, noSentimentRes.br, noSentimentRes.nLong, noSentimentRes.nShort) },
      { key: "noMacroNoSentiment", row: toComponentPruningRow(noMacroNoSentimentRes.tr, noMacroNoSentimentRes.br, noMacroNoSentimentRes.nLong, noMacroNoSentimentRes.nShort) },
    ];

    const pruningBestByEdge = variants.filter((v) => v.row.edge != null).sort((a, b) => (b.row.edge ?? 0) - (a.row.edge ?? 0))[0];
    const pruningBestByCum = variants.filter((v) => v.row.cumulativeReturn != null).sort((a, b) => (b.row.cumulativeReturn ?? 0) - (a.row.cumulativeReturn ?? 0))[0];

    const componentPruningShadowAudit: NonNullable<DashboardSummary["componentPruningShadowAudit"]> = {
      currentFull: currentFullRow,
      noMacro: toComponentPruningRow(noMacroRes.tr, noMacroRes.br, noMacroRes.nLong, noMacroRes.nShort),
      noSentiment: toComponentPruningRow(noSentimentRes.tr, noSentimentRes.br, noSentimentRes.nLong, noSentimentRes.nShort),
      noMacroNoSentiment: toComponentPruningRow(noMacroNoSentimentRes.tr, noMacroNoSentimentRes.br, noMacroNoSentimentRes.nLong, noMacroNoSentimentRes.nShort),
      recommendation: {
        bestVariantByEdge: pruningBestByEdge?.key ?? null,
        bestVariantByCumulativeReturn: pruningBestByCum?.key ?? null,
      },
    };

    const shadowNoMacroNoSentimentRow = componentPruningShadowAudit.noMacroNoSentiment;
    const liveEdge = currentFullRow.edge ?? null;
    const shadowEdge = shadowNoMacroNoSentimentRow.edge ?? null;
    const liveCum = currentFullRow.cumulativeReturn ?? null;
    const shadowCum = shadowNoMacroNoSentimentRow.cumulativeReturn ?? null;
    const liveDd = currentFullRow.maxDrawdown ?? null;
    const shadowDd = shadowNoMacroNoSentimentRow.maxDrawdown ?? null;
    const edgeDelta = liveEdge != null && shadowEdge != null ? liveEdge - shadowEdge : null;
    const cumDelta = liveCum != null && shadowCum != null ? liveCum - shadowCum : null;
    const ddDelta = liveDd != null && shadowDd != null ? liveDd - shadowDd : null;
    const currentPreferredMode = (liveEdge != null && shadowEdge != null && liveCum != null && shadowCum != null)
      ? (liveEdge >= shadowEdge && liveCum >= shadowCum ? "liveBaseline" : "shadowNoMacroNoSentiment")
      : "liveBaseline";

    const shadowBenchmarkAudit: NonNullable<DashboardSummary["shadowBenchmarkAudit"]> = {
      liveBaseline: currentFullRow,
      shadowNoMacroNoSentiment: shadowNoMacroNoSentimentRow,
      comparison: {
        edgeDeltaLiveMinusShadow: edgeDelta,
        cumulativeReturnDeltaLiveMinusShadow: cumDelta,
        drawdownDeltaLiveMinusShadow: ddDelta,
        currentPreferredMode,
      },
    };

    const computeAlphaRow = (vals: number[], returns: number[]) => {
      const n = vals.length;
      if (n < 2) return { correlation: null as number | null, posAvg: null as number | null, negAvg: null as number | null };
      const pos = vals.map((v, i) => ({ v, r: returns[i]! })).filter((x) => x.v > 0);
      const neg = vals.map((v, i) => ({ v, r: returns[i]! })).filter((x) => x.v < 0);
      const meanX = vals.reduce((a, b) => a + b, 0) / n;
      const meanY = returns.reduce((a, b) => a + b, 0) / n;
      let sumXY = 0;
      let sumX2 = 0;
      let sumY2 = 0;
      for (let i = 0; i < n; i++) {
        const dx = vals[i]! - meanX;
        const dy = returns[i]! - meanY;
        sumXY += dx * dy;
        sumX2 += dx * dx;
        sumY2 += dy * dy;
      }
      const denom = Math.sqrt(sumX2 * sumY2);
      const correlation = denom > 1e-12 ? sumXY / denom : null;
      const posAvg = pos.length > 0 ? pos.reduce((a, x) => a + x.r, 0) / pos.length : null;
      const negAvg = neg.length > 0 ? neg.reduce((a, x) => a + x.r, 0) / neg.length : null;
      return { correlation, posAvg, negAvg };
    };
    const r = alphaComponentVals.rawReturn;
    const alphaComponentAudit: NonNullable<DashboardSummary["alphaComponentAudit"]> = {
      baseSignal: (() => { const x = computeAlphaRow(alphaComponentVals.baseSignal, r); return { correlationWithForwardReturn: x.correlation, positiveBucketAvgForwardReturn: x.posAvg, negativeBucketAvgForwardReturn: x.negAvg }; })(),
      postInformationSignal: (() => { const x = computeAlphaRow(alphaComponentVals.postInformationSignal, r); return { correlationWithForwardReturn: x.correlation, positiveBucketAvgForwardReturn: x.posAvg, negativeBucketAvgForwardReturn: x.negAvg }; })(),
      technicalContribution: (() => { const x = computeAlphaRow(alphaComponentVals.technicalContribution, r); return { correlationWithForwardReturn: x.correlation, positiveBucketAvgForwardReturn: x.posAvg, negativeBucketAvgForwardReturn: x.negAvg }; })(),
      macroContribution: (() => { const x = computeAlphaRow(alphaComponentVals.macroContribution, r); return { correlationWithForwardReturn: x.correlation, positiveBucketAvgForwardReturn: x.posAvg, negativeBucketAvgForwardReturn: x.negAvg }; })(),
      sentimentContribution: (() => { const x = computeAlphaRow(alphaComponentVals.sentimentContribution, r); return { correlationWithForwardReturn: x.correlation, positiveBucketAvgForwardReturn: x.posAvg, negativeBucketAvgForwardReturn: x.negAvg }; })(),
      noiseContribution: (() => { const x = computeAlphaRow(alphaComponentVals.noiseContribution, r); return { correlationWithForwardReturn: x.correlation, positiveBucketAvgForwardReturn: x.posAvg, negativeBucketAvgForwardReturn: x.negAvg }; })(),
    };

    const computeCorr = (x: number[], y: number[]) => {
      const n = x.length;
      if (n < 2) return null;
      const mx = x.reduce((a, b) => a + b, 0) / n;
      const my = y.reduce((a, b) => a + b, 0) / n;
      let sumXY = 0, sumX2 = 0, sumY2 = 0;
      for (let i = 0; i < n; i++) {
        const dx = x[i]! - mx;
        const dy = y[i]! - my;
        sumXY += dx * dy;
        sumX2 += dx * dx;
        sumY2 += dy * dy;
      }
      const denom = Math.sqrt(sumX2 * sumY2);
      return denom > 1e-12 ? sumXY / denom : null;
    };
    const inv = (arr: number[]) => arr.map((v) => -v);
    const componentInversionShadowAudit: NonNullable<DashboardSummary["componentInversionShadowAudit"]> = {
      baseSignal: { actualCorrelation: computeCorr(alphaComponentVals.baseSignal, r), invertedCorrelation: computeCorr(inv(alphaComponentVals.baseSignal), r) },
      postInformationSignal: { actualCorrelation: computeCorr(alphaComponentVals.postInformationSignal, r), invertedCorrelation: computeCorr(inv(alphaComponentVals.postInformationSignal), r) },
      technicalContribution: { actualCorrelation: computeCorr(alphaComponentVals.technicalContribution, r), invertedCorrelation: computeCorr(inv(alphaComponentVals.technicalContribution), r) },
      macroContribution: { actualCorrelation: computeCorr(alphaComponentVals.macroContribution, r), invertedCorrelation: computeCorr(inv(alphaComponentVals.macroContribution), r) },
      sentimentContribution: { actualCorrelation: computeCorr(alphaComponentVals.sentimentContribution, r), invertedCorrelation: computeCorr(inv(alphaComponentVals.sentimentContribution), r) },
    };

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
        neutralCount: byTypeSums.trendFollower.neutralCount,
      },
      contrarian: {
        avgSignal: execCount > 0 && nContr > 0 ? byTypeSums.contrarian.sumSignal / (execCount * nContr) : 0,
        positiveCount: byTypeSums.contrarian.positiveCount,
        negativeCount: byTypeSums.contrarian.negativeCount,
        neutralCount: byTypeSums.contrarian.neutralCount,
      },
      balanced: {
        avgSignal: execCount > 0 && nBal > 0 ? byTypeSums.balanced.sumSignal / (execCount * nBal) : 0,
        positiveCount: byTypeSums.balanced.positiveCount,
        negativeCount: byTypeSums.balanced.negativeCount,
        neutralCount: byTypeSums.balanced.neutralCount,
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
      trendFollower: { avgSignal: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0 },
      contrarian: { avgSignal: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0 },
      balanced: { avgSignal: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0 },
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
        setupShadowAudit: {
          sourceDescription: "Feature-available rows; same setup rule (score vs directionThreshold); shadow counts from baseOnly, shadow25, shadow50, actual score variants.",
          variants: { ...shadowCounts },
        },
        setupScoreAudit: {
          sourceDescription: "Setup direction now uses attenuated information delta: setupScore = baseSignal + delta * 0.25.",
          attenuationFactor: 0.25,
          avgSetupScore: setupScoreCount > 0 ? sumSetupScore / setupScoreCount : null,
          positiveSetupScoreCount,
          negativeSetupScoreCount,
        },
        signalFlipAudit: {
          enabled: ENABLE_SIGNAL_FLIP,
          scoreSource: ENABLE_SIGNAL_FLIP ? `-(baseSignal + delta * ${SETUP_DELTA_ATTENUATION})` : `baseSignal + delta * ${SETUP_DELTA_ATTENUATION}`,
          flipped: ENABLE_SIGNAL_FLIP,
          avgInvertedSetupScore: setupScoreCount > 0 ? -sumSetupScore / setupScoreCount : null,
          positiveInvertedSetupScoreCount: negativeSetupScoreCount,
          negativeInvertedSetupScoreCount: positiveSetupScoreCount,
        },
        currentStrategyConfigAudit: {
          longOnlyMode: !ENABLE_SHORT_TRADES,
          signalFlipEnabled: ENABLE_SIGNAL_FLIP,
          deltaAttenuationFactor: SETUP_DELTA_ATTENUATION,
          activeSetupScoreFormula: ENABLE_SIGNAL_FLIP
            ? `-(baseSignal + delta * ${SETUP_DELTA_ATTENUATION})`
            : `baseSignal + delta * ${SETUP_DELTA_ATTENUATION}`,
        },
        liveDirectionModeAudit: {
          longOnlyMode: !ENABLE_SHORT_TRADES,
          shortEnabled: ENABLE_SHORT_TRADES,
          signalFlipEnabled: ENABLE_SIGNAL_FLIP,
          deltaAttenuationFactor: SETUP_DELTA_ATTENUATION,
          activeSetupScoreFormula: ENABLE_SIGNAL_FLIP
            ? `-(baseSignal + delta * ${SETUP_DELTA_ATTENUATION})`
            : `baseSignal + delta * ${SETUP_DELTA_ATTENUATION}`,
        },
        macroPrunedLiveAudit: {
          enabled: EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE,
          macroIncludedInLiveSetupScore: !EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE,
          signalFlipEnabled: ENABLE_SIGNAL_FLIP,
          deltaAttenuationFactor: SETUP_DELTA_ATTENUATION,
          activeSetupScoreFormula: ENABLE_SIGNAL_FLIP
            ? (EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE ? `-(baseSignal + (meanSignal - macroContribution - baseSignal) * ${SETUP_DELTA_ATTENUATION})` : `-(baseSignal + delta * ${SETUP_DELTA_ATTENUATION})`)
            : (EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE ? `baseSignal + (meanSignal - macroContribution - baseSignal) * ${SETUP_DELTA_ATTENUATION}` : `baseSignal + delta * ${SETUP_DELTA_ATTENUATION}`),
        },
        officialBaselineAudit: {
          signalFlipEnabled: ENABLE_SIGNAL_FLIP,
          shortEnabled: ENABLE_SHORT_TRADES,
          deltaAttenuationFactor: SETUP_DELTA_ATTENUATION,
          macroExcludedFromLiveSetupScore: EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE,
          sentimentExcludedFromLiveSetupScore: EXCLUDE_SENTIMENT_FROM_LIVE_SETUP_SCORE,
          activeSetupScoreFormula: EXCLUDE_SENTIMENT_FROM_LIVE_SETUP_SCORE
            ? `-(baseSignal + (meanSignal - macroContribution - sentimentContribution - baseSignal) * ${SETUP_DELTA_ATTENUATION})`
            : `-(baseSignal + (meanSignal - macroContribution - baseSignal) * ${SETUP_DELTA_ATTENUATION})`,
        },
        sentimentPrunedLiveAudit: {
          enabled: true,
          macroIncludedInLiveSetupScore: false,
          sentimentIncludedInLiveSetupScore: false,
          signalFlipEnabled: ENABLE_SIGNAL_FLIP,
          deltaAttenuationFactor: SETUP_DELTA_ATTENUATION,
          activeSetupScoreFormula: `-(baseSignal + (meanSignal - macroContribution - sentimentContribution - baseSignal) * ${SETUP_DELTA_ATTENUATION})`,
        },
        baselinePreservationAudit: {
          officialBaselineName: "noMacroNoSentiment",
          signalFlipEnabled: ENABLE_SIGNAL_FLIP,
          shortEnabled: ENABLE_SHORT_TRADES,
          deltaAttenuationFactor: SETUP_DELTA_ATTENUATION,
          macroExcludedFromLiveSetupScore: EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE,
          sentimentExcludedFromLiveSetupScore: EXCLUDE_SENTIMENT_FROM_LIVE_SETUP_SCORE,
          activeSetupScoreFormula: `-(baseSignal + (meanSignal - macroContribution - sentimentContribution - baseSignal) * ${SETUP_DELTA_ATTENUATION})`,
          baselinePerformanceSnapshot: {
            trades: 0,
            winRate: null,
            avgTradeReturn: null,
            cumulativeReturn: null,
            benchmarkReturn: null,
            edge: null,
            maxDrawdown: null,
          },
        },
        winningBaselineFeatureAudit,
        strongSignalLiveAudit,
        outOfSampleAudit,
        walkForwardAudit,
        strategyV1CandidateAudit,
        strategyV2CandidateAudit,
        liveExitPolicyAudit,
        exitPolicyShadowAudit,
        executionRealismAudit,
        frictionSensitivityAudit,
        concurrencyExposureAudit,
        capitalConstraintShadowAudit,
        deployableStrategyCandidateAudit,
        strategyComparisonSummaryAudit,
        regimePerformanceAudit,
        downtrendSuppressionShadowAudit,
        causalRegimePolicyShadowAudit,
        regimePolicyShadowAudit,
        experimentHarnessAudit: (() => {
          const bl = { name: "noMacroNoSentiment", trades: 0, winRate: null, avgTradeReturn: null, cumulativeReturn: null, benchmarkReturn: null, edge: null, maxDrawdown: null } as const;
          const cand = noiseOnlyRow;
          const expBlEdge = bl.edge;
          const expBlCum = bl.cumulativeReturn;
          const expBlDd = bl.maxDrawdown;
          const expCdEdge = cand.edge;
          const expCdCum = cand.cumulativeReturn;
          const expCdDd = cand.maxDrawdown;
          const expEdgeD = expCdEdge != null && expBlEdge != null ? expCdEdge - expBlEdge : null;
          const expCumD = expCdCum != null && expBlCum != null ? expCdCum - expBlCum : null;
          const expDdD = expCdDd != null && expBlDd != null ? expCdDd - expBlDd : null;
          const prefEdge = expCdEdge != null && expBlEdge != null ? (expCdEdge >= expBlEdge ? "noiseOnlyShadow" : "noMacroNoSentiment") : null;
          const prefCum = expCdCum != null && expBlCum != null ? (expCdCum >= expBlCum ? "noiseOnlyShadow" : "noMacroNoSentiment") : null;
          return {
            baseline: bl,
            candidateShadow: { name: "noiseOnlyShadow", configured: true, trades: cand.trades, winRate: cand.winRate, avgTradeReturn: cand.avgTradeReturn, cumulativeReturn: cand.cumulativeReturn, benchmarkReturn: cand.benchmarkReturn, edge: cand.edge, maxDrawdown: cand.maxDrawdown },
            comparison: { edgeDeltaCandidateMinusBaseline: expEdgeD, cumulativeReturnDeltaCandidateMinusBaseline: expCumD, drawdownDeltaCandidateMinusBaseline: expDdD, preferredByEdge: prefEdge, preferredByCumulativeReturn: prefCum },
          };
        })(),
        setupGateConsistencyAudit: {
          sourceDescription: "Setup direction and signal-strength gate both use setupScore (baseSignal + delta * 0.25) with the same threshold.",
          setupUses: "setupScore",
          signalStrengthUses: "setupScore",
        },
        neutralGateConsistencyAudit: {
          sourceDescription: "Setup direction, signal-strength gate, and neutral filter all use setupScore (baseSignal + delta * 0.25) with the same threshold.",
          setupUses: "setupScore",
          signalStrengthUses: "setupScore",
          neutralUses: "setupScore",
        },
        neutralFilterAudit: {
          sourceDescription: "Audit of neutral filter: reject when probabilityNeutral >= neutralThreshold.",
          longPath: {
            enteredNeutralStageCount: neutralAuditLong.enteredNeutralStageCount,
            passedNeutralCount: neutralAuditLong.passedNeutralCount,
            rejectedNeutralCount: neutralAuditLong.rejectedNeutralCount,
            avgConvictionAtNeutralStage: neutralAuditLong.enteredNeutralStageCount > 0 ? neutralAuditLong.sumConviction / neutralAuditLong.enteredNeutralStageCount : null,
            avgNeutralMetricIfExists: neutralAuditLong.enteredNeutralStageCount > 0 ? neutralAuditLong.sumNeutralMetric / neutralAuditLong.enteredNeutralStageCount : null,
          },
          shortPath: {
            enteredNeutralStageCount: neutralAuditShort.enteredNeutralStageCount,
            passedNeutralCount: neutralAuditShort.passedNeutralCount,
            rejectedNeutralCount: neutralAuditShort.rejectedNeutralCount,
            avgConvictionAtNeutralStage: neutralAuditShort.enteredNeutralStageCount > 0 ? neutralAuditShort.sumConviction / neutralAuditShort.enteredNeutralStageCount : null,
            avgNeutralMetricIfExists: neutralAuditShort.enteredNeutralStageCount > 0 ? neutralAuditShort.sumNeutralMetric / neutralAuditShort.enteredNeutralStageCount : null,
          },
          neutralRuleDescription: "Reject when probabilityNeutral >= neutralThreshold, where probabilityNeutral is the fraction of NEUTRAL_LOOKBACK days where |meanSignal| < signalStrengthThreshold.",
          sampleRejectedLongs: sampleNeutralRejectedLongs,
          sampleRejectedShorts: sampleNeutralRejectedShorts,
        },
        longSetupAttritionAudit: {
          longPath: {
            setupCount: longConditionCount,
            afterSignalThresholdCount: attritionLong.afterSignalThresholdCount,
            afterConvictionCount: attritionLong.afterConvictionCount,
            afterNeutralFilterCount: attritionLong.afterNeutralFilterCount,
            afterPriceValidityCount: attritionLong.afterPriceValidityCount,
            executedCount: 0,
          },
          shortPath: {
            setupCount: shortConditionCount,
            afterSignalThresholdCount: attritionShort.afterSignalThresholdCount,
            afterConvictionCount: attritionShort.afterConvictionCount,
            afterNeutralFilterCount: attritionShort.afterNeutralFilterCount,
            afterPriceValidityCount: attritionShort.afterPriceValidityCount,
            executedCount: 0,
          },
          sampleRejectedLongs,
          sampleRejectedShorts,
        },
        postFixPerformanceAudit: {
          tradeMix: { executedLongTrades: 0, executedShortTrades: 0, longShare: null, shortShare: null },
          performance: { trades: 0, winRate: null, avgTradeReturn: null, cumulativeReturn: null, benchmarkReturn: null, edge: null, maxDrawdown: null },
          directionalQuality: { longWinRateIfAvailable: null, shortWinRateIfAvailable: null, avgLongReturnIfAvailable: null, avgShortReturnIfAvailable: null },
          scoringPopulation: { longSetupCount: longConditionCount, shortSetupCount: shortConditionCount, longExecutedCount: 0, shortExecutedCount: 0 },
        },
        attenuationComparisonAudit,
        attenuationRetestNoMacroAudit,
        longOnlyModeAudit: { enabled: !ENABLE_SHORT_TRADES, skippedShortTrades, executedLongTrades },
        alphaComponentAudit: {
          baseSignal: { correlationWithForwardReturn: null, positiveBucketAvgForwardReturn: null, negativeBucketAvgForwardReturn: null },
          postInformationSignal: { correlationWithForwardReturn: null, positiveBucketAvgForwardReturn: null, negativeBucketAvgForwardReturn: null },
          technicalContribution: { correlationWithForwardReturn: null, positiveBucketAvgForwardReturn: null, negativeBucketAvgForwardReturn: null },
          macroContribution: { correlationWithForwardReturn: null, positiveBucketAvgForwardReturn: null, negativeBucketAvgForwardReturn: null },
          sentimentContribution: { correlationWithForwardReturn: null, positiveBucketAvgForwardReturn: null, negativeBucketAvgForwardReturn: null },
          noiseContribution: { correlationWithForwardReturn: null, positiveBucketAvgForwardReturn: null, negativeBucketAvgForwardReturn: null },
        },
        componentInversionShadowAudit: {
          baseSignal: { actualCorrelation: null, invertedCorrelation: null },
          postInformationSignal: { actualCorrelation: null, invertedCorrelation: null },
          technicalContribution: { actualCorrelation: null, invertedCorrelation: null },
          macroContribution: { actualCorrelation: null, invertedCorrelation: null },
          sentimentContribution: { actualCorrelation: null, invertedCorrelation: null },
        },
        invertedSignalPerformanceAudit: {
          baseSignal: { trades: null, winRate: null, avgTradeReturn: null, cumulativeReturn: null, benchmarkReturn: null, edge: null },
          invertedBaseSignal: { trades: null, winRate: null, avgTradeReturn: null, cumulativeReturn: null, benchmarkReturn: null, edge: null },
          postInformationSignal: { trades: null, winRate: null, avgTradeReturn: null, cumulativeReturn: null, benchmarkReturn: null, edge: null },
          invertedPostInformationSignal: { trades: null, winRate: null, avgTradeReturn: null, cumulativeReturn: null, benchmarkReturn: null, edge: null },
        },
        timingAlphaAudit,
        shortReentryShadowAudit,
        componentPruningShadowAudit,
        signalRankingShadowAudit,
        positionSizingShadowAudit,
        sizingBenchmarkAudit,
        strongSignalShadowAudit,
        shadowBenchmarkAudit,
        directionCorrectnessAudit: {
          longTrades: { count: 0, avgReturn: null, positiveReturnRate: null, avgBenchmarkReturn: null },
          shortTrades: { count: 0, avgReturn: null, positiveReturnRate: null, avgBenchmarkReturn: null },
          inversionCheck: { shortWouldBeBetterIfLong: null, longWouldBeBetterIfShort: null },
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

    const setupShadowAudit: NonNullable<DashboardSummary["setupShadowAudit"]> = {
      sourceDescription: "Feature-available rows; same setup rule (score vs directionThreshold); shadow counts from baseOnly, shadow25, shadow50, actual score variants.",
      variants: { ...shadowCounts },
    };

    const setupScoreAudit: NonNullable<DashboardSummary["setupScoreAudit"]> = {
      sourceDescription: "Setup direction now uses attenuated information delta: setupScore = baseSignal + delta * 0.25.",
      attenuationFactor: 0.25,
      avgSetupScore: setupScoreCount > 0 ? sumSetupScore / setupScoreCount : null,
      positiveSetupScoreCount,
      negativeSetupScoreCount,
    };
    const signalFlipAudit: NonNullable<DashboardSummary["signalFlipAudit"]> = {
      enabled: ENABLE_SIGNAL_FLIP,
      scoreSource: ENABLE_SIGNAL_FLIP ? `-(baseSignal + delta * ${SETUP_DELTA_ATTENUATION})` : `baseSignal + delta * ${SETUP_DELTA_ATTENUATION}`,
      flipped: ENABLE_SIGNAL_FLIP,
      avgInvertedSetupScore: setupScoreCount > 0 ? -sumSetupScore / setupScoreCount : null,
      positiveInvertedSetupScoreCount: negativeSetupScoreCount,
      negativeInvertedSetupScoreCount: positiveSetupScoreCount,
    };
    const currentStrategyConfigAudit: NonNullable<DashboardSummary["currentStrategyConfigAudit"]> = {
      longOnlyMode: !ENABLE_SHORT_TRADES,
      signalFlipEnabled: ENABLE_SIGNAL_FLIP,
      deltaAttenuationFactor: SETUP_DELTA_ATTENUATION,
      activeSetupScoreFormula: ENABLE_SIGNAL_FLIP
        ? `-(baseSignal + delta * ${SETUP_DELTA_ATTENUATION})`
        : `baseSignal + delta * ${SETUP_DELTA_ATTENUATION}`,
    };
    const liveDirectionModeAudit: NonNullable<DashboardSummary["liveDirectionModeAudit"]> = {
      longOnlyMode: !ENABLE_SHORT_TRADES,
      shortEnabled: ENABLE_SHORT_TRADES,
      signalFlipEnabled: ENABLE_SIGNAL_FLIP,
      deltaAttenuationFactor: SETUP_DELTA_ATTENUATION,
      activeSetupScoreFormula: ENABLE_SIGNAL_FLIP
        ? `-(baseSignal + delta * ${SETUP_DELTA_ATTENUATION})`
        : `baseSignal + delta * ${SETUP_DELTA_ATTENUATION}`,
    };
    const macroPrunedLiveAudit: NonNullable<DashboardSummary["macroPrunedLiveAudit"]> = {
      enabled: EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE,
      macroIncludedInLiveSetupScore: !EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE,
      signalFlipEnabled: ENABLE_SIGNAL_FLIP,
      deltaAttenuationFactor: SETUP_DELTA_ATTENUATION,
      activeSetupScoreFormula: ENABLE_SIGNAL_FLIP
        ? (EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE ? `-(baseSignal + (meanSignal - macroContribution - baseSignal) * ${SETUP_DELTA_ATTENUATION})` : `-(baseSignal + delta * ${SETUP_DELTA_ATTENUATION})`)
        : (EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE ? `baseSignal + (meanSignal - macroContribution - baseSignal) * ${SETUP_DELTA_ATTENUATION}` : `baseSignal + delta * ${SETUP_DELTA_ATTENUATION}`),
    };
    const officialBaselineAudit: NonNullable<DashboardSummary["officialBaselineAudit"]> = {
      signalFlipEnabled: ENABLE_SIGNAL_FLIP,
      shortEnabled: ENABLE_SHORT_TRADES,
      deltaAttenuationFactor: SETUP_DELTA_ATTENUATION,
      macroExcludedFromLiveSetupScore: EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE,
      sentimentExcludedFromLiveSetupScore: EXCLUDE_SENTIMENT_FROM_LIVE_SETUP_SCORE,
      activeSetupScoreFormula: EXCLUDE_SENTIMENT_FROM_LIVE_SETUP_SCORE
        ? `-(baseSignal + (meanSignal - macroContribution - sentimentContribution - baseSignal) * ${SETUP_DELTA_ATTENUATION})`
        : `-(baseSignal + (meanSignal - macroContribution - baseSignal) * ${SETUP_DELTA_ATTENUATION})`,
    };

    const sentimentPrunedLiveAudit: NonNullable<DashboardSummary["sentimentPrunedLiveAudit"]> = {
      enabled: true,
      macroIncludedInLiveSetupScore: false,
      sentimentIncludedInLiveSetupScore: false,
      signalFlipEnabled: ENABLE_SIGNAL_FLIP,
      deltaAttenuationFactor: SETUP_DELTA_ATTENUATION,
      activeSetupScoreFormula: `-(baseSignal + (meanSignal - macroContribution - sentimentContribution - baseSignal) * ${SETUP_DELTA_ATTENUATION})`,
    };

    const baselinePreservationAudit: NonNullable<DashboardSummary["baselinePreservationAudit"]> = {
      officialBaselineName: "noMacroNoSentiment",
      signalFlipEnabled: ENABLE_SIGNAL_FLIP,
      shortEnabled: ENABLE_SHORT_TRADES,
      deltaAttenuationFactor: SETUP_DELTA_ATTENUATION,
      macroExcludedFromLiveSetupScore: EXCLUDE_MACRO_FROM_LIVE_SETUP_SCORE,
      sentimentExcludedFromLiveSetupScore: EXCLUDE_SENTIMENT_FROM_LIVE_SETUP_SCORE,
      activeSetupScoreFormula: `-(baseSignal + (meanSignal - macroContribution - sentimentContribution - baseSignal) * ${SETUP_DELTA_ATTENUATION})`,
      baselinePerformanceSnapshot: {
        trades: trades,
        winRate,
        avgTradeReturn: avgStrategyReturn,
        cumulativeReturn,
        benchmarkReturn,
        edge,
        maxDrawdown,
      },
    };

    const expBaselineEdge = edge;
    const expBaselineCum = cumulativeReturn;
    const expBaselineDd = maxDrawdown;
    const expCandEdge = noiseOnlyRow.edge;
    const expCandCum = noiseOnlyRow.cumulativeReturn;
    const expCandDd = noiseOnlyRow.maxDrawdown;
    const expEdgeDelta = expCandEdge != null && expBaselineEdge != null ? expCandEdge - expBaselineEdge : null;
    const expCumDelta = expCandCum != null && expBaselineCum != null ? expCandCum - expBaselineCum : null;
    const expDdDelta = expCandDd != null && expBaselineDd != null ? expCandDd - expBaselineDd : null;
    const expPreferredByEdge =
      expCandEdge != null && expBaselineEdge != null ? (expCandEdge >= expBaselineEdge ? "noiseOnlyShadow" : "noMacroNoSentiment") : null;
    const expPreferredByCumulativeReturn =
      expCandCum != null && expBaselineCum != null ? (expCandCum >= expBaselineCum ? "noiseOnlyShadow" : "noMacroNoSentiment") : null;

    const experimentHarnessAudit: NonNullable<DashboardSummary["experimentHarnessAudit"]> = {
      baseline: {
        name: "noMacroNoSentiment",
        trades: trades,
        winRate,
        avgTradeReturn: avgStrategyReturn,
        cumulativeReturn,
        benchmarkReturn,
        edge,
        maxDrawdown,
      },
      candidateShadow: {
        name: "noiseOnlyShadow",
        configured: true,
        trades: noiseOnlyRow.trades,
        winRate: noiseOnlyRow.winRate,
        avgTradeReturn: noiseOnlyRow.avgTradeReturn,
        cumulativeReturn: noiseOnlyRow.cumulativeReturn,
        benchmarkReturn: noiseOnlyRow.benchmarkReturn,
        edge: noiseOnlyRow.edge,
        maxDrawdown: noiseOnlyRow.maxDrawdown,
      },
      comparison: {
        edgeDeltaCandidateMinusBaseline: expEdgeDelta,
        cumulativeReturnDeltaCandidateMinusBaseline: expCumDelta,
        drawdownDeltaCandidateMinusBaseline: expDdDelta,
        preferredByEdge: expPreferredByEdge,
        preferredByCumulativeReturn: expPreferredByCumulativeReturn,
      },
    };

    const setupGateConsistencyAudit: NonNullable<DashboardSummary["setupGateConsistencyAudit"]> = {
      sourceDescription: "Setup direction and signal-strength gate both use setupScore (baseSignal + delta * 0.25) with the same threshold.",
      setupUses: "setupScore",
      signalStrengthUses: "setupScore",
    };

    const neutralGateConsistencyAudit: NonNullable<DashboardSummary["neutralGateConsistencyAudit"]> = {
      sourceDescription: "Setup direction, signal-strength gate, and neutral filter all use setupScore (baseSignal + delta * 0.25) with the same threshold.",
      setupUses: "setupScore",
      signalStrengthUses: "setupScore",
      neutralUses: "setupScore",
    };

    const neutralFilterAudit: NonNullable<DashboardSummary["neutralFilterAudit"]> = {
      sourceDescription: "Audit of neutral filter: reject when probabilityNeutral >= neutralThreshold.",
      longPath: {
        enteredNeutralStageCount: neutralAuditLong.enteredNeutralStageCount,
        passedNeutralCount: neutralAuditLong.passedNeutralCount,
        rejectedNeutralCount: neutralAuditLong.rejectedNeutralCount,
        avgConvictionAtNeutralStage: neutralAuditLong.enteredNeutralStageCount > 0 ? neutralAuditLong.sumConviction / neutralAuditLong.enteredNeutralStageCount : null,
        avgNeutralMetricIfExists: neutralAuditLong.enteredNeutralStageCount > 0 ? neutralAuditLong.sumNeutralMetric / neutralAuditLong.enteredNeutralStageCount : null,
      },
      shortPath: {
        enteredNeutralStageCount: neutralAuditShort.enteredNeutralStageCount,
        passedNeutralCount: neutralAuditShort.passedNeutralCount,
        rejectedNeutralCount: neutralAuditShort.rejectedNeutralCount,
        avgConvictionAtNeutralStage: neutralAuditShort.enteredNeutralStageCount > 0 ? neutralAuditShort.sumConviction / neutralAuditShort.enteredNeutralStageCount : null,
        avgNeutralMetricIfExists: neutralAuditShort.enteredNeutralStageCount > 0 ? neutralAuditShort.sumNeutralMetric / neutralAuditShort.enteredNeutralStageCount : null,
      },
      neutralRuleDescription: "Reject when probabilityNeutral >= neutralThreshold, where probabilityNeutral is the fraction of NEUTRAL_LOOKBACK days where |meanSignal| < signalStrengthThreshold.",
      sampleRejectedLongs: sampleNeutralRejectedLongs,
      sampleRejectedShorts: sampleNeutralRejectedShorts,
    };

    const longSetupAttritionAudit: NonNullable<DashboardSummary["longSetupAttritionAudit"]> = {
      longPath: {
        setupCount: longConditionCount,
        afterSignalThresholdCount: attritionLong.afterSignalThresholdCount,
        afterConvictionCount: attritionLong.afterConvictionCount,
        afterNeutralFilterCount: attritionLong.afterNeutralFilterCount,
        afterPriceValidityCount: attritionLong.afterPriceValidityCount,
        executedCount: executedLongTrades,
      },
      shortPath: {
        setupCount: shortConditionCount,
        afterSignalThresholdCount: attritionShort.afterSignalThresholdCount,
        afterConvictionCount: attritionShort.afterConvictionCount,
        afterNeutralFilterCount: attritionShort.afterNeutralFilterCount,
        afterPriceValidityCount: attritionShort.afterPriceValidityCount,
        executedCount: executedShortTrades,
      },
      sampleRejectedLongs,
      sampleRejectedShorts,
    };

    const postFixPerformanceAudit: NonNullable<DashboardSummary["postFixPerformanceAudit"]> = {
      tradeMix: {
        executedLongTrades,
        executedShortTrades,
        longShare: totalExecuted > 0 ? executedLongTrades / totalExecuted : null,
        shortShare: totalExecuted > 0 ? executedShortTrades / totalExecuted : null,
      },
      performance: {
        trades: trades,
        winRate,
        avgTradeReturn: avgStrategyReturn,
        cumulativeReturn,
        benchmarkReturn,
        edge,
        maxDrawdown,
      },
      directionalQuality: {
        longWinRateIfAvailable: longTradeReturns.length > 0 ? longTradeReturns.filter((r) => r > 0).length / longTradeReturns.length : null,
        shortWinRateIfAvailable: shortTradeReturns.length > 0 ? shortTradeReturns.filter((r) => r > 0).length / shortTradeReturns.length : null,
        avgLongReturnIfAvailable: longTradeReturns.length > 0 ? longTradeReturns.reduce((a, b) => a + b, 0) / longTradeReturns.length : null,
        avgShortReturnIfAvailable: shortTradeReturns.length > 0 ? shortTradeReturns.reduce((a, b) => a + b, 0) / shortTradeReturns.length : null,
      },
      scoringPopulation: {
        longSetupCount: longConditionCount,
        shortSetupCount: shortConditionCount,
        longExecutedCount: executedLongTrades,
        shortExecutedCount: executedShortTrades,
      },
    };

    const nLong = longTradeReturns.length;
    const nShort = shortTradeReturns.length;
    const longAvgReturn = nLong > 0 ? longTradeReturns.reduce((a, b) => a + b, 0) / nLong : null;
    const shortAvgReturn = nShort > 0 ? shortTradeReturns.reduce((a, b) => a + b, 0) / nShort : null;
    const longAvgBenchmark = nLong > 0 ? longTradeReturns.reduce((a, b) => a + b, 0) / nLong : null;
    const shortAvgBenchmark = nShort > 0 ? -shortTradeReturns.reduce((a, b) => a + b, 0) / nShort : null;
    const longOnlyModeAudit: NonNullable<DashboardSummary["longOnlyModeAudit"]> = {
      enabled: !ENABLE_SHORT_TRADES,
      skippedShortTrades,
      executedLongTrades,
    };

    const directionCorrectnessAudit: NonNullable<DashboardSummary["directionCorrectnessAudit"]> = {
      longTrades: {
        count: nLong,
        avgReturn: longAvgReturn,
        positiveReturnRate: nLong > 0 ? longTradeReturns.filter((r) => r > 0).length / nLong : null,
        avgBenchmarkReturn: longAvgBenchmark,
      },
      shortTrades: {
        count: nShort,
        avgReturn: shortAvgReturn,
        positiveReturnRate: nShort > 0 ? shortTradeReturns.filter((r) => r > 0).length / nShort : null,
        avgBenchmarkReturn: shortAvgBenchmark,
      },
      inversionCheck: {
        shortWouldBeBetterIfLong: nShort > 0 && shortAvgReturn != null && shortAvgBenchmark != null
          ? shortAvgReturn < 0 && shortAvgBenchmark > 0
          : null,
        longWouldBeBetterIfShort: nLong > 0 && longAvgReturn != null && longAvgBenchmark != null
          ? longAvgReturn < 0 && longAvgBenchmark < 0
          : null,
      },
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
      setupShadowAudit,
      setupScoreAudit,
      signalFlipAudit,
      currentStrategyConfigAudit,
      liveDirectionModeAudit,
      macroPrunedLiveAudit,
      officialBaselineAudit,
      sentimentPrunedLiveAudit,
      baselinePreservationAudit,
      winningBaselineFeatureAudit,
      strongSignalLiveAudit,
      outOfSampleAudit,
      walkForwardAudit,
      strategyV1CandidateAudit,
      strategyV2CandidateAudit,
      liveExitPolicyAudit,
      exitPolicyShadowAudit,
      executionRealismAudit,
      frictionSensitivityAudit,
      concurrencyExposureAudit,
      capitalConstraintShadowAudit,
      deployableStrategyCandidateAudit,
      strategyComparisonSummaryAudit,
      regimePerformanceAudit,
      downtrendSuppressionShadowAudit,
      causalRegimePolicyShadowAudit,
      regimePolicyShadowAudit,
      experimentHarnessAudit,
      setupGateConsistencyAudit,
      neutralGateConsistencyAudit,
      neutralFilterAudit,
      longSetupAttritionAudit,
      postFixPerformanceAudit,
      attenuationComparisonAudit,
      attenuationRetestNoMacroAudit,
      directionCorrectnessAudit,
      longOnlyModeAudit,
      alphaComponentAudit,
      componentInversionShadowAudit,
      invertedSignalPerformanceAudit,
      timingAlphaAudit,
      shortReentryShadowAudit,
      componentPruningShadowAudit,
      signalRankingShadowAudit,
      positionSizingShadowAudit,
      sizingBenchmarkAudit,
      strongSignalShadowAudit,
      shadowBenchmarkAudit,
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
    setupShadowAudit: NonNullable<DashboardSummary["setupShadowAudit"]>;
    setupScoreAudit: NonNullable<DashboardSummary["setupScoreAudit"]>;
    signalFlipAudit: NonNullable<DashboardSummary["signalFlipAudit"]>;
    currentStrategyConfigAudit: NonNullable<DashboardSummary["currentStrategyConfigAudit"]>;
    liveDirectionModeAudit: NonNullable<DashboardSummary["liveDirectionModeAudit"]>;
    macroPrunedLiveAudit: NonNullable<DashboardSummary["macroPrunedLiveAudit"]>;
    officialBaselineAudit: NonNullable<DashboardSummary["officialBaselineAudit"]>;
    sentimentPrunedLiveAudit: NonNullable<DashboardSummary["sentimentPrunedLiveAudit"]>;
    baselinePreservationAudit: NonNullable<DashboardSummary["baselinePreservationAudit"]>;
    winningBaselineFeatureAudit: NonNullable<DashboardSummary["winningBaselineFeatureAudit"]>;
    strongSignalLiveAudit: NonNullable<DashboardSummary["strongSignalLiveAudit"]>;
    outOfSampleAudit: NonNullable<DashboardSummary["outOfSampleAudit"]>;
    walkForwardAudit: NonNullable<DashboardSummary["walkForwardAudit"]>;
    strategyV1CandidateAudit: NonNullable<DashboardSummary["strategyV1CandidateAudit"]>;
    strategyV2CandidateAudit: NonNullable<DashboardSummary["strategyV2CandidateAudit"]>;
    liveExitPolicyAudit: NonNullable<DashboardSummary["liveExitPolicyAudit"]>;
    exitPolicyShadowAudit: NonNullable<DashboardSummary["exitPolicyShadowAudit"]>;
    executionRealismAudit: NonNullable<DashboardSummary["executionRealismAudit"]>;
    frictionSensitivityAudit: NonNullable<DashboardSummary["frictionSensitivityAudit"]>;
    concurrencyExposureAudit: NonNullable<DashboardSummary["concurrencyExposureAudit"]>;
    capitalConstraintShadowAudit: NonNullable<DashboardSummary["capitalConstraintShadowAudit"]>;
    deployableStrategyCandidateAudit: NonNullable<DashboardSummary["deployableStrategyCandidateAudit"]>;
    strategyComparisonSummaryAudit: NonNullable<DashboardSummary["strategyComparisonSummaryAudit"]>;
    regimePerformanceAudit: NonNullable<DashboardSummary["regimePerformanceAudit"]>;
    downtrendSuppressionShadowAudit: NonNullable<DashboardSummary["downtrendSuppressionShadowAudit"]>;
    causalRegimePolicyShadowAudit: NonNullable<DashboardSummary["causalRegimePolicyShadowAudit"]>;
    regimePolicyShadowAudit: NonNullable<DashboardSummary["regimePolicyShadowAudit"]>;
    experimentHarnessAudit: NonNullable<DashboardSummary["experimentHarnessAudit"]>;
    setupGateConsistencyAudit: NonNullable<DashboardSummary["setupGateConsistencyAudit"]>;
    neutralGateConsistencyAudit: NonNullable<DashboardSummary["neutralGateConsistencyAudit"]>;
    neutralFilterAudit: NonNullable<DashboardSummary["neutralFilterAudit"]>;
    longSetupAttritionAudit: NonNullable<DashboardSummary["longSetupAttritionAudit"]>;
    postFixPerformanceAudit: NonNullable<DashboardSummary["postFixPerformanceAudit"]>;
    attenuationComparisonAudit: NonNullable<DashboardSummary["attenuationComparisonAudit"]>;
    attenuationRetestNoMacroAudit: NonNullable<DashboardSummary["attenuationRetestNoMacroAudit"]>;
    directionCorrectnessAudit: NonNullable<DashboardSummary["directionCorrectnessAudit"]>;
    longOnlyModeAudit: NonNullable<DashboardSummary["longOnlyModeAudit"]>;
    alphaComponentAudit: NonNullable<DashboardSummary["alphaComponentAudit"]>;
    componentInversionShadowAudit: NonNullable<DashboardSummary["componentInversionShadowAudit"]>;
    invertedSignalPerformanceAudit: NonNullable<DashboardSummary["invertedSignalPerformanceAudit"]>;
    timingAlphaAudit: NonNullable<DashboardSummary["timingAlphaAudit"]>;
    shortReentryShadowAudit: NonNullable<DashboardSummary["shortReentryShadowAudit"]>;
    componentPruningShadowAudit: NonNullable<DashboardSummary["componentPruningShadowAudit"]>;
    signalRankingShadowAudit: NonNullable<DashboardSummary["signalRankingShadowAudit"]>;
    positionSizingShadowAudit: NonNullable<DashboardSummary["positionSizingShadowAudit"]>;
    sizingBenchmarkAudit: NonNullable<DashboardSummary["sizingBenchmarkAudit"]>;
    strongSignalShadowAudit: NonNullable<DashboardSummary["strongSignalShadowAudit"]>;
    shadowBenchmarkAudit: NonNullable<DashboardSummary["shadowBenchmarkAudit"]>;
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
        signalStrengthThreshold: DashboardService.LIVE_ACTIVE_SETUP_SCORE_ABS_THRESHOLD,
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
      setupShadowAudit: dirSetupShadowAudit,
      setupScoreAudit: dirSetupScoreAudit,
      signalFlipAudit: dirSignalFlipAudit,
      currentStrategyConfigAudit: dirCurrentStrategyConfigAudit,
      liveDirectionModeAudit: dirLiveDirectionModeAudit,
      macroPrunedLiveAudit: dirMacroPrunedLiveAudit,
      officialBaselineAudit: dirOfficialBaselineAudit,
      sentimentPrunedLiveAudit: dirSentimentPrunedLiveAudit,
      baselinePreservationAudit: dirBaselinePreservationAudit,
      winningBaselineFeatureAudit: dirWinningBaselineFeatureAudit,
      strongSignalLiveAudit: dirStrongSignalLiveAudit,
      outOfSampleAudit: dirOutOfSampleAudit,
      walkForwardAudit: dirWalkForwardAudit,
      strategyV1CandidateAudit: dirStrategyV1CandidateAudit,
      strategyV2CandidateAudit: dirStrategyV2CandidateAudit,
      liveExitPolicyAudit: dirLiveExitPolicyAudit,
      exitPolicyShadowAudit: dirExitPolicyShadowAudit,
      executionRealismAudit: dirExecutionRealismAudit,
      frictionSensitivityAudit: dirFrictionSensitivityAudit,
      concurrencyExposureAudit: dirConcurrencyExposureAudit,
      capitalConstraintShadowAudit: dirCapitalConstraintShadowAudit,
      deployableStrategyCandidateAudit: dirDeployableStrategyCandidateAudit,
      strategyComparisonSummaryAudit: dirStrategyComparisonSummaryAudit,
      regimePerformanceAudit: dirRegimePerformanceAudit,
      downtrendSuppressionShadowAudit: dirDowntrendSuppressionShadowAudit,
      causalRegimePolicyShadowAudit: dirCausalRegimePolicyShadowAudit,
      regimePolicyShadowAudit: dirRegimePolicyShadowAudit,
      experimentHarnessAudit: dirExperimentHarnessAudit,
      setupGateConsistencyAudit: dirSetupGateConsistencyAudit,
      neutralGateConsistencyAudit: dirNeutralGateConsistencyAudit,
      neutralFilterAudit: dirNeutralFilterAudit,
      longSetupAttritionAudit: dirLongSetupAttritionAudit,
      postFixPerformanceAudit: dirPostFixPerformanceAudit,
      attenuationComparisonAudit: dirAttenuationComparisonAudit,
      attenuationRetestNoMacroAudit: dirAttenuationRetestNoMacroAudit,
      directionCorrectnessAudit: dirDirectionCorrectnessAudit,
      longOnlyModeAudit: dirLongOnlyModeAudit,
      alphaComponentAudit: dirAlphaComponentAudit,
      componentInversionShadowAudit: dirComponentInversionShadowAudit,
      invertedSignalPerformanceAudit: dirInvertedSignalPerformanceAudit,
      timingAlphaAudit: dirTimingAlphaAudit,
      shortReentryShadowAudit: dirShortReentryShadowAudit,
      componentPruningShadowAudit: dirComponentPruningShadowAudit,
      signalRankingShadowAudit: dirSignalRankingShadowAudit,
      positionSizingShadowAudit: dirPositionSizingShadowAudit,
      sizingBenchmarkAudit: dirSizingBenchmarkAudit,
      strongSignalShadowAudit: dirStrongSignalShadowAudit,
      shadowBenchmarkAudit: dirShadowBenchmarkAudit,
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
      setupShadowAudit: dirSetupShadowAudit,
      setupScoreAudit: dirSetupScoreAudit,
      signalFlipAudit: dirSignalFlipAudit,
      currentStrategyConfigAudit: dirCurrentStrategyConfigAudit,
      liveDirectionModeAudit: dirLiveDirectionModeAudit,
      macroPrunedLiveAudit: dirMacroPrunedLiveAudit,
      officialBaselineAudit: dirOfficialBaselineAudit,
      sentimentPrunedLiveAudit: dirSentimentPrunedLiveAudit,
      baselinePreservationAudit: dirBaselinePreservationAudit,
      winningBaselineFeatureAudit: dirWinningBaselineFeatureAudit,
      strongSignalLiveAudit: dirStrongSignalLiveAudit,
      outOfSampleAudit: dirOutOfSampleAudit,
      walkForwardAudit: dirWalkForwardAudit,
      strategyV1CandidateAudit: dirStrategyV1CandidateAudit,
      strategyV2CandidateAudit: dirStrategyV2CandidateAudit,
      liveExitPolicyAudit: dirLiveExitPolicyAudit,
      exitPolicyShadowAudit: dirExitPolicyShadowAudit,
      executionRealismAudit: dirExecutionRealismAudit,
      frictionSensitivityAudit: dirFrictionSensitivityAudit,
      concurrencyExposureAudit: dirConcurrencyExposureAudit,
      capitalConstraintShadowAudit: dirCapitalConstraintShadowAudit,
      deployableStrategyCandidateAudit: dirDeployableStrategyCandidateAudit,
      strategyComparisonSummaryAudit: dirStrategyComparisonSummaryAudit,
      regimePerformanceAudit: dirRegimePerformanceAudit,
      downtrendSuppressionShadowAudit: dirDowntrendSuppressionShadowAudit,
      causalRegimePolicyShadowAudit: dirCausalRegimePolicyShadowAudit,
      regimePolicyShadowAudit: dirRegimePolicyShadowAudit,
      experimentHarnessAudit: dirExperimentHarnessAudit,
      setupGateConsistencyAudit: dirSetupGateConsistencyAudit,
      neutralGateConsistencyAudit: dirNeutralGateConsistencyAudit,
      neutralFilterAudit: dirNeutralFilterAudit,
      longSetupAttritionAudit: dirLongSetupAttritionAudit,
      postFixPerformanceAudit: dirPostFixPerformanceAudit,
      attenuationComparisonAudit: dirAttenuationComparisonAudit,
      attenuationRetestNoMacroAudit: dirAttenuationRetestNoMacroAudit,
      directionCorrectnessAudit: dirDirectionCorrectnessAudit,
      longOnlyModeAudit: dirLongOnlyModeAudit,
      alphaComponentAudit: dirAlphaComponentAudit,
      componentInversionShadowAudit: dirComponentInversionShadowAudit,
      invertedSignalPerformanceAudit: dirInvertedSignalPerformanceAudit,
      timingAlphaAudit: dirTimingAlphaAudit,
      shortReentryShadowAudit: dirShortReentryShadowAudit,
      componentPruningShadowAudit: dirComponentPruningShadowAudit,
      signalRankingShadowAudit: dirSignalRankingShadowAudit,
      positionSizingShadowAudit: dirPositionSizingShadowAudit,
      sizingBenchmarkAudit: dirSizingBenchmarkAudit,
      strongSignalShadowAudit: dirStrongSignalShadowAudit,
      shadowBenchmarkAudit: dirShadowBenchmarkAudit,
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

  /**
   * Aggregate AgentDecision BUY/SELL counts for a completed run + symbol (matches backtest-v0 crowd direction basis).
   * longShare/shortShare use BUY+SELL as denominator (HOLD excluded), same as worker plurality ratios.
   */
  private async computeTradeDirectionDiagnosticsCrowd(
    runId: string | null,
    assetSymbol: string,
  ): Promise<NonNullable<DashboardSummary["tradeDirectionDiagnosticsCrowd"]>> {
    if (!runId) {
      return {
        runId: null,
        assetSymbol,
        executedLongTrades: 0,
        executedShortTrades: 0,
        longShare: null,
        shortShare: null,
      };
    }
    const rows = await this.prisma.agentDecision.groupBy({
      by: ["action"],
      where: { runId, assetSymbol },
      _count: { id: true },
    });
    let buy = 0;
    let sell = 0;
    for (const r of rows) {
      if (r.action === "BUY") buy = r._count.id;
      if (r.action === "SELL") sell = r._count.id;
    }
    const denom = buy + sell;
    return {
      runId,
      assetSymbol,
      executedLongTrades: buy,
      executedShortTrades: sell,
      longShare: denom > 0 ? buy / denom : null,
      shortShare: denom > 0 ? sell / denom : null,
    };
  }

  /**
   * divergence = abs(model.longShare - crowd.longShare).
   * directionAgreement: sign(model.longShare - model.shortShare) === sign(crowd.longShare - crowd.shortShare) when all four shares are defined.
   */
  private computeTradeDirectionDivergence(
    model: NonNullable<DashboardSummary["tradeDirectionDiagnostics"]>,
    crowd: NonNullable<DashboardSummary["tradeDirectionDiagnosticsCrowd"]>,
  ): NonNullable<DashboardSummary["tradeDirectionDivergence"]> {
    const ml = model.longShare;
    const ms = model.shortShare;
    const cl = crowd.longShare;
    const cs = crowd.shortShare;
    const divergence = ml != null && cl != null ? Math.abs(ml - cl) : null;
    let directionAgreement: boolean | null = null;
    if (ml != null && ms != null && cl != null && cs != null) {
      const modelBias = ml - ms;
      const crowdBias = cl - cs;
      const sgn = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);
      directionAgreement = sgn(modelBias) === sgn(crowdBias);
    }
    return { divergence, directionAgreement };
  }

  /**
   * Explains crowd vs model direction using AgentDecision rows: archetype histograms, mean signal channels, summary string.
   */
  private async computeTradeDirectionDivergenceExplanation(
    runId: string | null,
    assetSymbol: string,
    model: NonNullable<DashboardSummary["tradeDirectionDiagnostics"]>,
    crowd: NonNullable<DashboardSummary["tradeDirectionDiagnosticsCrowd"]>,
  ): Promise<DashboardSummary["tradeDirectionDivergenceExplanation"]> {
    if (!runId) {
      return {
        runId: null,
        assetSymbol,
        decisionRowCount: 0,
        topCrowdBiasByArchetype: [],
        buySellHoldByArchetype: [],
        signalContributions: {
          syntheticMean: null,
          infoMean: null,
          eventMean: null,
          regimeMean: null,
          channelsByAbsoluteStrength: [],
          channelDirectionalBreakdown: [
            { channel: "synthetic", meanBuy: null, meanSell: null, directionalPush: null },
            { channel: "info", meanBuy: null, meanSell: null, directionalPush: null },
            { channel: "event", meanBuy: null, meanSell: null, directionalPush: null },
            { channel: "regime", meanBuy: null, meanSell: null, directionalPush: null },
          ],
          channelsAlignedWithCrowdDirection: [],
        },
        archetypesWithNetAlignedToCrowd: [],
        archetypeChannelMeans: [],
        summary: null,
      };
    }

    const rows = await this.prisma.agentDecision.findMany({
      where: { runId, assetSymbol },
      select: {
        action: true,
        syntheticSignal: true,
        infoSignal: true,
        eventSignal: true,
        regimeSignal: true,
        agent: { select: { archetype: true } },
      },
    });

    const meanNonNull = (vals: Array<number | null | undefined>): number | null => {
      const xs = vals.filter((v): v is number => v != null && Number.isFinite(v));
      if (xs.length === 0) return null;
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };

    const byArch = new Map<
      string,
      { buy: number; sell: number; hold: number; synthetic: number[]; info: number[]; event: number[]; regime: number[] }
    >();
    const allSynth: number[] = [];
    const allInfo: number[] = [];
    const allEvent: number[] = [];
    const allRegime: number[] = [];

    for (const row of rows) {
      const key = row.agent.archetype?.trim() || "(unlabeled)";
      let g = byArch.get(key);
      if (!g) {
        g = { buy: 0, sell: 0, hold: 0, synthetic: [], info: [], event: [], regime: [] };
        byArch.set(key, g);
      }
      if (row.action === "BUY") g.buy++;
      else if (row.action === "SELL") g.sell++;
      else g.hold++;
      if (row.syntheticSignal != null && Number.isFinite(row.syntheticSignal)) {
        g.synthetic.push(row.syntheticSignal);
        allSynth.push(row.syntheticSignal);
      }
      if (row.infoSignal != null && Number.isFinite(row.infoSignal)) {
        g.info.push(row.infoSignal);
        allInfo.push(row.infoSignal);
      }
      if (row.eventSignal != null && Number.isFinite(row.eventSignal)) {
        g.event.push(row.eventSignal);
        allEvent.push(row.eventSignal);
      }
      if (row.regimeSignal != null && Number.isFinite(row.regimeSignal)) {
        g.regime.push(row.regimeSignal);
        allRegime.push(row.regimeSignal);
      }
    }

    const buySellHoldByArchetype = Array.from(byArch.entries())
      .map(([archetype, v]) => ({
        archetype,
        buyCount: v.buy,
        sellCount: v.sell,
        holdCount: v.hold,
      }))
      .sort((a, b) => a.archetype.localeCompare(b.archetype));

    const topCrowdBiasByArchetype = Array.from(byArch.entries())
      .map(([archetype, v]) => ({
        archetype,
        buyCount: v.buy,
        sellCount: v.sell,
        holdCount: v.hold,
        netBuyMinusSell: v.buy - v.sell,
      }))
      .sort((a, b) => Math.abs(b.netBuyMinusSell) - Math.abs(a.netBuyMinusSell));

    const archetypeChannelMeans = Array.from(byArch.entries())
      .map(([archetype, v]) => ({
        archetype,
        meanSynthetic: meanNonNull(v.synthetic),
        meanInfo: meanNonNull(v.info),
        meanEvent: meanNonNull(v.event),
        meanRegime: meanNonNull(v.regime),
      }))
      .sort((a, b) => a.archetype.localeCompare(b.archetype));

    const syntheticMean = meanNonNull(allSynth);
    const infoMean = meanNonNull(allInfo);
    const eventMean = meanNonNull(allEvent);
    const regimeMean = meanNonNull(allRegime);

    const chans: Array<{ channel: "synthetic" | "info" | "event" | "regime"; mean: number }> = [];
    if (syntheticMean != null) chans.push({ channel: "synthetic", mean: syntheticMean });
    if (infoMean != null) chans.push({ channel: "info", mean: infoMean });
    if (eventMean != null) chans.push({ channel: "event", mean: eventMean });
    if (regimeMean != null) chans.push({ channel: "regime", mean: regimeMean });
    chans.sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean));

    const ml = model.longShare;
    const ms = model.shortShare;
    const cl = crowd.longShare;
    const cs = crowd.shortShare;
    const sgn = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);
    const crowdNet = cl != null && cs != null ? cl - cs : null;

    let archetypesWithNetAlignedToCrowd: string[] = [];
    if (crowdNet != null && crowdNet !== 0) {
      const sc = sgn(crowdNet);
      archetypesWithNetAlignedToCrowd = topCrowdBiasByArchetype
        .filter((a) => sgn(a.netBuyMinusSell) === sc)
        .map((a) => a.archetype);
    }

    type SigKey = "syntheticSignal" | "infoSignal" | "eventSignal" | "regimeSignal";
    const channelFromKey: Record<SigKey, "synthetic" | "info" | "event" | "regime"> = {
      syntheticSignal: "synthetic",
      infoSignal: "info",
      eventSignal: "event",
      regimeSignal: "regime",
    };
    const meanSignalForAction = (wantBuy: boolean, key: SigKey): number | null => {
      const vals: number[] = [];
      for (const r of rows) {
        if (wantBuy && r.action !== "BUY") continue;
        if (!wantBuy && r.action !== "SELL") continue;
        const v = r[key];
        if (v != null && Number.isFinite(v)) vals.push(v);
      }
      if (vals.length === 0) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    const sigKeyOrder: SigKey[] = ["syntheticSignal", "infoSignal", "eventSignal", "regimeSignal"];
    const channelDirectionalBreakdown: Array<{
      channel: "synthetic" | "info" | "event" | "regime";
      meanBuy: number | null;
      meanSell: number | null;
      directionalPush: number | null;
    }> = sigKeyOrder.map((sigKey) => {
      const meanBuy = meanSignalForAction(true, sigKey);
      const meanSell = meanSignalForAction(false, sigKey);
      const directionalPush =
        meanBuy != null && meanSell != null ? meanSell - meanBuy : null;
      return {
        channel: channelFromKey[sigKey],
        meanBuy,
        meanSell,
        directionalPush,
      };
    });

    const channelPushes: Array<{ channel: "synthetic" | "info" | "event" | "regime"; directionalPush: number }> =
      channelDirectionalBreakdown
        .filter((b): b is typeof b & { directionalPush: number } => b.directionalPush != null)
        .map((b) => ({ channel: b.channel, directionalPush: b.directionalPush }));

    let channelsAlignedWithCrowdDirection: Array<{
      channel: "synthetic" | "info" | "event" | "regime";
      directionalPush: number;
    }> = [];
    if (cl != null && cs != null) {
      const crowdIsShort = cs > cl;
      const crowdIsLong = cl > cs;
      if (crowdIsShort) {
        channelsAlignedWithCrowdDirection = channelPushes
          .filter((p) => p.directionalPush > 0)
          .sort((a, b) => b.directionalPush - a.directionalPush);
      } else if (crowdIsLong) {
        channelsAlignedWithCrowdDirection = channelPushes
          .filter((p) => p.directionalPush < 0)
          .sort((a, b) => a.directionalPush - b.directionalPush);
      }
    }

    /** Summary text only: channels with |mean(SELL)−mean(BUY)| below this are not called out as material. */
    const MATERIAL_DIRECTIONAL_PUSH_THRESHOLD = 0.001;

    let summary: string | null = null;
    if (rows.length > 0 && ml != null && ms != null && cl != null && cs != null) {
      const sideLabel = (longS: number, shortS: number) =>
        longS > shortS ? "LONG" : shortS > longS ? "SHORT" : "NEUTRAL";
      const modelSide = sideLabel(ml, ms);
      const crowdSide = sideLabel(cl, cs);
      const alignedArchetypePhrase = archetypesWithNetAlignedToCrowd.slice(0, 4).join(" + ");
      const topByMag = topCrowdBiasByArchetype.slice(0, 3).map((a) => a.archetype).join(", ");

      const materiallyAlignedChannels = channelsAlignedWithCrowdDirection.filter(
        (c) => Math.abs(c.directionalPush) >= MATERIAL_DIRECTIONAL_PUSH_THRESHOLD,
      );

      const notMateriallyExplainedBySignals =
        "Crowd direction is not materially explained by directional signal channels; likely driven more by behavioral factors.";

      const directionalSignalExplanation = (): string => {
        if (crowdSide === "NEUTRAL") {
          return "Final HOLD emerges from balanced opposing pressures.";
        }
        if (materiallyAlignedChannels.length > 0) {
          const parts = materiallyAlignedChannels.map(
            (c) => `${c.channel} (Δ = ${c.directionalPush.toFixed(4)})`,
          );
          return (
            `Among decision-level channels, ${parts.join("; ")} show a material mean(SELL)−mean(BUY) gap ` +
            `(|Δ| ≥ ${MATERIAL_DIRECTIONAL_PUSH_THRESHOLD}) consistent with crowd ${crowdSide} positioning.`
          );
        }
        return notMateriallyExplainedBySignals;
      };

      if (modelSide === crowdSide) {
        summary =
          `Crowd and the dashboard execution model agree on ${modelSide} bias (long vs. short share of executed mix). ` +
          `Largest archetype-level |BUY−SELL| concentration: ${topByMag || "n/a"}. ` +
          directionalSignalExplanation();
      } else {
        const crowdDriver =
          alignedArchetypePhrase.length > 0
            ? `Crowd positioning is most associated with archetypes: ${alignedArchetypePhrase} (BUY−SELL net aligned with crowd). `
            : `Strongest |BUY−SELL| archetypes by magnitude: ${topByMag || "n/a"}. `;
        summary =
          `Crowd reads ${crowdSide}; the model’s synthetic execution mix reads ${modelSide}. ${crowdDriver}` +
          directionalSignalExplanation();
      }
    }

    return {
      runId,
      assetSymbol,
      decisionRowCount: rows.length,
      topCrowdBiasByArchetype,
      buySellHoldByArchetype,
      signalContributions: {
        syntheticMean,
        infoMean,
        eventMean,
        regimeMean,
        channelsByAbsoluteStrength: chans,
        channelDirectionalBreakdown,
        channelsAlignedWithCrowdDirection,
      },
      archetypesWithNetAlignedToCrowd,
      archetypeChannelMeans,
      summary,
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
