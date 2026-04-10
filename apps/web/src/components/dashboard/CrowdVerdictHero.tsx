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
  BUY: { text: "text-[#22C55E]" },
  SELL: { text: "text-[#EF4444]" },
  HOLD: { text: "text-amber-200" },
};

type CrowdMarker = "BUY" | "SELL" | "HOLD";

function buildCrowdMarkers(consensus: ConsensusSnapshot | null | undefined, count = 48): CrowdMarker[] {
  const b = Math.max(0, consensus?.buyPct ?? 0);
  const s = Math.max(0, consensus?.sellPct ?? 0);
  const h = Math.max(0, consensus?.holdPct ?? 0);
  const total = b + s + h;
  if (total <= 0) return Array.from({ length: count }, () => "HOLD" as const);
  const buyN = Math.round((b / total) * count);
  const sellN = Math.round((s / total) * count);
  const holdN = Math.max(0, count - buyN - sellN);
  return [
    ...Array.from({ length: buyN }, () => "BUY" as const),
    ...Array.from({ length: sellN }, () => "SELL" as const),
    ...Array.from({ length: holdN }, () => "HOLD" as const),
  ];
}

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
  const crowdMarkers = buildCrowdMarkers(consensus, 48);

  return (
    <section className="border-b border-slate-800/80 pb-10 pt-1" aria-labelledby="crowd-verdict-heading">
      <span className="sr-only">Crowd verdict</span>
      <div className="relative">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-4">
            <h2 id="crowd-verdict-heading" className="flex flex-col gap-2">
              {v ? (
                <span className={`text-7xl font-black tracking-[-0.04em] sm:text-8xl ${style.text}`}>{v}</span>
              ) : (
                <span className="text-7xl font-bold text-slate-600 sm:text-8xl">—</span>
              )}
              <span className="text-4xl font-black tracking-tight text-slate-100 sm:text-5xl">{assetSymbol}</span>
            </h2>
            <p className="mt-2 text-sm text-slate-400">Crowd state from aggregated persona decisions.</p>
          </div>

          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Crowd band</p>
              <div className="mt-3 grid grid-cols-12 gap-1.5">
                {crowdMarkers.map((marker, idx) => (
                  <span
                    key={`${marker}-${idx}`}
                    className={`h-3.5 w-3.5 rounded-full ${
                      marker === "BUY"
                        ? "bg-[#22C55E]"
                        : marker === "SELL"
                          ? "bg-[#EF4444]"
                          : "bg-slate-300/70"
                    }`}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/40 p-4">
              <div className="mb-2 flex justify-end">
                <ExpandToggle variant="minimal" expanded={metricsExpanded} onToggle={() => setMetricsExpanded((e) => !e)} />
              </div>
              <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <div className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Consensus</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums leading-none text-slate-100">
                    {Math.round((consensus?.majorityPct ?? 0) * 100)}%
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Entropy</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums leading-none text-slate-100">
                    {consensus?.entropy != null && Number.isFinite(consensus.entropy) ? consensus.entropy.toFixed(2) : "—"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Split</dt>
                  <dd className="mt-1 font-mono text-sm leading-relaxed text-slate-200">
                    <span className="text-[#22C55E]">B</span> {((consensus?.buyPct ?? 0) * 100).toFixed(0)}% ·{" "}
                    <span className="text-[#EF4444]">S</span> {((consensus?.sellPct ?? 0) * 100).toFixed(0)}% ·{" "}
                    <span className="text-slate-300">H</span> {((consensus?.holdPct ?? 0) * 100).toFixed(0)}%
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {consensus && metricsExpanded && (
          <div className="mt-5 border-t border-slate-800/60 pt-5">
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
