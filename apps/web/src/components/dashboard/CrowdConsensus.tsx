"use client";

import React from "react";

export type ConsensusData = {
  buyPct: number;
  sellPct: number;
  holdPct: number;
  majorityPct: number;
  entropy: number;
  polarization: number;
};

type CrowdConsensusProps = {
  data: ConsensusData | null;
};

const MAX_ENTROPY = Math.log2(3);

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function CrowdConsensus({ data }: CrowdConsensusProps) {
  if (!data) {
    return (
      <div
        style={{
          border: "1px solid rgba(15, 23, 42, 0.10)",
          borderRadius: 10,
          padding: 24,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 100,
          color: "rgba(15, 23, 42, 0.55)",
          fontSize: 14,
        }}
      >
        No consensus data available
      </div>
    );
  }

  const { buyPct, sellPct, holdPct, majorityPct, entropy, polarization } = data;
  const entropy01 = clamp01(entropy / MAX_ENTROPY);
  const polarization01 = clamp01(polarization);

  const majorityStrength: "strong" | "medium" | "weak" =
    majorityPct > 0.7 ? "strong" : majorityPct >= 0.5 ? "medium" : "weak";

  const majorityColor =
    majorityStrength === "strong"
      ? "rgba(15, 23, 42, 0.95)"
      : majorityStrength === "medium"
        ? "rgba(15, 23, 42, 0.8)"
        : "rgba(15, 23, 42, 0.6)";

  const majorityFontWeight = majorityStrength === "strong" ? 700 : 600;

  return (
    <div
      style={{
        border: "1px solid rgba(15, 23, 42, 0.10)",
        borderRadius: 10,
        padding: 16,
        marginBottom: 24,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>
        Crowd Consensus
      </div>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            height: 24,
            borderRadius: 6,
            overflow: "hidden",
            background: "rgba(15, 23, 42, 0.06)",
          }}
        >
          <div
            style={{
              width: `${buyPct * 100}%`,
              background: "#22c55e",
              minWidth: buyPct > 0 ? 2 : 0,
            }}
            title={`BUY ${(buyPct * 100).toFixed(1)}%`}
          />
          <div
            style={{
              width: `${sellPct * 100}%`,
              background: "#ef4444",
              minWidth: sellPct > 0 ? 2 : 0,
            }}
            title={`SELL ${(sellPct * 100).toFixed(1)}%`}
          />
          <div
            style={{
              width: `${holdPct * 100}%`,
              background: "#94a3b8",
              minWidth: holdPct > 0 ? 2 : 0,
            }}
            title={`HOLD ${(holdPct * 100).toFixed(1)}%`}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 6,
            fontSize: 11,
            color: "rgba(15, 23, 42, 0.6)",
          }}
        >
          <span>BUY {(buyPct * 100).toFixed(1)}%</span>
          <span>SELL {(sellPct * 100).toFixed(1)}%</span>
          <span>HOLD {(holdPct * 100).toFixed(1)}%</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.5)", marginBottom: 4 }}>
            Majority
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: majorityFontWeight,
              color: majorityColor,
              fontVariantNumeric: "tabular-nums",
            }}
            title="Largest share (BUY, SELL, or HOLD)"
          >
            {(majorityPct * 100).toFixed(1)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.5)", marginBottom: 4 }}>
            Entropy
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                background: "rgba(15, 23, 42, 0.08)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${entropy01 * 100}%`,
                  height: "100%",
                  background: "#0ea5e9",
                  borderRadius: 4,
                }}
                title={`Entropy: ${entropy.toFixed(3)} (0–1 normalized: ${entropy01.toFixed(2)})`}
              />
            </div>
            <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", minWidth: 36 }}>
              {entropy01.toFixed(2)}
            </span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "rgba(15, 23, 42, 0.5)", marginBottom: 4 }}>
            Polarization
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                background: "rgba(15, 23, 42, 0.08)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${polarization01 * 100}%`,
                  height: "100%",
                  background: "#f59e0b",
                  borderRadius: 4,
                }}
                title={`Polarization: |buyPct - sellPct| = ${polarization.toFixed(3)}`}
              />
            </div>
            <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", minWidth: 36 }}>
              {polarization01.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
