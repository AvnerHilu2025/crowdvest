"use client";

import { useEffect } from "react";
import type { TradeDirectionDivergenceExplanation } from "./crowd-intelligence-types";

export type DrillDownChannelRow = {
  key: "synthetic" | "info" | "event" | "regime";
  label: string;
  shortLabel: string;
  value: number;
};

const TIE_PRIORITY: ("BUY" | "SELL" | "HOLD")[] = ["SELL", "BUY", "HOLD"];

export function dominantDecisionFromMix(
  buyPct: number,
  sellPct: number,
  holdPct: number,
): "BUY" | "SELL" | "HOLD" {
  const m = { BUY: buyPct, SELL: sellPct, HOLD: holdPct };
  let best: "BUY" | "SELL" | "HOLD" = "BUY";
  let bestV = -1;
  for (const d of ["BUY", "SELL", "HOLD"] as const) {
    const v = m[d];
    if (v > bestV) {
      bestV = v;
      best = d;
    } else if (v === bestV && TIE_PRIORITY.indexOf(d) < TIE_PRIORITY.indexOf(best)) {
      best = d;
    }
  }
  return best;
}

function normKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export type ArchetypeChannelMeanRow = NonNullable<
  TradeDirectionDivergenceExplanation["archetypeChannelMeans"]
>[number];

export function findArchetypeChannelMeans(
  list: TradeDirectionDivergenceExplanation["archetypeChannelMeans"] | undefined,
  rowName: string,
  profileKey?: "trendFollower" | "contrarian" | "balanced",
): ArchetypeChannelMeanRow | null {
  if (!list?.length) return null;
  const n = normKey(rowName);
  const exact = list.find((m) => normKey(m.archetype) === n);
  if (exact) return exact;
  const fuzzy = list.find(
    (m) => normKey(m.archetype).includes(n) || n.includes(normKey(m.archetype)),
  );
  if (fuzzy) return fuzzy;
  if (profileKey) {
    const hint =
      profileKey === "trendFollower"
        ? "trend"
        : profileKey === "contrarian"
          ? "contrarian"
          : "balanced";
    const byHint = list.find((m) => normKey(m.archetype).includes(hint));
    if (byHint) return byHint;
  }
  return null;
}

const CHANNEL_META: Record<
  DrillDownChannelRow["key"],
  { label: string; shortLabel: string; narrative: { hi: string; lo: string; mid: string } }
> = {
  synthetic: {
    label: "Synthetic (market) signal",
    shortLabel: "Synthetic",
    narrative: {
      hi: "supportive market/synthetic inputs",
      lo: "headwind from market/synthetic inputs",
      mid: "neutral market/synthetic inputs",
    },
  },
  info: {
    label: "Information / sentiment signal",
    shortLabel: "Info",
    narrative: {
      hi: "positive sentiment signals",
      lo: "negative sentiment signals",
      mid: "mixed sentiment in the information layer",
    },
  },
  event: {
    label: "Event / catalyst signal",
    shortLabel: "Event",
    narrative: {
      hi: "event flow skewing constructive",
      lo: "event flow skewing cautious",
      mid: "event catalysts roughly balanced",
    },
  },
  regime: {
    label: "Regime / macro signal",
    shortLabel: "Regime",
    narrative: {
      hi: "risk-on regime conditions",
      lo: "risk-off regime conditions",
      mid: "mixed regime / macro conditions",
    },
  },
};

export function buildChannelRows(means: {
  meanSynthetic: number | null;
  meanInfo: number | null;
  meanEvent: number | null;
  meanRegime: number | null;
}): DrillDownChannelRow[] {
  const raw: DrillDownChannelRow[] = [
    {
      key: "synthetic",
      label: CHANNEL_META.synthetic.label,
      shortLabel: CHANNEL_META.synthetic.shortLabel,
      value: means.meanSynthetic ?? NaN,
    },
    {
      key: "info",
      label: CHANNEL_META.info.label,
      shortLabel: CHANNEL_META.info.shortLabel,
      value: means.meanInfo ?? NaN,
    },
    {
      key: "event",
      label: CHANNEL_META.event.label,
      shortLabel: CHANNEL_META.event.shortLabel,
      value: means.meanEvent ?? NaN,
    },
    {
      key: "regime",
      label: CHANNEL_META.regime.label,
      shortLabel: CHANNEL_META.regime.shortLabel,
      value: means.meanRegime ?? NaN,
    },
  ];
  return raw
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

function phraseForChannel(
  key: DrillDownChannelRow["key"],
  value: number,
): string {
  const meta = CHANNEL_META[key];
  const t = 0.02;
  if (value > t) return meta.narrative.hi;
  if (value < -t) return meta.narrative.lo;
  return meta.narrative.mid;
}

export function buildDrillDownNarrative(rows: DrillDownChannelRow[]): string {
  if (rows.length === 0) {
    return "Channel-level signals are not available for this archetype in the current snapshot.";
  }
  const top = rows.slice(0, 2);
  const parts = top.map((r) => phraseForChannel(r.key, r.value));
  if (parts.length === 1) {
    return `Decision shape is driven mainly by ${parts[0]}.`;
  }
  return `Decision driven mainly by ${parts[0]} and ${parts[1]}.`;
}

export function buildExampleNewsLine(topic: string | undefined): string | null {
  if (topic == null || topic.trim() === "") return null;
  const t = topic.trim();
  const short = t.length > 90 ? `${t.slice(0, 87)}…` : t;
  return `Recent news: ${short}`;
}

export function buildExampleSocialLine(
  source: string | null | undefined,
  sentiment: number | undefined,
): string | null {
  if (sentiment == null || !Number.isFinite(sentiment)) return null;
  const src = (source ?? "").toLowerCase();
  const isTwitter = src.includes("twitter") || src === "x" || src.includes("x.com");
  if (isTwitter) {
    if (sentiment < -0.05) return "Twitter bearish spike in the narrative window.";
    if (sentiment > 0.05) return "Twitter bullish spike in the narrative window.";
    return "Twitter sentiment mixed in the narrative window.";
  }
  if (sentiment < -0.05) return "Information flow skews bearish in the latest window.";
  if (sentiment > 0.05) return "Information flow skews bullish in the latest window.";
  return null;
}

type ArchetypeDrillDownPanelProps = {
  open: boolean;
  onClose: () => void;
  archetypeTitle: string;
  decision: "BUY" | "SELL" | "HOLD";
  channels: DrillDownChannelRow[];
  narrative: string;
  exampleNewsLine: string | null;
  exampleSocialLine: string | null;
  hasChannelData: boolean;
};

const DECISION_STYLE: Record<"BUY" | "SELL" | "HOLD", string> = {
  BUY: "text-emerald-400",
  SELL: "text-rose-400",
  HOLD: "text-slate-400",
};

export function ArchetypeDrillDownPanel({
  open,
  onClose,
  archetypeTitle,
  decision,
  channels,
  narrative,
  exampleNewsLine,
  exampleSocialLine,
  hasChannelData,
}: ArchetypeDrillDownPanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        aria-label="Close panel"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="archetype-drilldown-title"
        className="relative z-[81] flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-700/80 bg-slate-950 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 id="archetype-drilldown-title" className="text-lg font-semibold text-slate-50">
              {archetypeTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-500">Archetype drill-down</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Decision</p>
            <p className={`mt-1 text-2xl font-bold tracking-tight ${DECISION_STYLE[decision]}`}>{decision}</p>
            <p className="mt-1 text-xs text-slate-500">From buy / sell / hold mix in this archetype’s AgentDecision rows.</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top influencing factors</p>
            <p className="mt-1 text-xs text-slate-500">Sorted by absolute mean channel value (same units as agent pipeline).</p>
            {!hasChannelData ? (
              <p className="mt-2 text-sm text-slate-400">
                No per-channel means for this archetype — run may be missing AgentDecision signal columns or labels may not
                match.
              </p>
            ) : (
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-200">
                {channels.map((c) => (
                  <li key={c.key} className="marker:text-slate-500">
                    <span className="font-medium text-slate-100">{c.label}</span>
                    <span className="ml-2 font-mono text-xs text-slate-400 tabular-nums">
                      {c.value >= 0 ? "+" : ""}
                      {c.value.toFixed(4)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Explanation</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">{narrative}</p>
          </div>

          {(exampleNewsLine != null || exampleSocialLine != null) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Context (optional)</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-300">
                {exampleNewsLine != null ? (
                  <li className="border-l-2 border-sky-500/40 pl-3">{exampleNewsLine}</li>
                ) : null}
                {exampleSocialLine != null ? (
                  <li className="border-l-2 border-violet-500/40 pl-3">{exampleSocialLine}</li>
                ) : null}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
