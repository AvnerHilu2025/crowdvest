"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getWallet, getWalletTransactions, type WalletTransactionItem } from "@/lib/api";
import { formatBetStatus } from "@/lib/bet-status-label";
import { getOrCreateUserId } from "@/lib/identity";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4001";

type AgentDetail = { id: string; name: string; archetype: { id: string; name: string }; wallet: { balance: number } };

type BetRow = {
  id: string;
  runId: string;
  agentId: string | null;
  assetSymbol: string | null;
  direction: string;
  amount: number;
  status: string;
  openStep: number | null;
  closeStep: number | null;
  pnl: number | null;
  createdAt: string;
};

function formatDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatTransactionDate(s: string): string {
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

function transactionTypeLabel(type: string): string {
  switch (type) {
    case "SEED":
      return "Initial balance";
    case "BET_DEBIT":
      return "Bet placed";
    case "BET_CREDIT":
      return "Bet settled";
    case "ADJUSTMENT":
      return "Manual adjustment";
    default:
      return type;
  }
}

function shortId(id: string | null | undefined): string {
  if (!id || id.length < 8) return id ?? "";
  return id.slice(0, 8);
}

function transactionDescription(t: WalletTransactionItem): string {
  if (t.note && t.note.trim() !== "") return t.note;
  switch (t.type) {
    case "BET_DEBIT":
      return `Bet placed${t.betId ? ` · betId=${shortId(t.betId)}` : ""}${t.runId ? ` · runId=${shortId(t.runId)}` : ""}`.trim() || "Bet placed";
    case "BET_CREDIT":
      return `Bet settled${t.betId ? ` · betId=${shortId(t.betId)}` : ""}${t.runId ? ` · runId=${shortId(t.runId)}` : ""}`.trim() || "Bet settled";
    case "SEED":
      return "Seeded wallet";
    case "ADJUSTMENT":
      return "Adjustment";
    default:
      return "—";
  }
}

type TransactionsFilter = "all" | "bets" | "adjustments";

function filterTransactions(items: WalletTransactionItem[], filter: TransactionsFilter): WalletTransactionItem[] {
  if (filter === "all") return items;
  if (filter === "bets") return items.filter((t) => t.type === "BET_DEBIT" || t.type === "BET_CREDIT");
  return items.filter((t) => t.type === "ADJUSTMENT" || t.type === "SEED");
}

export default function MyBetsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [items, setItems] = useState<BetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionItem[]>([]);
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [transactionsLimit, setTransactionsLimit] = useState(20);
  const [transactionsFilter, setTransactionsFilter] = useState<TransactionsFilter>("all");

  useEffect(() => {
    const uid = getOrCreateUserId();
    setUserId(uid);
    console.log("[bets] apiBase", API_BASE);
    console.log("[bets] userId", uid);
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/me?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        console.log("[bets] /me", res.status, data);
        setDisplayName(data?.displayName ?? null);
      } catch (e) {
        console.log("[bets] /me", "error", e);
        setDisplayName(null);
      }
    })();
  }, [userId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/results/runs?limit=1`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        const id = data?.items?.[0]?.id ?? null;
        setRunId(id);
        console.log("[bets] latestRunId", id ?? "(none)");
      } catch {
        setRunId(null);
        console.log("[bets] latestRunId", "(failed)");
      }
    })();
  }, []);

  useEffect(() => {
    if (!runId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/results/agents?run_id=${encodeURIComponent(runId)}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        const first = Array.isArray(data?.items) && data.items.length > 0 ? data.items[0] : null;
        const picked = first?.agentId ?? null;
        setAgentId(picked);
        console.log("[bets] pickedAgentId", picked ?? "(none)");
      } catch {
        setAgentId(null);
        console.log("[bets] pickedAgentId", "(failed)");
      }
    })();
  }, [runId]);

  useEffect(() => {
    if (!agentId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(agentId)}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        console.log("[bets] agent", res.status, data);
        if (res.ok && data?.name != null) {
          setAgent(data as AgentDetail);
        } else {
          setAgent(null);
        }
      } catch (e) {
        console.log("[bets] agent", "error", e);
        setAgent(null);
      }
    })();
  }, [agentId]);

  const loadWallet = useCallback(() => {
    if (!userId) return;
    getWallet(userId)
      .then((w) => setWalletBalance(w.balance))
      .catch(() => setWalletBalance(null));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadWallet();
    const onWalletUpdate = () => loadWallet();
    window.addEventListener("wallet-updated", onWalletUpdate);
    return () => window.removeEventListener("wallet-updated", onWalletUpdate);
  }, [userId, loadWallet]);

  const loadRunContext = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/results/runs?limit=1`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      const id = data?.items?.[0]?.id ?? null;
      setRunId(id);
      if (!id) {
        setAgentId(null);
        setAgent(null);
        return;
      }
      const res2 = await fetch(`${API_BASE}/results/agents?run_id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data2 = await res2.json().catch(() => null);
      const first = Array.isArray(data2?.items) && data2.items.length > 0 ? data2.items[0] : null;
      const picked = first?.agentId ?? null;
      setAgentId(picked ?? null);
      if (!picked) {
        setAgent(null);
        return;
      }
      const res3 = await fetch(`${API_BASE}/agents/${encodeURIComponent(picked)}`, { cache: "no-store" });
      const data3 = await res3.json().catch(() => null);
      if (res3.ok && data3?.name != null) {
        setAgent(data3 as AgentDetail);
      } else {
        setAgent(null);
      }
    } catch {
      setRunId(null);
      setAgentId(null);
      setAgent(null);
    }
  }, []);

  const load = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/bets?userId=${encodeURIComponent(userId)}&limit=50`, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({ items: [], total: 0 }))) as { items?: BetRow[]; total?: number };
        const list = Array.isArray(data?.items) ? data.items : [];
        const t = typeof data?.total === "number" ? data.total : 0;
        setItems(list);
        setTotal(t);
        console.log("[bets] bets status", res.status, "count", t);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setItems([]);
        setTotal(0);
        console.log("[bets] bets status", "error", "count", 0);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userId]);

  const loadTransactions = useCallback(() => {
    if (!userId) return;
    setTransactionsError(null);
    getWalletTransactions(userId, transactionsLimit)
      .then(({ items, total }) => {
        setTransactions(items);
        setTransactionsTotal(total);
      })
      .catch((err) => {
        setTransactions([]);
        setTransactionsTotal(0);
        setTransactionsError(err instanceof Error ? err.message : "Failed to load transactions");
      });
  }, [userId, transactionsLimit]);

  const refreshAll = useCallback(() => {
    loadRunContext();
    loadWallet();
    load();
    loadTransactions();
  }, [loadRunContext, loadWallet, load, loadTransactions]);

  useEffect(() => {
    if (!userId) return;
    load();
  }, [userId, load]);

  useEffect(() => {
    if (!userId) return;
    loadTransactions();
  }, [userId, loadTransactions]);

  const handleLoadMoreTransactions = useCallback(() => {
    setTransactionsLimit((prev) => prev + 20);
  }, []);

  useEffect(() => {
    const onBetsUpdated = () => {
      load();
      loadTransactions();
    };
    window.addEventListener("bets-updated", onBetsUpdated);
    return () => window.removeEventListener("bets-updated", onBetsUpdated);
  }, [load, loadTransactions]);

  useEffect(() => {
    const onWalletUpdate = () => loadTransactions();
    window.addEventListener("wallet-updated", onWalletUpdate);
    return () => window.removeEventListener("wallet-updated", onWalletUpdate);
  }, [loadTransactions]);

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 900 }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, alignItems: "center" }}>
        <Link href="/" style={{ color: "#0066cc", textDecoration: "none" }}>
          ← Home
        </Link>
        <Link href="/runs" style={{ color: "#0066cc", textDecoration: "none" }}>
          Runs
        </Link>
        <button
          type="button"
          onClick={refreshAll}
          disabled={loading}
          style={{ padding: "6px 12px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <h1 style={{ margin: "0 0 8px" }}>My Bets</h1>
      <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
        User: <code style={{ fontSize: 12 }}>{displayName ?? userId ?? "…"}</code>
        {runId != null && agentId == null && (
          <span style={{ marginLeft: 8, fontSize: 12, color: "#999" }}>· Loading latest run agent…</span>
        )}
        {agent != null && (
          <>
            <span style={{ marginLeft: 12 }}>· Latest Run Agent: <code style={{ fontSize: 12 }}>{agent.name}</code> ({agent.archetype?.name ?? "—"})</span>
            {agent.wallet != null && (
              <span style={{ marginLeft: 8, fontWeight: 600 }}>· Agent wallet: {agent.wallet.balance.toFixed(2)} Coins</span>
            )}
          </>
        )}
        {runId != null && agentId != null && agent == null && (
          <span style={{ marginLeft: 8, fontSize: 12, color: "#999" }}>· Could not load latest run agent.</span>
        )}
        {runId == null && (
          <span style={{ marginLeft: 8, fontSize: 12, color: "#999" }}>· No run available for agent context.</span>
        )}
        {walletBalance !== null && (
          <span style={{ marginLeft: 12, fontWeight: 600 }}>· Your wallet: {walletBalance.toFixed(2)} Coins</span>
        )}
      </p>

      {loading && total === 0 && <p style={{ marginTop: 24 }}>Loading…</p>}
      {error && (
        <p style={{ color: "#c00", marginTop: 24 }}>Error: {error}</p>
      )}
      {!loading && total === 0 && !error && (
        <p style={{ marginTop: 24, color: "#666" }}>No bets yet. Place a bet from a Run Details page.</p>
      )}
      {total > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
            {total} bet{total !== 1 ? "s" : ""}
          </p>
          <table
            border={1}
            cellPadding={10}
            cellSpacing={0}
            style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f5f5f5" }}>
                <th>Date</th>
                <th>Run</th>
                <th>Asset</th>
                <th>Dir</th>
                <th>Amount</th>
                <th>Status</th>
                <th>PnL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontSize: 12, color: "#666" }}>{formatDate(b.createdAt)}</td>
                  <td>
                    <Link href={`/runs/${b.runId}`} style={{ color: "#0066cc", textDecoration: "none" }}>
                      {b.runId.slice(0, 8)}…
                    </Link>
                  </td>
                  <td>{b.assetSymbol ?? "—"}</td>
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
                  <td>{b.amount}</td>
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
                      {formatBetStatus(b.status)}
                    </span>
                  </td>
                  <td style={{ fontFamily: "monospace" }}>
                    {b.status === "SETTLED" && b.pnl != null
                      ? (b.pnl >= 0 ? "+" : "") + b.pnl.toFixed(2)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ marginTop: 32, marginBottom: 12, fontSize: 18 }}>Wallet Transactions</h2>
      {transactionsError && (
        <p style={{ color: "#c00", fontSize: 14 }}>{transactionsError}</p>
      )}
      {!transactionsError && (
        <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {(["all", "bets", "adjustments"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setTransactionsFilter(f)}
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                border: "1px solid #ccc",
                borderRadius: 4,
                backgroundColor: transactionsFilter === f ? "#0066cc" : "#fff",
                color: transactionsFilter === f ? "#fff" : "#333",
              }}
            >
              {f === "all" ? "All" : f === "bets" ? "Bets" : "Adjustments"}
            </button>
          ))}
        </div>
      )}
      {!transactionsError && transactions.length === 0 && (
        <p style={{ color: "#666", fontSize: 14 }}>No transactions yet.</p>
      )}
      {!transactionsError && transactions.length > 0 && (() => {
        const filtered = filterTransactions(transactions, transactionsFilter);
        if (filtered.length === 0) {
          return <p style={{ color: "#666", fontSize: 14 }}>No transactions in this filter.</p>;
        }
        return (
          <>
            <table
              border={1}
              cellPadding={10}
              cellSpacing={0}
              style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f5f5f5" }}>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const amountStr = (t.amount >= 0 ? "+" : "") + t.amount.toFixed(2);
                  const amountColor =
                    t.type === "SEED" ? "#666" : t.amount > 0 ? "#0a0" : t.amount < 0 ? "#c00" : "#666";
                  return (
                    <tr key={t.id}>
                      <td style={{ fontSize: 12, color: "#666" }}>{formatTransactionDate(t.createdAt)}</td>
                      <td>{transactionTypeLabel(t.type)}</td>
                      <td style={{ fontFamily: "monospace", color: amountColor }}>{amountStr}</td>
                      <td style={{ fontSize: 12, color: "#666" }}>{transactionDescription(t)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {transactionsLimit < transactionsTotal && (
              <button
                type="button"
                onClick={handleLoadMoreTransactions}
                style={{
                  marginTop: 12,
                  padding: "6px 12px",
                  cursor: "pointer",
                  border: "1px solid #666",
                  borderRadius: 4,
                }}
              >
                Load more
              </button>
            )}
          </>
        );
      })()}
    </main>
  );
}
