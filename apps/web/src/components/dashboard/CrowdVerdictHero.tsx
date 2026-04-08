"use client";

import { useState } from "react";
import type {
  ConsensusSnapshot,
  TradeDirectionDiagnostics,
  TradeDirectionDiagnosticsCrowd,
  TradeDirectionDivergence,
  TradeDirectionDivergenceExplanation,
} from "./crowd-intelligence-types";
import { ExpandToggle } from "./ExpandToggle";

function dominantVerdict(c: ConsensusSnapshot | null | undefined): "BUY" | "SELL" | "HOLD" | null {
  if (c == null) return null;
  const b = c.buyPct ?? 0;
  const s = c.sellPct ?? 0;
  const h = c.holdPct ?? 0;
  if (b >= s && b >= h) return "BUY";
  if (s >= b && s >= h) return "SELL";
  return "HOLD";
}

const verdictStyles: Record<"BUY" | "SELL" | "HOLD", { text: string }> = {
  BUY: { text: "text-emerald-400" },
  SELL: { text: "text-rose-400" },
  HOLD: { text: "text-slate-200" },
};

function shareLine(label: string, longShare: number | null | undefined, shortShare: number | null | undefined) {
  if (longShare == null || shortShare == null || !Number.isFinite(longShare) || !Number.isFinite(shortShare)) {
    return `${label}: —`;
  }
  return `${label}: long ${(longShare * 100).toFixed(1)}% · short ${(shortShare * 100).toFixed(1)}%`;
}

/** Verdict + consensus; optional summary (omit when narrative lives in Advanced Analysis). */
export function CrowdVerdictHero({
  assetSymbol,
  consensus,
  explanation,
  showDivergenceSummary = true,
}: {
  assetSymbol: string;
  consensus: ConsensusSnapshot | null | undefined;
  explanation: TradeDirectionDivergenceExplanation | null | undefined;
  showDivergenceSummary?: boolean;
}) {
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const v = dominantVerdict(consensus ?? null);
  const style = v ? verdictStyles[v] : verdictStyles.HOLD;

  return (
    <section className="border-b border-slate-800/80 pb-10 pt-1" aria-labelledby="crowd-verdict-heading">
      <span className="sr-only">Crowd verdict</span>
      <div className="relative">
        <h2 id="crowd-verdict-heading" className="flex flex-wrap items-end gap-x-4 gap-y-2">
          {v ? (
            <span
              className={`text-7xl font-black tracking-[-0.04em] sm:text-8xl lg:text-9xl ${style.text}`}
            >
              {v}
            </span>
          ) : (
            <span className="text-7xl font-bold text-slate-600 sm:text-8xl lg:text-9xl">—</span>
          )}
          <span className="mb-2 text-base font-medium text-slate-500 sm:text-lg">{assetSymbol}</span>
        </h2>

        {consensus && !metricsExpanded && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/60 pt-5">
            <p className="font-mono text-xs leading-relaxed text-slate-500">
              Majority {Math.round((consensus.majorityPct ?? 0) * 100)}%
              {" · "}
              entropy{" "}
              {consensus.entropy != null && Number.isFinite(consensus.entropy) ? consensus.entropy.toFixed(2) : "—"}
              {" · "}
              B/S/H {((consensus.buyPct ?? 0) * 100).toFixed(0)}/
              {((consensus.sellPct ?? 0) * 100).toFixed(0)}/
              {((consensus.holdPct ?? 0) * 100).toFixed(0)}
            </p>
            <ExpandToggle
              variant="minimal"
              expanded={metricsExpanded}
              onToggle={() => setMetricsExpanded((e) => !e)}
            />
          </div>
        )}
        {consensus && metricsExpanded && (
          <div className="mt-6 border-t border-slate-800/60 pt-5">
            <div className="mb-4 flex justify-end">
              <ExpandToggle
                variant="minimal"
                expanded={metricsExpanded}
                onToggle={() => setMetricsExpanded((e) => !e)}
              />
            </div>
            <dl className="grid gap-6 sm:grid-cols-3 sm:gap-8">
              <div className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Consensus strength</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums leading-none text-slate-100">
                  {Math.round((consensus.majorityPct ?? 0) * 100)}%
                </dd>
                <dd className="mt-1 text-xs text-slate-500">majority share</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Entropy</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums leading-none text-slate-100">
                  {consensus.entropy != null && Number.isFinite(consensus.entropy) ? consensus.entropy.toFixed(3) : "—"}
                </dd>
                <dd className="mt-1 text-xs text-slate-500">disagreement in the crowd</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Split</dt>
                <dd className="mt-1 font-mono text-sm leading-relaxed text-slate-300">
                  B {((consensus.buyPct ?? 0) * 100).toFixed(0)}% · S {((consensus.sellPct ?? 0) * 100).toFixed(0)}% · H{" "}
                  {((consensus.holdPct ?? 0) * 100).toFixed(0)}%
                </dd>
              </div>
            </dl>
          </div>
        )}

        {showDivergenceSummary &&
          (explanation?.summary ? (
            <p className="mt-6 max-w-3xl border-l-2 border-sky-500/30 pl-4 text-base leading-relaxed text-slate-400">
              {explanation.summary}
            </p>
          ) : (
            <p className="mt-6 text-base leading-relaxed text-slate-500">
              No divergence narrative available for this snapshot.
            </p>
          ))}
      </div>
    </section>
  );
}

/** Model vs crowd alignment and shares (use in col-span-4). */
export function ModelDivergencePanel({
  divergence,
  modelDiagnostics,
  crowdDiagnostics,
}: {
  divergence: TradeDirectionDivergence | null | undefined;
  modelDiagnostics: TradeDirectionDiagnostics | null | undefined;
  crowdDiagnostics: TradeDirectionDiagnosticsCrowd | null | undefined;
}) {
  const aligned = divergence?.directionAgreement === true;
  const diverging = divergence?.directionAgreement === false;
  const div = divergence?.divergence;

  return (
    <section className="border-b border-slate-800/60 pb-6 pt-2" aria-label="Model versus crowd">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Model / divergence</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {aligned && (
          <span className="text-sm font-medium text-emerald-400">Aligned with Model</span>
        )}
        {diverging && (
          <span className="text-sm font-medium text-amber-200/90">Diverging from Model</span>
        )}
        {!aligned && !diverging && (
          <span className="text-sm text-slate-500">No agreement flag for this snapshot.</span>
        )}
      </div>
      {div != null && Number.isFinite(div) && (
        <p className="mt-3 text-sm text-slate-400">
          Long-share gap: <span className="font-mono text-slate-200">{(div * 100).toFixed(2)}%</span>
        </p>
      )}
      {(modelDiagnostics || crowdDiagnostics) && (
        <div className="mt-4 space-y-2 border-t border-slate-800/50 pt-4 font-mono text-sm leading-relaxed text-slate-400">
          <span className="block break-words">{shareLine("Model", modelDiagnostics?.longShare, modelDiagnostics?.shortShare)}</span>
          <span className="block break-words">{shareLine("Crowd", crowdDiagnostics?.longShare, crowdDiagnostics?.shortShare)}</span>
        </div>
      )}
    </section>
  );
}
