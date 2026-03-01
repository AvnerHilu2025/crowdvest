"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { truncateMiddle } from "@/lib/format";

export interface ScalingRow {
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
}

interface ScalingTableProps {
  rows: ScalingRow[];
  assetSymbol?: string;
  rowHref?: (row: ScalingRow) => string;
  emptyMessage?: string;
  footnote?: string;
  title?: string;
}

export function ScalingTable({
  rows,
  assetSymbol = "SPY",
  rowHref,
  emptyMessage = "No completed runs with variants. Run the hardening suite or create runs first.",
  footnote = "Legacy timing means variants have no durationMs/timestamps; only runDurationMs is available.",
  title = "Last Runs (Scaling)",
}: ScalingTableProps) {
  const router = useRouter();

  return (
    <section className="card" style={{ marginBottom: 24 }}>
      <h2 className="card-title">{title}</h2>
      {footnote ? (
        <p className="run-detail-meta" style={{ marginTop: 4, marginBottom: 0, fontSize: 12 }}>
          {footnote}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="card-empty" style={{ marginTop: 8 }}>
          {emptyMessage}
        </p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="variants-table" style={{ width: "100%", minWidth: 800 }}>
            <thead>
              <tr>
                <th>Run</th>
                <th>Agents</th>
                <th>Variants</th>
                <th>Steps</th>
                <th>Run duration</th>
                <th>Decisions/sec</th>
                <th>Overhead (ms)</th>
                <th>Overhead %</th>
                <th>Efficiency (ms/decision)</th>
                <th style={{ width: 1 }} />
                <th>Compare</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const compareHref =
                  rowHref?.(row) ??
                  (row.variants >= 2
                    ? `/runs/${row.runId}/compare?assetSymbol=${encodeURIComponent(assetSymbol)}`
                    : null);
                return (
                <tr
                  key={row.runId}
                  title={row.isLegacyTiming ? "Variant timing not recorded for older runs." : undefined}
                  role={compareHref ? "button" : undefined}
                  tabIndex={compareHref ? 0 : undefined}
                  onClick={
                    compareHref
                      ? () => router.push(compareHref)
                      : undefined
                  }
                  onKeyDown={
                    compareHref
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(compareHref);
                          }
                        }
                      : undefined
                  }
                  style={{
                    cursor: compareHref ? "pointer" : undefined,
                  }}
                >
                  <td>
                    <Link href={`/runs/${row.runId}`} className="card-link">
                      {truncateMiddle(row.runId, 8, 4)}
                    </Link>
                  </td>
                  <td>{row.agents}</td>
                  <td>{row.variants}</td>
                  <td>{row.steps}</td>
                  <td>
                    {row.runDurationMs != null && row.runDurationMs > 0
                      ? `${row.runDurationMs} ms (${(row.runDurationMs / 1000).toFixed(1)} s)`
                      : "—"}
                  </td>
                  <td>
                    {row.decisionsPerSec != null
                      ? row.decisionsPerSec.toFixed(1)
                      : "—"}
                  </td>
                  <td>
                    {row.overheadMs != null ? Math.round(row.overheadMs) : "—"}
                  </td>
                  <td>
                    {row.overheadPct != null ? `${row.overheadPct.toFixed(1)}%` : "—"}
                  </td>
                  <td>
                    {row.efficiencyMsPerDecision != null
                      ? row.efficiencyMsPerDecision.toFixed(4)
                      : "—"}
                  </td>
                  <td>
                    {row.isLegacyTiming ? (
                      <span
                        className="badge"
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          opacity: 0.8,
                          fontWeight: 500,
                        }}
                        title="Variant timing not recorded for older runs."
                      >
                        LEGACY
                      </span>
                    ) : null}
                  </td>
                  <td onClick={(e) => compareHref && e.stopPropagation()}>
                    {row.variants >= 2 && compareHref ? (
                      <Link
                        href={compareHref}
                        className="card-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Compare seeds
                      </Link>
                    ) : (
                      <span style={{ color: "var(--cv-muted)", fontSize: 12 }}>
                        single-seed
                      </span>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
