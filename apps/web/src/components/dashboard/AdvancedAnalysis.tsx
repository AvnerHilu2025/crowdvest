"use client";

import { useState } from "react";
import { ModelDivergencePanel } from "./CrowdVerdictHero";
import { TechnicalDiagnostics } from "./TechnicalDiagnostics";
import type {
  TradeDirectionDiagnostics,
  TradeDirectionDiagnosticsCrowd,
  TradeDirectionDivergence,
  TradeDirectionDivergenceExplanation,
} from "./crowd-intelligence-types";

export function AdvancedAnalysis({
  explanation,
  divergence,
  tradeDirectionDiagnostics,
  tradeDirectionDiagnosticsCrowd,
  rawMetrics,
}: {
  explanation: TradeDirectionDivergenceExplanation | null | undefined;
  divergence: TradeDirectionDivergence | null | undefined;
  tradeDirectionDiagnostics: TradeDirectionDiagnostics | null | undefined;
  tradeDirectionDiagnosticsCrowd: TradeDirectionDiagnosticsCrowd | null | undefined;
  rawMetrics: Record<string, unknown> | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const summary = explanation?.summary?.trim();

  return (
    <section className="border-t border-slate-800/80 pt-8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 py-2 text-left text-sm font-medium text-slate-300 hover:text-slate-100"
        aria-expanded={open}
      >
        <span>{open ? "Hide Advanced Analysis" : "Show Advanced Analysis"}</span>
        <span className="text-slate-500">{open ? "▼" : "▶"}</span>
      </button>
      {!open && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          Narrative, model vs crowd, journey, and raw diagnostics — expand to view.
        </p>
      )}
      {open && (
        <div className="mt-6 space-y-8">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Divergence narrative</h4>
            {summary ? (
              <p className="mt-2 border-l-2 border-sky-500/35 pl-4 text-base leading-relaxed text-slate-300">
                {summary}
              </p>
            ) : (
              <p className="mt-2 text-base leading-relaxed text-slate-500">
                No extended narrative for this snapshot.
              </p>
            )}
          </div>
          <ModelDivergencePanel
            divergence={divergence}
            modelDiagnostics={tradeDirectionDiagnostics}
            crowdDiagnostics={tradeDirectionDiagnosticsCrowd}
          />
          <TechnicalDiagnostics
            tradeDirectionDiagnostics={tradeDirectionDiagnostics}
            tradeDirectionDiagnosticsCrowd={tradeDirectionDiagnosticsCrowd}
            rawMetrics={rawMetrics}
          />
        </div>
      )}
    </section>
  );
}
