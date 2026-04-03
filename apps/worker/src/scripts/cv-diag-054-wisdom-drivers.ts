/**
 * CV-054: Compare wisdom vs no-wisdom variants (diagnostic).
 *
 * Env: RUN_ID (required). Optional: MAX_VARIANTS, CV053_VID_CHUNK (same as CV-053).
 *
 * Note: This repo's RunVariantSummary has no `wisdom` or sweep weight columns.
 * Wisdom = crowd step accuracy > mean per-archetype step accuracy (CV-053).
 * Weights come from variant labels (`_syn0p4_…`); metrics from CrowdMetrics (step average).
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

type Action = "BUY" | "SELL" | "HOLD";

function loadEnv(): void {
  const repoRoot = path.resolve(__dirname, "../../../../.env");
  try {
    if (!fs.existsSync(repoRoot)) return;
    const content = fs.readFileSync(repoRoot, "utf8");
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

function labelArchetype(s: string | null | undefined): string {
  return s == null || s === "" ? "(null)" : s;
}

function directionFromReturn(stepReturn: number): Action {
  if (stepReturn > 0) return "BUY";
  if (stepReturn < 0) return "SELL";
  return "HOLD";
}

function majorityDirection(buy: number, sell: number, hold: number): Action {
  const max = Math.max(buy, sell, hold);
  if (buy === max && buy > sell && buy > hold) return "BUY";
  if (sell === max && sell > buy && sell > hold) return "SELL";
  return "HOLD";
}

function parseCompactNumToken(tok: string): number | null {
  const m = /^(\d+)p(\d+)$/.exec(tok);
  if (!m) return null;
  const frac = m[2]!;
  return parseInt(m[1]!, 10) + parseInt(frac, 10) / 10 ** frac.length;
}

type ParsedLabelWeights = {
  syn: number | null;
  info: number | null;
  evt: number | null;
  reg: number | null;
  th: number | null;
};

function parseWeightsFromLabel(lab: string | null | undefined): ParsedLabelWeights {
  const out: ParsedLabelWeights = { syn: null, info: null, evt: null, reg: null, th: null };
  if (!lab) return out;
  const pick = (re: RegExp): number | null => {
    const m = re.exec(lab);
    if (!m?.[1]) return null;
    return parseCompactNumToken(m[1]!);
  };
  out.syn = pick(/_syn(\d+p\d+)/);
  out.info = pick(/_info(\d+p\d+)/);
  out.evt = pick(/_evt(\d+p\d+)/);
  out.reg = pick(/_reg(\d+p\d+)/);
  out.th = pick(/_th(\d+p\d+)/);
  return out;
}

function crowdAccuracyFromDecisions(
  decisions: { step: number; action: Action }[],
  retByKey: Map<string, number>,
  assetSymbol: string,
): number | null {
  const countsByStep = new Map<number, { BUY: number; SELL: number; HOLD: number }>();
  for (const d of decisions) {
    let c = countsByStep.get(d.step);
    if (!c) {
      c = { BUY: 0, SELL: 0, HOLD: 0 };
      countsByStep.set(d.step, c);
    }
    const a = d.action as Action;
    if (a === "BUY") c.BUY++;
    else if (a === "SELL") c.SELL++;
    else c.HOLD++;
  }

  let ok = 0;
  let tot = 0;
  for (const [step, c] of countsByStep) {
    const nextRet = retByKey.get(`${assetSymbol}:${step + 1}`);
    if (nextRet == null || !Number.isFinite(nextRet)) continue;
    const votes = c.BUY + c.SELL + c.HOLD;
    if (votes === 0) continue;
    const fore = majorityDirection(c.BUY, c.SELL, c.HOLD);
    const truth = directionFromReturn(nextRet);
    tot++;
    if (fore === truth) ok++;
  }
  return tot > 0 ? ok / tot : null;
}

type Bucket051 = { accOk: number; accTot: number };

function meanArchetypeFromDecisions(
  decisions: { step: number; agentId: string; action: Action }[],
  retByKey: Map<string, number>,
  assetSymbol: string,
  archByAgent: Map<string, string>,
): number | null {
  const byArch = new Map<string, Bucket051>();
  for (const d of decisions) {
    const arch = archByAgent.get(d.agentId) ?? "(missing)";
    let b = byArch.get(arch);
    if (!b) {
      b = { accOk: 0, accTot: 0 };
      byArch.set(arch, b);
    }
    const act = d.action as Action;
    const nk = `${assetSymbol}:${d.step + 1}`;
    const nr = retByKey.get(nk);
    if (nr != null && Number.isFinite(nr)) {
      b.accTot++;
      if (act === directionFromReturn(nr)) b.accOk++;
    }
  }

  let sum = 0;
  let n = 0;
  for (const b of byArch.values()) {
    if (b.accTot <= 0) continue;
    sum += b.accOk / b.accTot;
    n++;
  }
  return n > 0 ? sum / n : null;
}

function variantName(name: string, label: string | null): string {
  const n = name.trim();
  if (n !== "") return n;
  const l = (label ?? "").trim();
  return l !== "" ? l : "variant";
}

type FlatVariant = {
  wisdom: boolean;
  nAgents: number;
  synWeight: number;
  infoWeight: number;
  eventWeight: number;
  regimeWeight: number;
  threshold: number;
  diversityIndex: number;
  independenceIndex: number;
  herdingIndex: number;
  label: string;
};

async function main(): Promise<void> {
  loadEnv();
  const runId = process.env.RUN_ID?.trim();
  if (!runId) throw new Error("RUN_ID is required");

  const prisma = new PrismaClient();
  let variants = await prisma.runVariant.findMany({
    where: { runId },
    orderBy: [{ assetSymbol: "asc" }, { seed: "asc" }, { label: "asc" }],
    select: { id: true, name: true, label: true, assetSymbol: true, agents: true },
  });
  const maxV = process.env.MAX_VARIANTS?.trim();
  if (maxV) {
    const n = parseInt(maxV, 10);
    if (Number.isFinite(n) && n > 0) variants = variants.slice(0, n);
  }

  const byAsset = new Map<string, typeof variants>();
  for (const v of variants) {
    const arr = byAsset.get(v.assetSymbol) ?? [];
    arr.push(v);
    byAsset.set(v.assetSymbol, arr);
  }

  const crowdByVariant = new Map<string, number | null>();
  const meanArchByVariant = new Map<string, number | null>();
  const VID_CHUNK = Math.max(1, parseInt(process.env.CV053_VID_CHUNK ?? "4", 10) || 4);
  const archByAgentCache = new Map<string, string>();

  for (const [assetSymbol, group] of byAsset) {
    const returns = await prisma.assetStepReturn.findMany({
      where: { runId, assetSymbol },
      select: { step: true, stepReturn: true },
    });
    const retByKey = new Map<string, number>();
    for (const r of returns) {
      retByKey.set(`${assetSymbol}:${r.step}`, r.stepReturn);
    }

    const vids = group.map((g) => g.id);
    for (let off = 0; off < vids.length; off += VID_CHUNK) {
      const slice = vids.slice(off, off + VID_CHUNK);
      const allDecisions = await prisma.agentDecision.findMany({
        where: { runId, assetSymbol, runVariantId: { in: slice } },
        select: { runVariantId: true, step: true, agentId: true, action: true },
      });

      const newAgentIds = [...new Set(allDecisions.map((d) => d.agentId))].filter(
        (id) => !archByAgentCache.has(id),
      );
      if (newAgentIds.length > 0) {
        const runAgents = await prisma.runAgent.findMany({
          where: { id: { in: newAgentIds } },
          select: { id: true, archetype: true, archetypeRef: { select: { name: true } } },
        });
        for (const a of runAgents) {
          archByAgentCache.set(
            a.id,
            labelArchetype(a.archetype ?? a.archetypeRef?.name ?? null),
          );
        }
      }

      const decByVid = new Map<string, typeof allDecisions>();
      for (const d of allDecisions) {
        const vid = d.runVariantId;
        if (!vid) continue;
        let list = decByVid.get(vid);
        if (!list) {
          list = [];
          decByVid.set(vid, list);
        }
        list.push(d);
      }

      for (const vid of slice) {
        const decs = decByVid.get(vid) ?? [];
        const crowd = crowdAccuracyFromDecisions(
          decs.map((d) => ({ step: d.step, action: d.action as Action })),
          retByKey,
          assetSymbol,
        );
        const meanArch = meanArchetypeFromDecisions(
          decs.map((d) => ({
            step: d.step,
            agentId: d.agentId,
            action: d.action as Action,
          })),
          retByKey,
          assetSymbol,
          archByAgentCache,
        );
        crowdByVariant.set(vid, crowd);
        meanArchByVariant.set(vid, meanArch);
      }
    }
  }

  const allVid = variants.map((v) => v.id);
  const allMetrics =
    allVid.length > 0
      ? await prisma.crowdMetrics.findMany({
          where: { runVariantId: { in: allVid } },
          select: {
            runVariantId: true,
            diversityIndex: true,
            herdingIndex: true,
            independenceIndex: true,
          },
        })
      : [];

  const metricsByVid = new Map<string, typeof allMetrics>();
  for (const m of allMetrics) {
    const vid = m.runVariantId;
    if (!vid) continue;
    let list = metricsByVid.get(vid);
    if (!list) {
      list = [];
      metricsByVid.set(vid, list);
    }
    list.push(m);
  }

  function finiteAvgRows(rows: typeof allMetrics, pick: (r: (typeof allMetrics)[0]) => number | null | undefined) {
    const xs = rows.map(pick).filter((x): x is number => x != null && Number.isFinite(x));
    if (xs.length === 0) return null;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }

  const numOrZero = (x: number | null | undefined) => (x != null && Number.isFinite(x) ? x : 0);

  const flat: FlatVariant[] = [];
  for (const v of variants) {
    const crowd = crowdByVariant.get(v.id) ?? null;
    const meanArch = meanArchByVariant.get(v.id) ?? null;
    const wisdom =
      crowd != null && meanArch != null && crowd > meanArch && Number.isFinite(crowd - meanArch);
    const mrows = metricsByVid.get(v.id) ?? [];
    const parsed = parseWeightsFromLabel(v.label);
    flat.push({
      wisdom,
      nAgents: v.agents,
      synWeight: numOrZero(parsed.syn),
      infoWeight: numOrZero(parsed.info),
      eventWeight: numOrZero(parsed.evt),
      regimeWeight: numOrZero(parsed.reg),
      threshold: numOrZero(parsed.th),
      diversityIndex: numOrZero(finiteAvgRows(mrows, (r) => r.diversityIndex)),
      independenceIndex: numOrZero(finiteAvgRows(mrows, (r) => r.independenceIndex)),
      herdingIndex: numOrZero(finiteAvgRows(mrows, (r) => r.herdingIndex)),
      label: variantName(v.name, v.label),
    });
  }

  await prisma.$disconnect();

  const withWisdom = flat.filter((v) => v.wisdom === true);
  const withoutWisdom = flat.filter((v) => v.wisdom === false);

  function avg(arr: number[]) {
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function extractMetric(group: FlatVariant[], field: keyof FlatVariant) {
    return avg(group.map((v) => Number(v[field] ?? 0)));
  }

  const fields: (keyof FlatVariant)[] = [
    "nAgents",
    "synWeight",
    "infoWeight",
    "eventWeight",
    "regimeWeight",
    "threshold",
    "diversityIndex",
    "independenceIndex",
    "herdingIndex",
  ];

  console.log("\n=== Wisdom Drivers Comparison ===\n");
  console.log("| parameter | wisdom_yes | wisdom_no | diff |");
  console.log("|-----------|------------|-----------|------|");

  for (const field of fields) {
    const yesVal = extractMetric(withWisdom, field);
    const noVal = extractMetric(withoutWisdom, field);
    const diff = yesVal != null && noVal != null ? (yesVal - noVal).toFixed(4) : "—";
    console.log(
      `| ${String(field)} | ${yesVal?.toFixed(4) ?? "—"} | ${noVal?.toFixed(4) ?? "—"} | ${diff} |`,
    );
  }

  console.log("\nCounts:");
  console.log("wisdom_yes:", withWisdom.length);
  console.log("wisdom_no:", withoutWisdom.length);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
