"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import DashboardFiltersClient from "@/components/dashboard-filters.client";
import { MiniBar as ScalingMiniBar, Badge } from "@/components/dashboard/mini-bar";
import { MiniBar, HeaderWithTip, StabilityLegend } from "@/components/dashboard/mini";
import { ScalingCurve } from "@/components/dashboard/ScalingCurve";
import { CrowdConsensus } from "@/components/dashboard/CrowdConsensus";
import { ScalingDetails } from "@/components/dashboard/ScalingDetails";
import { p95, normToP95 } from "@/lib/miniBars";
import { DASH_THRESHOLDS, fmtNum, fmtPct01, clamp01, formatOverheadPct } from "@/lib/dashboardThresholds";
import { Sparkline } from "@/components/sparkline";
import styles from "./dashboard.module.css";

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

export type DashboardClientProps = {
  initialData: {
    consensus: {
      buyPct: number;
      sellPct: number;
      holdPct: number;
      majorityPct: number;
      entropy: number;
      polarization: number;
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

  const { consensus, scaling = [], stability = [], counts = { unstable: 0, diverging: 0, ok: 0, legacy: 0 }, filterLabel = "all", latest, latestScalingRow, driftAsset: initialDriftAsset, driftGlobal: initialDriftGlobal, forecastAccuracy, productionAggregationMode, aggregationModeRanking = [], strategyProfile: initialStrategyProfile, strategyDefaults = FALLBACK_STRATEGY_DEFAULTS, executionPreset = FALLBACK_EXECUTION_PRESET, launchPlan = FALLBACK_LAUNCH_PLAN, crowdSignals: rawCrowdSignals, signalValidation: rawSignalValidation, signalHistoryStats, signalCoverage, marketRegime, marketTransition, marketStress, marketAlerts, signalProbabilities, watchlistCandidates, symbolProbabilities, tradeSetups, crowdDivergence, crowdAcceleration, crowdConfidence, signalValidationMetrics, backtestMetrics, backtestDiagnostics } = initialData ?? {};
  const crowdSignals =
    rawCrowdSignals && typeof rawCrowdSignals === "object" && Array.isArray(rawCrowdSignals.items)
      ? rawCrowdSignals
      : { window: 20, items: [] as Array<{ symbol: string; signal: string; confidence: number; disagreement: number; instability: number; runsUsed: number }> };
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
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Dashboard</h1>
        <DashboardFiltersClient
          assetSymbol={initialQuery.assetSymbol}
          topN={initialQuery.topN}
          showOnlyUnstable={initialQuery.showOnlyUnstable}
          showLegacy={initialQuery.showLegacy}
          sortByRisk={initialQuery.sortByRisk}
        />
      </div>

      <div data-testid="legend" className={styles.legend}>
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

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Operational Overview</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          <div style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>Run duration</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              {latest?.runDurationMs != null ? `${(latest.runDurationMs / 1000).toFixed(1)} s (${latest.runDurationMs} ms)` : "—"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.5)", marginTop: 4 }}>Latest completed run</div>
          </div>
          <div style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>Decisions/sec</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              {latestScalingRow?.decisionsPerSec != null ? Math.round(latestScalingRow.decisionsPerSec) : "—"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.5)", marginTop: 4 }}>Throughput</div>
          </div>
          <div style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>Overhead %</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              {formatOverheadPct(latestScalingRow?.overheadPct)}
            </div>
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.5)", marginTop: 4 }}>Run wallclock vs variants</div>
          </div>
          <div style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>Efficiency</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              {latestScalingRow?.efficiencyMsPerDecision != null ? latestScalingRow.efficiencyMsPerDecision.toFixed(4) : "—"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.5)", marginTop: 4 }}>ms per decision</div>
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

      <CrowdConsensus data={consensus} />

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
                <span title="signal strength">{((item.signalStrength ?? 0) * 100).toFixed(1)}%</span>
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
                <span key={sig}>{sig}: {signalCoverage.bySignal[sig] ?? 0}</span>
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
    </div>
  );
}
