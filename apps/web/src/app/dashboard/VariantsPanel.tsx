"use client";

import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api";

export type VariantCompareRow = {
  name: string;
  accuracy: number | null;
  baselineBuy: number | null;
  pnl: number | null;
};

function parseVariantsPayload(json: unknown): VariantCompareRow[] {
  if (!Array.isArray(json)) return [];
  const out: VariantCompareRow[] = [];
  for (const item of json) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    let baselineBuy: number | null = null;
    const bl = o.baseline;
    if (bl && typeof bl === "object" && bl !== null) {
      const buy = (bl as Record<string, unknown>).buy;
      if (typeof buy === "number" && Number.isFinite(buy)) baselineBuy = buy;
    }
    if (baselineBuy == null && typeof o.baselineBuy === "number" && Number.isFinite(o.baselineBuy)) {
      baselineBuy = o.baselineBuy;
    }
    const accuracy =
      typeof o.accuracy === "number" && Number.isFinite(o.accuracy) ? o.accuracy : null;
    const pnl = typeof o.pnl === "number" && Number.isFinite(o.pnl) ? o.pnl : null;
    const name = typeof o.name === "string" ? o.name : "—";
    if (accuracy == null && pnl == null && baselineBuy == null) continue;
    out.push({ name, accuracy, baselineBuy, pnl });
  }
  return out;
}

function pct01(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function pnlFmt(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(2)}`;
}

export function VariantsPanel({ runId }: { runId: string | null }) {
  const [rows, setRows] = useState<VariantCompareRow[] | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    if (!runId?.trim()) {
      setRows(null);
      setLoadState("idle");
      return;
    }
    let cancelled = false;
    setLoadState("loading");
    setRows(null);
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/variants?runId=${encodeURIComponent(runId.trim())}`,
          { cache: "no-store", headers: { accept: "application/json" } },
        );
        if (!res.ok) {
          if (!cancelled) {
            setRows([]);
            setLoadState("done");
          }
          return;
        }
        const data: unknown = await res.json();
        if (!cancelled) {
          setRows(parseVariantsPayload(data));
          setLoadState("done");
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setLoadState("done");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const bestIndex = useMemo(() => {
    if (!rows?.length) return -1;
    let best = -1;
    let bestAcc = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < rows.length; i++) {
      const a = rows[i]!.accuracy;
      if (a == null || !Number.isFinite(a)) continue;
      if (a > bestAcc) {
        bestAcc = a;
        best = i;
      }
    }
    return best;
  }, [rows]);

  if (!runId?.trim()) return null;
  if (loadState === "loading" || rows === null) {
    return (
      <div
        data-testid="variants-comparison-panel"
        style={{
          border: "1px solid rgba(15, 23, 42, 0.10)",
          borderRadius: 10,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Variant comparison</div>
        <div style={{ fontSize: 13, color: "rgba(15, 23, 42, 0.45)" }}>Loading variants…</div>
      </div>
    );
  }
  if (rows.length === 0) return null;

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(15, 23, 42, 0.55)",
    padding: "8px 10px",
    borderBottom: "1px solid rgba(15, 23, 42, 0.12)",
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 10px",
    fontSize: 13,
    color: "rgba(15, 23, 42, 0.92)",
    borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <div
      data-testid="variants-comparison-panel"
      style={{
        border: "1px solid rgba(15, 23, 42, 0.10)",
        borderRadius: 10,
        padding: 16,
        marginBottom: 24,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Variant comparison</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 360 }}>
          <thead>
            <tr>
              <th style={thStyle}>Variant</th>
              <th style={thStyle}>Accuracy</th>
              <th style={thStyle}>Baseline</th>
              <th style={thStyle}>PnL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isBest = i === bestIndex && bestIndex >= 0;
              return (
                <tr
                  key={`${r.name}-${i}`}
                  style={{
                    background: isBest ? "rgba(220, 252, 231, 0.85)" : undefined,
                    boxShadow: isBest ? "inset 3px 0 0 #16a34a" : undefined,
                  }}
                >
                  <td style={{ ...tdStyle, fontWeight: isBest ? 600 : 500 }}>{r.name}</td>
                  <td style={tdStyle}>{pct01(r.accuracy)}</td>
                  <td style={tdStyle}>{pct01(r.baselineBuy)}</td>
                  <td
                    style={{
                      ...tdStyle,
                      color:
                        r.pnl == null
                          ? tdStyle.color
                          : r.pnl >= 0
                            ? "#15803d"
                            : "#b91c1c",
                    }}
                  >
                    {pnlFmt(r.pnl)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
