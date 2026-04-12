/**
 * Post-run scenario explainability (injected events + crowd shift).
 */

import fs from "fs/promises";
import path from "path";
import type { ScenarioEventRecord } from "./scenario-injection";

export type ScenarioReactionArchetypeRow = {
  archetypeId: string | null;
  archetypeName: string | null;
  avgInfoSignal: number;
  avgEventSignal: number;
  dominantDirection: "BUY" | "SELL" | "HOLD";
};

export type ScenarioReactionStepRow = {
  step: number;
  injectedEvents: ScenarioEventRecord[];
  topAffectedArchetypes: ScenarioReactionArchetypeRow[];
  avgInfoSignal: number;
  avgEventSignal: number;
  crowdSignalBefore: number | null;
  crowdSignalAfter: number;
  dominantCrowdDirection: "BUY" | "SELL" | "HOLD";
  crowdShift: number | null;
};

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

function dominantFromCounts(counts: { BUY: number; SELL: number; HOLD: number }): "BUY" | "SELL" | "HOLD" {
  const order: ("BUY" | "SELL" | "HOLD")[] = ["BUY", "SELL", "HOLD"];
  let best: "BUY" | "SELL" | "HOLD" = "BUY";
  let bestN = -1;
  for (const k of order) {
    const n = counts[k];
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  return best;
}

export function buildScenarioReactionStepRow(input: {
  step: number;
  injected: ScenarioEventRecord[];
  decisionSlice: Array<{
    infoSignal: number | null;
    eventSignal: number | null;
    action: string;
    agentId: string;
  }>;
  agents: Array<{ id: string; archetype: string | null; archetypeId: string | null }>;
  resolveArchetypeConfigId: (
    agentId: string,
    archetypeLabel: string | null | undefined,
    archetypeUuid: string | null | undefined,
  ) => string;
  crowdSignalBefore: number | null;
  crowdSignalAfter: number;
  dominantCrowdDirection: "BUY" | "SELL" | "HOLD";
}): ScenarioReactionStepRow {
  const { step, injected, decisionSlice, agents, resolveArchetypeConfigId, crowdSignalBefore, crowdSignalAfter, dominantCrowdDirection } =
    input;

  const infoVals = decisionSlice.map((d) => d.infoSignal).filter((x): x is number => x != null && Number.isFinite(x));
  const evtVals = decisionSlice.map((d) => d.eventSignal).filter((x): x is number => x != null && Number.isFinite(x));

  const agentById = new Map(agents.map((a) => [a.id, a]));
  type Agg = {
    archetypeId: string | null;
    archetypeName: string | null;
    info: number[];
    evt: number[];
    counts: { BUY: number; SELL: number; HOLD: number };
    sortKey: string;
  };
  const m = new Map<string, Agg>();

  for (const d of decisionSlice) {
    const ag = agentById.get(d.agentId);
    const cfgId = resolveArchetypeConfigId(d.agentId, ag?.archetype ?? null, ag?.archetypeId ?? null);
    const key = cfgId;
    let g = m.get(key);
    if (!g) {
      g = {
        archetypeId: ag?.archetypeId ?? null,
        archetypeName: ag?.archetype ?? null,
        info: [],
        evt: [],
        counts: { BUY: 0, SELL: 0, HOLD: 0 },
        sortKey: cfgId,
      };
      m.set(key, g);
    }
    if (d.infoSignal != null && Number.isFinite(d.infoSignal)) g.info.push(d.infoSignal);
    if (d.eventSignal != null && Number.isFinite(d.eventSignal)) g.evt.push(d.eventSignal);
    const a = String(d.action) as keyof Agg["counts"];
    if (a === "BUY" || a === "SELL" || a === "HOLD") g.counts[a]++;
  }

  const topAffectedArchetypes = [...m.values()]
    .map((g) => ({
      archetypeId: g.archetypeId,
      archetypeName: g.archetypeName,
      avgInfoSignal: round6(mean(g.info)),
      avgEventSignal: round6(mean(g.evt)),
      dominantDirection: dominantFromCounts(g.counts),
      _score: mean(g.info.map(Math.abs)) + mean(g.evt.map(Math.abs)),
      _key: g.sortKey,
    }))
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return a._key.localeCompare(b._key);
    })
    .slice(0, 5)
    .map(({ _score: _s, _key: _k, ...rest }) => rest);

  return {
    step,
    injectedEvents: injected,
    topAffectedArchetypes,
    avgInfoSignal: round6(mean(infoVals)),
    avgEventSignal: round6(mean(evtVals)),
    crowdSignalBefore: crowdSignalBefore != null ? round6(crowdSignalBefore) : null,
    crowdSignalAfter: round6(crowdSignalAfter),
    dominantCrowdDirection,
    crowdShift:
      crowdSignalBefore != null && Number.isFinite(crowdSignalBefore)
        ? round6(crowdSignalAfter - crowdSignalBefore)
        : null,
  };
}

export async function writeScenarioReactionReport(input: {
  runId: string;
  assetSymbol: string;
  runVariantId: string;
  scenarioFile: string;
  steps: ScenarioReactionStepRow[];
  log: (msg: string) => void;
}): Promise<string> {
  const outPath = path.resolve(__dirname, "..", "tmp", "scenario-reaction-report.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const payload = {
    runId: input.runId,
    assetSymbol: input.assetSymbol,
    runVariantId: input.runVariantId,
    scenarioFile: input.scenarioFile,
    generatedAt: new Date().toISOString(),
    steps: input.steps,
  };
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");

  input.log("");
  input.log("scenario reaction summary");
  input.log("step | injected_events | strongest_archetypes | crowd_shift");
  input.log("-----+-------------------+----------------------+------------");
  for (const row of input.steps) {
    const arch = row.topAffectedArchetypes
      .slice(0, 3)
      .map((a) => String(a.archetypeName ?? a.archetypeId ?? "?").slice(0, 12))
      .join(",");
    const shift = row.crowdShift != null ? row.crowdShift.toFixed(4) : "—";
    input.log(
      `${String(row.step).padStart(4)} | ${String(row.injectedEvents.length).padStart(17)} | ${arch.padEnd(20).slice(0, 20)} | ${String(shift).padStart(10)}`,
    );
  }
  input.log(`Wrote ${outPath}`);
  return outPath;
}
