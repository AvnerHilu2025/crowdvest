"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getWalletSummary } from "@/lib/api";
import { getOrCreateUserId } from "@/lib/identity";

const links = [
  { href: "/", label: "Home" },
  { href: "/runs", label: "Runs" },
  { href: "/bets", label: "My Bets" },
  { href: "/leaderboard", label: "Leaderboard" },
] as const;

/** Wallet v4 – Read-only. Shows available / locked / total from GET /wallet/summary. */
function WalletPanel() {
  const [summary, setSummary] = useState<{ available: number; locked: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const hasWarned = useRef(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    const userId = getOrCreateUserId();
    getWalletSummary(userId)
      .then((s) => {
        setSummary(s);
        setError(false);
        hasWarned.current = false;
        setLoading(false);
      })
      .catch(() => {
        setSummary(null);
        setError(true);
        setLoading(false);
        if (!hasWarned.current) {
          hasWarned.current = true;
          console.warn("[WalletPanel] getWalletSummary failed");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("wallet-updated", handler);
    return () => window.removeEventListener("wallet-updated", handler);
  }, [load]);

  if (error) {
    return <span style={{ fontSize: 14, color: "#999" }}>Wallet unavailable</span>;
  }
  if (loading && !summary) {
    return <span style={{ fontSize: 14, color: "#999" }}>Wallet: …</span>;
  }
  if (!summary) {
    return null;
  }
  return (
    <span style={{ fontSize: 14, color: "#666" }}>
      Available: {summary.available.toFixed(2)} · Locked: {summary.locked.toFixed(2)} · Total:{" "}
      {summary.total.toFixed(2)} Coins
    </span>
  );
}

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      {links.map(({ href, label }) => {
        const isActive = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            style={{
              color: isActive ? "#333" : "#0066cc",
              textDecoration: "none",
              fontWeight: isActive ? 600 : 400,
            }}
          >
            {label}
          </Link>
        );
      })}
      <span style={{ marginLeft: "auto" }}>
        <WalletPanel />
      </span>
    </nav>
  );
}
