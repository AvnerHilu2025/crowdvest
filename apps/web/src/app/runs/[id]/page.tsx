"use client";

// Ensure run data, wallet, and bets are always fresh (no static generation).
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  createOpenBet,
  getBets,
  getRunById,
  getRunTimeseries,
  getWallet,
  getWalletSummary,
  settleBets,
  type BetItem,
  type CreateBetPayload,
  type RunDetailResponse,
} from "@/lib/api";
import { getOrCreateUserId } from "@/lib/identity";

function formatBetStatus(status: string): string {
  if (status === "OPEN") return "OPEN";
  if (status === "SETTLED") return "SETTLED";
  return status ?? "";
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatPnl(value: number): string {
  return value.toFixed(4);
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function HistogramBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 2 }}>
        <span>{label}</span>
        <span>{count}</span>
      </div>
      <div
        style={{
          height: 20,
          backgroundColor: "#e0e0e0",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            backgroundColor: "#0066cc",
            transition: "width 0.2s",
          }}
        />
      </div>
    </div>
  );
}

export default function RunDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [data, setData] = useState<RunDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [betForm, setBetForm] = useState<CreateBetPayload & { thesis: string }>({
    runId: id,
    direction: "BUY",
    confidence: 50,
    stake: 10,
    thesis: "",
    settleVersion: "v2",
    entryStep: 0,
    exitStep: undefined,
  });
  const [betSubmitting, setBetSubmitting] = useState(false);
  const [runBets, setRunBets] = useState<BetItem[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletSummary, setWalletSummary] = useState<{ available: number; locked: number; total: number } | null>(null);
  const [betSuccess, setBetSuccess] = useState(false);
  const [placingRowKey, setPlacingRowKey] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [timeseries, setTimeseries] = useState<{ points: { step: number; value: number }[] } | null>(null);
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getRunById(id, { debug: debugMode })
      .then(setData)
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, debugMode]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setBetForm((f) => ({ ...f, runId: id }));
  }, [id]);

  const loadRunBets = useCallback(() => {
    if (!id) return;
    const userId = getOrCreateUserId();
    getBets({ userId, limit: 200 }).then(({ items }) => setRunBets(items.filter((b) => b.runId === id))).catch(() => {});
  }, [id]);

  const loadWallet = useCallback(() => {
    getWallet(getOrCreateUserId()).then((w) => setWalletBalance(w.balance)).catch(() => setWalletBalance(null));
  }, []);

  const loadWalletSummary = useCallback(() => {
    getWalletSummary(getOrCreateUserId())
      .then(setWalletSummary)
      .catch(() => setWalletSummary(null));
  }, []);

  useEffect(() => {
    loadRunBets();
  }, [loadRunBets]);

  useEffect(() => {
    loadWalletSummary();
  }, [loadWalletSummary]);

  useEffect(() => {
    if (betModalOpen) {
      loadWallet();
      loadWalletSummary();
    }
  }, [betModalOpen, loadWallet, loadWalletSummary]);

  useEffect(() => {
    const handler = () => {
      loadWalletSummary();
    };
    window.addEventListener("wallet-updated", handler);
    return () => window.removeEventListener("wallet-updated", handler);
  }, [loadWalletSummary]);

  const openBetsForRun = runBets.filter((b) => b.status === "OPEN");
  const openBetCount = openBetsForRun.length;
  const openExposure = openBetsForRun.reduce(
    (sum, b) => sum + ((b as { amount?: number }).amount ?? b.stake ?? 0),
    0,
  );
  const amount = Number(betForm.stake) || 0;
  const available = walletSummary?.available ?? walletBalance ?? 0;
  let disablePlaceBetReason: string | null = null;
  if (available < amount) disablePlaceBetReason = "Insufficient funds";
  else if (openBetCount >= 5) disablePlaceBetReason = "Max open bets reached (5)";
  else if (openExposure + amount > 25) disablePlaceBetReason = "Max exposure reached (25)";
  const canPlaceBet = !disablePlaceBetReason && amount > 0;

  const handlePlaceBet = useCallback(async () => {
    if (!id) return;
    if (betForm.direction === "HOLD") {
      setError("Choose BUY or SELL to place a bet.");
      return;
    }
    if (!canPlaceBet) return;
    setBetSubmitting(true);
    setError(null);
    const openStep = betForm.entryStep ?? 0;
    const payload = {
      userId: getOrCreateUserId(),
      runId: id,
      assetSymbol: "RUN",
      direction: betForm.direction as "BUY" | "SELL",
      amount: Number(betForm.stake),
      openStep,
    };
    console.log("[Place Bet] request payload", payload);
    try {
      await createOpenBet(payload);
      setBetModalOpen(false);
      setBetForm({ runId: id, direction: "BUY", confidence: 50, stake: 10, thesis: "", settleVersion: "v2", entryStep: 0, exitStep: undefined });
      loadRunBets();
      window.dispatchEvent(new CustomEvent("wallet-updated"));
      loadWallet();
      loadWalletSummary();
      setBetSuccess(true);
      setTimeout(() => setBetSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      let displayMsg = msg;
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.message) {
          displayMsg = Array.isArray(parsed.message) ? parsed.message.join(". ") : String(parsed.message);
        }
      } catch {
        if (msg.includes("insufficient funds")) displayMsg = "Insufficient funds";
        else if (msg.includes("max open bets exceeded")) displayMsg = "Max open bets exceeded for run";
        else if (msg.includes("max open exposure exceeded")) displayMsg = "Max open exposure exceeded for run";
      }
      setError(displayMsg);
    } finally {
      setBetSubmitting(false);
    }
  }, [id, betForm.direction, betForm.stake, betForm.entryStep, loadRunBets, loadWallet, loadWalletSummary, canPlaceBet]);

  const handlePlaceBetForDecision = useCallback(
    async (agentId: string, step: number, action: string) => {
      if (!id || (action !== "BUY" && action !== "SELL")) return;
      const rowKey = `${agentId}-${step}`;
      setPlacingRowKey(rowKey);
      setError(null);
      try {
        await createOpenBet({
          userId: getOrCreateUserId(),
          runId: id,
          agentId,
          assetSymbol: "RUN",
          direction: action as "BUY" | "SELL",
          amount: 10,
          openStep: step,
          openPrice: 0,
        });
        setBetSuccess(true);
        setTimeout(() => setBetSuccess(false), 3000);
        window.dispatchEvent(new CustomEvent("wallet-updated"));
        window.dispatchEvent(new CustomEvent("bets-updated"));
        loadRunBets();
        loadWallet();
        loadWalletSummary();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        let displayMsg = msg;
        try {
          const parsed = JSON.parse(msg);
          if (parsed?.message) {
            displayMsg = Array.isArray(parsed.message) ? parsed.message.join(". ") : String(parsed.message);
          }
        } catch {
          if (msg.includes("insufficient funds")) displayMsg = "Insufficient funds";
          else if (msg.includes("max open bets exceeded")) displayMsg = "Max open bets exceeded for run";
          else if (msg.includes("max open exposure exceeded")) displayMsg = "Max open exposure exceeded for run";
        }
        setError(displayMsg);
      } finally {
        setPlacingRowKey(null);
      }
    },
    [id, loadRunBets, loadWallet, loadWalletSummary],
  );

  if (!id) {
    return (
      <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
        <p style={{ color: "#c00" }}>Missing run ID</p>
        <Link href="/runs" style={{ color: "#0066cc" }}>← Back to Runs</Link>
      </main>
    );
  }

  if (loading && !data) {
    return (
      <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
        <p>Loading run…</p>
      </main>
    );
  }

  if (error === "Run not found") {
    return (
      <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ marginBottom: 8 }}>Run not found</h1>
        <p style={{ color: "#666", marginBottom: 16 }}>Run ID: {id}</p>
        <Link href="/runs" style={{ color: "#0066cc", textDecoration: "none" }}>
          ← Back to Runs
        </Link>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
        <p style={{ color: "#c00" }}>Error: {error}</p>
        <Link href="/runs" style={{ color: "#0066cc" }}>← Back to Runs</Link>
      </main>
    );
  }

  const d = data!;
  const hist = d.persistedHistogram ?? { BUY: 0, SELL: 0, HOLD: 0, OTHER: 0 };
  const maxCount = Math.max(hist.BUY, hist.SELL, hist.HOLD, hist.OTHER, 1);
  const m = d.metrics;
  const v = d.validation;

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 800 }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
        <Link href="/runs" style={{ color: "#0066cc", textDecoration: "none" }}>
          ← Back to Runs
        </Link>
        <button
          type="button"
          onClick={() => setBetModalOpen(true)}
          style={{ padding: "6px 12px", cursor: "pointer", backgroundColor: "#0066cc", color: "#fff", border: "none", borderRadius: 4 }}
        >
          Place Bet
        </button>
        <button
          type="button"
          disabled={settling}
          onClick={async () => {
            if (!id) return;
            setSettling(true);
            try {
              await settleBets(id, "v1");
              window.dispatchEvent(new CustomEvent("wallet-updated"));
              loadWallet();
              loadRunBets();
            } finally {
              setSettling(false);
            }
          }}
          style={{ padding: "6px 12px", cursor: settling ? "not-allowed" : "pointer", border: "1px solid #666", borderRadius: 4, opacity: settling ? 0.6 : 1 }}
        >
          {settling ? "Settling…" : "Settle Bets (v1)"}
        </button>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{ padding: "6px 12px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={debugMode}
            onChange={(e) => setDebugMode(Boolean(e.target.checked))}
          />
          <span>Debug</span>
        </label>
        {betSuccess && (
          <span style={{ color: "#0a0", fontWeight: 600, fontSize: 14 }}>Bet placed!</span>
        )}
      </div>

      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, marginBottom: 4 }}>{d.name ?? "Run"}</h1>
        <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
          {d.status} · Started: {formatDate(d.startedAt)} · Finished: {formatDate(d.finishedAt)}
        </p>
        <p style={{ margin: 0, color: "#999", fontSize: 12, fontFamily: "monospace" }}>{d.runId}</p>
      </header>

      <h2 style={{ marginBottom: 12 }}>KPIs</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          { label: "Total PnL", value: formatPnl(m.totalPnl) },
          { label: "Avg PnL", value: formatPnl(m.avgPnl) },
          { label: "Trade Rate", value: m.tradeRate != null ? formatRate(m.tradeRate) : "—" },
          { label: "Buy Rate", value: m.buyRate != null ? formatRate(m.buyRate) : "—" },
          { label: "Sell Rate", value: m.sellRate != null ? formatRate(m.sellRate) : "—" },
          { label: "Hold Rate", value: m.holdRate != null ? formatRate(m.holdRate) : "—" },
          { label: "Pct Profitable", value: `${v.pctProfitableAgents.toFixed(1)}%` },
          { label: "Archetype Disp.", value: v.archetypeDispersion.toFixed(4) },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              padding: 12,
              border: "1px solid #ddd",
              borderRadius: 4,
              backgroundColor: "#fafafa",
            }}
          >
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: "monospace", fontWeight: 600 }}>{value}</div>
          </div>
        ))}
      </div>

      <h2 style={{ marginBottom: 12 }}>Action Histogram (persistedHistogram)</h2>
      <div style={{ marginBottom: 24, maxWidth: 400 }}>
        <HistogramBar label="BUY" count={hist.BUY} max={maxCount} />
        <HistogramBar label="SELL" count={hist.SELL} max={maxCount} />
        <HistogramBar label="HOLD" count={hist.HOLD} max={maxCount} />
        <HistogramBar label="OTHER" count={hist.OTHER} max={maxCount} />
      </div>

      <h2 style={{ marginBottom: 12 }}>Crowd Decisions (v1)</h2>
      <div style={{ marginBottom: 24 }}>
        <button
          type="button"
          disabled={crowdLoading}
          onClick={async () => {
            if (!id) return;
            setCrowdLoading(true);
            setCrowdStep(0);
            setStepDecisions(null);
            try {
              const cs = await getCrowdSummaryDecisions(id, "RUN");
              setCrowdDecisions({
                perStep: cs.perStep,
                recommendation: cs.recommendation,
              });
              if (cs.perStep.length > 0) {
                setCrowdStep(cs.perStep[0].step);
              }
            } catch {
              setCrowdDecisions(null);
            } finally {
              setCrowdLoading(false);
            }
          }}
          style={{ padding: "6px 12px", cursor: crowdLoading ? "not-allowed" : "pointer", border: "1px solid #666", borderRadius: 4, marginBottom: 8 }}
        >
          {crowdLoading ? "Loading…" : "Load Crowd Decisions"}
        </button>
        {crowdDecisions && (
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: "0 0 8px", fontSize: 14, color: "#666" }}>
              Recommendation: <strong>{crowdDecisions.recommendation.action}</strong> (strength: {crowdDecisions.recommendation.strength.toFixed(3)})
            </p>
            <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>Step</label>
            <select
              value={crowdStep}
              onChange={(e) => {
                const s = Number(e.target.value);
                setCrowdStep(s);
              }}
              style={{ padding: 8, minWidth: 80, marginBottom: 8 }}
            >
              {crowdDecisions.perStep.map((ps) => (
                <option key={ps.step} value={ps.step}>
                  {ps.step}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={stepDecisionsLoading}
              onClick={async () => {
                if (!id) return;
                setStepDecisionsLoading(true);
                try {
                  const d = await getDecisions(id, crowdStep, "RUN");
                  setStepDecisions({
                    histogram: d.histogram,
                    avgConfidence: d.avgConfidence,
                    sample: d.sample,
                  });
                } catch {
                  setStepDecisions(null);
                } finally {
                  setStepDecisionsLoading(false);
                }
              }}
              style={{ marginLeft: 8, padding: "6px 12px", cursor: stepDecisionsLoading ? "not-allowed" : "pointer", border: "1px solid #666", borderRadius: 4 }}
            >
              {stepDecisionsLoading ? "Loading…" : "View step"}
            </button>
            {stepDecisions && (
              <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 4, backgroundColor: "#fafafa" }}>
                <p style={{ margin: "0 0 8px", fontSize: 14 }}>
                  Histogram: BUY={stepDecisions.histogram.BUY} SELL={stepDecisions.histogram.SELL} HOLD={stepDecisions.histogram.HOLD} · Avg confidence: {stepDecisions.avgConfidence.toFixed(3)}
                </p>
                {stepDecisions.sample.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Sample rationales</div>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                      {stepDecisions.sample.slice(0, 5).map((s, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>
                          {s.action} (conf: {s.confidence.toFixed(2)}): {s.rationale || "—"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {!crowdDecisions && !crowdLoading && (
          <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
            Run <code>pnpm -C apps/worker run decide -- --runId {id} --steps 20 --seed 123</code> to generate decisions.
          </p>
        )}
      </div>

      <h2 style={{ marginBottom: 12 }}>Timeline</h2>
      <div style={{ marginBottom: 24 }}>
        <button
          type="button"
          disabled={timeseriesLoading}
          onClick={async () => {
            if (!id) return;
            setTimeseriesLoading(true);
            try {
              const ts = await getRunTimeseries(id);
              setTimeseries(ts);
            } catch {
              setTimeseries(null);
            } finally {
              setTimeseriesLoading(false);
            }
          }}
          style={{ padding: "6px 12px", cursor: timeseriesLoading ? "not-allowed" : "pointer", border: "1px solid #666", borderRadius: 4, marginBottom: 8 }}
        >
          {timeseriesLoading ? "Loading…" : "View Run Timeline"}
        </button>
        {timeseries && timeseries.points.length > 0 && (
          <p style={{ margin: 0, fontSize: 14, color: "#666" }}>
            First: step {timeseries.points[0].step} = {timeseries.points[0].value.toFixed(2)} · Last: step {timeseries.points[timeseries.points.length - 1].step} = {timeseries.points[timeseries.points.length - 1].value.toFixed(2)}
          </p>
        )}
      </div>

      {d.warnings.length > 0 && (
        <>
          <h2 style={{ marginBottom: 12 }}>Warnings</h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: 20,
              backgroundColor: "#fff3cd",
              border: "1px solid #ffc107",
              borderRadius: 4,
              padding: "12px 12px 12px 32px",
              marginBottom: 24,
            }}
          >
            {d.warnings.map((w) => (
              <li key={w} style={{ marginBottom: 4 }}><strong>{w}</strong></li>
            ))}
          </ul>
        </>
      )}

      {debugMode && d.debug?.sampleDecisions && d.debug.sampleDecisions.length > 0 && (
        <>
          <h2 style={{ marginBottom: 12 }}>Debug: sampleDecisions (first 20)</h2>
          <table
            border={1}
            cellPadding={8}
            cellSpacing={0}
            style={{ borderCollapse: "collapse", marginBottom: 24, fontSize: 13 }}
          >
            <thead>
              <tr>
                <th>agentId</th>
                <th>step</th>
                <th>action</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {d.debug.sampleDecisions.slice(0, 20).map((sd, i) => {
                const rowKey = `${sd.agentId}-${sd.step}`;
                const canPlace = sd.action === "BUY" || sd.action === "SELL";
                const isPlacing = placingRowKey === rowKey;
                return (
                  <tr key={i}>
                    <td style={{ fontFamily: "monospace" }}>{sd.agentId.slice(0, 8)}…</td>
                    <td>{sd.step}</td>
                    <td>{sd.action}</td>
                    <td>
                      {canPlace && (
                        <button
                          type="button"
                          disabled={isPlacing}
                          onClick={() => handlePlaceBetForDecision(sd.agentId, sd.step, sd.action)}
                          style={{
                            padding: "4px 8px",
                            fontSize: 12,
                            cursor: isPlacing ? "not-allowed" : "pointer",
                            backgroundColor: "#0066cc",
                            color: "#fff",
                            border: "none",
                            borderRadius: 4,
                            opacity: isPlacing ? 0.6 : 1,
                          }}
                        >
                          {isPlacing ? "Placing…" : "Place bet"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <h2 style={{ marginBottom: 12 }}>
        Bets on this run
        {runBets.length > 0 && (() => {
          const pending = runBets.filter((b) => b.status !== "SETTLED").length;
          return pending > 0 ? (
            <span style={{ fontSize: 14, fontWeight: 400, color: "#666", marginLeft: 8 }}>
              ({pending} pending)
            </span>
          ) : null;
        })()}
      </h2>
      {runBets.length === 0 ? (
        <p style={{ color: "#666", marginBottom: 24 }}>No bets yet. Place a bet above.</p>
      ) : (
        <table
          border={1}
          cellPadding={8}
          cellSpacing={0}
          style={{ borderCollapse: "collapse", marginBottom: 24, fontSize: 13 }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th>Direction</th>
              <th>Confidence</th>
              <th>Stake</th>
              <th>Status</th>
              <th>PnL</th>
              <th>Thesis</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {runBets.map((b) => (
              <tr key={b.id}>
                <td>
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        b.direction === "BUY" ? "#0a0" : b.direction === "SELL" ? "#c00" : "#666",
                    }}
                  >
                    {b.direction}
                  </span>
                </td>
                <td>{b.confidence}%</td>
                <td>{b.stake}</td>
                <td>
                  <span
                    style={{
                      fontSize: 12,
                      padding: "2px 6px",
                      borderRadius: 4,
                      backgroundColor: b.status === "SETTLED" ? "#e8f5e9" : "#fff3e0",
                      color: b.status === "SETTLED" ? "#2e7d32" : "#e65100",
                    }}
                  >
                    {formatBetStatus(b.status ?? "")}
                  </span>
                </td>
                <td style={{ fontFamily: "monospace" }}>
                  {b.status === "SETTLED" && b.pnl != null
                    ? (b.pnl >= 0 ? "+" : "") + b.pnl.toFixed(2)
                    : "—"}
                </td>
                <td style={{ maxWidth: 180 }}>{b.thesis || "—"}</td>
                <td style={{ fontSize: 12, color: "#666" }}>{formatDate(b.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {betModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => !betSubmitting && (setBetModalOpen(false), setError(null))}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: 24,
              borderRadius: 8,
              maxWidth: 400,
              width: "90%",
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px" }}>Place Bet</h3>
            {error && (
              <p style={{ color: "#c00", fontSize: 14, marginBottom: 12 }}>{error}</p>
            )}
            {disablePlaceBetReason && (
              <p style={{ color: "#c00", fontSize: 14, marginBottom: 12 }}>{disablePlaceBetReason}</p>
            )}
            {(walletSummary != null || walletBalance != null) && (
              <p style={{ margin: "0 0 12px", fontSize: 14, color: "#666" }}>
                {walletSummary != null ? (
                  <>
                    Available: {walletSummary.available.toFixed(2)} · Locked: {walletSummary.locked.toFixed(2)} ·
                    Total: {walletSummary.total.toFixed(2)} Coins
                  </>
                ) : (
                  <>Balance: {(walletBalance ?? 0).toFixed(2)} coins (loading summary…)</>
                )}
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>Direction</label>
                <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                  {(["BUY", "SELL", "HOLD"] as const).map((d) => (
                    <label key={d} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="direction"
                        value={d}
                        checked={betForm.direction === d}
                        onChange={() => setBetForm((f) => ({ ...f, direction: d }))}
                      />
                      <span>{d}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>Settlement version</label>
                <select
                  value={betForm.settleVersion ?? "v2"}
                  onChange={(e) => setBetForm((f) => ({ ...f, settleVersion: (e.target.value as "v1" | "v2") }))}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="v1">v1 (total PnL sign)</option>
                  <option value="v2">v2 (timeline curve Δ)</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>
                  Confidence: {betForm.confidence}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={betForm.confidence}
                  onChange={(e) =>
                    setBetForm((f) => ({ ...f, confidence: Number(e.target.value) }))
                  }
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>Stake</label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={betForm.stake}
                  onChange={(e) =>
                    setBetForm((f) => ({ ...f, stake: Number(e.target.value) || 10 }))
                  }
                  style={{ width: "100%", padding: 8 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>Thesis (optional)</label>
                <textarea
                  value={betForm.thesis}
                  onChange={(e) => setBetForm((f) => ({ ...f, thesis: e.target.value }))}
                  rows={3}
                  placeholder="Why are you betting this way?"
                  style={{ width: "100%", padding: 8, resize: "vertical" }}
                />
              </div>
              {data?.metrics?.totalSteps != null && data.metrics.totalSteps > 0 && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>Entry step (optional, default 0)</label>
                    <select
                      value={betForm.entryStep ?? 0}
                      onChange={(e) => setBetForm((f) => ({ ...f, entryStep: Number(e.target.value) }))}
                      style={{ width: "100%", padding: 8 }}
                    >
                      {Array.from({ length: data.metrics.totalSteps + 1 }, (_, i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>Exit step (optional, default last)</label>
                    <select
                      value={betForm.exitStep ?? data.metrics.totalSteps}
                      onChange={(e) => {
                        const v = e.target.value;
                        setBetForm((f) => ({ ...f, exitStep: v === "" ? undefined : Number(v) }));
                      }}
                      style={{ width: "100%", padding: 8 }}
                    >
                      <option value="">Last step</option>
                      {Array.from({ length: data.metrics.totalSteps + 1 }, (_, i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => !betSubmitting && (setBetModalOpen(false), setError(null))}
                disabled={betSubmitting}
                style={{ padding: "8px 16px", cursor: betSubmitting ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePlaceBet}
                disabled={betSubmitting || !canPlaceBet || (walletSummary == null && walletBalance == null)}
                style={{
                  padding: "8px 16px",
                  cursor: betSubmitting ? "not-allowed" : "pointer",
                  backgroundColor: "#0066cc",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                }}
              >
                {betSubmitting ? "Submitting…" : "Place Bet"}
              </button>
            </div>
          </div>
        </div>
      )}

      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: "pointer", color: "#666", fontSize: 14 }}>Raw JSON</summary>
        <pre
          style={{
            marginTop: 8,
            padding: 12,
            backgroundColor: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: 4,
            fontSize: 12,
            overflow: "auto",
            maxHeight: 400,
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </main>
  );
}
