"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import DashboardFiltersClient from "@/components/dashboard-filters.client";
import { MiniBar as ScalingMiniBar, Badge } from "@/components/dashboard/mini-bar";
import { MiniBar, HeaderWithTip, StabilityLegend } from "@/components/dashboard/mini";
import { ScalingCurve } from "@/components/dashboard/ScalingCurve";
import { ScalingDetails } from "@/components/dashboard/ScalingDetails";
import { p95, normToP95 } from "@/lib/miniBars";
import { DASH_THRESHOLDS, fmtNum, fmtPct01, clamp01, formatOverheadPct } from "@/lib/dashboardThresholds";
import { Sparkline } from "@/components/sparkline";
import { API_BASE } from "@/lib/api";
import styles from "./dashboard.module.css";

const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(1)}%`;
};

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return Math.round(value).toString();
};

function agentProfileLeaning(positiveCount: number, negativeCount: number): string {
  if (positiveCount > negativeCount) return "Positive bias";
  if (negativeCount > positiveCount) return "Negative bias";
  return "Balanced bias";
}

/** Consensus buy/sell/hold are 0–1 shares; display as whole percent 0–100. */
function consensusPctWhole(share: number | undefined | null): string {
  if (share == null || !Number.isFinite(share)) return "—";
  return `${Math.round(share * 100)}%`;
}

/**
 * Crowd reaction disagreement badge from the largest BUY/SELL/HOLD share (0–100 scale).
 * Higher majority share → lower labeled disagreement.
 */
function crowdReactionDistributionDisagreementFromMaxPct(maxSharePct: number): {
  level: "LOW" | "MODERATE" | "HIGH";
  color: string;
} {
  const level: "LOW" | "MODERATE" | "HIGH" =
    maxSharePct >= 70 ? "LOW" : maxSharePct >= 50 ? "MODERATE" : "HIGH";
  const color =
    level === "LOW" ? "#16a34a" : level === "MODERATE" ? "#f59e0b" : "#dc2626";
  return { level, color };
}

/** Run accuracy rates from API (0–1) as one-decimal percent. */
function formatSignalQualityPct01(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function signalConfidenceTierColor(tier: "HIGH" | "MEDIUM" | "LOW"): string {
  if (tier === "HIGH") return "#15803d";
  if (tier === "MEDIUM") return "#ea580c";
  return "#dc2626";
}

function disagreementDisplayLabel(word: "high" | "moderate" | "low"): string {
  if (word === "high") return "High";
  if (word === "moderate") return "Moderate";
  return "Low";
}

function disagreementPenaltyPoints(word: "high" | "moderate" | "low"): number {
  if (word === "high") return 70;
  if (word === "moderate") return 40;
  return 10;
}

/** Unified 0–100 score: (accuracy% × 0.5) + (confidence% × 0.3) − (disagreementPenalty × 0.2). */
function decisionQualityTierFromScore(score: number): "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 65) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
}

/** Trading guidance from decision score only (same breakpoints as quality tier). */
function recommendedActionFromScore(score: number): {
  positionSize: "SMALL" | "MEDIUM" | "LARGE";
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  executionStyle: "Conservative" | "Balanced" | "Aggressive";
} {
  if (score >= 65) {
    return { positionSize: "LARGE", riskLevel: "LOW", executionStyle: "Aggressive" };
  }
  if (score >= 45) {
    return { positionSize: "MEDIUM", riskLevel: "MEDIUM", executionStyle: "Balanced" };
  }
  return { positionSize: "SMALL", riskLevel: "HIGH", executionStyle: "Conservative" };
}

/** Steps-based horizon from crowd disagreement (entropy bucket). */
function signalHorizonFromDisagreement(
  disagreement: "high" | "moderate" | "low",
): { horizon: string; description: string } {
  if (disagreement === "high") {
    return { horizon: "Short-Term", description: "Next 3–5 steps" };
  }
  if (disagreement === "moderate") {
    return { horizon: "Medium-Term", description: "Next 5–15 steps" };
  }
  return { horizon: "Long-Term", description: "Next 15+ steps" };
}

function dominantConsensusAction(
  c: { buyPct?: number; sellPct?: number; holdPct?: number } | null | undefined,
): "BUY" | "SELL" | "HOLD" | null {
  if (c == null) return null;
  const b = c.buyPct ?? 0;
  const s = c.sellPct ?? 0;
  const h = c.holdPct ?? 0;
  if (b >= s && b >= h) return "BUY";
  if (s >= b && s >= h) return "SELL";
  return "HOLD";
}

function majorityStrengthWord(maj: number | undefined | null): "weak" | "moderate" | "strong" {
  if (maj == null || !Number.isFinite(maj)) return "weak";
  if (maj > 0.6) return "strong";
  if (maj > 0.45) return "moderate";
  return "weak";
}

function entropyDisagreementWord(ent: number | undefined | null): "high" | "moderate" | "low" {
  if (ent == null || !Number.isFinite(ent)) return "moderate";
  if (ent > 1.5) return "high";
  if (ent > 1.2) return "moderate";
  return "low";
}

/** Dashboard header signal score: HIGH→0.8, MODERATE→0.5, LOW→0.2 (used as disagreement term). */
function entropyDisagreementSignalWeight(word: "high" | "moderate" | "low"): number {
  if (word === "high") return 0.8;
  if (word === "moderate") return 0.5;
  return 0.2;
}

function dashboardHeaderSignalLevel(score01: number): "STRONG" | "MODERATE" | "WEAK" {
  if (score01 > 0.7) return "STRONG";
  if (score01 < 0.4) return "WEAK";
  return "MODERATE";
}

function dashboardHeaderSignalColor(level: "STRONG" | "MODERATE" | "WEAK"): string {
  if (level === "STRONG") return "#16a34a";
  if (level === "MODERATE") return "#f59e0b";
  return "#dc2626";
}

/** 0–100 market confidence gauge: below 40 red, 40–70 orange, above 70 green */
function globalMarketConfidenceGaugeColor(score100: number): string {
  if (score100 < 40) return "#dc2626";
  if (score100 > 70) return "#16a34a";
  return "#f59e0b";
}

/** Hero subline under Decision Quality tier: why crowd confidence reads low / medium / high. */
function decisionQualityConfidenceExplanation(
  confidencePct: number,
  disagreement: "high" | "moderate" | "low",
): string {
  if (confidencePct < 50) {
    if (disagreement === "high") {
      return "Low confidence due to high disagreement";
    }
    return "Low confidence due to weak signal strength";
  }
  if (confidencePct <= 70) {
    return "Moderate confidence with mixed signals";
  }
  return "High confidence with strong alignment";
}

/** Deterministic PRNG for agent-tick positions (stable across re-renders for same consensus). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function crowdMixTickPositionsFromConsensus(consensus: {
  buyPct?: number;
  sellPct?: number;
  holdPct?: number;
}): number[] {
  const b = consensus.buyPct ?? 0;
  const s = consensus.sellPct ?? 0;
  const h = consensus.holdPct ?? 0;
  const seed = (Math.floor(b * 100000) ^ Math.floor(s * 100000) ^ Math.floor(h * 100000)) >>> 0 || 0x9e3779b9;
  const rng = mulberry32(seed);
  const n = 26;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(rng() * 100);
  out.sort((a, b) => a - b);
  return out;
}

const CROWD_MAP_SAMPLE_PER_PROFILE = 60;

type DirectionBiasSlice = {
  avgSignal: number;
  positiveCount: number;
  negativeCount: number;
};

type DirectionBiasByAgentTypeInput = {
  trendFollower?: DirectionBiasSlice;
  contrarian?: DirectionBiasSlice;
  balanced?: DirectionBiasSlice;
};

type CrowdMapDot = {
  kind: "positive" | "negative" | "neutral";
  leftPct: number;
  topPct: number;
  delaySec: number;
  durSec: number;
  key: string;
};

type CrowdMapProfileZone = {
  profileKey: "trendFollower" | "contrarian" | "balanced";
  title: string;
  leaningLabel: string;
  dots: CrowdMapDot[];
};

/** Split 60 sample dots into positive / negative / neutral filler from raw counts. */
function allocateDirectionDots60(positiveCount: number, negativeCount: number): { pos: number; neg: number; neu: number } {
  const t = positiveCount + negativeCount;
  if (t <= 0) {
    return { pos: 0, neg: 0, neu: CROWD_MAP_SAMPLE_PER_PROFILE };
  }
  const posExact = (CROWD_MAP_SAMPLE_PER_PROFILE * positiveCount) / t;
  const negExact = (CROWD_MAP_SAMPLE_PER_PROFILE * negativeCount) / t;
  let pos = Math.floor(posExact);
  let neg = Math.floor(negExact);
  const rem = CROWD_MAP_SAMPLE_PER_PROFILE - pos - neg;
  const fr = [
    { i: 0 as const, f: posExact - pos },
    { i: 1 as const, f: negExact - neg },
  ].sort((a, b) => b.f - a.f);
  for (let k = 0; k < rem; k++) {
    if (fr[k % 2].i === 0) pos++;
    else neg++;
  }
  return { pos, neg, neu: 0 };
}

function placeZoneDot(rng: () => number, kind: "positive" | "negative" | "neutral"): { leftPct: number; topPct: number } {
  if (kind === "positive") {
    return { leftPct: 7 + rng() * 34, topPct: 7 + rng() * 34 };
  }
  if (kind === "negative") {
    return { leftPct: 58 + rng() * 33, topPct: 58 + rng() * 33 };
  }
  return { leftPct: 34 + rng() * 32, topPct: 34 + rng() * 32 };
}

function buildCrowdMapZones(
  directionBiasByAgentType: DirectionBiasByAgentTypeInput | null | undefined,
): CrowdMapProfileZone[] | null {
  if (directionBiasByAgentType == null) return null;

  const profiles: Array<{ key: CrowdMapProfileZone["profileKey"]; title: string }> = [
    { key: "trendFollower", title: "Trend Follower" },
    { key: "contrarian", title: "Contrarian" },
    { key: "balanced", title: "Balanced" },
  ];

  const zones: CrowdMapProfileZone[] = [];

  for (const { key, title } of profiles) {
    const row = directionBiasByAgentType[key];
    const pc = row != null && Number.isFinite(row.positiveCount) ? row.positiveCount : 0;
    const nc = row != null && Number.isFinite(row.negativeCount) ? row.negativeCount : 0;
    const leaningLabel = agentProfileLeaning(pc, nc);
    const { pos, neg, neu } = allocateDirectionDots60(pc, nc);
    const seed =
      (key.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) ^
        (Math.floor(pc + 1) * 0x9e37 ^ Math.floor(nc + 1) * 0x85eb)) >>>
      0;
    const rng = mulberry32(seed || 0xabc123);
    const dots: CrowdMapDot[] = [];
    let idx = 0;
    const push = (kind: CrowdMapDot["kind"], count: number) => {
      for (let i = 0; i < count; i++) {
        const { leftPct, topPct } = placeZoneDot(rng, kind);
        dots.push({
          kind,
          leftPct,
          topPct,
          delaySec: (idx % 14) * 0.16,
          durSec: 3.1 + (idx % 6) * 0.22,
          key: `${key}-${kind}-${idx}`,
        });
        idx++;
      }
    };
    push("positive", pos);
    push("negative", neg);
    push("neutral", neu);
    zones.push({ profileKey: key, title, leaningLabel, dots });
  }

  return zones;
}

function profileDirectionFromCounts(positiveCount: number, negativeCount: number): "Positive" | "Negative" | "Neutral" {
  if (positiveCount > negativeCount) return "Positive";
  if (negativeCount > positiveCount) return "Negative";
  return "Neutral";
}

function profileDirectionFromSignal(avgSignal: number | undefined): "Positive" | "Negative" | "Neutral" {
  if (avgSignal == null || !Number.isFinite(avgSignal)) return "Neutral";
  if (avgSignal > 0.001) return "Positive";
  if (avgSignal < -0.001) return "Negative";
  return "Neutral";
}

function directionArrowFromDir(dir: "Positive" | "Negative" | "Neutral"): { sym: string; color: string } {
  if (dir === "Positive") return { sym: "↑", color: "#15803d" };
  if (dir === "Negative") return { sym: "↓", color: "#b91c1c" };
  return { sym: "→", color: "#94a3b8" };
}

const CROWD_INFLUENCE_PROFILE_TITLE: Record<"trendFollower" | "contrarian" | "balanced", string> = {
  trendFollower: "Trend Follower",
  contrarian: "Contrarian",
  balanced: "Balanced",
};

const CROWD_INFLUENCE_LABELS = ["HIGH", "MEDIUM", "LOW"] as const;

type CrowdInfluenceRowComputed = {
  key: "trendFollower" | "contrarian" | "balanced";
  title: string;
  totalSignals: number;
  dominanceRatio: number;
  influenceScore: number;
  avgSignal: number;
  positiveCount: number;
  negativeCount: number;
};

/** Returns ranked rows or null if no usable profile data. */
function buildCrowdInfluenceRows(
  directionBiasByAgentType: DirectionBiasByAgentTypeInput | null | undefined,
): CrowdInfluenceRowComputed[] | null {
  if (directionBiasByAgentType == null) return null;

  const raw: CrowdInfluenceRowComputed[] = [];

  for (const key of ["trendFollower", "contrarian", "balanced"] as const) {
    const row = directionBiasByAgentType[key];
    if (!row || !Number.isFinite(row.avgSignal) || !Number.isFinite(row.positiveCount) || !Number.isFinite(row.negativeCount)) {
      continue;
    }
    const totalSignals = row.positiveCount + row.negativeCount;
    const dominanceRatio = Math.abs(row.avgSignal);
    const influenceScore = totalSignals * dominanceRatio;
    raw.push({
      key,
      title: CROWD_INFLUENCE_PROFILE_TITLE[key],
      totalSignals,
      dominanceRatio,
      influenceScore,
      avgSignal: row.avgSignal,
      positiveCount: row.positiveCount,
      negativeCount: row.negativeCount,
    });
  }

  if (raw.length === 0) return null;

  raw.sort((a, b) => b.influenceScore - a.influenceScore);
  return raw;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const computeDecisionScore = (research: { maxDrawdown?: number | null; edge?: number | null; trades?: number | null } | null | undefined, deployable: { maxDrawdown?: number | null; edge?: number | null; trades?: number | null } | null | undefined) => {
  if (!research || !deployable) return null;

  const researchDrawdown = Number(research.maxDrawdown ?? 0);
  const deployableDrawdown = Number(deployable.maxDrawdown ?? 0);
  const researchEdge = Number(research.edge ?? 0);
  const deployableEdge = Number(deployable.edge ?? 0);
  const researchTrades = Number(research.trades ?? 0);
  const deployableTrades = Number(deployable.trades ?? 0);

  const drawdownImprovementPct =
    researchDrawdown > 0
      ? ((researchDrawdown - deployableDrawdown) / researchDrawdown) * 100
      : 0;

  const edgeRetentionPct =
    researchEdge > 0
      ? (deployableEdge / researchEdge) * 100
      : 0;

  const tradeEfficiencyPct =
    researchTrades > 0
      ? (1 - deployableTrades / researchTrades) * 100
      : 0;

  const drawdownScore = clamp(drawdownImprovementPct, 0, 100);
  const edgeScore = clamp(edgeRetentionPct, 0, 100);
  const tradeScore = clamp(tradeEfficiencyPct, 0, 100);

  const weighted =
    drawdownScore * 0.45 +
    edgeScore * 0.35 +
    tradeScore * 0.20;

  let finalScore = clamp(weighted, 0, 100);

  // --- PRODUCT ALIGNMENT LOGIC ---

  const isBetterDrawdown =
    deployableDrawdown < researchDrawdown;

  const acceptableEdgeRetention =
    edgeRetentionPct > 50; // keeps at least half of edge

  if (isBetterDrawdown && acceptableEdgeRetention) {
    // boost score into recommendation zone
    finalScore = Math.max(finalScore, 70);
  }

  return Math.round(finalScore);
};

const THRESH = {
  corrSpreadUnstable: 0.2,
  accStdDevUnstable: 0.02,
  signAgreementUnstableBelow: 1,
} as const;

const RISK_WEIGHTS = {
  corrSpread: 0.4,
  accStdDev: 0.3,
  signAgreement: 0.2,
  overhead: 0.1,
} as const;

function clampRisk(v: number) {
  return Math.max(0, Math.min(1, v));
}

function computeRiskScore(r: {
  corrSpread?: number | null;
  accStdDev?: number | null;
  signAgreementRate?: number | null;
  overheadPct?: number | null;
}) {
  const corrNorm = clampRisk((r.corrSpread ?? 0) / 0.5);
  const accNorm = clampRisk((r.accStdDev ?? 0) / 0.05);
  const signNorm = clampRisk(1 - (r.signAgreementRate ?? 1));
  const overheadNorm = clampRisk((r.overheadPct ?? 0) / 5);

  const score01 =
    corrNorm * RISK_WEIGHTS.corrSpread +
    accNorm * RISK_WEIGHTS.accStdDev +
    signNorm * RISK_WEIGHTS.signAgreement +
    overheadNorm * RISK_WEIGHTS.overhead;

  return Math.round(score01 * 100);
}

function isUnstableRow(r: { corrSpread?: number | null; accStdDev?: number | null; signAgreementRate?: number | null }) {
  const corr = r.corrSpread ?? 0;
  const acc = r.accStdDev ?? 0;
  const sign = r.signAgreementRate ?? 1;
  return sign < THRESH.signAgreementUnstableBelow || corr > THRESH.corrSpreadUnstable || acc > THRESH.accStdDevUnstable;
}

type ScalingRow = {
  runId: string;
  stabilityBand?: "OK" | "DIVERGING" | "UNSTABLE" | "LEGACY" | null;
  stabilityScore?: number | null;
  agents: number;
  variants: number;
  steps: number;
  runDurationMs: number | null;
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
};

type StabilityRow = {
  runId: string;
  agents: number;
  variants: number;
  seeds?: number;
  steps: number;
  score: number;
  band: string;
  cause: string;
  reason: string;
  corrSpread: number | null;
  accStdDev: number | null;
  signAgreementRate: number | null;
  label: string;
  riskScore?: number;
};

function rowBgClass(band: string, index: number): string {
  if (band === "UNSTABLE") return "bg-rose-50/60";
  if (band === "DIVERGING") return "bg-amber-50/40";
  if (band === "LEGACY") return "bg-slate-50/40";
  return index % 2 === 0 ? "bg-white" : "bg-slate-50/30";
}

function badgeKind(band: string): "stable" | "unstable" | "diverging" | "legacy" | "neutral" {
  if (band === "UNSTABLE") return "unstable";
  if (band === "DIVERGING") return "diverging";
  if (band === "LEGACY") return "legacy";
  return "stable";
}

function shortenId(id: string, head = 8): string {
  if (!id || id.length <= head) return id;
  return `${id.slice(0, head)}...`;
}

function shortenHash(hash: string | null | undefined, maxLen = 12): string {
  if (hash == null || hash === "") return "—";
  return hash.length > maxLen ? `${hash.slice(0, maxLen)}...` : hash;
}

function buildDashboardUrl(
  pathname: string,
  searchParams: URLSearchParams,
  patch: (p: URLSearchParams) => void
): string {
  const p = new URLSearchParams(searchParams.toString());
  patch(p);
  const qs = p.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** InfoEvent rows from `GET /runs/:runId/info-events` (capped & sorted on the dashboard page). */
export type DashboardLatestRunInfoEvent = {
  id: string;
  runId: string;
  assetSymbol: string;
  step: number;
  topic: string;
  sentiment: number;
  credibility: number;
  reach: number;
  volatilityImpact: number | null;
  source: string | null;
  createdAt?: string;
};

/** `recommendation` slice from `GET /results/crowd-state` (crowd reaction / outcome narrative). */
export type DashboardCrowdStateRecommendation = {
  direction: "bullish" | "bearish" | "neutral";
  strength: number;
  confidence: number;
  stability: number;
  explanation: string;
};

const SIGNIFICANT_INFO_EVENTS_MAX = 5;
const SENTIMENT_LABEL_EPS = 0.05;

function sentimentPolarity(sentiment: number): "positive" | "negative" | "neutral" {
  if (sentiment > SENTIMENT_LABEL_EPS) return "positive";
  if (sentiment < -SENTIMENT_LABEL_EPS) return "negative";
  return "neutral";
}

/** Majority polarity across Information-block items (same `sentimentPolarity` as UI badges). */
function overallInformationSentiment(events: Array<{ sentiment: number }>): "NEGATIVE" | "POSITIVE" | null {
  if (events.length === 0) return null;
  let negative = 0;
  let positive = 0;
  for (const ev of events) {
    const pol = sentimentPolarity(ev.sentiment);
    if (pol === "negative") negative++;
    else if (pol === "positive") positive++;
  }
  const n = events.length;
  if (negative > n / 2) return "NEGATIVE";
  if (positive > n / 2) return "POSITIVE";
  return null;
}

type CrowdReactionContradictionInsight =
  | { kind: "buyAgainstNegative"; buyPct: number }
  | { kind: "sellAgainstPositive"; sellPct: number };

function crowdReactionContradictionInsight(
  infoEvents: Array<{ sentiment: number }>,
  buyShare: number | undefined,
  sellShare: number | undefined,
): CrowdReactionContradictionInsight | null {
  const sentiment = overallInformationSentiment(infoEvents);
  const buyPct = Math.round((buyShare ?? 0) * 100);
  const sellPct = Math.round((sellShare ?? 0) * 100);
  if (sentiment === "NEGATIVE" && buyPct > 20) {
    return { kind: "buyAgainstNegative", buyPct };
  }
  if (sentiment === "POSITIVE" && sellPct > 20) {
    return { kind: "sellAgainstPositive", sellPct };
  }
  return null;
}

/** Subline under each archetype in decision flow; driven by top INFORMATION event `sentiment`. */
function agentImpactExplanationForArchetype(
  profileKey: "trendFollower" | "contrarian" | "balanced",
  topEventSentiment: number,
): string {
  if (topEventSentiment > SENTIMENT_LABEL_EPS) {
    const m = {
      trendFollower: "Following positive momentum",
      contrarian: "Taking profit into strength",
      balanced: "Increasing exposure cautiously",
    } as const;
    return m[profileKey];
  }
  if (topEventSentiment < -SENTIMENT_LABEL_EPS) {
    const m = {
      trendFollower: "Following negative momentum",
      contrarian: "Selling due to weak reversal signals",
      balanced: "Reducing exposure under uncertainty",
    } as const;
    return m[profileKey];
  }
  const m = {
    trendFollower: "Weighing headlines without a clear tilt",
    contrarian: "No sharp reversal to fade yet",
    balanced: "Holding exposure steady amid mixed news",
  } as const;
  return m[profileKey];
}

/** Rank: highest reach → then credibility → then |sentiment|; cap at `max`. */
function pickSignificantInfoEvents(
  rows: DashboardLatestRunInfoEvent[] | undefined,
  max: number,
): DashboardLatestRunInfoEvent[] {
  if (!rows?.length) return [];
  return [...rows]
    .sort((a, b) => {
      if (b.reach !== a.reach) return b.reach - a.reach;
      if (b.credibility !== a.credibility) return b.credibility - a.credibility;
      return Math.abs(b.sentiment) - Math.abs(a.sentiment);
    })
    .slice(0, max);
}

/** Same ranking as `pickSignificantInfoEvents`, scoped to one asset (case-insensitive symbol match). */
function pickTopInfoEventsForAsset(
  rows: DashboardLatestRunInfoEvent[] | undefined,
  assetSymbol: string,
  max: number,
): DashboardLatestRunInfoEvent[] {
  if (!rows?.length || !assetSymbol.trim()) return [];
  const sym = assetSymbol.trim().toUpperCase();
  const filtered = rows.filter((r) => r.assetSymbol.trim().toUpperCase() === sym);
  if (!filtered.length) return [];
  return [...filtered]
    .sort((a, b) => {
      if (b.reach !== a.reach) return b.reach - a.reach;
      if (b.credibility !== a.credibility) return b.credibility - a.credibility;
      return Math.abs(b.sentiment) - Math.abs(a.sentiment);
    })
    .slice(0, max);
}

/** Parse GET /info-events JSON (same shape as page.tsx). */
function parseInfoEventsFromApiJson(json: unknown): DashboardLatestRunInfoEvent[] {
  if (!Array.isArray(json)) return [];
  const out: DashboardLatestRunInfoEvent[] = [];
  for (const item of json) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    if (typeof e.id !== "string" || typeof e.runId !== "string" || typeof e.assetSymbol !== "string") continue;
    if (typeof e.step !== "number" || !Number.isFinite(e.step)) continue;
    if (typeof e.topic !== "string") continue;
    if (typeof e.sentiment !== "number" || !Number.isFinite(e.sentiment)) continue;
    if (typeof e.credibility !== "number" || !Number.isFinite(e.credibility)) continue;
    if (typeof e.reach !== "number" || !Number.isFinite(e.reach)) continue;
    const vol = e.volatilityImpact;
    const volN =
      vol == null ? null : typeof vol === "number" && Number.isFinite(vol) ? vol : null;
    const src = e.source;
    out.push({
      id: e.id,
      runId: e.runId,
      assetSymbol: e.assetSymbol,
      step: e.step,
      topic: e.topic,
      sentiment: e.sentiment,
      credibility: e.credibility,
      reach: e.reach,
      volatilityImpact: volN,
      source: src == null ? null : typeof src === "string" ? src : null,
      createdAt: typeof e.createdAt === "string" ? e.createdAt : undefined,
    });
  }
  return out;
}

export type DashboardRunPerformance = {
  runId: string;
  hitRate: number | null;
  byAsset?: Array<{
    assetSymbol: string;
    totalEvaluations: number;
    correctCount: number;
    accuracyRate: number;
    buyAccuracy: number | null;
    sellAccuracy: number | null;
    holdAccuracy: number | null;
  }>;
};

export type DashboardClientProps = {
  initialData: {
    consensus?: {
      buyPct?: number;
      sellPct?: number;
      holdPct?: number;
      majorityPct?: number;
      entropy?: number;
      polarization?: number;
    } | null;
    scaling: ScalingRow[];
    stability: StabilityRow[];
    counts: { unstable: number; diverging: number; ok: number; legacy: number };
    filterLabel: string;
    latest: { runDurationMs: number | null } | null;
    latestScalingRow: ScalingRow | null;
    driftAsset?: {
      window: number;
      count: number;
      regimeShift: boolean;
      riskMean: number;
      riskDelta?: number;
      deltaRisk?: number;
      deltaSign?: number;
      deltaCorr?: number;
      direction?: "UP" | "DOWN" | "STABLE";
      riskSeries: number[];
    } | null;
    driftGlobal?: {
      window: number;
      count: number;
      regimeShift: boolean;
      riskMean: number;
      riskDelta?: number;
      deltaRisk?: number;
      deltaSign?: number;
      deltaCorr?: number;
      direction?: "UP" | "DOWN" | "STABLE";
      riskSeries: number[];
    } | null;
    forecastAccuracy?: {
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
    productionAggregationMode?: {
      aggregationMode: string;
      snapshotId: string;
      datasetVersion: string | null;
      modelVersion: string | null;
    } | null;
    aggregationModeRanking?: Array<{
      aggregationMode: string;
      rawScore: number;
    }>;
    strategyProfile?: {
      key: string;
      name: string;
      aggregationMode: string;
      selectionPolicy: string;
      intendedUse: string;
    };
    strategyDefaults?: {
      benchmarkDefaults: { aggregationMode: string; selectionPolicy: string; symbols: string[]; windows: number[]; n: number };
      runDefaults: { aggregationMode: string; selectionPolicy: string; assetSymbols: string[]; points: number };
    };
    executionPreset?: {
      runPreset: { assetSymbols: string[]; points: number; aggregationMode: string; selectionPolicy: string };
      benchmarkPreset: { symbols: string[]; windows: number[]; n: number; aggregationMode: string; selectionPolicy: string; baselineTag: string };
    };
    launchPlan?: {
      runPlan: { endpoint: string; method: string; params: { symbols: string[]; points: number }; resolved: { aggregationMode: string; selectionPolicy: string } };
      benchmarkPlan: { endpoint: string; method: string; params: { symbols: string[]; windows: number[]; n: number; aggregationMode: string; baselineTag: string }; resolved: { aggregationMode: string; selectionPolicy: string; baselineTag: string } };
      governance: { baselineFamilyTag: string; candidateMode: string; recommendedMode: string; notes: string[] };
    };
    crowdSignals?: {
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
    signalValidation?: {
      total: number;
      actionable?: number;
      abstained?: number;
      directionalValidated?: number;
      directionalAccuracyRate?: number | null;
      coverageRate?: number | null;
      validated?: number;
      accuracyRate?: number | null;
      latestItems: Array<{
        symbol: string;
        signal: string;
        realizedDirection: "UP" | "DOWN" | "FLAT" | null;
        actionable?: boolean;
        correct: boolean | null;
        confidence: number;
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
      bySignal?: Record<string, number>;
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
    } | null;
    strategyComparisonSummaryAudit?: {
      researchChampion: { strategyId: string; versionLabel: string; trades: number | null; cumulativeReturn: number | null; benchmarkReturn: number | null; edge: number | null; maxDrawdown: number | null };
      deployableCandidate: { strategyId: string; versionLabel: string; trades: number | null; cumulativeReturn: number | null; benchmarkReturn: number | null; edge: number | null; maxDrawdown: number | null; maxConcurrentOpenTrades: number | null };
      productInterpretation?: { preferredForResearch?: string | null; preferredForDeployment?: string | null };
    };
    /** Optional information-layer fields (forwarded when present on summary payload). */
    sentimentSignal?: number | null;
    infoEvents?: unknown;
    eventSignal?: number | null;
    syntheticSignal?: number | null;
    directionBiasByAgentType?: {
      trendFollower?: {
        avgSignal: number;
        positiveCount: number;
        negativeCount: number;
      };
      contrarian?: {
        avgSignal: number;
        positiveCount: number;
        negativeCount: number;
      };
      balanced?: {
        avgSignal: number;
        positiveCount: number;
        negativeCount: number;
      };
    };
    decisionFunnelDiagnostics?: unknown;
    informationExposureDiagnostics?: unknown;
    directionBiasDiagnostics?: unknown;
    /** Capped list for event-level explainability (server-fetched; not part of dashboard summary). */
    latestRunInfoEvents?: DashboardLatestRunInfoEvent[];
    /** Crowd-state recommendation for the same run + asset (server-fetched). */
    latestRunCrowdStateRecommendation?: DashboardCrowdStateRecommendation | null;
    /** GET /runs/:runId/performance for latest run (forecast accuracy aggregates). */
    performance?: DashboardRunPerformance;
  };
  initialQuery: {
    assetSymbol: string;
    topN: string;
    showOnlyUnstable: boolean;
    showLegacy: boolean;
    sortByRisk: boolean;
  };
};

const DEFAULTS = {
  assetSymbol: "SPY",
  topN: "10",
  unstableOnly: "1",
  showLegacy: "0",
  sortRisk: "1",
} as const;

/** Mirrors `page.tsx` search-param parsing for filter navigation / loading reconciliation. */
function parseDashboardFiltersFromSearchParams(sp: URLSearchParams): {
  assetSymbol: string;
  topN: string;
  showOnlyUnstable: boolean;
  showLegacy: boolean;
  sortByRisk: boolean;
} {
  const assetSymbol = (sp.get("assetSymbol") ?? "").trim() || "SPY";
  const topNParam = sp.get("topN") || "50";
  const topN = ["10", "25", "50", "100"].includes(topNParam) ? topNParam : "50";
  const showOnlyUnstable = (sp.get("unstableOnly") ?? "1") === "1";
  const showLegacy = (sp.get("showLegacy") ?? "0") === "1";
  const sortByRisk = (sp.get("sortRisk") ?? "1") !== "0";
  return { assetSymbol, topN, showOnlyUnstable, showLegacy, sortByRisk };
}

function dashboardFilterStateKey(q: {
  assetSymbol: string;
  topN: string;
  showOnlyUnstable: boolean;
  showLegacy: boolean;
  sortByRisk: boolean;
}): string {
  return [
    q.assetSymbol,
    q.topN,
    q.showOnlyUnstable ? "1" : "0",
    q.showLegacy ? "1" : "0",
    q.sortByRisk ? "1" : "0",
  ].join("|");
}

const FALLBACK_STRATEGY_DEFAULTS = {
  benchmarkDefaults: { aggregationMode: "top_20pct_only", selectionPolicy: "top_20pct_agents", symbols: ["SPY", "QQQ", "IWM"], windows: [29, 60, 120], n: 20 },
  runDefaults: { aggregationMode: "top_20pct_only", selectionPolicy: "top_20pct_agents", assetSymbols: ["SPY", "QQQ", "IWM"], points: 29 },
};
const FALLBACK_EXECUTION_PRESET = {
  runPreset: { assetSymbols: ["SPY", "QQQ", "IWM"], points: 29, aggregationMode: "top_20pct_only", selectionPolicy: "top_20pct_agents" },
  benchmarkPreset: { symbols: ["SPY", "QQQ", "IWM"], windows: [29, 60, 120], n: 20, aggregationMode: "top_20pct_only", selectionPolicy: "top_20pct_agents", baselineTag: "baseline-top20-v1" },
};
const FALLBACK_LAUNCH_PLAN = {
  runPlan: { endpoint: "/runs/import/prices", method: "POST", params: { symbols: ["SPY", "QQQ", "IWM"], points: 29 }, resolved: { aggregationMode: "top_20pct_only", selectionPolicy: "top_20pct_agents" } },
  benchmarkPlan: { endpoint: "/bench/windows/run-and-compare", method: "POST", params: { symbols: ["SPY", "QQQ", "IWM"], windows: [29, 60, 120], n: 20, aggregationMode: "top_20pct_only", baselineTag: "baseline-top20-v1" }, resolved: { aggregationMode: "top_20pct_only", selectionPolicy: "top_20pct_agents", baselineTag: "baseline-top20-v1" } },
  governance: { baselineFamilyTag: "baseline-top20-v1", candidateMode: "top_20pct_only", recommendedMode: "top_20pct_only", notes: ["Launch plan fallback."] },
};

export function DashboardClient({ initialData, initialQuery }: DashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const drawerRunId = searchParams.get("drawerRunId");

  const [pendingFilterKey, setPendingFilterKey] = useState<string | null>(null);
  const [, startFilterTransition] = useTransition();

  const navigateFilters = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      updater(params);
      const nextFilters = parseDashboardFiltersFromSearchParams(params);
      setPendingFilterKey(dashboardFilterStateKey(nextFilters));
      startFilterTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams, startFilterTransition],
  );

  const isFilterLoading =
    pendingFilterKey !== null && dashboardFilterStateKey(initialQuery) !== pendingFilterKey;

  useEffect(() => {
    if (pendingFilterKey === null) return;
    if (dashboardFilterStateKey(initialQuery) === pendingFilterKey) {
      setPendingFilterKey(null);
    }
  }, [initialQuery, pendingFilterKey]);

  const {
    consensus,
    directionBiasByAgentType,
    scaling = [],
    stability = [],
    counts = { unstable: 0, diverging: 0, ok: 0, legacy: 0 },
    filterLabel = "all",
    latest,
    latestScalingRow,
    driftAsset: initialDriftAsset,
    driftGlobal: initialDriftGlobal,
    forecastAccuracy,
    productionAggregationMode,
    aggregationModeRanking = [],
    strategyProfile: initialStrategyProfile,
    strategyDefaults = FALLBACK_STRATEGY_DEFAULTS,
    executionPreset = FALLBACK_EXECUTION_PRESET,
    launchPlan = FALLBACK_LAUNCH_PLAN,
    crowdSignals: rawCrowdSignals,
    signalValidation: rawSignalValidation,
    signalHistoryStats,
    signalCoverage,
    marketRegime,
    marketTransition,
    marketStress,
    marketAlerts,
    signalProbabilities,
    watchlistCandidates,
    symbolProbabilities,
    tradeSetups,
    crowdDivergence,
    crowdAcceleration,
    crowdConfidence,
    signalValidationMetrics,
    backtestMetrics,
    backtestDiagnostics,
    strategyComparisonSummaryAudit,
    latestRunInfoEvents,
    performance,
  } = initialData ?? {};

  const dashboardInfoEventsRunId = useMemo(() => {
    if (latestScalingRow?.runId) return latestScalingRow.runId;
    if (performance?.runId) return performance.runId;
    const lr = latest as { id?: string } | null | undefined;
    if (lr && typeof lr.id === "string" && lr.id.trim() !== "") return lr.id.trim();
    return null;
  }, [latestScalingRow?.runId, performance?.runId, latest]);

  const [infoEventsFromFlatFetch, setInfoEventsFromFlatFetch] = useState<DashboardLatestRunInfoEvent[] | null>(
    null,
  );

  useEffect(() => {
    setInfoEventsFromFlatFetch(null);
    if (!dashboardInfoEventsRunId || !initialQuery.assetSymbol?.trim()) return;
    if (latestRunInfoEvents != null && latestRunInfoEvents.length > 0) return;

    let cancelled = false;
    (async () => {
      try {
        const url = `${API_BASE}/info-events?runId=${encodeURIComponent(dashboardInfoEventsRunId)}&assetSymbol=${encodeURIComponent(
          initialQuery.assetSymbol.trim(),
        )}`;
        const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
        if (!res.ok || cancelled) return;
        const raw: unknown = await res.json();
        const parsed = parseInfoEventsFromApiJson(raw);
        if (!cancelled) setInfoEventsFromFlatFetch(parsed);
      } catch {
        if (!cancelled) setInfoEventsFromFlatFetch(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboardInfoEventsRunId, initialQuery.assetSymbol, latestRunInfoEvents]);

  const effectiveLatestRunInfoEvents =
    latestRunInfoEvents != null && latestRunInfoEvents.length > 0
      ? latestRunInfoEvents
      : infoEventsFromFlatFetch !== null
        ? infoEventsFromFlatFetch
        : latestRunInfoEvents;

  const significantInfoEvents = useMemo(
    () => pickSignificantInfoEvents(effectiveLatestRunInfoEvents, SIGNIFICANT_INFO_EVENTS_MAX),
    [effectiveLatestRunInfoEvents],
  );

  const decisionFlowInformationEvents = useMemo(
    () => pickTopInfoEventsForAsset(effectiveLatestRunInfoEvents, initialQuery.assetSymbol, 2),
    [effectiveLatestRunInfoEvents, initialQuery.assetSymbol],
  );

  const crowdReactionContradiction = useMemo(
    () =>
      consensus == null
        ? null
        : crowdReactionContradictionInsight(
            decisionFlowInformationEvents,
            consensus.buyPct,
            consensus.sellPct,
          ),
    [consensus, decisionFlowInformationEvents],
  );

  const signalQualityAssetRow = useMemo(() => {
    const sym = initialQuery.assetSymbol.trim();
    if (!sym || !performance?.byAsset?.length) return null;
    return performance.byAsset.find((r) => r.assetSymbol === sym) ?? null;
  }, [performance?.byAsset, initialQuery.assetSymbol]);

  /** Primary confidence: selected asset `accuracyRate`, else run-level `hitRate`. */
  const signalConfidencePrimary01 = useMemo((): number | null => {
    if (!performance) return null;
    if (signalQualityAssetRow != null && Number.isFinite(signalQualityAssetRow.accuracyRate)) {
      return signalQualityAssetRow.accuracyRate;
    }
    if (performance.hitRate != null && Number.isFinite(performance.hitRate)) {
      return performance.hitRate;
    }
    return null;
  }, [performance, signalQualityAssetRow]);

  const decisionQuality = useMemo(() => {
    if (consensus == null) return null;
    const acc01 = signalConfidencePrimary01;
    if (acc01 == null || !Number.isFinite(acc01)) return null;
    const accuracyPct = acc01 * 100;
    const maj = consensus.majorityPct;
    const confidencePct = maj != null && Number.isFinite(maj) ? maj * 100 : 0;
    const disagreement = entropyDisagreementWord(consensus.entropy);
    const penalty = disagreementPenaltyPoints(disagreement);
    const raw = accuracyPct * 0.5 + confidencePct * 0.3 - penalty * 0.2;
    const score = Math.max(0, Math.min(100, Math.round(raw)));
    const tier = decisionQualityTierFromScore(score);
    const bullets: string[] = [];
    if (accuracyPct < 50) bullets.push("Low signal accuracy");
    if (disagreement === "high") bullets.push("High disagreement");
    if (confidencePct < 50) bullets.push("Weak conviction");
    const filteredBullets =
      tier === "LOW" ? bullets.filter((b) => b !== "Low signal accuracy") : bullets;
    return {
      score,
      tier,
      recommendedAction: recommendedActionFromScore(score),
      signalHorizon: signalHorizonFromDisagreement(disagreement),
      bullets: filteredBullets.slice(0, 3),
      accuracyPct,
      confidencePct,
      disagreement,
      acc01,
      confidenceExplanation: decisionQualityConfidenceExplanation(confidencePct, disagreement),
    };
  }, [consensus, signalConfidencePrimary01]);

  /** Header "SIGNAL" line: accuracy (0–1) × 0.4 + confidence × 0.3 + (1 − disagreementWeight) × 0.3 */
  const dashboardHeaderSignal = useMemo(() => {
    if (consensus == null) return null;
    const accuracy = signalConfidencePrimary01;
    if (accuracy == null || !Number.isFinite(accuracy)) return null;
    const acc = clamp01(accuracy);
    const confidence = clamp01(consensus.majorityPct ?? 0);
    const disagreementWord = entropyDisagreementWord(consensus.entropy);
    const disagreement = entropyDisagreementSignalWeight(disagreementWord);
    const score = acc * 0.4 + confidence * 0.3 + (1 - disagreement) * 0.3;
    const level = dashboardHeaderSignalLevel(score);
    const buyPct = Math.max(0, Math.min(100, (consensus.buyPct ?? 0) * 100));
    const sellPct = Math.max(0, Math.min(100, (consensus.sellPct ?? 0) * 100));
    const holdPct = Math.max(0, Math.min(100, (consensus.holdPct ?? 0) * 100));
    const maxPct = Math.max(buyPct, sellPct, holdPct);
    const disagreementLevel = crowdReactionDistributionDisagreementFromMaxPct(maxPct).level;

    const reasons: string[] = [];
    if (acc < 0.5) {
      reasons.push("Low accuracy");
    }
    if (disagreementLevel === "HIGH") {
      reasons.push("High disagreement");
    }
    if (confidence < 0.5) {
      reasons.push("Low confidence");
    }

    return {
      score,
      level,
      color: dashboardHeaderSignalColor(level),
      reasons,
    };
  }, [consensus, signalConfidencePrimary01]);

  const dashboardPositionAdvice = useMemo((): string[] => {
    if (dashboardHeaderSignal == null) return [];
    const { reasons, level: signalLevel } = dashboardHeaderSignal;

    if (reasons.length === 0) {
      if (signalLevel === "WEAK") {
        return ["Reduce position size", "Wait for confirmation"];
      }
      if (signalLevel === "MODERATE") {
        return ["Trade cautiously", "Monitor trend continuation"];
      }
      return ["High conviction signal", "Standard position sizing"];
    }

    const advice: string[] = [];
    if (reasons.includes("Low accuracy")) {
      advice.push("Model is unreliable — avoid trading");
    }
    if (reasons.includes("High disagreement")) {
      advice.push("Wait for consensus to form");
    }
    if (reasons.includes("Low confidence")) {
      advice.push("Reduce exposure until confidence improves");
    }
    return advice;
  }, [dashboardHeaderSignal]);

  const heroExpectedBehaviorOutlook = useMemo((): string | null => {
    if (consensus == null || dashboardHeaderSignal == null) return null;
    const buyShare = consensus.buyPct ?? 0;
    const sellShare = consensus.sellPct ?? 0;
    const direction = sellShare > buyShare ? "downward" : "upward";
    const strength = dashboardHeaderSignal.level.toLowerCase();
    const buyPct100 = Math.max(0, Math.min(100, buyShare * 100));
    const sellPct100 = Math.max(0, Math.min(100, sellShare * 100));
    const holdPct100 = Math.max(0, Math.min(100, (consensus.holdPct ?? 0) * 100));
    const maxPct = Math.max(buyPct100, sellPct100, holdPct100);
    const disagreementLevel = crowdReactionDistributionDisagreementFromMaxPct(maxPct).level;
    const uncertainty = disagreementLevel === "HIGH" ? "high uncertainty" : "low uncertainty";
    return `Expected behavior (next 3–5 steps):\n${strength} ${direction} bias with ${uncertainty}`;
  }, [consensus, dashboardHeaderSignal]);

  const globalMarketConfidenceScore = useMemo((): number | null => {
    if (consensus == null) return null;
    const accuracy = signalConfidencePrimary01;
    if (accuracy == null || !Number.isFinite(accuracy)) return null;
    const acc = clamp01(accuracy);
    const modelConfidence = clamp01(consensus.majorityPct ?? 0);
    const disagreementWord = entropyDisagreementWord(consensus.entropy);
    const disagreementValue = entropyDisagreementSignalWeight(disagreementWord);
    return Math.round(
      (acc * 0.4 + modelConfidence * 0.3 + (1 - disagreementValue) * 0.3) * 100,
    );
  }, [consensus, signalConfidencePrimary01]);

  const crowdInfluenceRows = useMemo(
    () => buildCrowdInfluenceRows(directionBiasByAgentType ?? null),
    [directionBiasByAgentType],
  );

  const crowdSignals =
    rawCrowdSignals && typeof rawCrowdSignals === "object" && Array.isArray(rawCrowdSignals.items)
      ? rawCrowdSignals
      : { window: 20, items: [] as Array<{ symbol: string; signal: string; confidence: number; disagreement: number; instability: number; runsUsed: number }> };

  const crowdMixTickPositions = useMemo(
    () => (consensus ? crowdMixTickPositionsFromConsensus(consensus) : []),
    [consensus?.buyPct, consensus?.sellPct, consensus?.holdPct],
  );

  const crowdMapZones = useMemo(
    () => buildCrowdMapZones(directionBiasByAgentType ?? null),
    [directionBiasByAgentType],
  );
  const signalValidation =
    rawSignalValidation && typeof rawSignalValidation === "object"
      ? {
          total: typeof rawSignalValidation.total === "number" ? rawSignalValidation.total : 0,
          actionable: typeof rawSignalValidation.actionable === "number" ? rawSignalValidation.actionable : 0,
          abstained: typeof rawSignalValidation.abstained === "number" ? rawSignalValidation.abstained : 0,
          directionalValidated: typeof rawSignalValidation.directionalValidated === "number" ? rawSignalValidation.directionalValidated : rawSignalValidation.validated ?? 0,
          directionalAccuracyRate: typeof rawSignalValidation.directionalAccuracyRate === "number" ? rawSignalValidation.directionalAccuracyRate : rawSignalValidation.accuracyRate ?? null,
          coverageRate: typeof rawSignalValidation.coverageRate === "number" ? rawSignalValidation.coverageRate : null,
          validated: typeof rawSignalValidation.validated === "number" ? rawSignalValidation.validated : 0,
          accuracyRate: typeof rawSignalValidation.accuracyRate === "number" ? rawSignalValidation.accuracyRate : null,
          latestItems: Array.isArray(rawSignalValidation.latestItems) ? rawSignalValidation.latestItems : [],
        }
      : { total: 0, actionable: 0, abstained: 0, directionalValidated: 0, directionalAccuracyRate: null,
          coverageRate: null, validated: 0, accuracyRate: null as number | null,
          latestItems: [] as Array<{ symbol: string; signal: string; realizedDirection: "UP" | "DOWN" | "FLAT" | null; actionable?: boolean; correct: boolean | null; confidence: number }> };
  const { assetSymbol = "SPY" } = initialQuery ?? {};

  const [drawerRun, setDrawerRun] = useState<{
    runId: string;
    type: "scaling" | "stability";
    row: ScalingRow | StabilityRow;
  } | null>(null);
  const [drawerRunMetadata, setDrawerRunMetadata] = useState<{
    datasetVersion: string;
    strategyProfile: string;
    aggregationMode: string;
    selectionPolicy: string;
    simulationSeed: number;
    modelVersion: string;
  } | null>(null);
  const [showOverheadOutliersOnly, setShowOverheadOutliersOnly] = useState(false);
  const [expandedScalingRows, setExpandedScalingRows] = useState<Set<string>>(new Set());
  const [driftAsset, setDriftAsset] = useState<{
    window: number;
    count: number;
    riskMean: number;
    riskDelta?: number;
    deltaRisk?: number;
    deltaSign?: number;
    deltaCorr?: number;
    direction?: "UP" | "DOWN" | "STABLE";
    regimeShift: boolean;
    riskSeries: number[];
  } | null>(initialDriftAsset ?? null);
  const [driftGlobal, setDriftGlobal] = useState<{
    window: number;
    count: number;
    riskMean: number;
    riskDelta?: number;
    deltaRisk?: number;
    deltaSign?: number;
    deltaCorr?: number;
    direction?: "UP" | "DOWN" | "STABLE";
    regimeShift: boolean;
    riskSeries: number[];
  } | null>(initialDriftGlobal ?? null);
  const [strategyProfile, setStrategyProfile] = useState(initialStrategyProfile ?? {
    key: "conservative",
    name: "Conservative",
    aggregationMode: "top_20pct_only",
    selectionPolicy: "top_20pct_agents",
    intendedUse: "production",
  });
  const [strategySwitchLoading, setStrategySwitchLoading] = useState(false);
  const [strategySwitchError, setStrategySwitchError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDriftAsset != null) setDriftAsset(initialDriftAsset);
    if (initialDriftGlobal != null) setDriftGlobal(initialDriftGlobal);
  }, [initialDriftAsset, initialDriftGlobal]);

  useEffect(() => {
    if (initialStrategyProfile != null) setStrategyProfile(initialStrategyProfile);
  }, [initialStrategyProfile]);

  useEffect(() => {
    if (!drawerRunId) {
      setDrawerRunMetadata(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/runs/${encodeURIComponent(drawerRunId)}/metadata`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.ok === false) {
          setDrawerRunMetadata(null);
          return;
        }
        setDrawerRunMetadata({
          datasetVersion: data.datasetVersion ?? "—",
          strategyProfile: data.strategyProfile ?? "—",
          aggregationMode: data.aggregationMode ?? "—",
          selectionPolicy: data.selectionPolicy ?? "—",
          simulationSeed: data.simulationSeed ?? 0,
          modelVersion: data.modelVersion ?? "—",
        });
      } catch {
        if (!cancelled) setDrawerRunMetadata(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drawerRunId]);

  useEffect(() => {
    if (initialDriftAsset != null && initialDriftGlobal != null) return;
    async function loadDrift() {
      try {
        const assetRes = await fetch(
          `/api/dashboard/drift?assetSymbol=${encodeURIComponent(assetSymbol)}&window=30`
        );
        const globalRes = await fetch(`/api/dashboard/drift?window=30`);
        setDriftAsset(await assetRes.json());
        setDriftGlobal(await globalRes.json());
      } catch {
        setDriftAsset(null);
        setDriftGlobal(null);
      }
    }
    loadDrift();
  }, [assetSymbol, initialDriftAsset, initialDriftGlobal]);

  const didNormalizeRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (searchParams.get("drawerRunId")) return;

    const current = new URLSearchParams(searchParams.toString());
    let changed = false;

    for (const [k, v] of Object.entries(DEFAULTS)) {
      if (!current.has(k)) {
        current.set(k, v);
        changed = true;
      }
    }

    if (!changed) return;
    if (didNormalizeRef.current) return;
    didNormalizeRef.current = true;

    router.replace(`${pathname}?${current.toString()}`);
    setTimeout(() => {
      didNormalizeRef.current = false;
    }, 0);
  }, [pathname, router, searchParams]);

  const openRunDetailsDrawer = useCallback(
    (runId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("drawerRunId", runId);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const closeRunDetailsDrawer = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("drawerRunId");
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  const toggleScalingRowExpand = useCallback((runId: string) => {
    setExpandedScalingRows((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  }, []);

  const scalingShown = initialQuery.showLegacy ? scaling : scaling.filter((r) => !r.isLegacyTiming);

  const stabilityWithRisk = useMemo(() => {
    const mapped = stability.map((r) => ({
      ...r,
      riskScore: computeRiskScore(r),
    }));
    if (initialQuery.sortByRisk) {
      mapped.sort((a, b) => b.riskScore - a.riskScore);
    }
    return mapped;
  }, [stability, initialQuery.sortByRisk]);
  const stabilityShown = stabilityWithRisk;

  const scalingFiltered = showOverheadOutliersOnly
    ? scalingShown.filter(
        (r) =>
          !r.isLegacyTiming &&
          r.overheadPct != null &&
          r.overheadPct >= 5
      )
    : scalingShown;

  const sparkDecisions = scalingShown.map((r) => r.decisionsPerSec ?? 0).filter((v) => v > 0);
  const sparkOverhead = scalingShown.map((r) => r.overheadPct ?? 0).filter((v) => Number.isFinite(v));
  const sparkCorr = stabilityShown.map((r) => r.corrSpread ?? 0).filter((v) => Number.isFinite(v));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRunDetailsDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeRunDetailsDrawer]);

  useEffect(() => {
    const rid = searchParams.get("drawerRunId");
    if (!rid) {
      setDrawerRun(null);
      return;
    }
    const scalingRow = scaling.find((r) => r.runId === rid);
    if (scalingRow) {
      setDrawerRun({ runId: rid, type: "scaling", row: scalingRow });
      return;
    }
    const stabilityRow = stabilityWithRisk.find((r) => r.runId === rid);
    if (stabilityRow) {
      setDrawerRun({ runId: rid, type: "stability", row: stabilityRow });
    } else {
      setDrawerRun(null);
    }
  }, [searchParams, scaling, stabilityWithRisk]);

  const decisionsPerSecVals = scalingFiltered.map((r) => r.decisionsPerSec ?? 0).filter((v) => v > 0);
  const overheadPctVals = scalingFiltered
    .map((r) => r.overheadPct ?? 0)
    .filter((v) => v > 0)
    .map((v) => (v > 100 ? 100 : v));
  const efficiencyVals = scalingFiltered.map((r) => r.efficiencyMsPerDecision ?? 0).filter((v) => v > 0);

  const p95Decisions = p95(decisionsPerSecVals);
  const p95Overhead = p95(overheadPctVals);
  const p95Efficiency = p95(efficiencyVals);

  const corrSpreadVals = stabilityWithRisk.map((r) => r.corrSpread ?? 0).filter((v) => v > 0);
  const accStdDevVals = stabilityWithRisk.map((r) => r.accStdDev ?? 0).filter((v) => v > 0);

  const p95CorrSpread = p95(corrSpreadVals) || 0.1;
  const p95AccStdDev = p95(accStdDevVals) || 0.05;

  return (
    <div data-testid="dashboard-root" style={{ maxWidth: 1152, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Dashboard</h1>
        </div>
        <DashboardFiltersClient
          assetSymbol={initialQuery.assetSymbol}
          topN={initialQuery.topN}
          showOnlyUnstable={initialQuery.showOnlyUnstable}
          showLegacy={initialQuery.showLegacy}
          sortByRisk={initialQuery.sortByRisk}
          navigateFilters={navigateFilters}
          filtersDisabled={isFilterLoading}
        />
      </div>

      <div className={styles.dashboardContentShell}>
        <div className={isFilterLoading ? styles.dashboardMainDimmed : undefined}>
      <div
        style={{
          textAlign: "center",
          padding: "28px 20px 32px",
          marginBottom: 28,
          borderRadius: 12,
          border: "1px solid rgba(15, 23, 42, 0.1)",
          background: "linear-gradient(180deg, rgba(248, 250, 252, 0.95) 0%, #fff 100%)",
        }}
      >
        {consensus == null ? (
          <div style={{ fontSize: 15, color: "rgba(15, 23, 42, 0.55)" }}>No crowd snapshot</div>
        ) : (
          <>
            <div
              style={{
                fontSize: 56,
                fontWeight: 800,
                letterSpacing: "0.06em",
                lineHeight: 1.1,
                marginBottom: 10,
                color:
                  dominantConsensusAction(consensus) === "BUY"
                    ? "#15803d"
                    : dominantConsensusAction(consensus) === "SELL"
                      ? "#b91c1c"
                      : "#475569",
              }}
            >
              {dominantConsensusAction(consensus)} {initialQuery.assetSymbol}
            </div>

            {globalMarketConfidenceScore != null ? (
              <div
                className={styles.globalConfidence}
                style={{ color: globalMarketConfidenceGaugeColor(globalMarketConfidenceScore) }}
              >
                Market Confidence: {globalMarketConfidenceScore} / 100
              </div>
            ) : null}

            {dashboardHeaderSignal != null ? (
              <>
                <div
                  className={styles.signal}
                  style={{ color: dashboardHeaderSignal.color }}
                  title={`Signal score ${dashboardHeaderSignal.score.toFixed(3)}`}
                >
                  SIGNAL: {dashboardHeaderSignal.level}
                </div>
                {dashboardHeaderSignal.reasons.length > 0 ? (
                  <div className={styles.signalReasons}>
                    {dashboardHeaderSignal.reasons.map((r) => (
                      <div key={r}>• {r}</div>
                    ))}
                  </div>
                ) : null}
                {dashboardHeaderSignal.level === "WEAK" ? (
                  <div className={`${styles.signalWarning} ${styles.signalWarningWeak}`}>
                    ⚠ Weak signal — high disagreement in the crowd
                  </div>
                ) : dashboardHeaderSignal.level === "MODERATE" ? (
                  <div className={`${styles.signalWarning} ${styles.signalWarningModerate}`}>
                    ⚠ Moderate signal — mixed crowd alignment
                  </div>
                ) : null}
                <div className={styles.advisor}>
                  {dashboardPositionAdvice.map((a) => (
                    <div key={a}>• {a}</div>
                  ))}
                </div>
              </>
            ) : null}

            {decisionQuality != null ? (
              <>
              <div data-testid="hero-decision-quality" className={styles.decisionQualityCard}>
                <div className={styles.decisionQualityTitle}>Decision Quality</div>
                <div
                  className={styles.decisionQualityScore}
                  style={{ color: signalConfidenceTierColor(decisionQuality.tier) }}
                >
                  {decisionQuality.score}
                </div>
                <div
                  className={
                    decisionQuality.tier === "HIGH"
                      ? styles.signalConfidenceBadgeHigh
                      : decisionQuality.tier === "MEDIUM"
                        ? styles.signalConfidenceBadgeMed
                        : styles.signalConfidenceBadgeLow
                  }
                >
                  {decisionQuality.tier}
                </div>
                <div
                  data-testid="hero-decision-confidence-explanation"
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    lineHeight: 1.35,
                    color: "rgba(15, 23, 42, 0.48)",
                    textAlign: "center",
                    maxWidth: 300,
                    marginLeft: "auto",
                    marginRight: "auto",
                  }}
                >
                  {decisionQuality.confidenceExplanation}
                </div>
                <div
                  className={styles.decisionQualityRecommended}
                  data-testid="hero-decision-recommended-action"
                >
                  <div className={styles.decisionQualityRecommendedTitle}>Recommended Action</div>
                  <div className={styles.decisionQualityRecommendedGrid}>
                    <div className={styles.decisionQualityRecommendedCell}>
                      <div className={styles.decisionQualityRecommendedLabel}>Position Size</div>
                      <div className={styles.decisionQualityRecommendedValue}>
                        {decisionQuality.recommendedAction.positionSize}
                      </div>
                    </div>
                    <div className={styles.decisionQualityRecommendedCell}>
                      <div className={styles.decisionQualityRecommendedLabel}>Risk Level</div>
                      <div className={styles.decisionQualityRecommendedValue}>
                        {decisionQuality.recommendedAction.riskLevel}
                      </div>
                    </div>
                    <div className={styles.decisionQualityRecommendedCell}>
                      <div className={styles.decisionQualityRecommendedLabel}>Execution Style</div>
                      <div className={styles.decisionQualityRecommendedValue}>
                        {decisionQuality.recommendedAction.executionStyle}
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className={styles.decisionQualitySignalHorizon}
                  data-testid="hero-signal-horizon"
                >
                  <div className={styles.decisionQualityRecommendedTitle}>Signal Horizon</div>
                  <div className={styles.decisionQualitySignalHorizonMain}>
                    {decisionQuality.signalHorizon.horizon}
                  </div>
                  <div className={styles.decisionQualitySignalHorizonSubtitle}>
                    {decisionQuality.signalHorizon.description}
                  </div>
                </div>
                <div className={styles.decisionQualityBasedOn}>
                  <div className={styles.decisionQualityBasedOnHeading}>Based on:</div>
                  <ul className={styles.decisionQualityBasedOnList}>
                    <li className={styles.decisionQualityBasedOnRow}>
                      <span>Accuracy</span>
                      <span className={styles.decisionQualityBasedOnValue}>
                        {formatSignalQualityPct01(decisionQuality.acc01)}
                      </span>
                    </li>
                    <li className={styles.decisionQualityBasedOnRow}>
                      <span>Model Confidence</span>
                      <span className={styles.decisionQualityBasedOnValue}>
                        {`${Math.round(decisionQuality.confidencePct)}%`}
                      </span>
                    </li>
                    <li className={styles.decisionQualityBasedOnRow}>
                      <span>Disagreement</span>
                      <span className={styles.decisionQualityBasedOnValue}>
                        {disagreementDisplayLabel(decisionQuality.disagreement)}
                      </span>
                    </li>
                  </ul>
                </div>
                {decisionQuality.bullets.length > 0 ? (
                  <ul className={styles.decisionQualityBullets}>
                    {decisionQuality.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {heroExpectedBehaviorOutlook != null ? (
                <div className={styles.outlook}>{heroExpectedBehaviorOutlook}</div>
              ) : null}
              </>
            ) : null}

            <div
              style={{
                fontSize: 11,
                color: "rgba(15, 23, 42, 0.45)",
                marginBottom: 4,
                marginTop: decisionQuality != null ? 18 : 10,
              }}
            >
              Crowd lean
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "8px 20px",
                fontSize: 10,
                fontWeight: 400,
                color: "rgba(15, 23, 42, 0.42)",
              }}
            >
              <span>
                Strength: {majorityStrengthWord(consensus.majorityPct)}
              </span>
              <span>
                Confidence: {consensusPctWhole(consensus.majorityPct)}
              </span>
              <span>
                Disagreement: {disagreementDisplayLabel(entropyDisagreementWord(consensus.entropy))}
              </span>
            </div>
          </>
        )}
      </div>

      <section data-testid="decision-flow" style={{ marginBottom: 28 }}>
        <div className={styles.sectionTitle} style={{ marginBottom: 14 }}>
          Why This Decision
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 0,
            overflowX: "auto",
            paddingBottom: 4,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {(
            [
              {
                key: "information",
                title: "Information",
                body: (
                  <>
                    {decisionFlowInformationEvents.length === 0 ? (
                      <>
                        <div style={{ fontSize: 14, color: "rgba(15, 23, 42, 0.72)", lineHeight: 1.4 }}>
                          Mixed signals
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.5)", lineHeight: 1.35, marginTop: 6 }}>
                          No high-impact event available for this asset
                        </div>
                      </>
                    ) : (
                      <>
                        {decisionFlowInformationEvents.map((ev, idx) => {
                          const pol = sentimentPolarity(ev.sentiment);
                          const sentimentStyle =
                            pol === "positive"
                              ? { bg: "#dcfce7", color: "#166534", label: "Positive" }
                              : pol === "negative"
                                ? { bg: "#fee2e2", color: "#991b1b", label: "Negative" }
                                : { bg: "#f3f4f6", color: "#4b5563", label: "Neutral" };
                          return (
                            <div
                              key={ev.id}
                              style={{
                                marginBottom: idx < decisionFlowInformationEvents.length - 1 ? 10 : 0,
                                padding: "10px 10px",
                                borderRadius: 8,
                                border: "1px solid rgba(15, 23, 42, 0.08)",
                                background: "rgba(255, 255, 255, 0.9)",
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: 13,
                                  color: "rgba(15, 23, 42, 0.92)",
                                  lineHeight: 1.35,
                                  marginBottom: 6,
                                }}
                              >
                                {ev.topic}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "rgba(15, 23, 42, 0.55)",
                                  marginBottom: 8,
                                  lineHeight: 1.3,
                                }}
                              >
                                Source: {ev.source != null && ev.source.trim() !== "" ? ev.source : "—"}
                              </div>
                              <div
                                style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12 }}
                              >
                                <span
                                  style={{
                                    fontWeight: 600,
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    background: sentimentStyle.bg,
                                    color: sentimentStyle.color,
                                  }}
                                >
                                  {sentimentStyle.label}
                                </span>
                                <span style={{ color: "rgba(15, 23, 42, 0.5)", fontSize: 11 }}>
                                  Reach {fmtPct01(ev.reach, 0)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            marginTop: 10,
                            color: "rgba(15, 23, 42, 0.78)",
                            lineHeight: 1.35,
                          }}
                        >
                          {decisionFlowInformationEvents[0].sentiment > 0.05
                            ? "Positive information pressure"
                            : decisionFlowInformationEvents[0].sentiment < -0.05
                              ? "Negative information pressure"
                              : "Mixed information pressure"}
                        </div>
                      </>
                    )}
                  </>
                ),
              },
              {
                key: "agent",
                title: "Agent impact",
                body: (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(["trendFollower", "contrarian", "balanced"] as const).map((profileKey) => {
                      const slice = directionBiasByAgentType?.[profileKey];
                      const dir = slice
                        ? profileDirectionFromCounts(slice.positiveCount, slice.negativeCount)
                        : ("Neutral" as const);
                      const { sym, color } = directionArrowFromDir(dir);
                      const topInfo = decisionFlowInformationEvents[0];
                      const explainLine =
                        topInfo != null
                          ? agentImpactExplanationForArchetype(profileKey, topInfo.sentiment)
                          : null;
                      return (
                        <div key={profileKey} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 8,
                              fontSize: 12,
                              color: "rgba(15, 23, 42, 0.88)",
                            }}
                          >
                            <span style={{ color: "rgba(15, 23, 42, 0.72)", fontWeight: 500 }}>
                              {CROWD_INFLUENCE_PROFILE_TITLE[profileKey]}
                            </span>
                            <span style={{ fontWeight: 600 }}>{dir}</span>
                            <span style={{ color, fontSize: 15, fontWeight: 700, lineHeight: 1 }} aria-hidden>
                              {sym}
                            </span>
                          </div>
                          {explainLine != null ? (
                            <div
                              style={{
                                fontSize: 11,
                                lineHeight: 1.35,
                                color: "rgba(15, 23, 42, 0.52)",
                              }}
                            >
                              {explainLine}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ),
              },
              {
                key: "crowd",
                title: "Crowd reaction",
                body:
                  consensus == null ? (
                    <div style={{ fontSize: 13, color: "rgba(15, 23, 42, 0.55)" }}>No consensus data</div>
                  ) : (
                    (() => {
                      const dom = dominantConsensusAction(consensus);
                      const buyPct = Math.max(0, Math.min(100, (consensus.buyPct ?? 0) * 100));
                      const sellPct = Math.max(0, Math.min(100, (consensus.sellPct ?? 0) * 100));
                      const holdPct = Math.max(0, Math.min(100, (consensus.holdPct ?? 0) * 100));
                      const maxPct = Math.max(buyPct, sellPct, holdPct);
                      const { level: distributionDisagreementLevel, color: distributionDisagreementColor } =
                        crowdReactionDistributionDisagreementFromMaxPct(maxPct);
                      const rows = [
                        { label: "BUY" as const, pct: consensus.buyPct, color: "#15803d" },
                        { label: "SELL" as const, pct: consensus.sellPct, color: "#b91c1c" },
                        { label: "HOLD" as const, pct: consensus.holdPct, color: "#475569" },
                      ];
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div
                            className={styles.disagreementBadge}
                            style={{ color: distributionDisagreementColor }}
                          >
                            {distributionDisagreementLevel} disagreement
                          </div>
                          <div className={styles.distributionBar} aria-hidden>
                            <div className={styles.buySegment} style={{ width: `${buyPct}%` }} />
                            <div className={styles.sellSegment} style={{ width: `${sellPct}%` }} />
                            <div className={styles.holdSegment} style={{ width: `${holdPct}%` }} />
                          </div>
                          {rows.map((r) => {
                            const isMajority = dom === r.label;
                            return (
                              <div
                                key={r.label}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "baseline",
                                  gap: 12,
                                  fontSize: isMajority ? 15 : 12,
                                  fontWeight: isMajority ? 700 : 500,
                                  color: r.color,
                                  padding: isMajority ? "4px 0" : 0,
                                  borderBottom: isMajority ? `2px solid ${r.color}` : undefined,
                                }}
                              >
                                <span>{r.label}</span>
                                <span style={{ fontVariantNumeric: "tabular-nums" }}>{consensusPctWhole(r.pct)}</span>
                              </div>
                            );
                          })}
                          {crowdReactionContradiction ? (
                            <div className={styles.contradiction}>
                              <div className={styles.contradictionTitle}>⚠ Contrarian pressure detected</div>
                              <div>
                                {crowdReactionContradiction.kind === "buyAgainstNegative"
                                  ? `${crowdReactionContradiction.buyPct}% of agents are buying against negative sentiment`
                                  : `${crowdReactionContradiction.sellPct}% of agents are selling against positive sentiment`}
                              </div>
                              <div className={styles.contradictionHint}>
                                This may indicate early reversal or disagreement in market interpretation
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })()
                  ),
              },
              {
                key: "outcome",
                title: "Outcome",
                body:
                  consensus == null ? (
                    <div style={{ fontSize: 13, color: "rgba(15, 23, 42, 0.55)" }}>—</div>
                  ) : (
                    <div style={{ fontSize: 13, color: "rgba(15, 23, 42, 0.82)", lineHeight: 1.55 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.04em", marginBottom: 8 }}>
                        <span
                          style={{
                            color:
                              dominantConsensusAction(consensus) === "BUY"
                                ? "#15803d"
                                : dominantConsensusAction(consensus) === "SELL"
                                  ? "#b91c1c"
                                  : "#475569",
                          }}
                        >
                          {dominantConsensusAction(consensus)} {initialQuery.assetSymbol}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>
                        Strength{" "}
                        <strong style={{ color: "rgba(15, 23, 42, 0.88)", fontWeight: 600 }}>
                          {majorityStrengthWord(consensus.majorityPct)}
                        </strong>
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>
                        Confidence{" "}
                        <strong style={{ color: "rgba(15, 23, 42, 0.88)", fontWeight: 600 }}>
                          {consensusPctWhole(consensus.majorityPct)}
                        </strong>
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>
                        Disagreement{" "}
                        <strong style={{ color: "rgba(15, 23, 42, 0.88)", fontWeight: 600 }}>
                          {entropyDisagreementWord(consensus.entropy)}
                        </strong>
                      </div>
                    </div>
                  ),
              },
            ] as const
          ).map((block, i) => (
            <React.Fragment key={block.key}>
              {i > 0 ? (
                <div
                  aria-hidden
                  style={{
                    flex: "0 0 auto",
                    alignSelf: "center",
                    fontSize: 20,
                    fontWeight: 600,
                    color: "rgba(148, 163, 184, 0.95)",
                    padding: "0 6px",
                    lineHeight: 1,
                  }}
                >
                  →
                </div>
              ) : null}
              <div
                style={{
                  flex: "1 1 160px",
                  minWidth: 148,
                  maxWidth: 280,
                  border: "1px solid rgba(15, 23, 42, 0.1)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  background: "rgba(248, 250, 252, 0.95)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase" as const,
                    color: "rgba(15, 23, 42, 0.5)",
                    marginBottom: 10,
                    fontWeight: 600,
                  }}
                >
                  {block.title}
                </div>
                {block.body}
              </div>
            </React.Fragment>
          ))}
        </div>
      </section>

      <div data-testid="legend" className={styles.legend} style={{ fontSize: 11 }}>
        <span className={styles.pill}>UNSTABLE if corrSpread &gt; 0.20</span>
        <span className={styles.pill}>or signAgreementRate &lt; 1.00</span>
        <span className={styles.pill}>or accStdDev &gt; 0.02</span>
        <span className={styles.pill}>LEGACY = missing variant timing</span>
        <span className={styles.pill}>Risk Score = weighted composite (corr, accStdDev, sign, overhead)</span>
      </div>

      <div data-testid="viz-bar" className={styles.vizBar}>
        <div className={styles.vizItem}>
          <div className={styles.vizLabel}>Decisions/sec trend</div>
          <Sparkline data-testid="spark-decisions" values={sparkDecisions} title="decisions/sec" />
        </div>
        <div className={styles.vizItem}>
          <div className={styles.vizLabel}>Overhead % trend</div>
          <Sparkline data-testid="spark-overhead" values={sparkOverhead} title="overhead %" />
        </div>
        <div className={styles.vizItem}>
          <div className={styles.vizLabel}>Corr spread trend</div>
          <span
            style={{
              color:
                stabilityShown.length > 0 &&
                Math.max(...stabilityShown.map((r) => r.riskScore ?? 0)) > 70
                  ? "#ff4d4f"
                  : undefined,
            }}
          >
            <Sparkline data-testid="spark-corrspread" values={sparkCorr} title="corr spread" />
          </span>
        </div>
      </div>

      {significantInfoEvents.length > 0 ? (
      <section className={styles.crowdCompositionSection} style={{ marginBottom: 32 }}>
        <div className={styles.sectionTitle}>Key Drivers</div>
        <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                {significantInfoEvents.map((ev) => {
                  const pol = sentimentPolarity(ev.sentiment);
                  const sentimentStyle =
                    pol === "positive"
                      ? { bg: "#dcfce7", color: "#166534", label: "Positive" }
                      : pol === "negative"
                        ? { bg: "#fee2e2", color: "#991b1b", label: "Negative" }
                        : { bg: "#f3f4f6", color: "#4b5563", label: "Neutral" };
                  return (
                    <div
                      key={ev.id}
                      className={styles.strategyComparisonCard}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid rgba(15, 23, 42, 0.1)",
                        background: "rgba(248, 250, 252, 0.85)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: "rgba(15, 23, 42, 0.92)",
                          flex: "1 1 auto",
                          minWidth: 0,
                        }}
                      >
                        {ev.topic}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: sentimentStyle.bg,
                          color: sentimentStyle.color,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {sentimentStyle.label}
                      </span>
                    </div>
                  );
                })}
              </div>
        </div>
      </section>
      ) : null}

      <section className={styles.crowdCompositionSection} style={{ marginBottom: 32 }}>
        <div className={styles.sectionTitle}>Agent Profile Bias</div>

        {crowdInfluenceRows == null ? (
          <div style={{ fontSize: 14, color: "rgba(15, 23, 42, 0.65)", marginBottom: 16 }}>
            No influence data available
          </div>
        ) : (
          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                fontWeight: 600,
                marginBottom: 8,
                fontSize: 13,
                letterSpacing: "0.03em",
                textTransform: "uppercase" as const,
                color: "rgba(15, 23, 42, 0.75)",
              }}
            >
              Crowd Influence Breakdown
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {crowdInfluenceRows.map((row, i) => {
                const influenceLabel = CROWD_INFLUENCE_LABELS[Math.min(i, 2)];
                const dir = profileDirectionFromSignal(row.avgSignal);
                return (
                <div
                  key={row.key}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(15, 23, 42, 0.1)",
                    background: "rgba(15, 23, 42, 0.03)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14, color: "rgba(15, 23, 42, 0.92)" }}>{row.title}</span>
                  <span style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)", fontWeight: 500 }}>{dir}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      color:
                        i === 0 ? "#15803d" : i === 1 ? "#b45309" : "rgba(15, 23, 42, 0.55)",
                    }}
                  >
                    {influenceLabel}
                  </span>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {consensus == null ? (
          <div style={{ fontSize: 14, color: "rgba(15, 23, 42, 0.65)", marginBottom: 16 }}>
            No crowd mix data available
          </div>
        ) : (
          <>
            <div className={styles.crowdMapSection} style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 8,
                  fontSize: 13,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase" as const,
                  color: "rgba(15, 23, 42, 0.75)",
                }}
              >
                Crowd Simulation
              </div>
              <div className={styles.crowdMapSampleLabel} style={{ fontSize: 11 }}>Sample by profile</div>
              {crowdMapZones == null ? (
                <div style={{ fontSize: 14, color: "rgba(15, 23, 42, 0.65)", marginBottom: 8 }}>
                  Agent profile bias data is required for the crowd map.
                </div>
              ) : (
                <>
                  <div className={styles.crowdMapGrid}>
                    {crowdMapZones.map((zone) => (
                      <div key={zone.profileKey} className={styles.crowdMapZone}>
                        <div className={styles.crowdMapZoneTitle}>{zone.title}</div>
                        <div className={styles.crowdMapZoneLean}>{zone.leaningLabel}</div>
                        <div
                          className={styles.crowdMapZoneCanvas}
                          aria-label={`${zone.title} sample: ${zone.leaningLabel}`}
                        >
                          {zone.dots.map((dot) => (
                            <span
                              key={dot.key}
                              className={
                                dot.kind === "positive"
                                  ? styles.crowdMapDotPos
                                  : dot.kind === "negative"
                                    ? styles.crowdMapDotNeg
                                    : styles.crowdMapDotNeu
                              }
                              style={{
                                left: `${dot.leftPct}%`,
                                top: `${dot.topPct}%`,
                                animationDuration: `${dot.durSec}s`,
                                animationDelay: `${dot.delaySec}s`,
                              }}
                              title={
                                dot.kind === "positive"
                                  ? "Positive signal (sample)"
                                  : dot.kind === "negative"
                                    ? "Negative signal (sample)"
                                    : "Neutral (sample)"
                              }
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {!directionBiasByAgentType ? (
          <div style={{ fontSize: 14, color: "rgba(15, 23, 42, 0.65)" }}>
            No agent profile bias data available
          </div>
        ) : (
          <div className={styles.crowdCompositionGrid}>
            {(
              [
                { key: "trendFollower" as const, title: "Trend Follower" },
                { key: "contrarian" as const, title: "Contrarian" },
                { key: "balanced" as const, title: "Balanced" },
              ] as const
            ).map(({ key, title }) => {
              const row = directionBiasByAgentType[key];
              const positiveCount = row?.positiveCount ?? 0;
              const negativeCount = row?.negativeCount ?? 0;
              return (
                <div key={key} className={styles.crowdCompositionCard}>
                  <div className={styles.crowdCompositionCardTitle}>{title}</div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 8,
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(15, 23, 42, 0.88)" }}>
                      {profileDirectionFromCounts(positiveCount, negativeCount)}
                    </span>
                    <span
                      aria-hidden
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background:
                          positiveCount > negativeCount
                            ? "#22c55e"
                            : negativeCount > positiveCount
                              ? "#ef4444"
                              : "#94a3b8",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {consensus != null ? (
            <div
              style={{
                marginBottom: 20,
                padding: 16,
                borderRadius: 10,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                background: "linear-gradient(180deg, rgba(15, 23, 42, 0.045) 0%, rgba(255, 255, 255, 0) 55%)",
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
              }}
            >
            <div
              style={{
                fontWeight: 600,
                marginBottom: 12,
                fontSize: 13,
                letterSpacing: "0.03em",
                textTransform: "uppercase" as const,
                color: "rgba(15, 23, 42, 0.75)",
              }}
            >
              Crowd Decision Mix
            </div>
            <div className={styles.crowdMixLiveLabel} style={{ fontSize: 11 }}>Buy / sell / hold mix</div>
            <div className={styles.crowdMixBar} data-testid="crowd-mix-bar" aria-label="Live crowd distribution by BUY, SELL, HOLD">
              <div
                className={`${styles.crowdMixSegment} ${styles.crowdMixSegmentBuy}`}
                style={{
                  width: `${Math.max(0, Math.min(1, consensus.buyPct ?? 0)) * 100}%`,
                  minWidth: (consensus.buyPct ?? 0) > 0 ? 3 : 0,
                }}
                title={`BUY ${consensusPctWhole(consensus.buyPct)}`}
              >
                <span className={styles.crowdMixShimmer} aria-hidden />
              </div>
              <div
                className={`${styles.crowdMixSegment} ${styles.crowdMixSegmentSell}`}
                style={{
                  width: `${Math.max(0, Math.min(1, consensus.sellPct ?? 0)) * 100}%`,
                  minWidth: (consensus.sellPct ?? 0) > 0 ? 3 : 0,
                }}
                title={`SELL ${consensusPctWhole(consensus.sellPct)}`}
              >
                <span className={`${styles.crowdMixShimmer} ${styles.crowdMixShimmerSell}`} aria-hidden />
              </div>
              <div
                className={`${styles.crowdMixSegment} ${styles.crowdMixSegmentHold}`}
                style={{
                  width: `${Math.max(0, Math.min(1, consensus.holdPct ?? 0)) * 100}%`,
                  minWidth: (consensus.holdPct ?? 0) > 0 ? 3 : 0,
                }}
                title={`HOLD ${consensusPctWhole(consensus.holdPct)}`}
              >
                <span className={`${styles.crowdMixShimmer} ${styles.crowdMixShimmerHold}`} aria-hidden />
              </div>
              <div className={styles.crowdMixTicks} aria-hidden>
                {crowdMixTickPositions.map((leftPct, i) => (
                  <span
                    key={i}
                    className={styles.crowdMixTick}
                    style={{ left: `${leftPct}%`, animationDelay: `${(i % 9) * 0.45}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

      {strategyComparisonSummaryAudit?.researchChampion && strategyComparisonSummaryAudit?.deployableCandidate ? (
        <div data-testid="strategy-comparison-section" className={styles.strategyComparisonSection}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 15 }}>Strategy Comparison</div>
          {(() => {
            const researchStrategy = strategyComparisonSummaryAudit.researchChampion;
            const deployableStrategy = strategyComparisonSummaryAudit.deployableCandidate;
            const drawdownDelta =
              ((researchStrategy?.maxDrawdown ?? 0) - (deployableStrategy?.maxDrawdown ?? 0)) * 100;

            const edgeRetentionPct =
              researchStrategy?.edge
                ? (Number(deployableStrategy?.edge ?? 0) / Number(researchStrategy.edge)) * 100
                : 0;

            const tradeReductionPct =
              researchStrategy?.trades
                ? (1 - Number(deployableStrategy?.trades ?? 0) / Number(researchStrategy.trades)) * 100
                : 0;

            const decisionScore = computeDecisionScore(researchStrategy, deployableStrategy);

            const validationStatus = (() => {
              const score = decisionScore ?? 0;
              const edgeRetention = edgeRetentionPct ?? 0;
              const drawdownImprovement = drawdownDelta ?? 0;

              if (score >= 70 && edgeRetention >= 50 && drawdownImprovement > 0) {
                return "Validated";
              }

              if (score >= 55) {
                return "Needs more runs";
              }

              return "Unstable";
            })();

            const guardrailEdge =
              edgeRetentionPct < 50;

            const guardrailDrawdown =
              (deployableStrategy?.maxDrawdown ?? 0) > 0.4;

            const guardrailTrades =
              (deployableStrategy?.trades ?? 0) > (researchStrategy?.trades ?? 0);

            return (
              <>
                <div className={styles.validationRow}>
                  <span className={styles.validationLabel}>Validation Status:</span>
                  <span
                    className={
                      validationStatus === "Validated"
                        ? styles.validationGood
                        : validationStatus === "Needs more runs"
                          ? styles.validationWarn
                          : styles.validationBad
                    }
                  >
                    {validationStatus}
                  </span>
                </div>
                <div className={styles.decisionScore}>
                  Decision Confidence: {decisionScore ?? "-"} / 100
                </div>
                <div className={styles.scoreBreakdown}>
                  <div>+{drawdownDelta.toFixed(1)}% drawdown improvement</div>
                  <div>{edgeRetentionPct.toFixed(0)}% edge retained</div>
                  <div>{tradeReductionPct.toFixed(0)}% fewer trades</div>
                </div>
                <div className={styles.decisionSummary}>
                  Deployable Candidate is recommended due to materially lower drawdown and tighter capital exposure compared to the research strategy.
                </div>
                <div className={styles.guardrails}>
                  <div className={styles.guardrailTitle}>
                    What would break this decision?
                  </div>
                  {guardrailEdge && (
                    <div className={styles.guardrailItem}>
                      Edge retention drops below 50%
                    </div>
                  )}
                  {guardrailDrawdown && (
                    <div className={styles.guardrailItem}>
                      Drawdown exceeds 40%
                    </div>
                  )}
                  {guardrailTrades && (
                    <div className={styles.guardrailItem}>
                      Trade count increases vs research strategy
                    </div>
                  )}
                </div>
              </>
            );
          })()}
          <div className={styles.strategyComparisonCards}>
            <div className={`${styles.strategyComparisonCard} ${styles.researchCard}`} data-testid="research-champion-card">
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Research Champion</div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 8 }}>
                {strategyComparisonSummaryAudit.researchChampion.strategyId} · {strategyComparisonSummaryAudit.researchChampion.versionLabel}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(85px, 1fr))", gap: 8 }}>
                <div><div style={{ fontSize: 10, color: "rgba(15, 23, 42, 0.5)" }}>trades</div><div style={{ fontSize: 13 }}>{formatNumber(strategyComparisonSummaryAudit.researchChampion.trades)}</div></div>
                <div><div style={{ fontSize: 10, color: "rgba(15, 23, 42, 0.5)" }}>cumulativeReturn</div><div style={{ fontSize: 13 }}>{formatPercent(strategyComparisonSummaryAudit.researchChampion.cumulativeReturn != null ? strategyComparisonSummaryAudit.researchChampion.cumulativeReturn * 100 : null)}</div></div>
                <div><div style={{ fontSize: 10, color: "rgba(15, 23, 42, 0.5)" }}>benchmarkReturn</div><div style={{ fontSize: 13 }}>{formatPercent(strategyComparisonSummaryAudit.researchChampion.benchmarkReturn != null ? strategyComparisonSummaryAudit.researchChampion.benchmarkReturn * 100 : null)}</div></div>
                <div><div style={{ fontSize: 10, color: "rgba(15, 23, 42, 0.5)" }}>edge</div><div style={{ fontSize: 13 }}>{formatPercent(strategyComparisonSummaryAudit.researchChampion.edge != null ? strategyComparisonSummaryAudit.researchChampion.edge * 100 : null)}</div></div>
                <div><div style={{ fontSize: 10, color: "rgba(15, 23, 42, 0.5)" }}>maxDrawdown</div><div style={{ fontSize: 13 }}>{formatPercent(strategyComparisonSummaryAudit.researchChampion.maxDrawdown != null ? strategyComparisonSummaryAudit.researchChampion.maxDrawdown * 100 : null)}</div></div>
              </div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)", marginTop: 8 }}>Highest expected edge</div>
            </div>
            <div className={`${styles.strategyComparisonCard} ${styles.deployableCard}`} data-testid="deployable-candidate-card">
              <div className={styles.decisionBadge}>
                Recommended for Deployment
              </div>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Deployable Candidate</div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 8 }}>
                {strategyComparisonSummaryAudit.deployableCandidate.strategyId} · {strategyComparisonSummaryAudit.deployableCandidate.versionLabel}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(85px, 1fr))", gap: 8 }}>
                <div><div style={{ fontSize: 10, color: "rgba(15, 23, 42, 0.5)" }}>trades</div><div style={{ fontSize: 13 }}>{formatNumber(strategyComparisonSummaryAudit.deployableCandidate.trades)}</div></div>
                <div><div style={{ fontSize: 10, color: "rgba(15, 23, 42, 0.5)" }}>cumulativeReturn</div><div style={{ fontSize: 13 }}>{formatPercent(strategyComparisonSummaryAudit.deployableCandidate.cumulativeReturn != null ? strategyComparisonSummaryAudit.deployableCandidate.cumulativeReturn * 100 : null)}</div></div>
                <div><div style={{ fontSize: 10, color: "rgba(15, 23, 42, 0.5)" }}>benchmarkReturn</div><div style={{ fontSize: 13 }}>{formatPercent(strategyComparisonSummaryAudit.deployableCandidate.benchmarkReturn != null ? strategyComparisonSummaryAudit.deployableCandidate.benchmarkReturn * 100 : null)}</div></div>
                <div><div style={{ fontSize: 10, color: "rgba(15, 23, 42, 0.5)" }}>edge</div><div style={{ fontSize: 13 }}>{formatPercent(strategyComparisonSummaryAudit.deployableCandidate.edge != null ? strategyComparisonSummaryAudit.deployableCandidate.edge * 100 : null)}</div></div>
                <div><div style={{ fontSize: 10, color: "rgba(15, 23, 42, 0.5)" }}>maxDrawdown</div><div style={{ fontSize: 13 }}>{formatPercent(strategyComparisonSummaryAudit.deployableCandidate.maxDrawdown != null ? strategyComparisonSummaryAudit.deployableCandidate.maxDrawdown * 100 : null)}</div></div>
                <div><div style={{ fontSize: 10, color: "rgba(15, 23, 42, 0.5)" }}>maxConcurrentOpenTrades</div><div style={{ fontSize: 13 }}>{formatNumber(strategyComparisonSummaryAudit.deployableCandidate.maxConcurrentOpenTrades)}</div></div>
              </div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)", marginTop: 8 }}>Best risk-adjusted choice</div>
              <div className={styles.decisionInsight}>
                Lower drawdown and controlled exposure vs research strategy, with reduced concurrency enabling more stable deployment.
              </div>
            </div>
          </div>
        </div>
      ) : null}
      </section>

      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 10,
            letterSpacing: "0.03em",
            textTransform: "uppercase" as const,
            color: "rgba(15, 23, 42, 0.65)",
          }}
        >
          Operational overview
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.5)" }}>Run duration</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: "rgba(15, 23, 42, 0.92)" }}>
              {latest?.runDurationMs != null ? `${(latest.runDurationMs / 1000).toFixed(1)} s` : "—"}
            </div>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.45)", marginTop: 4 }}>Latest run</div>
          </div>
          <div style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.5)" }}>Decisions/sec</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: "rgba(15, 23, 42, 0.92)" }}>
              {latestScalingRow?.decisionsPerSec != null ? Math.round(latestScalingRow.decisionsPerSec) : "—"}
            </div>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.45)", marginTop: 4 }}>Throughput</div>
          </div>
          <div style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.5)" }}>Overhead %</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: "rgba(15, 23, 42, 0.92)" }}>
              {formatOverheadPct(latestScalingRow?.overheadPct)}
            </div>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.45)", marginTop: 4 }}>Wallclock vs variants</div>
          </div>
          <div style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.5)" }}>Efficiency</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: "rgba(15, 23, 42, 0.92)" }}>
              {latestScalingRow?.efficiencyMsPerDecision != null ? latestScalingRow.efficiencyMsPerDecision.toFixed(4) : "—"}
            </div>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.45)", marginTop: 4 }}>ms per decision</div>
          </div>
        </div>
      </div>

      <div data-testid="drift-panel" className={styles.driftPanel}>
        <h3>Temporal Drift (Last 30 runs)</h3>

        <div className={styles.driftRow}>
          <div>
            <strong>Asset Drift</strong>
            {driftAsset && Array.isArray(driftAsset.riskSeries) && (
              <>
                <Sparkline
                  data-testid="spark-drift-asset"
                  values={driftAsset.riskSeries}
                />
                <div>Risk Mean: {driftAsset.riskMean?.toFixed(2)}</div>
                <div>Δ Risk: {((driftAsset.deltaRisk ?? driftAsset.riskDelta ?? 0) * 100).toFixed(1)}%</div>
                {typeof driftAsset.deltaSign === "number" && typeof driftAsset.deltaCorr === "number" && (
                  <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.5)" }}>
                    Δ sign: {(driftAsset.deltaSign * 100).toFixed(2)}% · Δ corr: {driftAsset.deltaCorr.toFixed(4)}
                  </div>
                )}
                <div>
                  Direction:{" "}
                  <span
                    className={
                      driftAsset.direction === "UP"
                        ? styles.directionUp
                        : driftAsset.direction === "DOWN"
                          ? styles.directionDown
                          : styles.directionStable
                    }
                  >
                    {driftAsset.direction ?? "STABLE"}
                  </span>
                </div>
                {driftAsset.regimeShift === true && (
                  <span className={styles.regimeShift}>REGIME SHIFT</span>
                )}
              </>
            )}
          </div>

          <div>
            <strong>Global Drift</strong>
            {driftGlobal && Array.isArray(driftGlobal.riskSeries) && (
              <>
                <Sparkline
                  data-testid="spark-drift-global"
                  values={driftGlobal.riskSeries}
                />
                <div>Risk Mean: {driftGlobal.riskMean?.toFixed(2)}</div>
                <div>Δ Risk: {((driftGlobal.deltaRisk ?? driftGlobal.riskDelta ?? 0) * 100).toFixed(1)}%</div>
                {typeof driftGlobal.deltaSign === "number" && typeof driftGlobal.deltaCorr === "number" && (
                  <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.5)" }}>
                    Δ sign: {(driftGlobal.deltaSign * 100).toFixed(2)}% · Δ corr: {driftGlobal.deltaCorr.toFixed(4)}
                  </div>
                )}
                <div>
                  Direction:{" "}
                  <span
                    className={
                      driftGlobal.direction === "UP"
                        ? styles.directionUp
                        : driftGlobal.direction === "DOWN"
                          ? styles.directionDown
                          : styles.directionStable
                    }
                  >
                    {driftGlobal.direction ?? "STABLE"}
                  </span>
                </div>
                {driftGlobal.regimeShift === true && (
                  <span className={styles.regimeShift}>REGIME SHIFT</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ScalingCurve scalingRows={scaling} />

      <div style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 32 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Last Runs (Scaling)</div>
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>
              Legacy timing means variants have no durationMs/timestamps; only runDurationMs is available.
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={showOverheadOutliersOnly}
              onChange={(e) => setShowOverheadOutliersOnly(e.target.checked)}
            />
            Show overhead outliers only (≥5%)
          </label>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Run</th>
                <th className={styles.num}>Agents</th>
                <th className={styles.num}>Variants</th>
                <th className={styles.num}>Steps</th>
                <th>Run duration</th>
                <th className={styles.num}>Decisions/sec</th>
                <th className={styles.num}>Overhead (ms)</th>
                <th className={styles.num}>Overhead %</th>
                <th className={styles.num}>Efficiency</th>
                <th className={styles.num} role="presentation" aria-hidden="true">Risk Score</th>
                <th>Compare</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scalingFiltered.map((r) => {
                const dpsWidth = r.decisionsPerSec != null ? normToP95(r.decisionsPerSec, p95Decisions) / 100 : 0;
                const ohVal = r.overheadPct != null ? (r.overheadPct > 100 ? 100 : r.overheadPct) : null;
                const ohWidth = ohVal != null ? normToP95(ohVal, p95Overhead) / 100 : 0;
                const effWidth = r.efficiencyMsPerDecision != null ? normToP95(r.efficiencyMsPerDecision, p95Efficiency) / 100 : 0;
                const overheadOutlierBadge =
                  !r.isLegacyTiming && r.overheadPct != null
                    ? r.overheadPct >= 15
                      ? { kind: "overhead-hard" as const, text: "≥15%" }
                      : r.overheadPct >= 5
                        ? { kind: "overhead-soft" as const, text: "≥5%" }
                        : null
                    : null;
                const isExpanded = expandedScalingRows.has(r.runId);
                const hasBreakdown =
                  !r.isLegacyTiming &&
                  (r.engineInitMs != null ||
                    r.orchestrationMs != null ||
                    r.dbCommitMs != null ||
                    r.computeMs != null);
                return (
                  <React.Fragment key={r.runId}>
                    <tr>
                      <td>
                        <div className="flex items-center gap-2 flex-wrap">
                          {hasBreakdown ? (
                            <button
                              type="button"
                              onClick={() => toggleScalingRowExpand(r.runId)}
                              className="inline-flex items-center justify-center w-6 h-6 rounded border border-slate-200 bg-transparent hover:bg-slate-50 text-slate-500 hover:text-slate-700"
                              aria-label={isExpanded ? "Collapse details" : "Expand details"}
                              title={isExpanded ? "Collapse" : "Expand"}
                            >
                              {isExpanded ? "▼" : "▶"}
                            </button>
                          ) : null}
                          <span className="font-mono text-xs">{r.runId.slice(0, 6)}…{r.runId.slice(-4)}</span>
                          {r.isLegacyTiming ? <Badge kind="legacy" text="LEGACY" /> : null}
                          {overheadOutlierBadge ? <Badge kind={overheadOutlierBadge.kind} text={overheadOutlierBadge.text} /> : null}
                          {r.stabilityBand != null ? (
                            <span
                              className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                                r.stabilityBand === "OK"
                                  ? "bg-green-100 text-green-700"
                                  : r.stabilityBand === "DIVERGING"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : r.stabilityBand === "UNSTABLE"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {r.stabilityBand}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                    <td className={styles.num}>{r.agents}</td>
                    <td className={styles.num}>{r.variants}</td>
                    <td className={styles.num}>{r.steps}</td>
                    <td>
                      {r.runDurationMs != null ? (
                        <span className="tabular-nums text-sm">{r.runDurationMs} ms</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td>
                      {r.decisionsPerSec != null ? (
                        <ScalingMiniBar
                          value01={p95Decisions > 0 ? dpsWidth : 0}
                          text={r.decisionsPerSec.toFixed(1)}
                          title="Decisions per second (higher = better)"
                        />
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className={styles.num}>{r.overheadMs != null ? Math.round(r.overheadMs) : "—"}</td>
                    <td>
                      {r.overheadPct != null ? (
                        <ScalingMiniBar
                          value01={p95Overhead > 0 ? ohWidth : 0}
                          text={formatOverheadPct(r.overheadPct)}
                          higherIsWorse
                          title="Overhead % (lower = better)"
                        />
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td>
                      {r.efficiencyMsPerDecision != null ? (
                        <ScalingMiniBar
                          value01={p95Efficiency > 0 ? effWidth : 0}
                          text={r.efficiencyMsPerDecision.toFixed(4)}
                          higherIsWorse
                          title="Efficiency ms/decision (lower = better)"
                        />
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td data-testid="risk-cell" className={styles.num}>
                      {r.stabilityScore ?? 0}
                    </td>
                    <td>
                      <Link
                        href={`/runs/${r.runId}/compare?assetSymbol=${encodeURIComponent(assetSymbol)}`}
                        className={styles.actionLink}
                      >
                        Compare seeds
                      </Link>
                    </td>
                    <td>
                      <button
                        type="button"
                        data-testid="run-details-btn"
                        data-runid={r.runId}
                        onClick={() => openRunDetailsDrawer(r.runId)}
                        className={styles.actionLink}
                        style={{ border: "none", cursor: "pointer", font: "inherit" }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                  {isExpanded && hasBreakdown ? (
                    <tr>
                      <td colSpan={12} style={{ padding: 0, verticalAlign: "top" }}>
                        <div
                          style={{
                            padding: "12px 16px",
                            background: "rgba(15, 23, 42, 0.03)",
                            borderTop: "1px solid rgba(15, 23, 42, 0.08)",
                            fontSize: 12,
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 8, color: "rgba(15, 23, 42, 0.7)" }}>
                            Overhead breakdown
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                              gap: 12,
                            }}
                          >
                            <div>
                              <div style={{ color: "rgba(15, 23, 42, 0.5)", fontSize: 11 }}>Engine Init</div>
                              <div className="tabular-nums">
                                {r.engineInitMs != null ? `${r.engineInitMs} ms` : "—"}
                              </div>
                            </div>
                            <div>
                              <div style={{ color: "rgba(15, 23, 42, 0.5)", fontSize: 11 }}>Orchestration</div>
                              <div className="tabular-nums">
                                {r.orchestrationMs != null ? `${r.orchestrationMs} ms` : "—"}
                              </div>
                            </div>
                            <div>
                              <div style={{ color: "rgba(15, 23, 42, 0.5)", fontSize: 11 }}>DB Commit</div>
                              <div className="tabular-nums">
                                {r.dbCommitMs != null ? `${r.dbCommitMs} ms` : "—"}
                              </div>
                            </div>
                            <div>
                              <div style={{ color: "rgba(15, 23, 42, 0.5)", fontSize: 11 }}>Compute</div>
                              <div className="tabular-nums">
                                {r.computeMs != null ? `${r.computeMs} ms` : "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
                );
              })}
              {scalingFiltered.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: 24, color: "rgba(15, 23, 42, 0.55)" }}>
                    {showOverheadOutliersOnly ? "No overhead outliers (≥5%) in this set." : "No completed runs found."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div
        data-testid="production-aggregation-card"
        style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
      >
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Production Aggregation Mode</div>
        {productionAggregationMode ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>Active mode</div>
                <div data-testid="production-aggregation-active-mode" style={{ fontSize: 13, fontWeight: 500 }}>{productionAggregationMode.aggregationMode}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>Snapshot ID</div>
                <div style={{ fontSize: 12, fontFamily: "ui-monospace, monospace" }} title={productionAggregationMode.snapshotId}>
                  {shortenId(productionAggregationMode.snapshotId)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>Dataset / Model</div>
                <div style={{ fontSize: 12 }}>
                  {shortenHash(productionAggregationMode.datasetVersion)} / {productionAggregationMode.modelVersion ?? "—"}
                </div>
              </div>
            </div>
            {aggregationModeRanking.length > 0 ? (
              <div data-testid="production-aggregation-ranking">
                <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 6 }}>Ranking</div>
                <div className={styles.tableWrap} style={{ maxHeight: 120 }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Mode</th>
                        <th className={styles.num}>rawScore</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aggregationModeRanking.map((r) => (
                        <tr
                          key={r.aggregationMode}
                          className={r.aggregationMode === productionAggregationMode.aggregationMode ? styles.productionModeActive : undefined}
                        >
                          <td>{r.aggregationMode}</td>
                          <td className={styles.num}>{r.rawScore.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>No aggregation mode ranking available</div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 13, color: "rgba(15, 23, 42, 0.55)" }}>No production aggregation mode selected</div>
        )}
      </div>

      <div
        data-testid="strategy-profile-card"
        style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
      >
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Strategy Profile</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>Active profile</div>
            <div data-testid="strategy-profile-active" style={{ fontSize: 13, fontWeight: 500 }}>{strategyProfile.name}</div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>Description</div>
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.75)" }}>
              {strategyProfile.key === "conservative" && "Stable production profile emphasizing proven crowd filtering."}
              {strategyProfile.key === "balanced" && "General-purpose profile balancing coverage and signal quality."}
              {strategyProfile.key === "aggressive" && "Higher-variance profile intended for future experimental weighting modes."}
              {strategyProfile.key === "research" && "Open analysis profile for benchmark exploration and diagnostics."}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>Aggregation mode</div>
            <div style={{ fontSize: 12 }}>{strategyProfile.aggregationMode}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>Selection policy</div>
            <div style={{ fontSize: 12 }}>{strategyProfile.selectionPolicy}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>Intended use</div>
            <div style={{ fontSize: 12 }}>{strategyProfile.intendedUse}</div>
          </div>
        </div>
        <div data-testid="strategy-profile-selector" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 6 }}>Switch profile</div>
          <div data-testid="strategy-profile-list" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(["conservative", "balanced", "aggressive", "research"] as const).map((key) => (
              <button
                key={key}
                type="button"
                data-testid={`strategy-profile-option-${key}`}
                disabled={strategySwitchLoading}
                onClick={async () => {
                  if (strategyProfile.key === key) return;
                  setStrategySwitchError(null);
                  setStrategySwitchLoading(true);
                  try {
                    const res = await fetch("/api/strategy-profiles/active", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ key }),
                    });
                    const data = (await res.json()) as { ok?: boolean; activeProfile?: typeof strategyProfile; error?: string; message?: string };
                    if (data.ok && data.activeProfile) {
                      setStrategyProfile(data.activeProfile);
                      router.refresh();
                    } else {
                      setStrategySwitchError(data.message ?? data.error ?? "Switch failed");
                    }
                  } catch (e) {
                    setStrategySwitchError(e instanceof Error ? e.message : "Switch failed");
                  } finally {
                    setStrategySwitchLoading(false);
                  }
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(15, 23, 42, 0.15)",
                  background: strategyProfile.key === key ? "rgba(6, 182, 212, 0.12)" : "rgba(15, 23, 42, 0.04)",
                  fontWeight: strategyProfile.key === key ? 600 : 500,
                  fontSize: 12,
                  cursor: strategySwitchLoading ? "not-allowed" : "pointer",
                  opacity: strategySwitchLoading ? 0.7 : 1,
                }}
              >
                {key === "conservative" ? "Conservative" : key === "balanced" ? "Balanced" : key === "aggressive" ? "Aggressive" : "Research"}
              </button>
            ))}
          </div>
        </div>
        {strategySwitchLoading && (
          <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)", marginTop: 4 }}>Switching…</div>
        )}
        {strategySwitchError && (
          <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{strategySwitchError}</div>
        )}
        <div data-testid="strategy-defaults-block" style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(15, 23, 42, 0.08)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "rgba(15, 23, 42, 0.8)" }}>Operational Defaults</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>Benchmark aggregation mode</div>
              <div>{strategyDefaults?.benchmarkDefaults?.aggregationMode ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>Benchmark selection policy</div>
              <div>{strategyDefaults?.benchmarkDefaults?.selectionPolicy ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>Benchmark symbols / windows / n</div>
              <div>{(strategyDefaults?.benchmarkDefaults?.symbols ?? []).join(", ")} · [{(strategyDefaults?.benchmarkDefaults?.windows ?? []).join(", ")}] · n={strategyDefaults?.benchmarkDefaults?.n ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>Run aggregation mode</div>
              <div>{strategyDefaults?.runDefaults?.aggregationMode ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>Run selection policy</div>
              <div>{strategyDefaults?.runDefaults?.selectionPolicy ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>Run assetSymbols / points</div>
              <div>{(strategyDefaults?.runDefaults?.assetSymbols ?? []).join(", ")} · points={strategyDefaults?.runDefaults?.points ?? "—"}</div>
            </div>
          </div>
        </div>
        <div data-testid="execution-preset-block" className={styles.executionPresetBlock}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "rgba(15, 23, 42, 0.8)" }}>Execution Preset</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: 12 }}>
            <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 4 }}>Run preset</div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>assetSymbols</div>
              <div>{executionPreset.runPreset.assetSymbols.join(", ")}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>points</div>
              <div>{executionPreset.runPreset.points}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>aggregationMode</div>
              <div>{executionPreset.runPreset.aggregationMode}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>selectionPolicy</div>
              <div>{executionPreset.runPreset.selectionPolicy}</div>
            </div>
            <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 4, marginTop: 8 }}>Benchmark preset</div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>symbols</div>
              <div>{executionPreset.benchmarkPreset.symbols.join(", ")}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>windows</div>
              <div>[{executionPreset.benchmarkPreset.windows.join(", ")}]</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>n</div>
              <div>{executionPreset.benchmarkPreset.n}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>aggregationMode</div>
              <div>{executionPreset.benchmarkPreset.aggregationMode}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>selectionPolicy</div>
              <div>{executionPreset.benchmarkPreset.selectionPolicy}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>baselineTag</div>
              <div>{executionPreset.benchmarkPreset.baselineTag}</div>
            </div>
          </div>
        </div>
        <div data-testid="launch-plan-block" className={styles.launchPlanBlock}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "rgba(15, 23, 42, 0.8)" }}>Launch Plan</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: 12 }}>
            <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 4 }}>Run plan</div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>endpoint</div>
              <div>{launchPlan.runPlan.endpoint}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>symbols · points</div>
              <div>{launchPlan.runPlan.params.symbols.join(", ")} · {launchPlan.runPlan.params.points}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>aggregationMode · selectionPolicy</div>
              <div>{launchPlan.runPlan.resolved.aggregationMode} · {launchPlan.runPlan.resolved.selectionPolicy}</div>
            </div>
            <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 4, marginTop: 8 }}>Benchmark plan</div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>endpoint</div>
              <div>{launchPlan.benchmarkPlan.endpoint}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>symbols · windows · n · baselineTag</div>
              <div>{launchPlan.benchmarkPlan.params.symbols.join(", ")} · [{launchPlan.benchmarkPlan.params.windows.join(", ")}] · n={launchPlan.benchmarkPlan.params.n} · {launchPlan.benchmarkPlan.params.baselineTag}</div>
            </div>
            <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 4, marginTop: 8 }}>Governance</div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>candidateMode</div>
              <div>{launchPlan.governance.candidateMode}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>recommendedMode</div>
              <div>{launchPlan.governance.recommendedMode}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginBottom: 2 }}>baselineFamilyTag</div>
              <div>{launchPlan.governance.baselineFamilyTag}</div>
            </div>
          </div>
        </div>
      </div>

      <div
        data-testid="crowd-signals-card"
        style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
      >
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Crowd Signals</div>
        {crowdSignals.items && crowdSignals.items.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "60px 1fr 70px 1fr 1fr 1fr 1fr",
                gap: 12,
                fontSize: 11,
                color: "rgba(15, 23, 42, 0.55)",
                paddingBottom: 4,
              }}
            >
              <span>Symbol</span>
              <span>Signal</span>
              <span title="Signal strength">Str</span>
              <span>Confidence</span>
              <span>Disagreement</span>
              <span>Instability</span>
              <span>Runs</span>
            </div>
            {crowdSignals.items.map((item) => (
              <div
                key={item.symbol ?? "unknown"}
                data-testid="crowd-signal-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 70px 1fr 1fr 1fr 1fr",
                  gap: 12,
                  alignItems: "center",
                  fontSize: 13,
                  padding: "8px 10px",
                  background: "rgba(15, 23, 42, 0.02)",
                  borderRadius: 6,
                  border: "1px solid rgba(15, 23, 42, 0.06)",
                }}
              >
                <span style={{ fontWeight: 600 }}>{item.symbol ?? "—"}</span>
                <span
                  style={{
                    color:
                      item.signal === "STRONG_BUY" || item.signal === "BUY"
                        ? "#16a34a"
                        : item.signal === "STRONG_SELL" || item.signal === "SELL"
                          ? "#dc2626"
                          : "rgba(15, 23, 42, 0.7)",
                  }}
                >
                  {item.signal ?? "NEUTRAL"}
                </span>
                <span title="signal strength">{(((item as { signalStrength?: number }).signalStrength ?? item.confidence ?? 0) * 100).toFixed(1)}%</span>
                <span title="confidence">{((item.confidence ?? 0) * 100).toFixed(1)}%</span>
                <span title="disagreement">{((item.disagreement ?? 0) * 100).toFixed(1)}%</span>
                <span title="instability">{((item.instability ?? 0) * 100).toFixed(1)}%</span>
                <span title="runs used">{item.runsUsed ?? 0}</span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginTop: 4 }}>
              Rolling window: {crowdSignals.window ?? 20} runs
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "rgba(15, 23, 42, 0.55)" }}>No crowd signals yet</div>
        )}
      </div>

      <div
        data-testid="signal-validation-card"
        style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
      >
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Signal Validation</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Total</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{signalValidation.total ?? 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Actionable</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{signalValidation.actionable ?? 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Abstained</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{signalValidation.abstained ?? 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Directional Accuracy</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {signalValidation.directionalAccuracyRate != null
                ? `${(signalValidation.directionalAccuracyRate * 100).toFixed(1)}%`
                : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Coverage Rate</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {signalValidation.coverageRate != null
                ? `${(signalValidation.coverageRate * 100).toFixed(1)}%`
                : "—"}
            </div>
          </div>
        </div>
        {signalValidation.latestItems && signalValidation.latestItems.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "50px 70px 40px 1fr 1fr 1fr",
                gap: 8,
                fontSize: 11,
                color: "rgba(15, 23, 42, 0.55)",
                paddingBottom: 4,
              }}
            >
              <span>Symbol</span>
              <span>Signal</span>
              <span title="Actionable">Act</span>
              <span>Realized</span>
              <span>Correct</span>
              <span>Conf</span>
            </div>
            {signalValidation.latestItems.map((item, idx) => (
              <div
                key={`${item.symbol}-${idx}`}
                data-testid="signal-validation-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "50px 70px 40px 1fr 1fr 1fr",
                  gap: 8,
                  alignItems: "center",
                  fontSize: 12,
                  padding: "6px 8px",
                  background: "rgba(15, 23, 42, 0.02)",
                  borderRadius: 6,
                  border: "1px solid rgba(15, 23, 42, 0.06)",
                }}
              >
                <span style={{ fontWeight: 600 }}>{item.symbol ?? "—"}</span>
                <span>{item.signal ?? "—"}</span>
                <span title={item.actionable ? "Actionable" : "Abstained"}>{item.actionable ? "✓" : "—"}</span>
                <span>{item.realizedDirection ?? "—"}</span>
                <span>
                  {item.correct === true ? "✓" : item.correct === false ? "✗" : "—"}
                </span>
                <span>{((item.confidence ?? 0) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "rgba(15, 23, 42, 0.55)" }}>No validation data yet. Run POST /signals/snapshot or POST /signals/backfill to persist signals.</div>
        )}
        {signalHistoryStats && (signalHistoryStats.totalSnapshots > 0 || signalHistoryStats.symbolsCovered > 0) ? (
          <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", marginTop: 8 }}>
            History: {signalHistoryStats.totalSnapshots} snapshots across {signalHistoryStats.symbolsCovered} symbol{signalHistoryStats.symbolsCovered !== 1 ? "s" : ""}
          </div>
        ) : null}
      </div>

      {signalCoverage ? (
        <div
          data-testid="signal-coverage-card"
          style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Signal Coverage</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Total</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{signalCoverage.total ?? 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Actionable</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{signalCoverage.actionable ?? 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Abstained</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{signalCoverage.abstained ?? 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Coverage Rate</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {signalCoverage.coverageRate != null ? `${(signalCoverage.coverageRate * 100).toFixed(1)}%` : "—"}
              </div>
            </div>
          </div>
          {signalCoverage.bySignal && Object.keys(signalCoverage.bySignal).length > 0 ? (
            <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)", display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["STRONG_BUY", "BUY", "NEUTRAL", "SELL", "STRONG_SELL"].map((sig) => (
                <span key={sig}>{sig}: {signalCoverage.bySignal?.[sig] ?? 0}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {marketRegime ? (
        <div
          data-testid="market-regime-card"
          style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Market Regime</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Regime: {marketRegime.regime}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Avg Signal Strength</div>
              <div style={{ fontSize: 14 }}>{(marketRegime.avgSignalStrength * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Avg Disagreement</div>
              <div style={{ fontSize: 14 }}>{(marketRegime.avgDisagreement * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Coverage</div>
              <div style={{ fontSize: 14 }}>{(marketRegime.coverageRate * 100).toFixed(1)}%</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)", fontStyle: "italic" }}>
            {marketRegime.regime === "TRENDING" && "Crowd consensus present"}
            {marketRegime.regime === "MIXED" && "Partial consensus"}
            {marketRegime.regime === "CHAOTIC" && "Crowd disagreement high"}
          </div>
        </div>
      ) : null}

      {marketTransition ? (
        <div
          data-testid="market-transition-card"
          style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Market Transition</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Trend: {marketTransition.trend}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Δ Strength</div>
              <div style={{ fontSize: 14 }}>{(marketTransition.strengthDelta * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Δ Disagreement</div>
              <div style={{ fontSize: 14 }}>{(marketTransition.disagreementDelta * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Δ Coverage</div>
              <div style={{ fontSize: 14 }}>{(marketTransition.coverageDelta * 100).toFixed(1)}%</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)", fontStyle: "italic" }}>
            {marketTransition.trend === "IMPROVING" && "Consensus strengthening"}
            {marketTransition.trend === "DETERIORATING" && "Consensus weakening"}
            {marketTransition.trend === "STABLE" && "No significant change"}
          </div>
        </div>
      ) : null}

      {marketStress ? (
        <div
          data-testid="market-stress-card"
          style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Market Stress</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            State: {marketStress.state}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Buy Dominance</div>
              <div style={{ fontSize: 14 }}>{marketStress.buyDominance ?? 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Sell Dominance</div>
              <div style={{ fontSize: 14 }}>{marketStress.sellDominance ?? 0}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)", fontStyle: "italic" }}>
            {marketStress.interpretation ?? ""}
          </div>
        </div>
      ) : null}

      {marketAlerts && marketAlerts.length > 0 ? (
        <div
          data-testid="market-alerts-card"
          style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Market Alerts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {marketAlerts.map((a, i) => (
              <div
                key={`${a.type}-${i}`}
                style={{ border: "1px solid rgba(15, 23, 42, 0.08)", borderRadius: 8, padding: 12 }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{a.type}</span>
                  <span style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)" }}>{a.severity}</span>
                  <span style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)" }}>
                    {(a.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.8)" }}>{a.message}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {signalValidationMetrics ? (
        <div
          data-testid="crowd-performance-card"
          style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Crowd Performance</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Accuracy</div>
              <div style={{ fontSize: 14 }}>{((signalValidationMetrics.accuracy ?? 0) * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Avg return</div>
              <div style={{ fontSize: 14 }}>{((signalValidationMetrics.avgReturn ?? 0) * 100).toFixed(2)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Edge vs benchmark</div>
              <div style={{ fontSize: 14 }}>{((signalValidationMetrics.edge ?? 0) * 100).toFixed(2)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Signals evaluated</div>
              <div style={{ fontSize: 14 }}>{signalValidationMetrics.actionableSignals ?? 0}</div>
            </div>
          </div>
        </div>
      ) : null}

      {backtestMetrics && backtestMetrics.trades > 0 ? (
        <div
          data-testid="backtest-performance-card"
          style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Backtest Performance</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Trades</div>
              <div style={{ fontSize: 14 }}>{backtestMetrics.trades}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Win rate</div>
              <div style={{ fontSize: 14 }}>{backtestMetrics.winRate != null ? `${(backtestMetrics.winRate * 100).toFixed(1)}%` : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Avg trade return</div>
              <div style={{ fontSize: 14 }}>{backtestMetrics.avgTradeReturn != null ? `${(backtestMetrics.avgTradeReturn * 100).toFixed(2)}%` : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Cumulative return</div>
              <div style={{ fontSize: 14 }}>{backtestMetrics.cumulativeReturn != null ? `${(backtestMetrics.cumulativeReturn * 100).toFixed(2)}%` : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Benchmark return</div>
              <div style={{ fontSize: 14 }}>{backtestMetrics.benchmarkReturn != null ? `${(backtestMetrics.benchmarkReturn * 100).toFixed(2)}%` : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Edge</div>
              <div style={{ fontSize: 14 }}>{backtestMetrics.edge != null ? `${(backtestMetrics.edge * 100).toFixed(2)}%` : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Max drawdown</div>
              <div style={{ fontSize: 14 }}>{backtestMetrics.maxDrawdown != null ? `${(backtestMetrics.maxDrawdown * 100).toFixed(1)}%` : "—"}</div>
            </div>
          </div>
          {backtestDiagnostics ? (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(15, 23, 42, 0.08)", fontSize: 11, color: "rgba(15, 23, 42, 0.6)" }}>
              Diagnostics: {backtestDiagnostics.candidateRows} candidates → {backtestDiagnostics.executedTrades} executed
              (skipped: {backtestDiagnostics.skippedNonPrepare} non-prepare, {backtestDiagnostics.skippedLowSignalStrength} low signal, {backtestDiagnostics.skippedHighNeutral} high neutral, {backtestDiagnostics.skippedLowConviction} low conviction)
            </div>
          ) : null}
        </div>
      ) : null}

      {crowdConfidence ? (
        <div
          data-testid="crowd-confidence-card"
          style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Crowd Confidence</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Regime: {crowdConfidence.regime}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Conviction</div>
              <div style={{ fontSize: 14 }}>{((crowdConfidence.conviction ?? 0) * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Disagreement</div>
              <div style={{ fontSize: 14 }}>{((crowdConfidence.disagreement ?? 0) * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Coverage</div>
              <div style={{ fontSize: 14 }}>{((crowdConfidence.coverageRate ?? 0) * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Neutral %</div>
              <div style={{ fontSize: 14 }}>{((crowdConfidence.neutralProbability ?? 0) * 100).toFixed(1)}%</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)", fontStyle: "italic" }}>
            {crowdConfidence.interpretation ?? ""}
          </div>
        </div>
      ) : null}

      {signalProbabilities ? (
        <div
          data-testid="signal-probabilities-card"
          style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Signal Probabilities</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 12, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Buy %</div>
              <div style={{ fontSize: 14 }}>{((signalProbabilities.probabilityBuy ?? 0) * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Sell %</div>
              <div style={{ fontSize: 14 }}>{((signalProbabilities.probabilitySell ?? 0) * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Neutral %</div>
              <div style={{ fontSize: 14 }}>{((signalProbabilities.probabilityNeutral ?? 0) * 100).toFixed(1)}%</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)", fontStyle: "italic" }}>
            {signalProbabilities.interpretation ?? ""}
          </div>
        </div>
      ) : null}

      {symbolProbabilities && symbolProbabilities.length > 0 ? (
        <div
          data-testid="symbol-probabilities-card"
          style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Symbol Probabilities</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {symbolProbabilities.map((p) => (
              <div
                key={p.symbol}
                style={{ padding: 10, border: "1px solid rgba(15, 23, 42, 0.08)", borderRadius: 8 }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{p.symbol}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Buy %</div>
                    <div style={{ fontSize: 13 }}>{((p.probabilityBuy ?? 0) * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Sell %</div>
                    <div style={{ fontSize: 13 }}>{((p.probabilitySell ?? 0) * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.55)" }}>Neutral %</div>
                    <div style={{ fontSize: 13 }}>{((p.probabilityNeutral ?? 0) * 100).toFixed(1)}%</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)", fontStyle: "italic" }}>
                  {p.interpretation ?? ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {watchlistCandidates && watchlistCandidates.length > 0 ? (
        <div
          data-testid="watchlist-candidates-card"
          style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Watchlist Candidates</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {watchlistCandidates.map((c) => (
              <div
                key={c.symbol}
                style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: 10, border: "1px solid rgba(15, 23, 42, 0.08)", borderRadius: 8 }}
              >
                <span style={{ fontWeight: 600, fontSize: 13, minWidth: 48 }}>{c.symbol}</span>
                <span style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)" }}>{c.status}</span>
                <span style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)" }}>{(c.score * 100).toFixed(0)}%</span>
                <span style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.75)", flex: 1 }}>{c.reason}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tradeSetups && tradeSetups.length > 0 ? (
        <div
          data-testid="trade-setups-card"
          style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Trade Setups</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tradeSetups.map((s) => (
              <div
                key={s.symbol}
                style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: 10, border: "1px solid rgba(15, 23, 42, 0.08)", borderRadius: 8 }}
              >
                <span style={{ fontWeight: 600, fontSize: 13, minWidth: 48 }}>{s.symbol}</span>
                <span style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)" }}>{s.status}</span>
                <span style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)" }}>{(s.confidence * 100).toFixed(0)}%</span>
                <span style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.75)", flex: 1 }}>{s.reason}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {crowdDivergence && crowdDivergence.length > 0 ? (
        <div
          data-testid="crowd-divergence-card"
          style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Crowd Divergence</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {crowdDivergence.map((d) => (
              <div
                key={d.symbol}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 12,
                  padding: 10,
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                  borderRadius: 8,
                  opacity: d.type === "NONE" ? 0.7 : 1,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13, minWidth: 48 }}>{d.symbol}</span>
                <span style={{ fontSize: 11, color: d.type === "NONE" ? "rgba(15, 23, 42, 0.5)" : "rgba(15, 23, 42, 0.6)" }}>{d.type}</span>
                <span style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)" }}>{(d.strength * 100).toFixed(0)}%</span>
                <span style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)" }}>mom: {(d.momentum * 100).toFixed(2)}%</span>
                <span style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)" }}>bias: {(d.crowdBias * 100).toFixed(1)}%</span>
                <span style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.75)", flex: 1 }}>{d.reason}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {crowdAcceleration && crowdAcceleration.length > 0 ? (
        <div
          data-testid="crowd-acceleration-card"
          style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Crowd Acceleration</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {crowdAcceleration.map((a) => (
              <div
                key={a.symbol}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 12,
                  padding: 10,
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                  borderRadius: 8,
                  opacity: a.type === "NONE" ? 0.7 : 1,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13, minWidth: 48 }}>{a.symbol}</span>
                <span style={{ fontSize: 11, color: a.type === "NONE" ? "rgba(15, 23, 42, 0.5)" : "rgba(15, 23, 42, 0.6)" }}>{a.type}</span>
                <span style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)" }}>{(a.strength * 100).toFixed(0)}%</span>
                <span style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)" }}>vel: {(a.velocity * 100).toFixed(2)}%</span>
                <span style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.75)", flex: 1 }}>{a.reason}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div
        data-testid="forecast-accuracy-panel"
        style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 24 }}
      >
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Forecast Accuracy</div>
        {forecastAccuracy?.items && forecastAccuracy.items.length > 0 ? (
          forecastAccuracy.items.map((item) => {
            const o = item.overall.accuracyRate;
            const ab = item.baselines.alwaysBuy.accuracyRate;
            const rnd = item.baselines.random.accuracyRate;
            const best =
              o >= ab && o >= rnd ? "Crowd" : ab >= rnd ? "Always-buy" : "Random";
            const fmt = (rate: number, total: number, correct: number) =>
              `${(rate * 100).toFixed(1)}% (${correct}/${total})`;
            return (
              <div
                key={item.assetSymbol}
                style={{
                  marginBottom: 16,
                  padding: 12,
                  background: "rgba(15, 23, 42, 0.02)",
                  borderRadius: 8,
                  border: "1px solid rgba(15, 23, 42, 0.06)",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Asset: {item.assetSymbol}</div>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  Overall: {fmt(item.overall.accuracyRate, item.overall.totalEvaluations, item.overall.correctCount)}
                </div>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  Rolling-10: {fmt(item.rolling10.accuracyRate, item.rolling10.totalEvaluations, item.rolling10.correctCount)}
                </div>
                <div style={{ fontSize: 13, marginBottom: 4 }}>Baselines:</div>
                <div style={{ fontSize: 12, marginLeft: 12, marginBottom: 2 }}>
                  Always-buy: {fmt(item.baselines.alwaysBuy.accuracyRate, item.baselines.alwaysBuy.totalEvaluations, item.baselines.alwaysBuy.correctCount)}
                </div>
                <div style={{ fontSize: 12, marginLeft: 12, marginBottom: 4 }}>
                  Random: {fmt(item.baselines.random.accuracyRate, item.baselines.random.totalEvaluations, item.baselines.random.correctCount)}
                </div>
                <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.6)", fontStyle: "italic" }}>
                  Best: {best}
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ fontSize: 13, color: "rgba(15, 23, 42, 0.55)" }}>No accuracy data yet</div>
        )}
      </div>

      <div style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Stability Watchlist</div>
        <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)", marginBottom: 8 }}>
          Computed across variants (seeds) per run. Use Compare seeds to inspect divergences.
        </div>
        <div className="mb-3">
          <StabilityLegend />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: "rgba(254, 226, 226, 0.9)", color: "#991b1b", fontWeight: 500 }}>
            Unstable: {counts.unstable}
          </span>
          <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: "rgba(254, 243, 199, 0.9)", color: "#92400e", fontWeight: 500 }}>
            Diverging: {counts.diverging}
          </span>
          <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: "rgba(220, 252, 231, 0.9)", color: "#166534", fontWeight: 500 }}>
            OK: {counts.ok}
          </span>
          <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: "rgba(243, 244, 246, 0.9)", color: "#374151", fontWeight: 500 }}>
            Legacy: {counts.legacy}
          </span>
          <span style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.6)" }}>Showing: {filterLabel}</span>
          {initialQuery.sortByRisk ? (
            <span style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)", fontStyle: "italic" }}>Sorted by risk</span>
          ) : null}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(15, 23, 42, 0.6)",
            marginBottom: 12,
            padding: "8px 12px",
            background: "rgba(15, 23, 42, 0.03)",
            borderRadius: 8,
            border: "1px solid rgba(15, 23, 42, 0.06)",
          }}
        >
          <div>OK &lt; 40, DIVERGING 40–69, UNSTABLE ≥ 70</div>
          <div style={{ marginTop: 4 }}>SIGN disagreement dominates; CORR spread ≥0.30 and ACC std dev ≥3% increase risk</div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Run</th>
                <th className={styles.num}>Score</th>
                <th>Band</th>
                <th>Cause</th>
                <th>Reason</th>
                <th className={styles.num}>Seeds</th>
                <th className={styles.num}>
                  <HeaderWithTip label="Corr spread" tip="Max(corr) - Min(corr) across seeds. Higher => less stable." />
                </th>
                <th className={styles.num}>
                  <HeaderWithTip label="Sign agreement" tip="Fraction of seeds that agree on direction. Lower => instability." />
                </th>
                <th className={styles.num}>
                  <HeaderWithTip label="Acc std dev" tip="Std deviation of accuracy across seeds. Higher => less stable." />
                </th>
                <th className={styles.num}>Risk</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {stabilityWithRisk.map((r, i) => {
                const corrSpread = r.corrSpread;
                const signAgreementRate = r.signAgreementRate;
                const accStdDev = r.accStdDev;

                const corrSpreadTone =
                  corrSpread != null
                    ? corrSpread >= DASH_THRESHOLDS.corrSpreadHigh
                      ? "bad"
                      : corrSpread >= DASH_THRESHOLDS.corrSpreadWarn
                        ? "warn"
                        : "good"
                    : "neutral";
                const signAgreementTone =
                  signAgreementRate != null
                    ? signAgreementRate < DASH_THRESHOLDS.signAgreementWarn
                      ? "bad"
                      : "good"
                    : "neutral";
                const accStdDevTone =
                  accStdDev != null
                    ? accStdDev >= 0.05
                      ? "bad"
                      : accStdDev >= DASH_THRESHOLDS.accStdDevWarn
                        ? "warn"
                        : "good"
                    : "neutral";

                const corrWidth = corrSpread != null ? normToP95(corrSpread, p95CorrSpread) / 100 : 0;
                const accWidth = accStdDev != null ? normToP95(accStdDev, p95AccStdDev) / 100 : 0;
                const signWidth = signAgreementRate != null ? clamp01(signAgreementRate) : 0;

                return (
                  <tr
                    key={r.runId}
                    className={`${rowBgClass(r.band, i)} ${styles.clickable}`}
                    onClick={() => openRunDetailsDrawer(r.runId)}
                  >
                    <td>
                      <span className="font-mono text-xs">{r.runId.slice(0, 6)}…{r.runId.slice(-4)}</span>
                    </td>
                    <td className={styles.num} style={{ fontWeight: 600 }}>{r.score}</td>
                    <td>
                      <Badge kind={badgeKind(r.band)} text={r.band} />
                    </td>
                    <td style={{ fontSize: 12 }}>{r.cause}</td>
                    <td className="max-w-[280px] truncate text-slate-600 text-xs" title={r.reason}>
                      {r.reason}
                    </td>
                    <td className={styles.num}>{r.seeds ?? r.variants}</td>
                    <td>
                      {corrSpread != null ? (
                        <MiniBar
                          value01={corrWidth}
                          label={fmtNum(corrSpread, 4)}
                          title="corrSpread: higher means seeds disagree more"
                          tone={corrSpreadTone}
                        />
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td>
                      {signAgreementRate != null ? (
                        <MiniBar
                          value01={signWidth}
                          label={fmtPct01(signAgreementRate, 0)}
                          title="signAgreementRate: 1.0 = all seeds agree"
                          tone={signAgreementTone}
                        />
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td>
                      {accStdDev != null ? (
                        <MiniBar
                          value01={accWidth}
                          label={fmtPct01(accStdDev, 2)}
                          title="accStdDev: std dev across seeds"
                          tone={accStdDevTone}
                        />
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td data-testid="risk-cell" className={styles.num}>
                      <span
                        className={
                          (r.riskScore ?? 0) > 70
                            ? styles.riskHigh
                            : (r.riskScore ?? 0) > 40
                              ? styles.riskMedium
                              : styles.riskLow
                        }
                      >
                        {r.riskScore ?? 0}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/runs/${r.runId}/compare?assetSymbol=${encodeURIComponent(assetSymbol)}`}
                        className={styles.actionLink}
                      >
                        Compare seeds
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {stabilityWithRisk.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: 24, color: "rgba(15, 23, 42, 0.55)" }}>
                    No stability rows for this asset / filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
        </div>
      </div>

      {drawerRunId && (
        <>
          <div className={styles.drawerBackdrop} onClick={closeRunDetailsDrawer} aria-hidden />
          <div data-testid="run-details-drawer" className={styles.drawer} role="dialog" aria-label="Run details">
            <div className={styles.drawerHeader}>
              <h2 data-testid="run-details-title" className={styles.drawerTitle}>Run details</h2>
              <button type="button" data-testid="run-details-close" className={styles.drawerClose} onClick={closeRunDetailsDrawer} aria-label="Close">
                ×
              </button>
            </div>
            <div className={styles.drawerBody}>
              {drawerRun ? (
                <>
              <div className={styles.drawerRow} data-testid="drawer-row-runId">
                <div className={styles.drawerLabel}>Run ID</div>
                <div className={styles.drawerValue} data-testid="drawer-value-runId">{drawerRun.runId}</div>
              </div>
              <div className={styles.drawerRow} data-testid="drawer-row-asset">
                <div className={styles.drawerLabel}>Asset</div>
                <div className={styles.drawerValue} data-testid="drawer-value-asset">{assetSymbol}</div>
              </div>
              <div className={styles.drawerRow} data-testid="drawer-row-seeds">
                <div className={styles.drawerLabel}>Seeds / Variants</div>
                <div className={styles.drawerValue} data-testid="drawer-value-seeds">
                  {"seeds" in drawerRun.row ? (drawerRun.row.seeds ?? drawerRun.row.variants) : drawerRun.row.variants}
                </div>
              </div>
              {drawerRunMetadata && (
                <div className={styles.drawerRow} data-testid="drawer-row-run-config">
                  <div className={styles.drawerLabel}>Run configuration</div>
                  <div className={styles.drawerValue} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span><strong>Dataset:</strong> {drawerRunMetadata.datasetVersion}</span>
                    <span><strong>Strategy:</strong> {drawerRunMetadata.strategyProfile}</span>
                    <span><strong>Aggregation:</strong> {drawerRunMetadata.aggregationMode}</span>
                    <span><strong>Selection:</strong> {drawerRunMetadata.selectionPolicy}</span>
                    <span><strong>Seed:</strong> {drawerRunMetadata.simulationSeed}</span>
                    <span><strong>Model:</strong> {drawerRunMetadata.modelVersion}</span>
                  </div>
                </div>
              )}
              {drawerRun.type === "scaling" && (
                <div className={styles.drawerRow}>
                  <div className={styles.drawerLabel}>Overhead breakdown</div>
                  <div className={styles.drawerValue} style={{ fontFamily: "inherit" }}>
                    <ScalingDetails row={drawerRun.row as ScalingRow} assetSymbol={assetSymbol} />
                    {!((drawerRun.row as ScalingRow).isLegacyTiming) && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(15, 23, 42, 0.55)",
                          padding: "8px 10px",
                          background: "rgba(15, 23, 42, 0.04)",
                          borderRadius: 6,
                          border: "1px solid rgba(15, 23, 42, 0.08)",
                          marginTop: 12,
                        }}
                      >
                        High overhead often indicates fixed setup costs dominating short runs; compare with larger agent counts.
                      </div>
                    )}
                  </div>
                </div>
              )}
              {drawerRun.type === "stability" && (
                <>
                  <div className={styles.drawerRow}>
                    <div className={styles.drawerLabel}>Label</div>
                    <div className={styles.drawerValue}>{(drawerRun.row as StabilityRow).label}</div>
                  </div>
                  <div className={styles.drawerRow}>
                    <div className={styles.drawerLabel}>Corr spread</div>
                    <div className={styles.drawerValue}>
                      {(drawerRun.row as StabilityRow).corrSpread != null
                        ? fmtNum((drawerRun.row as StabilityRow).corrSpread!, 4)
                        : "—"}
                    </div>
                  </div>
                  <div className={styles.drawerRow}>
                    <div className={styles.drawerLabel}>Sign agreement</div>
                    <div className={styles.drawerValue}>
                      {(drawerRun.row as StabilityRow).signAgreementRate != null
                        ? fmtPct01((drawerRun.row as StabilityRow).signAgreementRate!, 0)
                        : "—"}
                    </div>
                  </div>
                  <div className={styles.drawerRow}>
                    <div className={styles.drawerLabel}>Acc std dev</div>
                    <div className={styles.drawerValue}>
                      {(drawerRun.row as StabilityRow).accStdDev != null
                        ? fmtPct01((drawerRun.row as StabilityRow).accStdDev!, 2)
                        : "—"}
                    </div>
                  </div>
                </>
              )}
              <div className={styles.drawerActions}>
                <Link href={`/runs/${drawerRun.runId}`} className={styles.actionLink}>
                  Open run
                </Link>
                <Link
                  href={`/runs/${drawerRun.runId}/compare?assetSymbol=${encodeURIComponent(assetSymbol)}`}
                  className={styles.actionLink}
                >
                  Compare seeds
                </Link>
              </div>
                </>
              ) : (
                <div className={styles.drawerRow}>
                  <div className={styles.drawerLabel}>Run ID</div>
                  <div className={styles.drawerValue}>{drawerRunId}</div>
                  <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.6)", marginTop: 8 }}>Loading run details…</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {isFilterLoading && (
        <div
          data-testid="dashboard-filter-loading"
          role="status"
          aria-live="polite"
          aria-busy="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.32)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "320px",
              maxWidth: "calc(100vw - 32px)",
              background: "#ffffff",
              border: "1px solid #d1d5db",
              borderRadius: "14px",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
              padding: "24px 28px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "999px",
                border: "3px solid #cbd5e1",
                borderTopColor: "#111827",
                animation: "dashboardSpin 0.8s linear infinite",
              }}
            />
            <div
              style={{
                fontSize: "16px",
                lineHeight: 1.4,
                fontWeight: 600,
                color: "#111827",
                textAlign: "center",
              }}
            >
              Analyzing market signals...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
