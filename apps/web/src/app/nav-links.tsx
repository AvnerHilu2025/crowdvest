"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import { getOrCreateUserId } from "@/lib/identity";

interface WalletSummary {
  available: number;
  locked: number;
  total: number;
}

function isWalletSummary(v: unknown): v is WalletSummary {
  return (
    v != null &&
    typeof v === "object" &&
    typeof (v as WalletSummary).available === "number" &&
    typeof (v as WalletSummary).locked === "number" &&
    typeof (v as WalletSummary).total === "number"
  );
}

async function fetchWalletSummary(userId: string): Promise<unknown> {
  const url = `${API_BASE}/wallet/summary?userId=${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Wallet summary: ${res.status}`);
  const json: unknown = await res.json();
  return json;
}

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/runs", label: "Runs" },
  { href: "/bets", label: "My Bets" },
  { href: "/leaderboard", label: "Leaderboard" },
] as const;

/** Wallet v4 – Read-only. Shows available / locked / total from GET /wallet/summary. */
function WalletPanel() {
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const hasWarned = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call -- getOrCreateUserId returns string; @/lib/identity resolves at build
    const userId = getOrCreateUserId();
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- fetchWalletSummary returns unknown; userId from getOrCreateUserId; raw narrowed by isWalletSummary
      const raw = await fetchWalletSummary(userId);
      setSummary(isWalletSummary(raw) ? raw : null);
      setError(false);
      hasWarned.current = false;
    } catch {
      setSummary(null);
      setError(true);
      if (!hasWarned.current) {
        hasWarned.current = true;
        console.warn("[WalletPanel] getWalletSummary failed");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
    const handler: EventListener = () => {
      void load();
    };
    window.addEventListener("wallet-updated", handler);
    return () => window.removeEventListener("wallet-updated", handler);
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
  }, [load]);

  if (error) {
    return <span className="wallet-muted">Wallet unavailable</span>;
  }
  if (loading && !summary) {
    return <span className="wallet-muted">Wallet: …</span>;
  }
  if (!summary) {
    return null;
  }
  return (
    <span className="wallet-summary">
      Available: {summary.available.toFixed(2)} · Locked: {summary.locked.toFixed(2)} · Total:{" "}
      {summary.total.toFixed(2)} Coins
    </span>
  );
}

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="app-nav">
      {links.map(({ href, label }) => {
        const isActive = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={isActive ? "app-nav-link active" : "app-nav-link"}
          >
            {label}
          </Link>
        );
      })}
      <span className="app-nav-wallet">
        <WalletPanel />
      </span>
    </nav>
  );
}
