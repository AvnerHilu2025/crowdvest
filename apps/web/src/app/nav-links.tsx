"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getWallet } from "@/lib/api";
import { getOrCreateUserId } from "@/lib/identity";

const links = [
  { href: "/", label: "Home" },
  { href: "/runs", label: "Runs" },
  { href: "/bets", label: "My Bets" },
  { href: "/leaderboard", label: "Leaderboard" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  const [balance, setBalance] = useState<number | null>(null);

  const loadWallet = useCallback(() => {
    getWallet(getOrCreateUserId())
      .then((w) => setBalance(w.balance))
      .catch(() => setBalance(null));
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  useEffect(() => {
    const handler = () => loadWallet();
    window.addEventListener("wallet-updated", handler);
    return () => window.removeEventListener("wallet-updated", handler);
  }, [loadWallet]);

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
      {balance != null && (
        <span style={{ marginLeft: "auto", fontSize: 14, color: "#666" }}>
          Wallet: {balance.toFixed(2)} Coins
        </span>
      )}
    </nav>
  );
}
