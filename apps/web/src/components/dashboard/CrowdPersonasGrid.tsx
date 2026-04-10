"use client";

import { useMemo, useState } from "react";
import type { DirectionBiasByAgentType, TradeDirectionDivergenceExplanation } from "./crowd-intelligence-types";
import { buildChannelRows, dominantDecisionFromMix, findArchetypeChannelMeans } from "./ArchetypeDrillDownPanel";
import { getArchetypePersona } from "./ArchetypeAvatar";
import { PersonaCard, type PersonaCardModel } from "./PersonaCard";
import { PersonaDetailPanel } from "./PersonaDetailPanel";

type PersonaRow = PersonaCardModel & {
  influence: number;
};

function fromExplanation(ex: TradeDirectionDivergenceExplanation): PersonaRow[] {
  const rows = ex.buySellHoldByArchetype ?? [];
  const totalDecisions = rows.reduce((sum, row) => sum + row.buyCount + row.sellCount + row.holdCount, 0);

  return rows
    .map((row) => {
      const t = row.buyCount + row.sellCount + row.holdCount;
      const buyPct = t > 0 ? row.buyCount / t : 0;
      const sellPct = t > 0 ? row.sellCount / t : 0;
      const holdPct = t > 0 ? row.holdCount / t : 0;
      const net = buyPct - sellPct;
      const archetypeWeight = totalDecisions > 0 ? t / totalDecisions : 0;
      const contributionScore = archetypeWeight * net;
      const decision = dominantDecisionFromMix(buyPct, sellPct, holdPct);
      return {
        name: row.archetype,
        personalityDescription: getArchetypePersona(row.archetype).blurb,
        decision,
        contributionScore,
        buyPct,
        sellPct,
        holdPct,
        quickExplanation: `${decision} stance from mix B ${(buyPct * 100).toFixed(0)} / S ${(sellPct * 100).toFixed(0)} / H ${(holdPct * 100).toFixed(0)} with ${(contributionScore * 100).toFixed(1)}pp net contribution.`,
        shareOfCrowdPct: archetypeWeight * 100,
        influence: t,
      };
    })
    .sort((a, b) => Math.abs(b.contributionScore) - Math.abs(a.contributionScore));
}

function fromAgentBias(bias: DirectionBiasByAgentType): PersonaRow[] {
  const keys = ["trendFollower", "contrarian", "balanced"] as const;
  const labels: Record<(typeof keys)[number], string> = {
    trendFollower: "Trend follower",
    contrarian: "Contrarian",
    balanced: "Balanced",
  };
  const seed = keys
    .map((k) => ({ k, row: bias[k] }))
    .filter((x): x is { k: (typeof keys)[number]; row: NonNullable<DirectionBiasByAgentType[(typeof keys)[number]]> } => Boolean(x.row))
    .map(({ k, row }) => {
      const holdCount = row.neutralCount ?? 0;
      const t = row.positiveCount + row.negativeCount + holdCount;
      const buyPct = t > 0 ? row.positiveCount / t : 0;
      const sellPct = t > 0 ? row.negativeCount / t : 0;
      const holdPct = t > 0 ? holdCount / t : 0;
      return { name: labels[k], t, buyPct, sellPct, holdPct };
    });
  const total = seed.reduce((sum, s) => sum + s.t, 0);
  return seed.map((s) => {
    const weight = total > 0 ? s.t / total : 0;
    const net = s.buyPct - s.sellPct;
    const contributionScore = weight * net;
    const decision = dominantDecisionFromMix(s.buyPct, s.sellPct, s.holdPct);
    return {
      name: s.name,
      personalityDescription: getArchetypePersona(s.name).blurb,
      decision,
      contributionScore,
      buyPct: s.buyPct,
      sellPct: s.sellPct,
      holdPct: s.holdPct,
      quickExplanation: `${decision} stance from profile-level mix with ${(contributionScore * 100).toFixed(1)}pp contribution.`,
      shareOfCrowdPct: weight * 100,
      influence: s.t,
    };
  });
}

export function CrowdPersonasGrid({
  explanation,
  directionBiasByAgentType,
  topInfoEvent,
}: {
  explanation: TradeDirectionDivergenceExplanation | null | undefined;
  directionBiasByAgentType: DirectionBiasByAgentType | null | undefined;
  topInfoEvent?: { topic: string; sentiment: number; source: string | null } | null;
}) {
  const rows = useMemo(() => {
    if (explanation?.buySellHoldByArchetype?.length) return fromExplanation(explanation);
    return fromAgentBias(directionBiasByAgentType ?? {});
  }, [explanation, directionBiasByAgentType]);

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selected = useMemo(
    () => rows.find((r) => r.name === selectedName) ?? null,
    [rows, selectedName],
  );

  const selectedTopSignals = useMemo(() => {
    if (!selected || !explanation?.archetypeChannelMeans?.length) return [];
    const means = findArchetypeChannelMeans(explanation.archetypeChannelMeans, selected.name);
    if (!means) return [];
    return buildChannelRows(means)
      .slice(0, 3)
      .map((c) => ({ label: c.label, value: c.value }));
  }, [selected, explanation?.archetypeChannelMeans]);

  const detailModel = selected
    ? {
        ...selected,
        topSignals: selectedTopSignals,
        ageDistribution: null,
        genderMix: null,
        sampleSourceInfluence:
          topInfoEvent?.topic != null
            ? `Sample event/news driver: ${topInfoEvent.topic}`
            : null,
      }
    : null;

  return (
    <section className="border-t border-slate-800/70 pt-8">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-100">Crowd Personas</h3>
          <p className="mt-1 text-sm text-slate-400">A persona view of the full archetype crowd and its live pressure mix.</p>
        </div>
        <p className="text-xs text-slate-500">{rows.length} personas active</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => (
          <PersonaCard key={row.name} row={row} onClick={() => setSelectedName(row.name)} />
        ))}
      </div>

      <PersonaDetailPanel open={selected != null} onClose={() => setSelectedName(null)} persona={detailModel} />
    </section>
  );
}
