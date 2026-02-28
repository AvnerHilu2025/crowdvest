"use client";

import React from "react";
import { clamp01 } from "@/lib/dashboardThresholds";

export function HeaderWithTip(props: {
  label: string;
  tip: string;
  className?: string;
}) {
  const { label, tip, className } = props;
  return (
    <span
      className={className}
      title={tip}
      style={{ cursor: "help", textDecoration: "underline dotted" }}
    >
      {label}
    </span>
  );
}

export function MiniBar(props: {
  value01: number; // normalized 0..1
  label?: string; // optional left label
  title?: string; // tooltip
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const { value01, label, title, tone = "neutral" } = props;

  const v = clamp01(value01);
  const width = `${Math.round(v * 100)}%`;

  // Keep colors subtle & consistent with existing style
  const fillClass =
    tone === "good"
      ? "bg-emerald-400"
      : tone === "warn"
        ? "bg-amber-400"
        : tone === "bad"
          ? "bg-rose-400"
          : "bg-sky-400";

  return (
    <div className="flex items-center gap-2" title={title}>
      {label ? <span className="text-xs text-slate-600 w-10">{label}</span> : null}
      <div className="h-2 w-24 rounded bg-slate-200 overflow-hidden">
        <div className={`h-2 ${fillClass}`} style={{ width }} />
      </div>
    </div>
  );
}

export function StabilityLegend() {
  return (
    <div className="text-xs text-slate-600 flex flex-wrap gap-x-6 gap-y-2">
      <div>
        <span className="font-semibold text-slate-700">Legend:</span>{" "}
        Corr spread: <span className="font-mono">0..1</span> (higher = worse)
      </div>
      <div>
        Sign agreement: <span className="font-mono">0..100%</span> (lower = worse)
      </div>
      <div>
        Acc std dev: <span className="font-mono">0..10%+</span> (higher = worse)
      </div>
      <div className="text-slate-500">
        Tip: hover column headers for definitions.
      </div>
    </div>
  );
}
