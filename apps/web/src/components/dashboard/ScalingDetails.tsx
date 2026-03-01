"use client";

import React, { useEffect, useState } from "react";
import { SeedHeatmap } from "./SeedHeatmap";
import { SeedProfilePanel } from "./SeedProfilePanel";
import { AgreementTimeline } from "./AgreementTimeline";
import { computeConvergenceStats, fmtPct01, fmtNum, classifyConvergenceBand, bandStyles } from "@/lib/convergence";

export type ScalingRowForDetails = {
  runId: string;
  variants?: number;
  runDurationMs: number | null;
  sumVariantMs?: number;
  engineInitMs?: number | null;
  orchestrationMs?: number | null;
  dbCommitMs?: number | null;
  computeMs?: number | null;
  isLegacyTiming?: boolean;
};

type ScalingDetailsProps = {
  row: ScalingRowForDetails;
  assetSymbol?: string;
};

export function ScalingDetails({ row, assetSymbol = "SPY" }: ScalingDetailsProps) {
  const [variantsData, setVariantsData] = useState<{
    agreementMatrix: Array<{ seedA: number; seedB: number; agreement: number }>;
    seedProfiles: Array<{
      seed: number;
      buyPct: number;
      sellPct: number;
      holdPct: number;
      netBias: number;
      dominantDirection: "BUY" | "SELL" | "HOLD";
    }>;
    stepAgreement: Array<{ step: number; agreementPct: number }>;
  }>({ agreementMatrix: [], seedProfiles: [], stepAgreement: [] });

  const variantsCount = row.variants ?? 0;

  useEffect(() => {
    if (variantsCount < 2 || !row.runId) return;
    const url = `/api/runs/${encodeURIComponent(row.runId)}/variants?assetSymbol=${encodeURIComponent(assetSymbol)}&limit=50`;
    fetch(url)
      .then((r) => r.json())
      .then(
        (data: {
          agreementMatrix?: Array<{ seedA: number; seedB: number; agreement: number }>;
          seedProfiles?: Array<{
            seed: number;
            buyPct: number;
            sellPct: number;
            holdPct: number;
            netBias: number;
            dominantDirection: "BUY" | "SELL" | "HOLD";
          }>;
          stepAgreement?: Array<{ step: number; agreementPct: number }>;
        }) => {
          setVariantsData({
            agreementMatrix: data.agreementMatrix ?? [],
            seedProfiles: data.seedProfiles ?? [],
            stepAgreement: data.stepAgreement ?? [],
          });
        }
      )
      .catch(() =>
        setVariantsData({
          agreementMatrix: [],
          seedProfiles: [],
          stepAgreement: [],
        })
      );
  }, [row.runId, assetSymbol, variantsCount]);

  if (row.isLegacyTiming) {
    return (
      <div style={{ fontSize: 13, color: "rgba(15, 23, 42, 0.55)" }}>
        No breakdown available
      </div>
    );
  }

  const totalMs = row.runDurationMs ?? 0;
  if (totalMs <= 0) {
    return (
      <div style={{ fontSize: 13, color: "rgba(15, 23, 42, 0.55)" }}>
        No breakdown available
      </div>
    );
  }

  const engineInitMs = row.engineInitMs ?? 0;
  const orchestrationMs = row.orchestrationMs ?? 0;
  const dbCommitMs = row.dbCommitMs ?? 0;
  const computeMs = row.computeMs ?? 0;

  const enginePct = totalMs > 0 ? (engineInitMs / totalMs) * 100 : 0;
  const orchestrationPct = totalMs > 0 ? (orchestrationMs / totalMs) * 100 : 0;
  const dbPct = totalMs > 0 ? (dbCommitMs / totalMs) * 100 : 0;
  const computePct = totalMs > 0 ? (computeMs / totalMs) * 100 : 0;

  const sections = [
    { label: "Engine Init", ms: engineInitMs, pct: enginePct, color: "#a855f7" },
    { label: "Orchestration", ms: orchestrationMs, pct: orchestrationPct, color: "#f97316" },
    { label: "DB Commit", ms: dbCommitMs, pct: dbPct, color: "#14b8a6" },
    { label: "Compute", ms: computeMs, pct: computePct, color: "#3b82f6" },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          height: 24,
          borderRadius: 6,
          overflow: "hidden",
          background: "rgba(15, 23, 42, 0.06)",
          marginBottom: 12,
        }}
      >
        {sections.map((s) => (
          <div
            key={s.label}
            style={{
              width: `${s.pct}%`,
              background: s.color,
              minWidth: s.pct > 0 ? 4 : 0,
            }}
            title={`${s.label}: ${s.ms} ms (${s.pct.toFixed(1)}%)`}
          />
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
          gap: 12,
          fontSize: 12,
        }}
      >
        {sections.map((s) => (
          <div key={s.label}>
            <div style={{ color: "rgba(15, 23, 42, 0.5)", fontSize: 11 }}>
              {s.label}
            </div>
            <div className="tabular-nums">
              {s.ms} ms ({s.pct.toFixed(1)}%)
            </div>
          </div>
        ))}
      </div>
      {variantsCount >= 2 && variantsData.agreementMatrix.length > 0 ? (
        <SeedHeatmap agreementMatrix={variantsData.agreementMatrix} />
      ) : null}
      {variantsCount >= 2 && variantsData.seedProfiles.length > 0 ? (
        <SeedProfilePanel seedProfiles={variantsData.seedProfiles} />
      ) : null}
      {variantsCount >= 2 && variantsData.stepAgreement.length > 0 ? (
        <AgreementTimeline stepAgreement={variantsData.stepAgreement} />
      ) : null}
      {variantsCount >= 2 ? (
        (() => {
          const stepAgreementSeries = variantsData.stepAgreement.map(
            (p) => p.agreementPct
          );
          const conv = computeConvergenceStats(stepAgreementSeries, 90);
          const band = classifyConvergenceBand({
            csiStepNumber: conv.csiStepNumber,
            pctAboveThreshold: conv.pctAboveThreshold,
            stdDev: conv.stdDev,
          });
          const bandUi = bandStyles(band);
          const pctBarWidth = Math.min(100, Math.max(0, conv.pctAboveThreshold ?? 0));
          const minBarWidth = conv.min != null ? Math.min(100, Math.max(0, conv.min * 100)) : 0;
          const finalBarWidth = conv.final != null ? Math.min(100, Math.max(0, conv.final * 100)) : 0;
          return (
            <div data-testid="convergence-section" style={{ marginTop: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 12 }}>Convergence</span>
                <span
                  data-testid="convergence-band-badge"
                  className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${bandUi.className}`}
                >
                  {bandUi.label}
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(15, 23, 42, 0.55)",
                  marginBottom: 8,
                }}
              >
                CSI = first step where agreement ≥ 90%. Lower is better.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "8px 16px",
                  fontSize: 12,
                }}
              >
                <div
                  data-testid="convergence-csi"
                  title="First step where agreement ≥ 90% (lower is better)"
                >
                  <span style={{ color: "rgba(15, 23, 42, 0.5)" }}>
                    CSI (steps to ≥90%)
                  </span>
                  <span className="tabular-nums" style={{ marginLeft: 8 }}>
                    {conv.csiStepNumber ?? "—"}
                  </span>
                </div>
                <div
                  title="Share of steps with agreement ≥ 90% (higher is better)"
                >
                  <span style={{ color: "rgba(15, 23, 42, 0.5)" }}>
                    % steps ≥90%
                  </span>
                  <span className="tabular-nums" style={{ marginLeft: 8 }}>
                    {conv.pctAboveThreshold == null
                      ? "—"
                      : `${conv.pctAboveThreshold.toFixed(0)}%`}
                  </span>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: "rgba(15, 23, 42, 0.08)",
                      overflow: "hidden",
                      marginTop: 4,
                    }}
                  >
                    <div
                      style={{
                        width: `${pctBarWidth}%`,
                        height: "100%",
                        background: "#6366f1",
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <span style={{ color: "rgba(15, 23, 42, 0.5)" }}>
                    Min agreement
                  </span>
                  <span className="tabular-nums" style={{ marginLeft: 8 }}>
                    {fmtPct01(conv.min, 0)}
                  </span>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: "rgba(15, 23, 42, 0.08)",
                      overflow: "hidden",
                      marginTop: 4,
                    }}
                  >
                    <div
                      style={{
                        width: `${minBarWidth}%`,
                        height: "100%",
                        background: "#94a3b8",
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <span style={{ color: "rgba(15, 23, 42, 0.5)" }}>
                    Final agreement
                  </span>
                  <span className="tabular-nums" style={{ marginLeft: 8 }}>
                    {fmtPct01(conv.final, 0)}
                  </span>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: "rgba(15, 23, 42, 0.08)",
                      overflow: "hidden",
                      marginTop: 4,
                    }}
                  >
                    <div
                      style={{
                        width: `${finalBarWidth}%`,
                        height: "100%",
                        background: "#6366f1",
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <span style={{ color: "rgba(15, 23, 42, 0.5)" }}>
                    Avg agreement
                  </span>
                  <span className="tabular-nums" style={{ marginLeft: 8 }}>
                    {fmtPct01(conv.mean, 0)}
                  </span>
                </div>
                <div
                  data-testid="convergence-stddev"
                  title="Volatility of agreement across steps (lower is better)"
                >
                  <span style={{ color: "rgba(15, 23, 42, 0.5)" }}>
                    Std dev
                  </span>
                  <span className="tabular-nums" style={{ marginLeft: 8 }}>
                    {conv.stdDev == null ? "—" : fmtNum(conv.stdDev, 3)}
                  </span>
                </div>
              </div>
            </div>
          );
        })()
      ) : null}
    </div>
  );
}
