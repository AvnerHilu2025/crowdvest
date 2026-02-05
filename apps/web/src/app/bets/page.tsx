"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getBetsByUser, getWallet, type BetItem } from "@/lib/api";
import { getOrCreateUserId } from "@/lib/identity";

function formatDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function MyBetsPage() {
  const [items, setItems] = useState<BetItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const loadWallet = useCallback(() => {
    getWallet(getOrCreateUserId())
      .then((w) => setWalletBalance(w.balance))
      .catch(() => setWalletBalance(null));
  }, []);

  useEffect(() => {
    loadWallet();
    const onWalletUpdate = () => loadWallet();
    window.addEventListener("wallet-updated", onWalletUpdate);
    return () => window.removeEventListener("wallet-updated", onWalletUpdate);
  }, [loadWallet]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getBetsByUser(getOrCreateUserId())
      .then(({ items: list, total: t }) => {
        setItems(list);
        setTotal(t);
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
          onClick={load}
          disabled={loading}
          style={{ padding: "6px 12px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <h1 style={{ margin: "0 0 8px" }}>My Bets</h1>
      <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
        Bets for user <code style={{ fontSize: 12 }}>{getOrCreateUserId()}</code>
        {walletBalance !== null && (
          <span style={{ marginLeft: 12, fontWeight: 600 }}>· Wallet: {walletBalance.toFixed(2)} Coins</span>
        )}
      </p>

      {loading && items.length === 0 && <p style={{ marginTop: 24 }}>Loading…</p>}
      {error && (
        <p style={{ color: "#c00", marginTop: 24 }}>Error: {error}</p>
      )}
      {!loading && items.length === 0 && !error && (
        <p style={{ marginTop: 24, color: "#666" }}>No bets yet. Place a bet from a Run Details page.</p>
      )}
      {items.length > 0 && (
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
                <th>Created</th>
                <th>Run</th>
                <th>Direction</th>
                <th>Confidence</th>
                <th>Stake</th>
                <th>Status</th>
                <th>PnL</th>
                <th>Thesis</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontSize: 12, color: "#666" }}>{formatDate(b.createdAt)}</td>
                  <td>
                    <Link href={`/runs/${b.runId}`} style={{ color: "#0066cc", textDecoration: "none" }}>
                      {b.runName ?? b.runId.slice(0, 8) + "…"}
                    </Link>
                  </td>
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
                      {b.status === "SETTLED" ? "Settled" : "Pending"}
                    </span>
                  </td>
                  <td style={{ fontFamily: "monospace" }}>
                    {b.status === "SETTLED" && b.pnl != null ? b.pnl.toFixed(2) : "—"}
                  </td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {b.thesis || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
