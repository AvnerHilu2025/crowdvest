"use client";

import { useState } from "react";
import type {
  TradeDirectionDiagnosticsCrowd,
  TradeDirectionDivergenceExplanation,
} from "./crowd-intelligence-types";
import { ExpandToggle } from "./ExpandToggle";

const THRESHOLD = 0.001;

const CHANNEL_ORDER = ["synthetic", "info", "event", "regime"] as const;

function channelLabel(c: string): string {
  switch (c) {
    case "synthetic":
      return "Synthetic";
    case "info":
      return "Info";
    case "event":
      return "Event";
    case "regime":
      return "Regime";
    default:
      return c;
  }
}

function crowdIsShort(crowd: TradeDirectionDiagnosticsCrowd | null | undefined): boolean | null {
  if (!crowd) return null;
  const l = crowd.longShare;
  const s = crowd.shortShare;
  if (l == null || s == null) return null;
  return s > l;
}

function interpret(
  push: number | null | undefined,
  isShort: boolean | null,
): string {
  if (push == null || !Number.isFinite(push)) return "No directional signal.";
  if (Math.abs(push) < THRESHOLD) return "Weak / negligible influence";

  if (isShort === null) {
    if (push > 0) return "Pushes toward short-side pressure (direction ambiguous)";
    if (push < 0) return "Pushes toward long-side pressure (direction ambiguous)";
    return "Neutral";
  }

  if (isShort) {
    if (push > 0) return "Supports SHORT behavior";
    return "Opposes crowd direction";
  }
  if (push < 0) return "Supports LONG behavior";
  return "Opposes crowd direction";
}

export function SignalContributionPanel({
  explanation,
  crowdDiagnostics,
}: {
  explanation: TradeDirectionDivergenceExplanation | null | undefined;
  crowdDiagnostics: TradeDirectionDiagnosticsCrowd | null | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const breakdown = explanation?.signalContributions?.channelDirectionalBreakdown ?? [];
  const byChannel = new Map(breakdown.map((b) => [b.channel, b]));
  const isShort = crowdIsShort(crowdDiagnostics);

  return (
    <section className="border-b border-slate-800/60 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-100">Signals</h3>
        <ExpandToggle expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
      </div>

      {expanded && isShort !== null && (
        <p className="mt-2 text-sm text-slate-400">
          Crowd leaning: <span className="font-medium text-slate-200">{isShort ? "SHORT" : "LONG"}</span>
        </p>
      )}

      {!expanded && (
        <div className="mt-4 flex flex-wrap divide-x divide-slate-800/90">
          {CHANNEL_ORDER.map((ch) => {
            const row = byChannel.get(ch);
            const push = row?.directionalPush ?? null;
            return (
              <div key={ch} className="min-w-[22%] flex-1 px-3 py-1 text-center first:pl-0">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {channelLabel(ch)}
                </div>
                <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-200">
                  {push != null && Number.isFinite(push) ? push.toFixed(4) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {expanded && (
        <div className="mt-5 space-y-6">
          {CHANNEL_ORDER.map((ch) => {
            const row = byChannel.get(ch);
            const push = row?.directionalPush ?? null;
            const text = interpret(push, isShort);
            return (
              <div key={ch} className="border-t border-slate-800/60 pt-5 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-slate-300">{channelLabel(ch)}</span>
                  <span className="font-mono text-lg text-slate-100">
                    {push != null && Number.isFinite(push) ? push.toFixed(4) : "—"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{text}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
