import React from "react";
import { KpiCard } from "./kpi-card";

export type KpiItem = {
  title: string;
  value: string;
  hint?: string;
  badge?: string;
};

export function KpiRow({ items }: { items: KpiItem[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
      }}
    >
      {items.map((it) => (
        <KpiCard
          key={it.title}
          title={it.title}
          value={it.value}
          hint={it.hint}
          badge={it.badge}
        />
      ))}
    </div>
  );
}
