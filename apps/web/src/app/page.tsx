"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchRuns,
  fetchAgents,
  fetchSummary,
  statusLabel,
  type RunResult,
  type AgentResult,
  type SummaryResponse,
} from "./results-api";

export default function Home() {
  const [runs, setRuns] = useState<RunResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [agents, setAgents] = useState<AgentResult[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingRuns(true);
    setRunsError(null);
    fetchRuns(50, 0)
      .then((data) => {
        if (!cancelled) {
          setRuns(data.items);
          setTotal(data.total);
        }
      })
      .catch((err) => {
        if (!cancelled) setRunsError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingRuns(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadRunDetail = useCallback((runId: string) => {
    setSelectedRunId(runId);
    setLoadingDetail(true);
    setDetailError(null);
    setSummary(null);
    setAgents([]);
    Promise.all([fetchSummary(runId), fetchAgents(runId)])
      .then(([s, agentsData]) => {
        setSummary(s);
        setAgents(agentsData.items);
      })
      .catch((err) => {
        setDetailError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoadingDetail(false);
      });
  }, []);

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>Simulation results</h1>

      <section style={{ marginBottom: 24 }}>
        <h2>Runs ({total})</h2>
        {runsError && <p style={{ color: "red" }}>{runsError}</p>}
        {loadingRuns && <p>Loading runs…</p>}
        {!loadingRuns && !runsError && (
          <table border={1} cellPadding={8} cellSpacing={0} style={{ borderCollapse: "collapse", width: "100%", maxWidth: 800 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Steps</th>
                <th>Created</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => loadRunDetail(r.id)}
                  style={{
                    cursor: "pointer",
                    background: selectedRunId === r.id ? "#eee" : undefined,
                  }}
                >
                  <td>{r.name ?? "—"}</td>
                  <td>{statusLabel(r.status)}</td>
                  <td>{r.steps}</td>
                  <td>{new Date(r.timestamp).toISOString()}</td>
                  <td style={{ fontSize: 12 }}>{r.id.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {selectedRunId && (
        <section style={{ marginBottom: 24 }}>
          <h2>Run detail: {selectedRunId.slice(0, 8)}…</h2>
          {detailError && <p style={{ color: "red" }}>{detailError}</p>}
          {loadingDetail && <p>Loading summary and agents…</p>}
          {!loadingDetail && !detailError && summary?.run && (
            <>
              <h3>Aggregated metrics (run)</h3>
              <table border={1} cellPadding={8} cellSpacing={0} style={{ borderCollapse: "collapse", marginBottom: 16 }}>
                <tbody>
                  <tr><td>Agents</td><td>{summary.run.metrics.agentCount}</td></tr>
                  <tr><td>Total PnL</td><td>{summary.run.metrics.totalPnl.toFixed(2)}</td></tr>
                  <tr><td>Avg PnL</td><td>{summary.run.metrics.avgPnl.toFixed(2)}</td></tr>
                  <tr><td>Avg risk</td><td>{summary.run.metrics.avgRisk.toFixed(4)}</td></tr>
                  <tr><td>Total steps</td><td>{summary.run.metrics.totalSteps}</td></tr>
                  <tr><td>Total reward</td><td>{summary.run.metrics.totalReward.toFixed(2)}</td></tr>
                  <tr><td>Actions (buy / sell / hold)</td><td>{summary.run.metrics.totalBuy} / {summary.run.metrics.totalSell} / {summary.run.metrics.totalHold}</td></tr>
                </tbody>
              </table>

              {summary.byArchetype.length > 0 && (
                <>
                  <h3>By archetype</h3>
                  <table border={1} cellPadding={8} cellSpacing={0} style={{ borderCollapse: "collapse", marginBottom: 16, width: "100%", maxWidth: 900 }}>
                    <thead>
                      <tr>
                        <th>Archetype ID</th>
                        <th>Agents</th>
                        <th>Total PnL</th>
                        <th>Avg PnL</th>
                        <th>Avg risk</th>
                        <th>Total steps</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.byArchetype.map((a) => (
                        <tr key={a.archetypeId}>
                          <td style={{ fontSize: 12 }}>{a.archetypeId.slice(0, 8)}…</td>
                          <td>{a.metrics.agentCount}</td>
                          <td>{a.metrics.totalPnl.toFixed(2)}</td>
                          <td>{a.metrics.avgPnl.toFixed(2)}</td>
                          <td>{a.metrics.avgRisk.toFixed(4)}</td>
                          <td>{a.metrics.totalSteps}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              <h3>Agent results ({agents.length})</h3>
              <table border={1} cellPadding={8} cellSpacing={0} style={{ borderCollapse: "collapse", width: "100%", maxWidth: 1000 }}>
                <thead>
                  <tr>
                    <th>Agent ID</th>
                    <th>Archetype</th>
                    <th>Steps</th>
                    <th>PnL</th>
                    <th>Risk</th>
                    <th>Reward</th>
                    <th>Buy</th>
                    <th>Sell</th>
                    <th>Hold</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a) => (
                    <tr key={a.agentId}>
                      <td style={{ fontSize: 12 }}>{a.agentId.slice(0, 8)}…</td>
                      <td style={{ fontSize: 12 }}>{a.archetypeId.slice(0, 8)}…</td>
                      <td>{a.steps}</td>
                      <td>{a.pnl.toFixed(2)}</td>
                      <td>{a.risk.toFixed(4)}</td>
                      <td>{a.totalReward.toFixed(2)}</td>
                      <td>{a.actionCounts.buy}</td>
                      <td>{a.actionCounts.sell}</td>
                      <td>{a.actionCounts.hold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}
    </main>
  );
}
