import React, { Suspense } from "react";
import { DashboardClient } from "./DashboardClient";
import { getWebBase } from "@/lib/web-base";
import { stabilityReason } from "@/lib/risk";
import { stabilityRiskScore, riskBand, stabilityCause } from "@/lib/stability-triage";

export const dynamic = "force-dynamic";

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
    validated: number;
    accuracyRate: number | null;
    latestItems: Array<{
      symbol: string;
      signal: string;
      realizedDirection: "UP" | "DOWN" | "FLAT" | null;
      correct: boolean | null;
      confidence: number;
    }>;
  };
  signalHistoryStats?: {
    totalSnapshots: number;
    symbolsCovered: number;
  };
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

  const WEB_BASE = getWebBase();
  const url = `${WEB_BASE}/api/dashboard/summary?limit=${topNNum}&assetSymbol=${encodeURIComponent(assetSymbol)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return (
      <div data-testid="dashboard-root" style={{ maxWidth: 1152, margin: "0 auto", padding: "32px 24px" }}>
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
    <Suspense fallback={<div style={{ maxWidth: 1152, margin: "0 auto", padding: "32px 24px" }}>Loading dashboard…</div>}>
      <DashboardClient
        initialData={{
        consensus: data.consensus,
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
