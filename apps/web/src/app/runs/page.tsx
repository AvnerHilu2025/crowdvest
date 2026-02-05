"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRuns, type RunsListItem } from "@/lib/api";

function formatDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function formatPnl(n: number): string {
  return n.toFixed(4);
}

export default function RunsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunsListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getRuns(20)
      .then((data) => {
        setRuns(data.items);
        setTotal(data.total);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Runs Dashboard</h1>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{
            padding: "8px 16px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p style={{ color: "#c00", marginBottom: 16 }}>
          Error: {error}
        </p>
      )}

      {loading && !runs.length && <p>Loading runs…</p>}

      {!loading && !error && (
        <table
          border={1}
          cellPadding={8}
          cellSpacing={0}
          style={{ borderCollapse: "collapse", width: "100%" }}
        >
          <thead>
            <tr>
              <th>startedAt</th>
              <th>name</th>
              <th>status</th>
              <th>totalPnl</th>
              <th>tradeRate</th>
              <th>agentCount</th>
              <th>totalSteps</th>
              <th>warningsCount</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", color: "#666" }}>
                  No runs found
                </td>
              </tr>
            ) : (
              runs.map((r) => (
                <tr
                  key={r.runId}
                  style={{ cursor: "pointer" }}
                  onClick={() => router.push(`/runs/${r.runId}`)}
                >
                  <td>{formatDate(r.startedAt)}</td>
                  <td>{r.name ?? "—"}</td>
                  <td>{r.status}</td>
                  <td style={{ fontFamily: "monospace" }}>{formatPnl(r.metrics.totalPnl)}</td>
                  <td>
                    {r.metrics.tradeRate != null
                      ? `${(r.metrics.tradeRate * 100).toFixed(2)}%`
                      : "—"}
                  </td>
                  <td>{r.metrics.agentCount}</td>
                  <td>{r.metrics.totalSteps}</td>
                  <td>{r.warningsCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {!loading && runs.length > 0 && (
        <p style={{ marginTop: 16, color: "#666", fontSize: 14 }}>
          {total} run{total !== 1 ? "s" : ""}
        </p>
      )}
    </main>
  );
}
