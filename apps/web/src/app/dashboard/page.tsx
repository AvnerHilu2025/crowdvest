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
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const assetSymbol = (Array.isArray(sp.assetSymbol) ? sp.assetSymbol[0] : sp.assetSymbol) || "SPY";
  const topNParam = (Array.isArray(sp.topN) ? sp.topN[0] : sp.topN) || "50";
  const topN = ["10", "25", "50"].includes(topNParam) ? topNParam : "50";
  const topNNum = parseInt(topN, 10);
  const unstableOnly = ((Array.isArray(sp.unstableOnly) ? sp.unstableOnly[0] : sp.unstableOnly) ?? "1") === "1";
  const showLegacy = ((Array.isArray(sp.showLegacy) ? sp.showLegacy[0] : sp.showLegacy) ?? "0") === "1";
  const sortByRisk = ((Array.isArray(sp.sortRisk) ? sp.sortRisk[0] : sp.sortRisk) ?? "1") === "1";

  const WEB_BASE = getWebBase();
  const url = `${WEB_BASE}/api/dashboard/summary?limit=${topNNum}&assetSymbol=${encodeURIComponent(assetSymbol)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return (
      <div style={{ maxWidth: 1152, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Dashboard</h1>
        <p style={{ marginTop: 16, color: "#dc2626" }}>Failed to load dashboard. Check that the API is running.</p>
      </div>
    );
  }
  const data = (await res.json()) as DashboardSummary;

  const latestRun = data.latestRun;
  const latestScalingRow = latestRun
    ? data.scalingRows.find((r) => r.runId === latestRun.id)
    : null;
  const latest = latestScalingRow ?? latestRun;

  const stabilityMapped = data.stabilityRows.map((r) => {
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
