"use client";

import { useState } from "react";
import type { TradeDirectionDiagnostics, TradeDirectionDiagnosticsCrowd } from "./crowd-intelligence-types";

export function TechnicalDiagnostics({
  tradeDirectionDiagnostics,
  tradeDirectionDiagnosticsCrowd,
  rawMetrics,
}: {
  tradeDirectionDiagnostics: TradeDirectionDiagnostics | null | undefined;
  tradeDirectionDiagnosticsCrowd: TradeDirectionDiagnosticsCrowd | null | undefined;
  rawMetrics: Record<string, unknown> | null | undefined;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-950/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-medium leading-snug text-slate-300 hover:bg-slate-800/40"
        aria-expanded={open}
      >
        <span>Technical diagnostics</span>
        <span className="text-slate-500">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div className="space-y-8 border-t border-slate-700/60 px-5 py-6">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Model trade direction</h4>
            <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-slate-900/80 p-4 font-mono text-sm leading-relaxed text-slate-400">
              {tradeDirectionDiagnostics
                ? JSON.stringify(tradeDirectionDiagnostics, null, 2)
                : "—"}
            </pre>
          </div>
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Crowd trade direction</h4>
            <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-slate-900/80 p-4 font-mono text-sm leading-relaxed text-slate-400">
              {tradeDirectionDiagnosticsCrowd
                ? JSON.stringify(tradeDirectionDiagnosticsCrowd, null, 2)
                : "—"}
            </pre>
          </div>
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Raw metrics snapshot</h4>
            <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-slate-900/80 p-4 font-mono text-sm leading-relaxed text-slate-400">
              {rawMetrics && Object.keys(rawMetrics).length > 0
                ? JSON.stringify(rawMetrics, null, 2)
                : "—"}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
