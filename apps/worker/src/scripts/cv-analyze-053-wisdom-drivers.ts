/**
 * CV-ARCH-053 analysis: wisdom=yes vs wisdom=no drivers (read-only Prisma).
 * Env: RUN_ID (required). Reuses 053 wisdom definition: crowd_acc > mean_archetype_acc.
 *
 * Usage: RUN_ID=<uuid> npx tsx src/scripts/cv-analyze-053-wisdom-drivers.ts
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

/** Inverse of decide sweep token: "0p4" -> 0.4 */
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
  decisionScale: number | null;
  nFromLabel: number | null;
};

/** Best-effort parse from labels like *_syn0p4_info0p3_evt0p2_reg0p2_th0p02_ds0p7_n10000 */
function parseWeightsFromLabel(lab: string | null | undefined): ParsedLabelWeights {
  const out: ParsedLabelWeights = {
    syn: null,
    info: null,
    evt: null,
    reg: null,
    th: null,
    decisionScale: null,
    nFromLabel: null,
  };
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
  out.decisionScale = pick(/_ds(\d+p\d+)/);
  const nM = /_n(\d+)(?:_|$)/.exec(lab);
  if (nM) out.nFromLabel = parseInt(nM[1]!, 10);
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

type Row = {
  label: string;
  wisdom: boolean;
  nAgents: number;
  parsed: ParsedLabelWeights;
  crowd: number | null;
  meanArch: number | null;
  diversityMean: number | null;
  wisdomMean: number | null;
  herdingMean: number | null;
  independenceMean: number | null;
  consensusMean: number | null;
  nSteps: number;
  configKeys: number;
};

async function main(): Promise<void> {
  loadEnv();
  const runId = process.env.RUN_ID?.trim();
  if (!runId) throw new Error("RUN_ID is required");

  const prisma = new PrismaClient();
  let variants = await prisma.runVariant.findMany({
    where: { runId },
    orderBy: [{ assetSymbol: "asc" }, { seed: "asc" }, { label: "asc" }],
    select: {
      id: true,
      name: true,
      label: true,
      assetSymbol: true,
      agents: true,
      config: true,
    },
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
            wisdomScore: true,
            herdingIndex: true,
            independenceIndex: true,
            consensus: true,
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

  function avgMetrics(vid: string) {
    const rows = metricsByVid.get(vid) ?? [];
    if (rows.length === 0) {
      return {
        diversityMean: null as number | null,
        wisdomMean: null as number | null,
        herdingMean: null as number | null,
        independenceMean: null as number | null,
        consensusMean: null as number | null,
        nSteps: 0,
      };
    }
    const finiteAvg = (xs: (number | null | undefined)[]): number | null => {
      const f = xs.filter((x): x is number => x != null && Number.isFinite(x));
      if (f.length === 0) return null;
      return f.reduce((a, b) => a + b, 0) / f.length;
    };
    return {
      diversityMean: finiteAvg(rows.map((r) => r.diversityIndex)),
      wisdomMean: finiteAvg(rows.map((r) => r.wisdomScore)),
      herdingMean: finiteAvg(rows.map((r) => r.herdingIndex)),
      independenceMean: finiteAvg(rows.map((r) => r.independenceIndex)),
      consensusMean: finiteAvg(rows.map((r) => r.consensus)),
      nSteps: rows.length,
    };
  }

  const rows: Row[] = [];
  for (const v of variants) {
    const lab = variantName(v.name, v.label);
    const crowd = crowdByVariant.get(v.id) ?? null;
    const meanArch = meanArchByVariant.get(v.id) ?? null;
    const wisdom =
      crowd != null && meanArch != null && crowd > meanArch && Number.isFinite(crowd - meanArch);
    const cm = avgMetrics(v.id);
    const parsed = parseWeightsFromLabel(v.label);
    const cfg = v.config;
    const configKeys = cfg != null && typeof cfg === "object" && !Array.isArray(cfg) ? Object.keys(cfg as object).length : 0;

    rows.push({
      label: lab,
      wisdom,
      nAgents: v.agents,
      parsed,
      crowd,
      meanArch,
      diversityMean: cm.diversityMean,
      wisdomMean: cm.wisdomMean,
      herdingMean: cm.herdingMean,
      independenceMean: cm.independenceMean,
      consensusMean: cm.consensusMean,
      nSteps: cm.nSteps,
      configKeys,
    });
  }

  await prisma.$disconnect();

  const yes = rows.filter((r) => r.wisdom);
  const no = rows.filter((r) => !r.wisdom);

  const lines: string[] = [];

  lines.push("## 1. wisdom = yes");
  lines.push("");
  if (yes.length === 0) lines.push("(none)");
  else {
    lines.push("| variant | n_agents | crowd | mean_arch | syn | info | evt | reg | th | ds | div | wisdomScore | herd | indep |");
    lines.push("|---------|----------|-------|-----------|-----|------|-----|-----|----|----|-----|-------------|------|-------|");
    for (const r of yes) {
      const p = (x: number | null) => (x != null ? x.toFixed(4) : "—");
      const w = r.parsed;
      lines.push(
        `| ${r.label.slice(0, 56)}${r.label.length > 56 ? "…" : ""} | ${r.nAgents} | ${p(r.crowd)} | ${p(r.meanArch)} | ${p(w.syn)} | ${p(w.info)} | ${p(w.evt)} | ${p(w.reg)} | ${p(w.th)} | ${p(w.decisionScale)} | ${p(r.diversityMean)} | ${p(r.wisdomMean)} | ${p(r.herdingMean)} | ${p(r.independenceMean)} |`,
      );
    }
  }

  lines.push("");
  lines.push("## 2. wisdom = no");
  lines.push("");
  if (no.length === 0) lines.push("(none)");
  else {
    lines.push("| variant | n_agents | crowd | mean_arch | syn | info | evt | reg | th | ds | div | wisdomScore | herd | indep |");
    lines.push("|---------|----------|-------|-----------|-----|------|-----|-----|----|----|-----|-------------|------|-------|");
    for (const r of no) {
      const p = (x: number | null) => (x != null ? x.toFixed(4) : "—");
      const w = r.parsed;
      lines.push(
        `| ${r.label.slice(0, 56)}${r.label.length > 56 ? "…" : ""} | ${r.nAgents} | ${p(r.crowd)} | ${p(r.meanArch)} | ${p(w.syn)} | ${p(w.info)} | ${p(w.evt)} | ${p(w.reg)} | ${p(w.th)} | ${p(w.decisionScale)} | ${p(r.diversityMean)} | ${p(r.wisdomMean)} | ${p(r.herdingMean)} | ${p(r.independenceMean)} |`,
      );
    }
  }

  const avg = (xs: (number | null)[]) => {
    const f = xs.filter((x): x is number => x != null && Number.isFinite(x));
    if (f.length === 0) return null;
    return f.reduce((a, b) => a + b, 0) / f.length;
  };

  const yn = (rs: Row[]) => ({
    n: rs.length,
    nAgents: avg(rs.map((r) => r.nAgents)),
    syn: avg(rs.map((r) => r.parsed.syn)),
    info: avg(rs.map((r) => r.parsed.info)),
    evt: avg(rs.map((r) => r.parsed.evt)),
    reg: avg(rs.map((r) => r.parsed.reg)),
    th: avg(rs.map((r) => r.parsed.th)),
    ds: avg(rs.map((r) => r.parsed.decisionScale)),
    diversity: avg(rs.map((r) => r.diversityMean)),
    wisdomScore: avg(rs.map((r) => r.wisdomMean)),
    herding: avg(rs.map((r) => r.herdingMean)),
    independence: avg(rs.map((r) => r.independenceMean)),
    consensus: avg(rs.map((r) => r.consensusMean)),
    crowd: avg(rs.map((r) => r.crowd)),
    meanArch: avg(rs.map((r) => r.meanArch)),
  });

  const A = yn(yes);
  const B = yn(no);

  lines.push("");
  lines.push("## 4. Comparison (means over variants with parsed / finite values)");
  lines.push("");
  lines.push("| parameter | wisdom_yes_avg | wisdom_no_avg |");
  lines.push("|-----------|----------------|---------------|");
  const cell = (x: number | null) => (x == null ? "—" : x.toFixed(6));
  lines.push(`| count variants | ${A.n} | ${B.n} |`);
  lines.push(`| n_agents | ${cell(A.nAgents)} | ${cell(B.nAgents)} |`);
  lines.push(`| crowd_accuracy | ${cell(A.crowd)} | ${cell(B.crowd)} |`);
  lines.push(`| mean_archetype_accuracy | ${cell(A.meanArch)} | ${cell(B.meanArch)} |`);
  lines.push(`| syn_weight (label) | ${cell(A.syn)} | ${cell(B.syn)} |`);
  lines.push(`| info_weight (label) | ${cell(A.info)} | ${cell(B.info)} |`);
  lines.push(`| event_weight (label) | ${cell(A.evt)} | ${cell(B.evt)} |`);
  lines.push(`| regime_weight (label) | ${cell(A.reg)} | ${cell(B.reg)} |`);
  lines.push(`| threshold (label) | ${cell(A.th)} | ${cell(B.th)} |`);
  lines.push(`| decision_scale ds (label) | ${cell(A.ds)} | ${cell(B.ds)} |`);
  lines.push(`| diversity_index (mean over steps) | ${cell(A.diversity)} | ${cell(B.diversity)} |`);
  lines.push(`| wisdom_score (CrowdMetrics) | ${cell(A.wisdomScore)} | ${cell(B.wisdomScore)} |`);
  lines.push(`| herding_index | ${cell(A.herding)} | ${cell(B.herding)} |`);
  lines.push(`| independence_index | ${cell(A.independence)} | ${cell(B.independence)} |`);
  lines.push(`| consensus | ${cell(A.consensus)} | ${cell(B.consensus)} |`);

  lines.push("");
  lines.push("## 5. Diffs (yes_avg − no_avg) — larger |diff| ⇒ separates groups");
  lines.push("");
  const diff = (a: number | null, b: number | null) =>
    a != null && b != null ? a - b : null;
  const dRows: [string, number | null][] = [
    ["n_agents", diff(A.nAgents, B.nAgents)],
    ["crowd_accuracy", diff(A.crowd, B.crowd)],
    ["mean_archetype_accuracy", diff(A.meanArch, B.meanArch)],
    ["syn_weight", diff(A.syn, B.syn)],
    ["info_weight", diff(A.info, B.info)],
    ["event_weight", diff(A.evt, B.evt)],
    ["regime_weight", diff(A.reg, B.reg)],
    ["threshold", diff(A.th, B.th)],
    ["decision_scale", diff(A.ds, B.ds)],
    ["diversity_index", diff(A.diversity, B.diversity)],
    ["wisdom_score_metric", diff(A.wisdomScore, B.wisdomScore)],
    ["herding_index", diff(A.herding, B.herding)],
    ["independence_index", diff(A.independence, B.independence)],
    ["consensus", diff(A.consensus, B.consensus)],
  ];
  dRows.sort((u, v) => {
    const au = Math.abs(u[1] ?? 0);
    const av = Math.abs(v[1] ?? 0);
    return av - au;
  });
  for (const [k, d] of dRows) {
    lines.push(`- **${k}**: ${d == null ? "—" : d.toFixed(6)}`);
  }

  lines.push("");
  lines.push("## 6. Patterns (heuristic)");
  lines.push("");
  lines.push(
    "- **Wisdom** here means plurality crowd hit-rate on next-step direction **>** unweighted mean of per-archetype hit-rates (051-style).",
  );
  lines.push(
    "- Labels without `_syn…_info…` tokens leave weights blank; compare only rows where parsed weights exist.",
  );
  lines.push(
    "- **CrowdMetrics `wisdomScore`** is an internal index, not the same as binary `wisdom`; still compare averages.",
  );
  if (A.diversity != null && B.diversity != null) {
    if (A.diversity > B.diversity) {
      lines.push(`- **diversity_index**: higher on wisdom=yes avg (${A.diversity.toFixed(4)} vs ${B.diversity.toFixed(4)}).`);
    } else if (A.diversity < B.diversity) {
      lines.push(`- **diversity_index**: lower on wisdom=yes avg (${A.diversity.toFixed(4)} vs ${B.diversity.toFixed(4)}).`);
    }
  }
  if (A.th != null && B.th != null) {
    if (A.th < B.th) lines.push(`- **threshold (label)**: lower on wisdom=yes avg (more aggressive crowd path).`);
    else if (A.th > B.th) lines.push(`- **threshold (label)**: higher on wisdom=yes avg.`);
  }
  if (A.herding != null && B.herding != null) {
    if (A.herding < B.herding) lines.push(`- **herding**: lower on wisdom=yes (less concentrated vote).`);
    else lines.push(`- **herding**: higher on wisdom=yes.`);
  }

  process.stdout.write(lines.join("\n"));
}

main().catch((e) => {
  process.stderr.write(String(e instanceof Error ? e.message : e) + "\n");
  process.exit(1);
});
