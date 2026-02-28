"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import DashboardFiltersClient from "@/components/dashboard-filters.client";
import { MiniBar as ScalingMiniBar, Badge } from "@/components/dashboard/mini-bar";
import { MiniBar, HeaderWithTip, StabilityLegend } from "@/components/dashboard/mini";
import { p95, normToP95 } from "@/lib/miniBars";
import { DASH_THRESHOLDS, fmtNum, fmtPct01, clamp01, formatOverheadPct } from "@/lib/dashboardThresholds";
import styles from "./dashboard.module.css";

type ScalingRow = {
  runId: string;
  agents: number;
  variants: number;
  steps: number;
  runDurationMs: number | null;
  decisionsPerSec: number | null;
  overheadMs: number | null;
  overheadPct: number | null;
  efficiencyMsPerDecision: number | null;
  isLegacyTiming?: boolean;
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

export type DashboardClientProps = {
  initialData: {
    scaling: ScalingRow[];
    stability: StabilityRow[];
    counts: { unstable: number; diverging: number; ok: number; legacy: number };
    filterLabel: string;
    latest: { runDurationMs: number | null } | null;
    latestScalingRow: ScalingRow | null;
  };
  initialQuery: {
    assetSymbol: string;
    topN: string;
    showOnlyUnstable: boolean;
    showLegacy: boolean;
    sortByRisk: boolean;
  };
};

export function DashboardClient({ initialData, initialQuery }: DashboardClientProps) {
  const { scaling, stability, counts, filterLabel, latest, latestScalingRow } = initialData;
  const { assetSymbol } = initialQuery;

  const [drawerRun, setDrawerRun] = useState<{
    runId: string;
    type: "scaling" | "stability";
    row: ScalingRow | StabilityRow;
  } | null>(null);

  const closeDrawer = useCallback(() => setDrawerRun(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDrawer]);

  const openScalingDrawer = (r: ScalingRow) => () => setDrawerRun({ runId: r.runId, type: "scaling", row: r });
  const openStabilityDrawer = (r: StabilityRow) => () => setDrawerRun({ runId: r.runId, type: "stability", row: r });

  const decisionsPerSecVals = scaling.map((r) => r.decisionsPerSec ?? 0).filter((v) => v > 0);
  const overheadPctVals = scaling
    .map((r) => r.overheadPct ?? 0)
    .filter((v) => v > 0)
    .map((v) => (v > 100 ? 100 : v));
  const efficiencyVals = scaling.map((r) => r.efficiencyMsPerDecision ?? 0).filter((v) => v > 0);

  const p95Decisions = p95(decisionsPerSecVals);
  const p95Overhead = p95(overheadPctVals);
  const p95Efficiency = p95(efficiencyVals);

  const corrSpreadVals = stability.map((r) => r.corrSpread ?? 0).filter((v) => v > 0);
  const accStdDevVals = stability.map((r) => r.accStdDev ?? 0).filter((v) => v > 0);

  const p95CorrSpread = p95(corrSpreadVals) || 0.1;
  const p95AccStdDev = p95(accStdDevVals) || 0.05;

  return (
    <div style={{ maxWidth: 1152, margin: "0 auto", padding: "32px 24px" }}>
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

      <div style={{ border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 10, padding: 16, marginBottom: 32 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Last Runs (Scaling)</div>
        <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)", marginBottom: 12 }}>
          Legacy timing means variants have no durationMs/timestamps; only runDurationMs is available.
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
              </tr>
            </thead>
            <tbody>
              {scaling.map((r) => {
                const dpsWidth = r.decisionsPerSec != null ? normToP95(r.decisionsPerSec, p95Decisions) / 100 : 0;
                const ohVal = r.overheadPct != null ? (r.overheadPct > 100 ? 100 : r.overheadPct) : null;
                const ohWidth = ohVal != null ? normToP95(ohVal, p95Overhead) / 100 : 0;
                const effWidth = r.efficiencyMsPerDecision != null ? normToP95(r.efficiencyMsPerDecision, p95Efficiency) / 100 : 0;
                return (
                  <tr key={r.runId} className={styles.clickable} onClick={openScalingDrawer(r)}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{r.runId.slice(0, 6)}…{r.runId.slice(-4)}</span>
                        {r.isLegacyTiming ? <Badge kind="legacy" text="LEGACY" /> : null}
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
              {scaling.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 24, color: "rgba(15, 23, 42, 0.55)" }}>
                    No completed runs found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {stability.map((r, i) => {
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
                    onClick={openStabilityDrawer(r)}
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
              {stability.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 24, color: "rgba(15, 23, 42, 0.55)" }}>
                    No stability rows for this asset / filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {drawerRun && (
        <>
          <div className={styles.drawerBackdrop} onClick={closeDrawer} aria-hidden />
          <div className={styles.drawer} role="dialog" aria-label="Run details">
            <div className={styles.drawerHeader}>
              <span className={styles.drawerTitle}>Run details</span>
              <button type="button" className={styles.drawerClose} onClick={closeDrawer} aria-label="Close">
                ×
              </button>
            </div>
            <div className={styles.drawerBody}>
              <div className={styles.drawerRow}>
                <div className={styles.drawerLabel}>Run ID</div>
                <div className={styles.drawerValue}>{drawerRun.runId}</div>
              </div>
              <div className={styles.drawerRow}>
                <div className={styles.drawerLabel}>Asset</div>
                <div className={styles.drawerValue}>{assetSymbol}</div>
              </div>
              <div className={styles.drawerRow}>
                <div className={styles.drawerLabel}>Seeds / Variants</div>
                <div className={styles.drawerValue}>
                  {"seeds" in drawerRun.row ? (drawerRun.row.seeds ?? drawerRun.row.variants) : drawerRun.row.variants}
                </div>
              </div>
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
