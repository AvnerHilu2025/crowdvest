"use client";

import { useMemo, useState } from "react";
import type {
  DirectionBiasByAgentType,
  TradeDirectionDivergenceExplanation,
} from "./crowd-intelligence-types";
import {
  ArchetypeDrillDownPanel,
  buildChannelRows,
  buildDrillDownNarrative,
  buildExampleNewsLine,
  buildExampleSocialLine,
  dominantDecisionFromMix,
  findArchetypeChannelMeans,
} from "./ArchetypeDrillDownPanel";
import { ExpandToggle } from "./ExpandToggle";

const AGENT_LABELS: Record<string, string> = {
  trendFollower: "Trend follower",
  contrarian: "Contrarian",
  balanced: "Balanced",
};

const SUMMARY_COUNT = 3;
const EXPANDED_MAX = 6;

export type ArchetypeInfluenceRow = {
  name: string;
  buyPct: number;
  sellPct: number;
  holdPct: number;
  net: number;
  influence: number;
  /** Set when rows come from `directionBiasByAgentType` (structured profiles). */
  profileKey?: "trendFollower" | "contrarian" | "balanced";
};

function labelForNet(net: number, buyPct: number, sellPct: number): string {
  if (Math.abs(net) < 0.05 && buyPct > 0.2 && sellPct > 0.2) return "Neutral";
  if (net < -0.02) return "SELL pressure";
  if (net > 0.02) return "BUY pressure";
  return "Neutral";
}

function fromExplanation(ex: TradeDirectionDivergenceExplanation): ArchetypeInfluenceRow[] {
  const byName = new Map(
    (ex.buySellHoldByArchetype ?? []).map((a) => [a.archetype, a]),
  );
  const fromTop = ex.topCrowdBiasByArchetype ?? [];
  const fromBsh = (ex.buySellHoldByArchetype ?? []).map((a) => ({
    archetype: a.archetype,
    buyCount: a.buyCount,
    sellCount: a.sellCount,
    holdCount: a.holdCount,
    netBuyMinusSell: a.buyCount - a.sellCount,
  }));

  const ordered =
    fromTop.length > 0
      ? [...fromTop].sort((a, b) => Math.abs(b.netBuyMinusSell) - Math.abs(a.netBuyMinusSell)).slice(0, EXPANDED_MAX)
      : [...fromBsh].sort((a, b) => Math.abs(b.netBuyMinusSell) - Math.abs(a.netBuyMinusSell)).slice(0, EXPANDED_MAX);

  return ordered.map((row) => {
    const full = byName.get(row.archetype);
    const buyCount = full?.buyCount ?? row.buyCount;
    const sellCount = full?.sellCount ?? row.sellCount;
    const holdCount = full?.holdCount ?? row.holdCount;
    const t = buyCount + sellCount + holdCount;
    const buyPct = t > 0 ? buyCount / t : 0;
    const sellPct = t > 0 ? sellCount / t : 0;
    const holdPct = t > 0 ? holdCount / t : 0;
    const net = buyPct - sellPct;
    const influence = t;
    return {
      name: row.archetype,
      buyPct,
      sellPct,
      holdPct,
      net,
      influence,
    };
  });
}

function fromAgentBias(bias: DirectionBiasByAgentType): ArchetypeInfluenceRow[] {
  const out: ArchetypeInfluenceRow[] = [];
  for (const k of ["trendFollower", "contrarian", "balanced"] as const) {
    const row = bias[k];
    if (!row) continue;
    const holdCount = row.neutralCount ?? 0;
    const t = row.positiveCount + row.negativeCount + holdCount;
    const buyPct = t > 0 ? row.positiveCount / t : 0;
    const sellPct = t > 0 ? row.negativeCount / t : 0;
    const holdPct = t > 0 ? holdCount / t : 0;
    const net = buyPct - sellPct;
    out.push({
      name: AGENT_LABELS[k] ?? k,
      profileKey: k,
      buyPct,
      sellPct,
      holdPct,
      net,
      influence: t * Math.abs(net),
    });
  }
  return out.sort((a, b) => b.influence - a.influence);
}

export function ArchetypeInfluencePanel({
  explanation,
  directionBiasByAgentType,
  topInfoEvent,
}: {
  explanation: TradeDirectionDivergenceExplanation | null | undefined;
  directionBiasByAgentType: DirectionBiasByAgentType | null | undefined;
  /** Highest-ranked information event for optional drill-down context lines. */
  topInfoEvent?: { topic: string; sentiment: number; source: string | null } | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [drillRow, setDrillRow] = useState<ArchetypeInfluenceRow | null>(null);

  const raw =
    explanation &&
    ((explanation.topCrowdBiasByArchetype?.length ?? 0) > 0 ||
      (explanation.buySellHoldByArchetype?.length ?? 0) > 0)
      ? fromExplanation(explanation)
      : fromAgentBias(directionBiasByAgentType ?? {});

  const sorted = [...raw].sort((a, b) => b.influence - a.influence).slice(0, EXPANDED_MAX);
  const showToggle = sorted.length > SUMMARY_COUNT;
  const visible = expanded ? sorted : sorted.slice(0, SUMMARY_COUNT);

  const drillMeans = useMemo(() => {
    if (!drillRow || !explanation?.archetypeChannelMeans?.length) return null;
    return findArchetypeChannelMeans(explanation.archetypeChannelMeans, drillRow.name, drillRow.profileKey);
  }, [drillRow, explanation?.archetypeChannelMeans]);

  const drillChannels = useMemo(() => (drillMeans ? buildChannelRows(drillMeans) : []), [drillMeans]);

  const drillDecision = useMemo(
    () =>
      drillRow
        ? dominantDecisionFromMix(drillRow.buyPct, drillRow.sellPct, drillRow.holdPct)
        : "HOLD",
    [drillRow],
  );

  const drillNarrative = useMemo(() => {
    if (!drillRow) return "";
    return buildDrillDownNarrative(drillChannels);
  }, [drillRow, drillChannels]);

  const exampleNewsLine = useMemo(
    () => (drillRow && topInfoEvent ? buildExampleNewsLine(topInfoEvent.topic) : null),
    [drillRow, topInfoEvent],
  );

  const exampleSocialLine = useMemo(
    () =>
      drillRow && topInfoEvent
        ? buildExampleSocialLine(topInfoEvent.source, topInfoEvent.sentiment)
        : null,
    [drillRow, topInfoEvent],
  );

  if (sorted.length === 0) {
    return (
      <section className="border-b border-slate-800/60 pb-6">
        <h3 className="text-base font-semibold text-slate-200">Archetypes</h3>
        <p className="mt-2 text-sm text-slate-500">No archetype breakdown available.</p>
      </section>
    );
  }

  return (
    <section className="border-b border-slate-800/60 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Archetypes</h3>
          <p className="mt-1 text-xs text-slate-500">Click a row for decision detail and channel breakdown.</p>
        </div>
        {showToggle && <ExpandToggle expanded={expanded} onToggle={() => setExpanded((e) => !e)} />}
      </div>
      {expanded && (
        <p className="mt-1 text-xs text-slate-500">Buy / sell / hold mix by archetype.</p>
      )}
      <ul className="mt-4 divide-y divide-slate-800/80">
        {visible.map((r) => (
          <li key={r.name} className="py-3 first:pt-0">
            <button
              type="button"
              onClick={() => setDrillRow(r)}
              className="w-full rounded-lg text-left transition-colors hover:bg-slate-900/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500/60"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                <span className="font-medium text-slate-200">{r.name}</span>
                <span
                  className={`text-sm ${
                    r.net > 0.02 ? "text-emerald-400/90" : r.net < -0.02 ? "text-rose-400/90" : "text-slate-500"
                  }`}
                >
                  {labelForNet(r.net, r.buyPct, r.sellPct)}
                </span>
              </div>
              {expanded && (
                <>
                  <div className="mt-2 h-1.5 max-w-[200px] overflow-hidden rounded-full bg-slate-800">
                    <div className="flex h-full w-full">
                      <div className="h-full bg-emerald-500/80" style={{ width: `${r.buyPct * 100}%` }} />
                      <div className="h-full bg-rose-500/80" style={{ width: `${r.sellPct * 100}%` }} />
                      <div className="h-full bg-slate-500/60" style={{ width: `${r.holdPct * 100}%` }} />
                    </div>
                  </div>
                  <p className="mt-2 font-mono text-xs text-slate-500">
                    B {(r.buyPct * 100).toFixed(0)}% · S {(r.sellPct * 100).toFixed(0)}% · H {(r.holdPct * 100).toFixed(0)}% · net{" "}
                    {r.net >= 0 ? "+" : ""}
                    {(r.net * 100).toFixed(1)}%
                  </p>
                </>
              )}
            </button>
          </li>
        ))}
      </ul>

      <ArchetypeDrillDownPanel
        open={drillRow != null}
        onClose={() => setDrillRow(null)}
        archetypeTitle={drillRow?.name ?? ""}
        decision={drillDecision}
        channels={drillChannels}
        narrative={drillNarrative}
        exampleNewsLine={exampleNewsLine}
        exampleSocialLine={exampleSocialLine}
        hasChannelData={drillMeans != null && drillChannels.length > 0}
      />
    </section>
  );
}
