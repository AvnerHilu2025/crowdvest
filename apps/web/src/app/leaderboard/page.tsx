"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getLeaderboard,
  type LeaderboardWalletRow,
  type LeaderboardAccuracyRow,
} from "@/lib/api";

type Tab = "wallet" | "accuracy";

export default function LeaderboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const byParam = (searchParams.get("by") ?? "wallet") as Tab;
  const initialTab: Tab = byParam === "accuracy" ? "accuracy" : "wallet";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [walletRows, setWalletRows] = useState<LeaderboardWalletRow[]>([]);
  const [accuracyRows, setAccuracyRows] = useState<LeaderboardAccuracyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((by: Tab) => {
    setLoading(true);
    setError(null);
    getLeaderboard({ by, limit: 10 })
      .then((rows) => {
        if (by === "wallet") {
          setWalletRows(rows as LeaderboardWalletRow[]);
        } else {
          setAccuracyRows(rows as LeaderboardAccuracyRow[]);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const setTabAndUrl = useCallback((t: Tab) => {
    setTab(t);
    router.replace(`/leaderboard?by=${t}`, { scroll: false });
  }, [router]);

  /** Show displayName when present; otherwise shortened userId (first 8 chars). */
  const userLabel = (userId: string, displayName?: string | null) =>
    displayName ?? (userId.slice(0, 8) + (userId.length > 8 ? "…" : ""));

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 900 }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
        <Link href="/" style={{ color: "#0066cc", textDecoration: "none" }}>
          ← Home
        </Link>
        <Link href="/runs" style={{ color: "#0066cc", textDecoration: "none" }}>
          Runs
        </Link>
        <Link href="/bets" style={{ color: "#0066cc", textDecoration: "none" }}>
          My Bets
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setTabAndUrl("wallet")}
            style={{
              padding: "6px 12px",
              cursor: "pointer",
              border: "1px solid #ccc",
              borderRadius: 4,
              backgroundColor: tab === "wallet" ? "#0066cc" : "#fff",
              color: tab === "wallet" ? "#fff" : "#333",
            }}
          >
            Wallet
          </button>
          <button
            type="button"
            onClick={() => setTabAndUrl("accuracy")}
            style={{
              padding: "6px 12px",
              cursor: "pointer",
              border: "1px solid #ccc",
              borderRadius: 4,
              backgroundColor: tab === "accuracy" ? "#0066cc" : "#fff",
              color: tab === "accuracy" ? "#fff" : "#333",
            }}
          >
            Accuracy
          </button>
        </div>
        <button
          type="button"
          onClick={() => load(tab)}
          disabled={loading}
          style={{ padding: "6px 12px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <h1 style={{ margin: "0 0 8px" }}>Leaderboard</h1>
      <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
        {tab === "wallet" ? "Ranked by wallet score (BUY/SELL * stake * run PnL)" : "Ranked by prediction accuracy"}
      </p>

      {loading && (tab === "wallet" ? walletRows : accuracyRows).length === 0 && (
        <p style={{ marginTop: 24 }}>Loading…</p>
      )}
      {error && <p style={{ color: "#c00", marginTop: 24 }}>Error: {error}</p>}

      {tab === "wallet" && walletRows.length > 0 && (
        <table
          border={1}
          cellPadding={10}
          cellSpacing={0}
          style={{ borderCollapse: "collapse", width: "100%", marginTop: 24, fontSize: 14 }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th>Rank</th>
              <th>User</th>
              <th>Wallet</th>
              <th>Bets</th>
            </tr>
          </thead>
          <tbody>
            {walletRows.map((r) => (
              <tr key={r.userId}>
                <td>{r.rank}</td>
                <td style={r.displayName ? undefined : { fontFamily: "monospace" }}>
                  {userLabel(r.userId, r.displayName)}
                </td>
                <td style={{ fontFamily: "monospace" }}>{r.wallet.toFixed(2)}</td>
                <td>{r.betsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "accuracy" && accuracyRows.length > 0 && (
        <table
          border={1}
          cellPadding={10}
          cellSpacing={0}
          style={{ borderCollapse: "collapse", width: "100%", marginTop: 24, fontSize: 14 }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th>Rank</th>
              <th>User</th>
              <th>Accuracy (%)</th>
              <th>Evaluated</th>
              <th>Bets</th>
            </tr>
          </thead>
          <tbody>
            {accuracyRows.map((r) => (
              <tr key={r.userId}>
                <td>{r.rank}</td>
                <td style={r.displayName ? undefined : { fontFamily: "monospace" }}>
                  {userLabel(r.userId, r.displayName)}
                </td>
                <td>{Math.round(r.accuracy)}%</td>
                <td>{r.evaluatedBets}</td>
                <td>{r.betsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && (tab === "wallet" ? walletRows : accuracyRows).length === 0 && !error && (
        <p style={{ marginTop: 24, color: "#666" }}>No leaderboard data yet.</p>
      )}
    </main>
  );
}
