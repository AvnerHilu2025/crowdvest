import React, { Suspense } from "react";
import {
  DashboardClient,
  type DashboardActiveVariantOption,
  type DashboardCrowdStateEnvelope,
  type DashboardCrowdStateRecommendation,
  type DashboardLatestRunInfoEvent,
  type DashboardRunPerformance,
} from "./DashboardClient";
import { getWebBase } from "@/lib/web-base";
import { stabilityReason } from "@/lib/risk";
import { stabilityRiskScore, riskBand, stabilityCause } from "@/lib/stability-triage";
import type { TradeDirectionDivergenceExplanation } from "@/components/dashboard/crowd-intelligence-types";

export const dynamic = "force-dynamic";

const DASHBOARD_INFO_EVENTS_CAP = 20;

function parseInfoEventsFromApi(json: unknown): DashboardLatestRunInfoEvent[] {
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

/** Deterministic: higher `reach` first, then higher `step`. */
function capHighImpactInfoEvents(rows: DashboardLatestRunInfoEvent[]): DashboardLatestRunInfoEvent[] {
  const sorted = [...rows].sort((a, b) => {
    const r = b.reach - a.reach;
    if (r !== 0) return r;
    return b.step - a.step;
  });
  return sorted.slice(0, DASHBOARD_INFO_EVENTS_CAP);
}

function parseCrowdState(json: unknown): DashboardCrowdStateEnvelope | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const rec = o.recommendation;
  if (!rec || typeof rec !== "object") return null;
  const r = rec as Record<string, unknown>;
  if (typeof r.explanation !== "string") return null;
  const dir = r.direction;
  if (dir !== "bullish" && dir !== "bearish" && dir !== "neutral") return null;
  if (
    typeof r.strength !== "number" ||
    !Number.isFinite(r.strength) ||
    typeof r.confidence !== "number" ||
    !Number.isFinite(r.confidence) ||
    typeof r.stability !== "number" ||
    !Number.isFinite(r.stability)
  ) {
    return null;
  }
  return {
    runVariantId: typeof o.runVariantId === "string" ? o.runVariantId : null,
    isActiveVariant: o.isActiveVariant === true,
    recommendation: {
      direction: dir,
      strength: r.strength,
      confidence: r.confidence,
      stability: r.stability,
      explanation: r.explanation,
    },
  };
}

function finiteNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function parseDashboardRunPerformance(json: unknown): DashboardRunPerformance | undefined {
  if (!json || typeof json !== "object") return undefined;
  const o = json as Record<string, unknown>;
  if (typeof o.runId !== "string" || o.runId.trim() === "") return undefined;
  if (!("hitRate" in o)) return undefined;
  let hitRate: number | null;
  if (o.hitRate === null) hitRate = null;
  else {
    const hr = finiteNumber(o.hitRate);
    if (hr === undefined) return undefined;
    hitRate = hr;
  }

  const byAssetOut: NonNullable<DashboardRunPerformance["byAsset"]> = [];
  const raw = o.byAsset;
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      if (typeof r.assetSymbol !== "string" || r.assetSymbol.trim() === "") continue;
      const accuracyRate = finiteNumber(r.accuracyRate);
      if (accuracyRate === undefined) continue;
      const totalEvaluationsRaw = finiteNumber(r.totalEvaluations);
      const correctCountRaw = finiteNumber(r.correctCount);
      byAssetOut.push({
        assetSymbol: r.assetSymbol.trim(),
        totalEvaluations: totalEvaluationsRaw !== undefined ? Math.trunc(totalEvaluationsRaw) : 0,
        correctCount: correctCountRaw !== undefined ? Math.trunc(correctCountRaw) : 0,
        accuracyRate,
        buyAccuracy: finiteNumber(r.buyAccuracy) ?? null,
        sellAccuracy: finiteNumber(r.sellAccuracy) ?? null,
        holdAccuracy: finiteNumber(r.holdAccuracy) ?? null,
      });
    }
  }

  return {
    runId: o.runId.trim(),
    hitRate,
    byAsset: byAssetOut.length > 0 ? byAssetOut : undefined,
  };
}

type DashboardSummary = {
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
    runDurationMs: number | null;
  } | null;
  scalingRows: Array<{
    runId: string;
    stabilityBand?: "OK" | "DIVERGING" | "UNSTABLE" | "LEGACY" | null;
    stabilityScore?: number | null;
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
  }>;
  stabilityRows: Array<{
    runId: string;
    agents: number;
    variants: number;
    seeds?: number;
    steps: number;
    corrSpread: number | null;
    corrStdDev: number | null;
    accStdDev: number | null;
    signAgreementRate: number | null;
    label: string;
  }>;
  driftAsset?: {
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
  driftGlobal?: {
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
  directionBiasByAgentType?: {
    trendFollower: { avgSignal: number; positiveCount: number; negativeCount: number; neutralCount?: number };
    contrarian: { avgSignal: number; positiveCount: number; negativeCount: number; neutralCount?: number };
    balanced: { avgSignal: number; positiveCount: number; negativeCount: number; neutralCount?: number };
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
  informationExposureDiagnostics?: {
    avgTechnicalWeight: number;
    avgMacroWeight: number;
    avgSentimentWeight: number;
    avgNoiseWeight: number;
    sampleAgents: unknown[];
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
  tradeDirectionDiagnostics?: {
    executedLongTrades: number;
    executedShortTrades: number;
    longShare: number | null;
    shortShare: number | null;
    sampleTradeDirections?: unknown[];
  };
  tradeDirectionDiagnosticsCrowd?: {
    runId: string | null;
    assetSymbol: string;
    executedLongTrades: number;
    executedShortTrades: number;
    longShare: number | null;
    shortShare: number | null;
  };
  tradeDirectionDivergence?: {
    divergence: number | null;
    directionAgreement: boolean | null;
  };
  tradeDirectionDivergenceExplanation?: TradeDirectionDivergenceExplanation | null;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const assetSymbol = (Array.isArray(sp.assetSymbol) ? sp.assetSymbol[0] : sp.assetSymbol) || "SPY";
  const topNParam = (Array.isArray(sp.topN) ? sp.topN[0] : sp.topN) || "50";
  const topN = ["10", "25", "50", "100"].includes(topNParam) ? topNParam : "50";
  const topNNum = parseInt(topN, 10);
  const unstableOnly = ((Array.isArray(sp.unstableOnly) ? sp.unstableOnly[0] : sp.unstableOnly) ?? "1") === "1";
  const showLegacy = ((Array.isArray(sp.showLegacy) ? sp.showLegacy[0] : sp.showLegacy) ?? "0") === "1";
  const sortByRisk = ((Array.isArray(sp.sortRisk) ? sp.sortRisk[0] : sp.sortRisk) ?? "1") === "1";
  const requestedRunVariantIdRaw = Array.isArray(sp.runVariantId) ? sp.runVariantId[0] : sp.runVariantId;
  const requestedRunVariantId =
    typeof requestedRunVariantIdRaw === "string" && requestedRunVariantIdRaw.trim() !== ""
      ? requestedRunVariantIdRaw.trim()
      : null;

  const WEB_BASE = getWebBase();
  const url = `${WEB_BASE}/api/dashboard/summary?limit=${topNNum}&assetSymbol=${encodeURIComponent(assetSymbol)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return (
      <div data-testid="dashboard-root" className="w-full px-6 py-6 xl:px-10">
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Dashboard</h1>
        <p style={{ marginTop: 16, color: "#dc2626" }}>Failed to load dashboard. Check that the API is running.</p>
      </div>
    );
  }
  const data = (await res.json()) as DashboardSummary;

  const scalingRows = data.scalingRows ?? [];
  const stabilityRows = data.stabilityRows ?? [];
  const latestRun = data.latestRun;
  const latestScalingRow = latestRun
    ? scalingRows.find((r) => r.runId === latestRun.id)
    : null;
  const latest = latestScalingRow ?? latestRun;

  let latestRunInfoEvents: DashboardLatestRunInfoEvent[] | undefined;
  let latestRunCrowdStateRecommendation: DashboardCrowdStateRecommendation | null | undefined;
  let latestRunCrowdStateEnvelope: DashboardCrowdStateEnvelope | null | undefined;
  let initialVariantOptions: DashboardActiveVariantOption[] = [];
  let latestRunPerformance: DashboardRunPerformance | undefined;
  if (latestRun?.id) {
    const apiBase = process.env.API_BASE_URL ?? "http://localhost:4001";
    const runId = latestRun.id;
    try {
      const variantsRes = await fetch(
        `${apiBase}/runs/${runId}/variants?assetSymbol=${encodeURIComponent(assetSymbol)}&limit=200`,
        { cache: "no-store", headers: { accept: "application/json" } },
      );
      let activeVariantId: string | null = null;
      if (variantsRes.ok) {
        const variantsJson = (await variantsRes.json()) as {
          items?: Array<{ id: string; seed: number; label: string | null; completedAt: string | null; createdAt: string }>;
        };
        const rawItems = Array.isArray(variantsJson.items) ? variantsJson.items : [];
        const items = rawItems
          .filter((it) => typeof it.id === "string" && it.id.trim() !== "")
          .sort((a, b) => {
            const at = Date.parse(a.completedAt ?? a.createdAt ?? "");
            const bt = Date.parse(b.completedAt ?? b.createdAt ?? "");
            return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
          });
        initialVariantOptions = items.map((it) => ({
          id: it.id,
          seed: it.seed,
          label: it.label,
        }));
        const requestedExists =
          requestedRunVariantId != null &&
          initialVariantOptions.some((v) => v.id === requestedRunVariantId);
        activeVariantId = requestedExists
          ? requestedRunVariantId
          : initialVariantOptions[0]?.id ?? null;
      }

      const [evRes, csRes, perfRes] = await Promise.all([
        fetch(
          `${apiBase}/runs/${runId}/info-events?assetSymbol=${encodeURIComponent(assetSymbol)}`,
          { cache: "no-store", headers: { accept: "application/json" } },
        ),
        fetch(
          `${apiBase}/results/crowd-state?runId=${encodeURIComponent(runId)}&assetSymbol=${encodeURIComponent(assetSymbol)}${
            activeVariantId ? `&runVariantId=${encodeURIComponent(activeVariantId)}` : ""
          }`,
          { cache: "no-store", headers: { accept: "application/json" } },
        ),
        fetch(`${apiBase}/runs/${runId}/performance`, {
          cache: "no-store",
          headers: { accept: "application/json" },
        }),
      ]);
      if (evRes.ok) {
        const raw: unknown = await evRes.json();
        const parsed = parseInfoEventsFromApi(raw);
        latestRunInfoEvents = capHighImpactInfoEvents(parsed);
      }
      if (csRes.ok) {
        const cs: unknown = await csRes.json();
        latestRunCrowdStateEnvelope = parseCrowdState(cs);
        latestRunCrowdStateRecommendation = latestRunCrowdStateEnvelope?.recommendation ?? null;
      }
      if (perfRes.ok) {
        const perfJson: unknown = await perfRes.json();
        latestRunPerformance = parseDashboardRunPerformance(perfJson);
      }
    } catch {
      /* leave undefined — API unreachable or parse edge case */
    }
  }

  const stabilityMapped = stabilityRows.map((r) => {
    const isLegacy = r.label === "missing-variants";
    const score = stabilityRiskScore({
      isLegacyTiming: isLegacy,
      label: r.label,
      corrSpread: r.corrSpread,
      accStdDev: r.accStdDev,
      signAgreementRate: r.signAgreementRate,
    });
    const band = isLegacy ? "LEGACY" : riskBand(score);
    const cause = stabilityCause({
      isLegacyTiming: isLegacy,
      label: r.label,
      corrSpread: r.corrSpread,
      accStdDev: r.accStdDev,
      signAgreementRate: r.signAgreementRate,
    });
    const reason = stabilityReason({
      label: r.label,
      corrSpread: r.corrSpread,
      accStdDev: r.accStdDev,
      signAgreementRate: r.signAgreementRate,
    });
    return { ...r, score, band, cause, reason };
  });

  const counts = {
    unstable: stabilityMapped.filter((r) => r.band === "UNSTABLE").length,
    diverging: stabilityMapped.filter((r) => r.band === "DIVERGING").length,
    ok: stabilityMapped.filter((r) => r.band === "OK").length,
    legacy: stabilityMapped.filter((r) => r.band === "LEGACY").length,
  };

  const stabilityDecorated = stabilityMapped
    .filter((r) => {
      if (!showLegacy && r.cause === "LEGACY") return false;
      if (!unstableOnly) return true;
      return r.band === "UNSTABLE" || r.band === "DIVERGING";
    })
    .sort((a, b) => {
      if (!sortByRisk) return 0;
      if (b.score !== a.score) return b.score - a.score;
      const csA = a.corrSpread ?? 0;
      const csB = b.corrSpread ?? 0;
      return csB - csA;
    });

  const filterLabel = unstableOnly ? "unstable/diverging" : "all";

  return (
    <Suspense
      fallback={
        <div data-testid="dashboard-root" className="w-full px-6 py-6 xl:px-10">
          Loading dashboard…
        </div>
      }
    >
      <DashboardClient
        initialData={{
        consensus: data.consensus,
        directionBiasByAgentType: data.directionBiasByAgentType,
        scaling: data.scalingRows,
        stability: stabilityDecorated,
        counts,
        filterLabel,
        latest,
        latestScalingRow: latestScalingRow ?? null,
        driftAsset: data.driftAsset ?? null,
        driftGlobal: data.driftGlobal ?? null,
        forecastAccuracy: data.forecastAccuracy ?? { runId: null, items: [] },
        productionAggregationMode: data.productionAggregationMode ?? null,
        aggregationModeRanking: data.aggregationModeRanking ?? [],
        strategyProfile: data.strategyProfile ?? {
          key: "conservative",
          name: "Conservative",
          aggregationMode: "top_20pct_only",
          selectionPolicy: "top_20pct_agents",
          intendedUse: "production",
        },
        strategyDefaults: data.strategyDefaults ?? {
          benchmarkDefaults: { aggregationMode: "top_20pct_only", selectionPolicy: "top_20pct_agents", symbols: ["SPY", "QQQ", "IWM"], windows: [29, 60, 120], n: 20 },
          runDefaults: { aggregationMode: "top_20pct_only", selectionPolicy: "top_20pct_agents", assetSymbols: ["SPY", "QQQ", "IWM"], points: 29 },
        },
        executionPreset: data.executionPreset ?? {
          runPreset: { assetSymbols: ["SPY", "QQQ", "IWM"], points: 29, aggregationMode: "top_20pct_only", selectionPolicy: "top_20pct_agents" },
          benchmarkPreset: { symbols: ["SPY", "QQQ", "IWM"], windows: [29, 60, 120], n: 20, aggregationMode: "top_20pct_only", selectionPolicy: "top_20pct_agents", baselineTag: "baseline-top20-v1" },
        },
        launchPlan: data.launchPlan ?? {
          runPlan: { endpoint: "/runs/import/prices", method: "POST", params: { symbols: ["SPY", "QQQ", "IWM"], points: 29 }, resolved: { aggregationMode: "top_20pct_only", selectionPolicy: "top_20pct_agents" } },
          benchmarkPlan: { endpoint: "/bench/windows/run-and-compare", method: "POST", params: { symbols: ["SPY", "QQQ", "IWM"], windows: [29, 60, 120], n: 20, aggregationMode: "top_20pct_only", baselineTag: "baseline-top20-v1" }, resolved: { aggregationMode: "top_20pct_only", selectionPolicy: "top_20pct_agents", baselineTag: "baseline-top20-v1" } },
          governance: { baselineFamilyTag: "baseline-top20-v1", candidateMode: "top_20pct_only", recommendedMode: "top_20pct_only", notes: ["Launch plan fallback."] },
        },
        crowdSignals:
          data.crowdSignals && typeof data.crowdSignals === "object" && Array.isArray(data.crowdSignals.items)
            ? data.crowdSignals
            : { window: 20, items: [] },
        signalValidation:
          data.signalValidation && typeof data.signalValidation === "object"
            ? data.signalValidation
            : { total: 0, validated: 0, accuracyRate: null, latestItems: [] },
        signalHistoryStats:
          data.signalHistoryStats && typeof data.signalHistoryStats === "object"
            ? data.signalHistoryStats
            : undefined,
        signalCoverage:
          data.signalCoverage && typeof data.signalCoverage === "object"
            ? data.signalCoverage
            : undefined,
        marketRegime:
          data.marketRegime && typeof data.marketRegime === "object"
            ? data.marketRegime
            : undefined,
        marketTransition:
          data.marketTransition && typeof data.marketTransition === "object"
            ? data.marketTransition
            : undefined,
        marketStress:
          data.marketStress && typeof data.marketStress === "object"
            ? data.marketStress
            : undefined,
        marketAlerts:
          Array.isArray(data.marketAlerts) ? data.marketAlerts : [],
        signalProbabilities:
          data.signalProbabilities && typeof data.signalProbabilities === "object"
            ? data.signalProbabilities
            : undefined,
        watchlistCandidates:
          Array.isArray(data.watchlistCandidates) ? data.watchlistCandidates : [],
        symbolProbabilities:
          Array.isArray(data.symbolProbabilities) ? data.symbolProbabilities : [],
        tradeSetups:
          Array.isArray(data.tradeSetups) ? data.tradeSetups : [],
        crowdDivergence:
          Array.isArray(data.crowdDivergence) ? data.crowdDivergence : [],
        crowdAcceleration:
          Array.isArray(data.crowdAcceleration) ? data.crowdAcceleration : [],
        crowdConfidence:
          data.crowdConfidence && typeof data.crowdConfidence === "object"
            ? data.crowdConfidence
            : undefined,
        signalValidationMetrics:
          data.signalValidationMetrics && typeof data.signalValidationMetrics === "object"
            ? data.signalValidationMetrics
            : undefined,
        backtestMetrics:
          data.backtestMetrics && typeof data.backtestMetrics === "object"
            ? data.backtestMetrics
            : undefined,
        backtestDiagnostics:
          data.backtestDiagnostics && typeof data.backtestDiagnostics === "object"
            ? data.backtestDiagnostics
            : undefined,
        strategyComparisonSummaryAudit:
          data.strategyComparisonSummaryAudit && typeof data.strategyComparisonSummaryAudit === "object"
            ? data.strategyComparisonSummaryAudit
            : undefined,
        decisionFunnelDiagnostics:
          data.decisionFunnelDiagnostics != null && typeof data.decisionFunnelDiagnostics === "object"
            ? data.decisionFunnelDiagnostics
            : undefined,
        informationExposureDiagnostics:
          data.informationExposureDiagnostics != null && typeof data.informationExposureDiagnostics === "object"
            ? data.informationExposureDiagnostics
            : undefined,
        directionBiasDiagnostics:
          data.directionBiasDiagnostics != null && typeof data.directionBiasDiagnostics === "object"
            ? data.directionBiasDiagnostics
            : undefined,
        tradeDirectionDiagnostics: data.tradeDirectionDiagnostics,
        tradeDirectionDiagnosticsCrowd: data.tradeDirectionDiagnosticsCrowd,
        tradeDirectionDivergence: data.tradeDirectionDivergence,
        tradeDirectionDivergenceExplanation: data.tradeDirectionDivergenceExplanation,
        latestRunInfoEvents,
        latestRunCrowdStateRecommendation,
        latestRunCrowdStateEnvelope,
        initialVariantOptions,
        performance: latestRunPerformance,
      }}
      initialQuery={{
        assetSymbol,
        topN,
        showOnlyUnstable: unstableOnly,
        showLegacy,
        sortByRisk,
      }}
      />
    </Suspense>
  );
}
