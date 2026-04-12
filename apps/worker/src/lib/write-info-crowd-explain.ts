/**
 * Post-decide explainability: InfoEvent → archetype aggregates → crowd (CrowdMetrics when present).
 * Deterministic: fixed sort keys (id, archetype key).
 */

import fs from "fs/promises";
import path from "path";
import type { PrismaClient } from "@crowdvest/db";

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

function dominantDirection(counts: { BUY: number; SELL: number; HOLD: number }): "BUY" | "SELL" | "HOLD" {
  let best: "BUY" | "SELL" | "HOLD" = "BUY";
  let bestN = -1;
  const order: ("BUY" | "SELL" | "HOLD")[] = ["BUY", "SELL", "HOLD"];
  for (const k of order) {
    const n = counts[k];
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  return best;
}

export type InfoCrowdExplainStep = {
  step: number;
  eventCount: number;
  avgInfoSignal: number;
  avgEventSignal: number;
  crowdSignal: number | null;
  crowdWeightedSignal: number | null;
  topEvents: Array<{
    id: string;
    sentiment: number;
    source: string | null;
    title: string;
  }>;
  topAffectedArchetypes: Array<{
    archetypeId: string | null;
    archetypeName: string | null;
    avgInfoSignal: number;
    avgEventSignal: number;
    dominantDirection: "BUY" | "SELL" | "HOLD";
  }>;
};

export async function writeInfoCrowdExplain(input: {
  prisma: PrismaClient;
  runId: string;
  assetSymbol: string;
  runVariantId: string;
  log: (msg: string) => void;
}): Promise<{ steps: InfoCrowdExplainStep[]; outPath: string }> {
  const { prisma, runId, assetSymbol, runVariantId, log } = input;

  const [events, decisions, crowdRows] = await Promise.all([
    prisma.infoEvent.findMany({
      where: { runId, assetSymbol },
      orderBy: [{ step: "asc" }, { id: "asc" }],
      select: {
        id: true,
        step: true,
        sentiment: true,
        source: true,
        topic: true,
        reach: true,
        credibility: true,
      },
    }),
    prisma.agentDecision.findMany({
      where: { runId, assetSymbol, runVariantId },
      orderBy: [{ step: "asc" }, { agentId: "asc" }],
      include: {
        agent: { select: { archetypeId: true, archetype: true } },
      },
    }),
    prisma.crowdMetrics.findMany({
      where: { runId, assetSymbol, runVariantId },
      orderBy: { step: "asc" },
      select: { step: true, signal: true, weightedSignal: true },
    }),
  ]);

  const crowdByStep = new Map<number, { signal: number; weightedSignal: number }>();
  for (const c of crowdRows) {
    crowdByStep.set(c.step, { signal: c.signal, weightedSignal: c.weightedSignal });
  }

  const eventsByStep = new Map<number, typeof events>();
  for (const e of events) {
    const list = eventsByStep.get(e.step) ?? [];
    list.push(e);
    eventsByStep.set(e.step, list);
  }

  const decisionsByStep = new Map<number, typeof decisions>();
  for (const d of decisions) {
    const list = decisionsByStep.get(d.step) ?? [];
    list.push(d);
    decisionsByStep.set(d.step, list);
  }

  const stepSet = new Set<number>();
  for (const e of events) stepSet.add(e.step);
  for (const d of decisions) stepSet.add(d.step);
  for (const c of crowdRows) stepSet.add(c.step);
  const stepsSorted = [...stepSet].sort((a, b) => a - b);

  const stepsOut: InfoCrowdExplainStep[] = [];

  for (const step of stepsSorted) {
    const evList = eventsByStep.get(step) ?? [];
    const decList = decisionsByStep.get(step) ?? [];

    const infoVals = decList.map((d) => d.infoSignal).filter((x): x is number => x != null && Number.isFinite(x));
    const evtVals = decList.map((d) => d.eventSignal).filter((x): x is number => x != null && Number.isFinite(x));

    const cm = crowdByStep.get(step);
    let crowdSignal: number | null = cm != null ? cm.signal : null;
    let crowdWeightedSignal: number | null = cm != null ? cm.weightedSignal : null;
    if (crowdSignal == null && decList.length > 0) {
      const syn = decList.map((d) => d.syntheticSignal).filter((x): x is number => x != null && Number.isFinite(x));
      const dist = decList.map((d) => d.distortedSignal).filter((x): x is number => x != null && Number.isFinite(x));
      if (syn.length > 0) crowdSignal = mean(syn);
      if (dist.length > 0) crowdWeightedSignal = mean(dist);
    }

    const topEvents = [...evList]
      .sort((a, b) => {
        const sa = Math.abs(a.sentiment) * a.reach * a.credibility;
        const sb = Math.abs(b.sentiment) * b.reach * b.credibility;
        if (sb !== sa) return sb - sa;
        return a.id.localeCompare(b.id);
      })
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        sentiment: round6(e.sentiment),
        source: e.source ?? null,
        title: (e.topic ?? "").trim() || "(no topic)",
      }));

    type ArchAgg = {
      archetypeId: string | null;
      archetypeName: string | null;
      info: number[];
      evt: number[];
      counts: { BUY: number; SELL: number; HOLD: number };
    };
    const archMap = new Map<string, ArchAgg>();
    for (const d of decList) {
      const id = d.agent?.archetypeId ?? null;
      const name = d.agent?.archetype ?? null;
      const key = `${id ?? ""}\t${name ?? ""}`;
      let g = archMap.get(key);
      if (!g) {
        g = {
          archetypeId: id,
          archetypeName: name,
          info: [],
          evt: [],
          counts: { BUY: 0, SELL: 0, HOLD: 0 },
        };
        archMap.set(key, g);
      }
      if (d.infoSignal != null && Number.isFinite(d.infoSignal)) g.info.push(d.infoSignal);
      if (d.eventSignal != null && Number.isFinite(d.eventSignal)) g.evt.push(d.eventSignal);
      const a = String(d.action) as keyof ArchAgg["counts"];
      if (a === "BUY" || a === "SELL" || a === "HOLD") g.counts[a]++;
    }

    const archList = [...archMap.values()]
      .map((g) => ({
        archetypeId: g.archetypeId,
        archetypeName: g.archetypeName,
        avgInfoSignal: round6(mean(g.info)),
        avgEventSignal: round6(mean(g.evt)),
        dominantDirection: dominantDirection(g.counts),
        _sort: mean(g.info.map(Math.abs)) + mean(g.evt.map(Math.abs)) + g.counts.BUY + g.counts.SELL,
        _key: `${g.archetypeId ?? ""}:${g.archetypeName ?? ""}`,
      }))
      .sort((a, b) => {
        if (b._sort !== a._sort) return b._sort - a._sort;
        return a._key.localeCompare(b._key);
      })
      .slice(0, 5)
      .map(({ _sort: _s, _key: _k, ...rest }) => rest);

    stepsOut.push({
      step,
      eventCount: evList.length,
      avgInfoSignal: round6(mean(infoVals)),
      avgEventSignal: round6(mean(evtVals)),
      crowdSignal: crowdSignal != null ? round6(crowdSignal) : null,
      crowdWeightedSignal: crowdWeightedSignal != null ? round6(crowdWeightedSignal) : null,
      topEvents,
      topAffectedArchetypes: archList,
    });
  }

  const outPath = path.resolve(__dirname, "..", "tmp", "info-crowd-explain.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const payload = {
    runId,
    assetSymbol,
    runVariantId,
    generatedAt: new Date().toISOString(),
    steps: stepsOut,
  };
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");

  log("");
  log("info-crowd explainability (InfoEvent → archetypes → crowd)");
  log("step | events | avg_info | avg_event | crowd_signal");
  log("-----+--------+----------+-----------+-------------");
  for (const row of stepsOut) {
    const cs = row.crowdSignal != null ? row.crowdSignal.toFixed(4) : "—";
    log(
      `${String(row.step).padStart(4)} | ${String(row.eventCount).padStart(6)} | ${row.avgInfoSignal.toFixed(4).padStart(8)} | ${row.avgEventSignal.toFixed(4).padStart(9)} | ${cs.padStart(11)}`,
    );
  }
  log(`Wrote ${outPath}`);

  return { steps: stepsOut, outPath };
}
