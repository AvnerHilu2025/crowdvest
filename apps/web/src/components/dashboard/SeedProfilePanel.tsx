"use client";

import React from "react";

export type SeedProfile = {
  seed: number;
  buyPct: number;
  sellPct: number;
  holdPct: number;
  netBias: number;
  dominantDirection: "BUY" | "SELL" | "HOLD";
};

type SeedProfilePanelProps = {
  seedProfiles: SeedProfile[];
};

function netBiasHighlight(netBias: number): string {
  if (netBias > 0.2) return "bg-green-100 text-green-800 ring-1 ring-green-200";
  if (netBias < -0.2) return "bg-red-100 text-red-800 ring-1 ring-red-200";
  return "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
}

export function SeedProfilePanel({ seedProfiles }: SeedProfilePanelProps) {
  if (seedProfiles.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12 }}>
        Seed behavioral profile
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        {seedProfiles.map((p) => (
          <div
            key={p.seed}
            style={{
              border: "1px solid rgba(15, 23, 42, 0.1)",
              borderRadius: 8,
              padding: 12,
              background: "rgba(15, 23, 42, 0.02)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12 }}>
              Seed {p.seed}
            </div>
            <div
              style={{
                display: "flex",
                height: 16,
                borderRadius: 4,
                overflow: "hidden",
                background: "rgba(15, 23, 42, 0.06)",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: `${p.buyPct * 100}%`,
                  background: "#22c55e",
                  minWidth: p.buyPct > 0 ? 2 : 0,
                }}
                title={`BUY ${(p.buyPct * 100).toFixed(1)}%`}
              />
              <div
                style={{
                  width: `${p.sellPct * 100}%`,
                  background: "#ef4444",
                  minWidth: p.sellPct > 0 ? 2 : 0,
                }}
                title={`SELL ${(p.sellPct * 100).toFixed(1)}%`}
              />
              <div
                style={{
                  width: `${p.holdPct * 100}%`,
                  background: "#94a3b8",
                  minWidth: p.holdPct > 0 ? 2 : 0,
                }}
                title={`HOLD ${(p.holdPct * 100).toFixed(1)}%`}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: "rgba(15, 23, 42, 0.6)",
                marginBottom: 6,
              }}
            >
              <span>BUY {(p.buyPct * 100).toFixed(0)}%</span>
              <span>SELL {(p.sellPct * 100).toFixed(0)}%</span>
              <span>HOLD {(p.holdPct * 100).toFixed(0)}%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${netBiasHighlight(p.netBias)}`}
                title="netBias = buyPct - sellPct"
              >
                netBias: {p.netBias.toFixed(2)}
              </span>
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                  p.dominantDirection === "BUY"
                    ? "bg-green-100 text-green-700"
                    : p.dominantDirection === "SELL"
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {p.dominantDirection}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
