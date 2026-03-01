import React from "react";

type Props = {
  title: string;
  value: string;
  hint?: string;
  badge?: string;
};

export function KpiCard({ title, value, hint, badge }: Props) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid rgba(15, 23, 42, 0.10)",
        background: "#fff",
        padding: 16,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(15, 23, 42, 0.92)" }}>
          {title}
        </div>
        {badge ? (
          <span
            style={{
              borderRadius: 6,
              background: "rgba(148, 163, 184, 0.16)",
              padding: "2px 8px",
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(15, 23, 42, 0.70)",
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 24,
          fontWeight: 700,
          color: "rgba(15, 23, 42, 0.95)",
        }}
      >
        {value}
      </div>
      {hint ? (
        <div style={{ marginTop: 4, fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
