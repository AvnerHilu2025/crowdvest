import React from "react";
import Link from "next/link";
import DashboardFiltersClient from "@/components/dashboard-filters.client";
import { MiniBar, Badge } from "@/components/dashboard/mini-bar";
import { getWebBase } from "@/lib/web-base";
import { stabilityReason, fmtNum, fmtPct } from "@/lib/risk";
import { stabilityRiskScore, riskBand, stabilityCause } from "@/lib/stability-triage";

export const dynamic = "force-dynamic";

type DashboardSummary = {
  latestRun: {
    id: string;
    runDurationMs: number | null;
  } | null;
  scalingRows: Array<{
    runId: string;
    agents: number;
    variants: number;
    steps: number;
    runDurationMs: number | null;
    decisionsTotal: number;
    decisionsPerSec: number | null;
    overheadMs: number | null;
    overheadPct: number | null;
    efficiencyMsPerDecision: number | null;
    isLegacyTiming?: boolean;
  }>;
  stabilityRows: Array<{
    runId: string;
    agents: number;
    variants: number;
    steps: number;
    corrSpread: number | null;
    corrStdDev: number | null;
    accStdDev: number | null;
    signAgreementRate: number | null;
    label: string;
  }>;
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

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

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

  const scaling = data.scalingRows;
  const maxDecisionsPerSec = Math.max(0, ...scaling.map((r) => r.decisionsPerSec ?? 0));
  const maxOverheadPct = Math.max(0, ...scaling.map((r) => r.overheadPct ?? 0));
  const maxEfficiency = Math.max(0, ...scaling.map((r) => r.efficiencyMsPerDecision ?? 0));
  const maxRunDurationMs = Math.max(0, ...scaling.map((r) => r.runDurationMs ?? 0));

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
    <div style={{ maxWidth: 1152, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Dashboard</h1>
        <DashboardFiltersClient
          assetSymbol={assetSymbol}
          topN={topN}
          showOnlyUnstable={unstableOnly}
          showLegacy={showLegacy}
          sortByRisk={sortByRisk}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Operational Overview</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
          }}
        >
          <div
            style={{
              border: "1px solid rgba(15, 23, 42, 0.10)",
              borderRadius: 10,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>Run duration</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              {latest?.runDurationMs != null
                ? `${(latest.runDurationMs / 1000).toFixed(1)} s (${latest.runDurationMs} ms)`
                : "—"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.5)", marginTop: 4 }}>
              Latest completed run
            </div>
          </div>
          <div
            style={{
              border: "1px solid rgba(15, 23, 42, 0.10)",
              borderRadius: 10,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>Decisions/sec</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              {latestScalingRow?.decisionsPerSec != null
                ? Math.round(latestScalingRow.decisionsPerSec)
                : "—"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.5)", marginTop: 4 }}>Throughput</div>
          </div>
          <div
            style={{
              border: "1px solid rgba(15, 23, 42, 0.10)",
              borderRadius: 10,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>Overhead %</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              {latestScalingRow?.overheadPct != null ? `${latestScalingRow.overheadPct.toFixed(1)}%` : "—"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.5)", marginTop: 4 }}>
              Run wallclock vs variants
            </div>
          </div>
          <div
            style={{
              border: "1px solid rgba(15, 23, 42, 0.10)",
              borderRadius: 10,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>Efficiency</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              {latestScalingRow?.efficiencyMsPerDecision != null
                ? latestScalingRow.efficiencyMsPerDecision.toFixed(4)
                : "—"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.5)", marginTop: 4 }}>
              ms per decision
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          border: "1px solid rgba(15, 23, 42, 0.10)",
          borderRadius: 10,
          padding: 16,
          marginBottom: 32,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Last Runs (Scaling)</div>
        <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)", marginBottom: 12 }}>
          Legacy timing means variants have no durationMs/timestamps; only runDurationMs is available.
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                <th style={{ padding: "8px 12px 8px 0" }}>Run</th>
                <th style={{ padding: "8px 12px 8px 0" }}>Agents</th>
                <th style={{ padding: "8px 12px 8px 0" }}>Variants</th>
                <th style={{ padding: "8px 12px 8px 0" }}>Steps</th>
                <th style={{ padding: "8px 12px 8px 0" }}>Run duration</th>
                <th style={{ padding: "8px 12px 8px 0" }}>Decisions/sec</th>
                <th style={{ padding: "8px 12px 8px 0" }}>Overhead (ms)</th>
                <th style={{ padding: "8px 12px 8px 0" }}>Overhead %</th>
                <th style={{ padding: "8px 12px 8px 0" }}>Efficiency (ms/decision)</th>
                <th style={{ padding: "8px 12px 8px 0" }}>Compare</th>
              </tr>
            </thead>
            <tbody>
              {scaling.map((r) => {
                const decisionsPerSec01 = maxDecisionsPerSec > 0 && r.decisionsPerSec != null ? clamp01(r.decisionsPerSec / maxDecisionsPerSec) : null;
                const overheadPct01 = r.overheadPct != null ? clamp01(r.overheadPct / 100) : null;
                const efficiency01 = maxEfficiency > 0 && r.efficiencyMsPerDecision != null ? clamp01(r.efficiencyMsPerDecision / maxEfficiency) : null;
                const runDuration01 = maxRunDurationMs > 0 && r.runDurationMs != null ? clamp01(r.runDurationMs / maxRunDurationMs) : null;
                return (
                  <tr key={r.runId} style={{ borderBottom: "1px solid rgba(15, 23, 42, 0.04)" }}>
                    <td style={{ padding: "12px 12px 12px 0" }}>
                      <div className="flex items-center gap-2">
                        <Link href={`/runs/${r.runId}`} className="card-link">
                          {r.runId.slice(0, 6)}…{r.runId.slice(-4)}
                        </Link>
                        {r.isLegacyTiming ? <Badge kind="legacy" text="LEGACY" /> : null}
                      </div>
                    </td>
                    <td style={{ padding: "12px 12px 12px 0" }}>{r.agents}</td>
                    <td style={{ padding: "12px 12px 12px 0" }}>{r.variants}</td>
                    <td style={{ padding: "12px 12px 12px 0" }}>{r.steps}</td>
                    <td style={{ padding: "12px 12px 12px 0" }}>
                      {r.runDurationMs != null ? (
                        <MiniBar
                          value01={runDuration01}
                          text={`${r.runDurationMs} ms`}
                          higherIsWorse
                          title="Run duration (higher = slower)"
                        />
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 12px 12px 0" }}>
                      {r.decisionsPerSec != null ? (
                        <MiniBar
                          value01={decisionsPerSec01}
                          text={r.decisionsPerSec.toFixed(1)}
                          title="Decisions per second (higher = better)"
                        />
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 12px 12px 0" }}>
                      {r.overheadMs != null ? Math.round(r.overheadMs) : <span className="text-slate-500">—</span>}
                    </td>
                    <td style={{ padding: "12px 12px 12px 0" }}>
                      {r.overheadPct != null ? (
                        <MiniBar
                          value01={overheadPct01}
                          text={`${r.overheadPct.toFixed(1)}%`}
                          higherIsWorse
                          title="Overhead % (lower = better)"
                        />
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 12px 12px 0" }}>
                      {r.efficiencyMsPerDecision != null ? (
                        <MiniBar
                          value01={efficiency01}
                          text={r.efficiencyMsPerDecision.toFixed(4)}
                          higherIsWorse
                          title="Efficiency ms/decision (lower = better)"
                        />
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 12px 12px 0" }}>
                      <Link
                        href={`/runs/${r.runId}/compare?assetSymbol=${encodeURIComponent(assetSymbol)}`}
                        className="card-link"
                      >
                        Compare seeds
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {scaling.length === 0 ? (
                <tr>
                  <td style={{ padding: 24, color: "rgba(15, 23, 42, 0.55)" }} colSpan={10}>
                    No completed runs found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div
        style={{
          border: "1px solid rgba(15, 23, 42, 0.10)",
          borderRadius: 10,
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Stability Watchlist</div>
        <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)", marginBottom: 8 }}>
          Computed across variants (seeds) per run. Use Compare seeds to inspect divergences.
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 8,
              background: "rgba(254, 226, 226, 0.9)",
              color: "#991b1b",
              fontWeight: 500,
            }}
          >
            Unstable: {counts.unstable}
          </span>
          <span
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 8,
              background: "rgba(254, 243, 199, 0.9)",
              color: "#92400e",
              fontWeight: 500,
            }}
          >
            Diverging: {counts.diverging}
          </span>
          <span
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 8,
              background: "rgba(220, 252, 231, 0.9)",
              color: "#166534",
              fontWeight: 500,
            }}
          >
            OK: {counts.ok}
          </span>
          <span
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 8,
              background: "rgba(243, 244, 246, 0.9)",
              color: "#374151",
              fontWeight: 500,
            }}
          >
            Legacy: {counts.legacy}
          </span>
          <span style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.6)" }}>
            Showing: {filterLabel}
          </span>
          {sortByRisk ? (
            <span style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)", fontStyle: "italic" }}>
              Sorted by risk
            </span>
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
          <div style={{ marginTop: 4 }}>
            SIGN disagreement dominates; CORR spread ≥0.30 and ACC std dev ≥3% increase risk
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr
                style={{
                  position: "sticky",
                  top: 0,
                  background: "#fff",
                  zIndex: 10,
                  textAlign: "left",
                  borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
                }}
              >
                <th style={{ padding: "8px 12px 8px 0" }}>Run</th>
                <th style={{ padding: "8px 12px 8px 0", textAlign: "right" }}>Score</th>
                <th style={{ padding: "8px 12px 8px 0" }}>Band</th>
                <th style={{ padding: "8px 12px 8px 0" }}>Cause</th>
                <th style={{ padding: "8px 12px 8px 0" }}>Reason</th>
                <th style={{ padding: "8px 12px 8px 0", textAlign: "right" }}>Seeds</th>
                <th style={{ padding: "8px 12px 8px 0", textAlign: "right" }}>Corr spread</th>
                <th style={{ padding: "8px 12px 8px 0", textAlign: "right" }}>Sign agreement</th>
                <th style={{ padding: "8px 12px 8px 0", textAlign: "right" }}>Acc std dev</th>
                <th style={{ padding: "8px 12px 8px 0" }}>Link</th>
              </tr>
            </thead>
            <tbody>
              {stabilityDecorated.map((r, i) => {
                const corrSpread01 = r.corrSpread != null ? clamp01(r.corrSpread) : null;
                const signAgreement01 = r.signAgreementRate != null ? clamp01(r.signAgreementRate) : null;
                const accStdDev01 = r.accStdDev != null ? clamp01(r.accStdDev) : null;
                return (
                  <tr
                    key={r.runId}
                    className={rowBgClass(r.band, i)}
                    style={{ borderBottom: "1px solid rgba(15, 23, 42, 0.04)" }}
                  >
                    <td style={{ padding: "12px 12px 12px 0", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                      <Link href={`/runs/${r.runId}`} className="card-link">
                        {r.runId.slice(0, 6)}…{r.runId.slice(-4)}
                      </Link>
                    </td>
                    <td style={{ padding: "12px 12px 12px 0", fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.score}</td>
                    <td style={{ padding: "12px 12px 12px 0" }}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge kind={badgeKind(r.band)} text={r.band} />
                      </div>
                    </td>
                    <td style={{ padding: "12px 12px 12px 0", fontSize: 12 }}>{r.cause}</td>
                    <td
                      className="max-w-[280px] truncate text-slate-600"
                      style={{ padding: "12px 12px 12px 0", fontSize: 12 }}
                      title={r.reason}
                    >
                      {r.reason}
                    </td>
                    <td style={{ padding: "12px 12px 12px 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.variants}</td>
                    <td style={{ padding: "12px 12px 12px 0" }}>
                      {r.corrSpread != null ? (
                        <MiniBar
                          value01={corrSpread01}
                          text={fmtNum(r.corrSpread, 4)}
                          higherIsWorse
                          title="corrSpread: higher means seeds disagree more"
                        />
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 12px 12px 0" }}>
                      {r.signAgreementRate != null ? (
                        <MiniBar
                          value01={signAgreement01}
                          text={`${Math.round(r.signAgreementRate * 100)}%`}
                          title="signAgreementRate: 1.0 means all seeds agree on direction"
                        />
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 12px 12px 0" }}>
                      {r.accStdDev != null ? (
                        <MiniBar
                          value01={accStdDev01}
                          text={`${(r.accStdDev * 100).toFixed(2)}%`}
                          higherIsWorse
                          title="accStdDev: std dev across seeds (fraction)"
                        />
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 12px 12px 0" }}>
                      <Link
                        href={`/runs/${r.runId}/compare?assetSymbol=${encodeURIComponent(assetSymbol)}`}
                        className="card-link"
                      >
                        Compare seeds
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {stabilityDecorated.length === 0 ? (
                <tr>
                  <td style={{ padding: 24, color: "rgba(15, 23, 42, 0.55)" }} colSpan={10}>
                    No stability rows for this asset / filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
