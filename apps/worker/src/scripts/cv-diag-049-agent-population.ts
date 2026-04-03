/**
 * CV-DIAG-049: agent population snapshot (read-only). Stdout: markdown tables only.
 * Usage: npx tsx src/scripts/cv-diag-049-agent-population.ts --runId <uuid> [--assetSymbol SPY]
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

type Action = "BUY" | "SELL" | "HOLD";

const RUN_ID_DEFAULT = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";

/** Bounded deterministic agent-pair samples for mean pairwise correlation (no full matrix). */
const PAIR_CORR_SAMPLE_CAP = 400;

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

function parseArgv(): { runId: string; assetSymbol: string } {
  const a = process.argv.slice(2);
  let runId = process.env.CV_DIAG049_RUN_ID?.trim() || RUN_ID_DEFAULT;
  let assetSymbol = "SPY";
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--runId" && a[i + 1]) runId = a[++i]!.trim();
    else if (a[i] === "--assetSymbol" && a[i + 1]) assetSymbol = a[++i]!.trim() || "SPY";
  }
  return { runId, assetSymbol };
}

function archetypeLabel(a: string | null): string {
  return a == null || a === "" ? "(null)" : a;
}

/** Population variance (÷ n); single pass, no auxiliary stack. */
function welfordPopulationStats(values: readonly number[]): {
  n: number;
  mean: number;
  variance: number;
  min: number;
  max: number;
} {
  let n = 0;
  let mean = 0;
  let m2 = 0;
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const x = values[i]!;
    if (!Number.isFinite(x)) continue;
    n++;
    if (x < minV) minV = x;
    if (x > maxV) maxV = x;
    const delta = x - mean;
    mean += delta / n;
    const delta2 = x - mean;
    m2 += delta * delta2;
  }
  const variance = n > 0 ? m2 / n : 0;
  return {
    n,
    mean,
    variance,
    min: n > 0 ? minV : 0,
    max: n > 0 ? maxV : 0,
  };
}

/** Merge one finite observation into running global stats (Welford + incremental min/max). */
function welfordPush(
  state: { n: number; mean: number; m2: number; minV: number; maxV: number },
  x: number,
): void {
  const n1 = state.n + 1;
  const delta = x - state.mean;
  const mean1 = state.mean + delta / n1;
  const delta2 = x - mean1;
  state.n = n1;
  state.mean = mean1;
  state.m2 += delta * delta2;
  if (x < state.minV) state.minV = x;
  if (x > state.maxV) state.maxV = x;
}

function actionEntropy(buy: number, sell: number, hold: number, n: number): number {
  if (n <= 0) return 0;
  let h = 0;
  for (let i = 0; i < 3; i++) {
    const c = i === 0 ? buy : i === 1 ? sell : hold;
    const p = c / n;
    if (p > 0) h -= p * Math.log(p);
  }
  return h;
}

/** Pearson; xs/ys must be short (≤ steps); internal loops only. */
function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = xs.length;
  if (n < 2 || ys.length !== n) return null;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i]!;
    sumY += ys[i]!;
  }
  const mx = sumX / n;
  const my = sumY / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = xs[i]! - mx;
    const vy = ys[i]! - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const den = Math.sqrt(dx * dy);
  if (den <= 1e-12) return null;
  return num / den;
}

/** Lexicographic pair unrank: k-th pair among (i,j) with 0 <= i < j < m. */
function pairUnrank(k: number, m: number): [number, number] | null {
  if (m < 2) return null;
  let i = 0;
  let rem = k;
  while (i < m - 1) {
    const rowLen = m - 1 - i;
    if (rem < rowLen) {
      return [i, i + 1 + rem];
    }
    rem -= rowLen;
    i++;
  }
  return null;
}

function hashSeedU32(runId: string, assetSymbol: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < runId.length; i++) {
    h ^= runId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= 0x9e3779b9;
  for (let i = 0; i < assetSymbol.length; i++) {
    h ^= assetSymbol.charCodeAt(i);
    h = Math.imul(h, 0x85ebca6b);
  }
  return h >>> 0;
}

async function main(): Promise<void> {
  loadEnv();
  const { runId, assetSymbol } = parseArgv();
  const prisma = new PrismaClient();

  const variantGroups = await prisma.agentDecision.groupBy({
    by: ["runVariantId"],
    where: { runId, assetSymbol },
    _count: { _all: true },
  });

  let decisionWhere: { runId: string; assetSymbol: string; runVariantId?: string | null } = {
    runId,
    assetSymbol,
  };
  if (variantGroups.length > 0) {
    variantGroups.sort((a, b) => b._count._all - a._count._all);
    const top = variantGroups[0]!;
    decisionWhere = { runId, assetSymbol, runVariantId: top.runVariantId };
  }

  const decisions = await prisma.agentDecision.findMany({
    where: decisionWhere,
    select: {
      step: true,
      agentId: true,
      action: true,
      distortedSignal: true,
    },
  });

  const agentIdSet = new Set<string>();
  for (let di = 0; di < decisions.length; di++) {
    agentIdSet.add(decisions[di]!.agentId);
  }
  const agentIdsFromDecisions = Array.from(agentIdSet);

  const runAgents = await prisma.runAgent.findMany({
    where: { id: { in: agentIdsFromDecisions } },
    select: {
      id: true,
      archetype: true,
      archetypeId: true,
      archetypeRef: { select: { name: true } },
    },
  });
  const archetypeById = new Map<string, string>();
  for (let ai = 0; ai < runAgents.length; ai++) {
    const a = runAgents[ai]!;
    const labelStr = a.archetype ?? a.archetypeRef?.name ?? null;
    archetypeById.set(a.id, archetypeLabel(labelStr));
  }

  const traitRowCount =
    agentIdsFromDecisions.length > 0
      ? await prisma.runAgentTrait.count({ where: { agentId: { in: agentIdsFromDecisions } } })
      : 0;

  const archetypeCounts = new Map<string, number>();
  for (let ai = 0; ai < runAgents.length; ai++) {
    const a = runAgents[ai]!;
    const k = archetypeLabel(a.archetype);
    archetypeCounts.set(k, (archetypeCounts.get(k) ?? 0) + 1);
  }
  const nAgents = runAgents.length;

  const byArchAction = new Map<string, { BUY: number; SELL: number; HOLD: number }>();
  function archBucket(arch: string): { BUY: number; SELL: number; HOLD: number } {
    let b = byArchAction.get(arch);
    if (!b) {
      b = { BUY: 0, SELL: 0, HOLD: 0 };
      byArchAction.set(arch, b);
    }
    return b;
  }

  const globalSig = {
    n: 0,
    mean: 0,
    m2: 0,
    minV: Infinity,
    maxV: -Infinity,
  };

  const byStep = new Map<
    number,
    { signals: number[]; BUY: number; SELL: number; HOLD: number }
  >();

  for (let di = 0; di < decisions.length; di++) {
    const d = decisions[di]!;
    const arch = archetypeById.get(d.agentId) ?? "(missing)";
    const act = d.action as Action;
    archBucket(arch)[act]++;
    const sig = d.distortedSignal;
    if (sig != null && Number.isFinite(sig)) {
      welfordPush(globalSig, sig);
    }
    let row = byStep.get(d.step);
    if (!row) {
      row = { signals: [], BUY: 0, SELL: 0, HOLD: 0 };
      byStep.set(d.step, row);
    }
    row[act]++;
    if (sig != null && Number.isFinite(sig)) {
      row.signals.push(sig);
    }
  }

  const lines: string[] = [];

  lines.push("| archetype | count | % |");
  lines.push("|-----------|-------|---|");
  const archetypeRows: { arch: string; c: number }[] = [];
  for (const e of archetypeCounts.entries()) {
    archetypeRows.push({ arch: e[0], c: e[1] });
  }
  archetypeRows.sort((a, b) => b.c - a.c);
  for (let i = 0; i < archetypeRows.length; i++) {
    const { arch, c } = archetypeRows[i]!;
    const pct = nAgents > 0 ? (100 * c) / nAgents : 0;
    lines.push(`| ${arch} | ${c} | ${pct.toFixed(2)}% |`);
  }
  lines.push("");
  lines.push("| source | row_count |");
  lines.push("|--------|-----------|");
  lines.push(`| RunAgentTrait | ${traitRowCount} |`);
  lines.push("");

  lines.push("| archetype | buy% | sell% | hold% |");
  lines.push("|-----------|------|-------|-------|");
  const archKeySet = new Set<string>();
  for (const k of archetypeCounts.keys()) archKeySet.add(k);
  for (const k of byArchAction.keys()) archKeySet.add(k);
  const archKeys = Array.from(archKeySet);
  archKeys.sort();
  for (let i = 0; i < archKeys.length; i++) {
    const arch = archKeys[i]!;
    const b = byArchAction.get(arch) ?? { BUY: 0, SELL: 0, HOLD: 0 };
    const n = b.BUY + b.SELL + b.HOLD;
    const fmt = (x: number): string => (n > 0 ? ((100 * x) / n).toFixed(2) : "—");
    lines.push(`| ${arch} | ${fmt(b.BUY)} | ${fmt(b.SELL)} | ${fmt(b.HOLD)} |`);
  }
  lines.push("");

  const gN = globalSig.n;
  const gMean = gN > 0 ? globalSig.mean : 0;
  const gVar = gN > 0 ? globalSig.m2 / gN : 0;
  const gStd = gN > 0 ? Math.sqrt(gVar) : 0;
  const gMin = gN > 0 ? globalSig.minV : 0;
  const gMax = gN > 0 ? globalSig.maxV : 0;
  lines.push("| metric | value |");
  lines.push("|--------|-------|");
  lines.push(`| mean | ${gN > 0 ? gMean.toFixed(6) : "—"} |`);
  lines.push(`| std | ${gN > 0 ? gStd.toFixed(6) : "—"} |`);
  lines.push(`| min | ${gN > 0 ? gMin.toFixed(6) : "—"} |`);
  lines.push(`| max | ${gN > 0 ? gMax.toFixed(6) : "—"} |`);
  lines.push("");

  const stepsSorted: number[] = [];
  for (const st of byStep.keys()) stepsSorted.push(st);
  stepsSorted.sort((a, b) => a - b);

  let sumUniqueRatio = 0;
  let nUniqueRatioSteps = 0;
  let sumStepVar = 0;
  let nVarSteps = 0;
  for (let si = 0; si < stepsSorted.length; si++) {
    const st = stepsSorted[si]!;
    const row = byStep.get(st)!;
    const sigs = row.signals;
    const nStep = row.BUY + row.SELL + row.HOLD;
    if (nStep > 0) {
      const uniq = sigs.length > 0 ? new Set(sigs).size : 0;
      sumUniqueRatio += sigs.length > 0 ? uniq / nStep : 0;
      nUniqueRatioSteps++;
    }
    const stStats = welfordPopulationStats(sigs);
    if (stStats.n > 0) {
      sumStepVar += stStats.variance;
      nVarSteps++;
    }
  }
  const avgUniqueSignalRatio = nUniqueRatioSteps > 0 ? sumUniqueRatio / nUniqueRatioSteps : 0;
  const varianceAcrossAgents = nVarSteps > 0 ? sumStepVar / nVarSteps : 0;

  const signalsByAgentStep = new Map<string, Map<number, number>>();
  for (let di = 0; di < decisions.length; di++) {
    const d = decisions[di]!;
    if (d.distortedSignal == null || !Number.isFinite(d.distortedSignal)) continue;
    let m = signalsByAgentStep.get(d.agentId);
    if (!m) {
      m = new Map();
      signalsByAgentStep.set(d.agentId, m);
    }
    m.set(d.step, d.distortedSignal);
  }

  const agentList: string[] = [];
  for (const id of signalsByAgentStep.keys()) agentList.push(id);

  const M = agentList.length;
  const pairSpace = M >= 2 ? (M * (M - 1)) / 2 : 0;
  const seedU = hashSeedU32(runId, assetSymbol);
  let corrSum = 0;
  let corrAccepted = 0;

  if (pairSpace > 0 && PAIR_CORR_SAMPLE_CAP > 0) {
    const take = PAIR_CORR_SAMPLE_CAP < pairSpace ? PAIR_CORR_SAMPLE_CAP : pairSpace;
    for (let k = 0; k < take; k++) {
      const mix = (seedU + Math.imul(k, 0x7f4a7c15)) >>> 0;
      const pairIdx = mix % pairSpace;
      const ij = pairUnrank(pairIdx, M);
      if (ij == null) continue;
      const [ii, jj] = ij;
      const a = agentList[ii]!;
      const b = agentList[jj]!;
      const ma = signalsByAgentStep.get(a);
      const mb = signalsByAgentStep.get(b);
      if (ma == null || mb == null) continue;

      const xs: number[] = [];
      const ys: number[] = [];
      for (let ti = 0; ti < stepsSorted.length; ti++) {
        const s = stepsSorted[ti]!;
        const x = ma.get(s);
        const y = mb.get(s);
        if (x != null && y != null && Number.isFinite(x) && Number.isFinite(y)) {
          xs.push(x);
          ys.push(y);
        }
      }
      const r = pearson(xs, ys);
      if (r != null) {
        corrSum += r;
        corrAccepted++;
      }
    }
  }
  const avgPairCorr = corrAccepted > 0 ? corrSum / corrAccepted : 0;

  lines.push("| metric | value |");
  lines.push("|--------|-------|");
  lines.push(`| unique_signal_ratio | ${nUniqueRatioSteps > 0 ? avgUniqueSignalRatio.toFixed(6) : "—"} |`);
  lines.push(`| variance_across_agents | ${nVarSteps > 0 ? varianceAcrossAgents.toFixed(6) : "—"} |`);
  lines.push(`| avg_pairwise_correlation | ${corrAccepted > 0 ? avgPairCorr.toFixed(6) : "—"} |`);
  lines.push("");

  lines.push("| step | mean | std | entropy | polarization |");
  lines.push("|------|------|-----|---------|--------------|");
  for (let si = 0; si < stepsSorted.length; si++) {
    const st = stepsSorted[si]!;
    const row = byStep.get(st)!;
    const stStats = welfordPopulationStats(row.signals);
    const n = row.BUY + row.SELL + row.HOLD;
    const ent = actionEntropy(row.BUY, row.SELL, row.HOLD, n);
    const buyPct = n > 0 ? (100 * row.BUY) / n : 0;
    const sellPct = n > 0 ? (100 * row.SELL) / n : 0;
    const pol = Math.abs(buyPct - sellPct);
    lines.push(
      `| ${st} | ${stStats.n > 0 ? stStats.mean.toFixed(6) : "—"} | ${stStats.n > 0 ? Math.sqrt(stStats.variance).toFixed(6) : "—"} | ${n > 0 ? ent.toFixed(6) : "—"} | ${n > 0 ? pol.toFixed(2) : "—"} |`,
    );
  }
  lines.push("");

  await prisma.$disconnect();

  process.stdout.write(lines.join("\n"));
}

main().catch((e) => {
  process.stderr.write(String(e instanceof Error ? e.message : e) + "\n");
  process.exit(1);
});
