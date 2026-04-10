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
import { ArchetypeAvatar, getArchetypePersona } from "./ArchetypeAvatar";

const AGENT_LABELS: Record<string, string> = {
  trendFollower: "Trend follower",
  contrarian: "Contrarian",
  balanced: "Balanced",
};

const SUMMARY_COUNT = 3;
const EXPANDED_MAX = 6;

export type ArchetypeInfluenceRow = {
  name: string;
  personalityDescription: string;
  buyPct: number;
  sellPct: number;
  holdPct: number;
  net: number;
  influence: number;
  contributionScore: number;
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
  const rows = ex.buySellHoldByArchetype ?? [];
  const totalDecisions = rows.reduce((sum, row) => sum + row.buyCount + row.sellCount + row.holdCount, 0);

  return rows.map((row) => {
    const t = row.buyCount + row.sellCount + row.holdCount;
    const buyPct = t > 0 ? row.buyCount / t : 0;
    const sellPct = t > 0 ? row.sellCount / t : 0;
    const holdPct = t > 0 ? row.holdCount / t : 0;
    const net = buyPct - sellPct;
    const archetypeWeight = totalDecisions > 0 ? t / totalDecisions : 0;
    const contributionScore = archetypeWeight * net;
    return {
      name: row.archetype,
      personalityDescription: getArchetypePersona(row.archetype).blurb,
      buyPct,
      sellPct,
      holdPct,
      net,
      influence: t,
      contributionScore,
    };
  });
}

function fromAgentBias(bias: DirectionBiasByAgentType): ArchetypeInfluenceRow[] {
  const seedRows: Array<{
    name: string;
    profileKey: "trendFollower" | "contrarian" | "balanced";
    t: number;
    buyPct: number;
    sellPct: number;
    holdPct: number;
    net: number;
  }> = [];
  for (const k of ["trendFollower", "contrarian", "balanced"] as const) {
    const row = bias[k];
    if (!row) continue;
    const holdCount = row.neutralCount ?? 0;
    const t = row.positiveCount + row.negativeCount + holdCount;
    const buyPct = t > 0 ? row.positiveCount / t : 0;
    const sellPct = t > 0 ? row.negativeCount / t : 0;
    const holdPct = t > 0 ? holdCount / t : 0;
    const net = buyPct - sellPct;
    seedRows.push({ name: AGENT_LABELS[k] ?? k, profileKey: k, t, buyPct, sellPct, holdPct, net });
  }
  const totalDecisions = seedRows.reduce((sum, row) => sum + row.t, 0);
  return seedRows
    .map((row) => {
      const archetypeWeight = totalDecisions > 0 ? row.t / totalDecisions : 0;
      const contributionScore = archetypeWeight * row.net;
      return {
        name: row.name,
        personalityDescription: getArchetypePersona(row.name).blurb,
        profileKey: row.profileKey,
        buyPct: row.buyPct,
        sellPct: row.sellPct,
        holdPct: row.holdPct,
        net: row.net,
        influence: row.t,
        contributionScore,
      };
    })
    .sort((a, b) => Math.abs(b.contributionScore) - Math.abs(a.contributionScore));
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

  const sorted = [...raw]
    .sort((a, b) => Math.abs(b.contributionScore) - Math.abs(a.contributionScore))
    .slice(0, EXPANDED_MAX);
  const showToggle = sorted.length > SUMMARY_COUNT;
  const visible = expanded ? sorted : sorted.slice(0, SUMMARY_COUNT);

  const contributionSummary = useMemo(() => {
    if (sorted.length === 0) return null;
    const totalInfluence = sorted.reduce((sum, row) => sum + row.influence, 0);
    const positive = sorted.reduce((sum, row) => sum + Math.max(row.contributionScore, 0), 0);
    const negativeAbs = sorted.reduce((sum, row) => sum + Math.abs(Math.min(row.contributionScore, 0)), 0);
    const net = sorted.reduce((sum, row) => sum + row.contributionScore, 0);
    const weightedHold =
      totalInfluence > 0
        ? sorted.reduce((sum, row) => sum + row.holdPct * (row.influence / totalInfluence), 0)
        : 0;
    const holdByMix = weightedHold >= 0.34;
    const nearNeutralNet = Math.abs(net) <= 0.03;
    const balancedPressure = positive >= 0.08 && negativeAbs >= 0.08;
    if (holdByMix && nearNeutralNet && balancedPressure) {
      return "Final HOLD emerges from balanced opposing pressures";
    }
    return null;
  }, [sorted]);

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
      <ul className="mt-4 grid gap-3">
        {visible.map((r) => (
          <li key={r.name}>
            <button
              type="button"
              onClick={() => setDrillRow(r)}
              className="w-full rounded-xl border border-slate-800/80 bg-slate-900/45 p-3 text-left transition-colors hover:border-slate-700/90 hover:bg-slate-900/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500/60"
            >
              <div className="flex items-start gap-3">
                <ArchetypeAvatar archetype={r.name} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="truncate font-semibold text-slate-100">{r.name}</span>
                    <span
                      className={`text-sm ${
                        r.net > 0.02 ? "text-emerald-400/90" : r.net < -0.02 ? "text-rose-400/90" : "text-slate-500"
                      }`}
                    >
                      {labelForNet(r.net, r.buyPct, r.sellPct)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{r.personalityDescription}</p>
                  <p className="mt-2 font-mono text-xs text-slate-500">
                    B {(r.buyPct * 100).toFixed(0)}% · S {(r.sellPct * 100).toFixed(0)}% · H {(r.holdPct * 100).toFixed(0)}% · net{" "}
                    {r.net >= 0 ? "+" : ""}
                    {(r.net * 100).toFixed(1)}%
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    Contribution{" "}
                    <span className={r.contributionScore >= 0 ? "text-emerald-300/90" : "text-rose-300/90"}>
                      {r.contributionScore >= 0 ? "+" : ""}
                      {(r.contributionScore * 100).toFixed(1)}pp
                    </span>
                  </p>
                </div>
              </div>
              {expanded && (
                <>
                  <div className="mt-3 h-1.5 max-w-[220px] overflow-hidden rounded-full bg-slate-800">
                    <div className="flex h-full w-full">
                      <div className="h-full bg-emerald-500/80" style={{ width: `${r.buyPct * 100}%` }} />
                      <div className="h-full bg-rose-500/80" style={{ width: `${r.sellPct * 100}%` }} />
                      <div className="h-full bg-slate-500/60" style={{ width: `${r.holdPct * 100}%` }} />
                    </div>
                  </div>
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
      {contributionSummary && (
        <p className="mt-4 border-l-2 border-sky-500/30 pl-3 text-sm text-slate-400">{contributionSummary}</p>
      )}

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
