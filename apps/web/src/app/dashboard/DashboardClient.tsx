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

export function DashboardClient({ initialData, initialQuery }: DashboardClientProps) {
  const { consensus, scaling, stability, counts, filterLabel, latest, latestScalingRow, driftAsset: initialDriftAsset, driftGlobal: initialDriftGlobal, forecastAccuracy } = initialData;
  const { assetSymbol } = initialQuery;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [drawerRun, setDrawerRun] = useState<{
    runId: string;
    type: "scaling" | "stability";
    row: ScalingRow | StabilityRow;
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

  useEffect(() => {
    if (initialDriftAsset != null) setDriftAsset(initialDriftAsset);
    if (initialDriftGlobal != null) setDriftGlobal(initialDriftGlobal);
  }, [initialDriftAsset, initialDriftGlobal]);

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

  const drawerRunId = searchParams.get("drawerRunId");

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
                      <td colSpan={11} style={{ padding: 0, verticalAlign: "top" }}>
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
                  <td colSpan={11} style={{ padding: 24, color: "rgba(15, 23, 42, 0.55)" }}>
                    {showOverheadOutliersOnly ? "No overhead outliers (≥5%) in this set." : "No completed runs found."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <CrowdConsensus data={consensus} />

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
