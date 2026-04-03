/**
 * CV-DIAG-051: per-archetype behavior vs next-step return (read-only; single streaming pass).
 * Usage: npx tsx src/scripts/cv-diag-051-archetype-differentiation.ts --runId <uuid> [--assetSymbol SPY]
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

type Action = "BUY" | "SELL" | "HOLD";

const RUN_ID_DEFAULT = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";

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
  let runId = process.env.CV_DIAG051_RUN_ID?.trim() || RUN_ID_DEFAULT;
  let assetSymbol = "SPY";
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--runId" && a[i + 1]) runId = a[++i]!.trim();
    else if (a[i] === "--assetSymbol" && a[i + 1]) assetSymbol = a[++i]!.trim() || "SPY";
  }
  return { runId, assetSymbol };
}

function labelArchetype(s: string | null | undefined): string {
  return s == null || s === "" ? "(null)" : s;
}

function directionFromReturn(stepReturn: number): Action {
  if (stepReturn > 0) return "BUY";
  if (stepReturn < 0) return "SELL";
  return "HOLD";
}

/** Population std (÷ n); online Welford fragment. */
type SigAgg = { n: number; mean: number; m2: number };

function sigPush(s: SigAgg, x: number): void {
  const n1 = s.n + 1;
  const d = x - s.mean;
  const mean1 = s.mean + d / n1;
  const d2 = x - mean1;
  s.n = n1;
  s.mean = mean1;
  s.m2 += d * d2;
}

type Bucket = {
  count: number;
  buy: number;
  sell: number;
  hold: number;
  accOk: number;
  accTot: number;
  sig: SigAgg;
};

function emptyBucket(): Bucket {
  return {
    count: 0,
    buy: 0,
    sell: 0,
    hold: 0,
    accOk: 0,
    accTot: 0,
    sig: { n: 0, mean: 0, m2: 0 },
  };
}

async function main(): Promise<void> {
  loadEnv();
  const { runId, assetSymbol } = parseArgv();
  const prisma = new PrismaClient();

  const returns = await prisma.assetStepReturn.findMany({
    where: { runId, assetSymbol },
    select: { step: true, stepReturn: true },
  });
  const retByKey = new Map<string, number>();
  for (let ri = 0; ri < returns.length; ri++) {
    const r = returns[ri]!;
    retByKey.set(`${assetSymbol}:${r.step}`, r.stepReturn);
  }

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
    decisionWhere = { runId, assetSymbol, runVariantId: variantGroups[0]!.runVariantId };
  }

  const decisions = await prisma.agentDecision.findMany({
    where: decisionWhere,
    select: { step: true, agentId: true, action: true, distortedSignal: true },
  });

  const agentIdSet = new Set<string>();
  for (let i = 0; i < decisions.length; i++) {
    agentIdSet.add(decisions[i]!.agentId);
  }
  const agentIds = Array.from(agentIdSet);

  const runAgents = await prisma.runAgent.findMany({
    where: { id: { in: agentIds } },
    select: {
      id: true,
      archetype: true,
      archetypeRef: { select: { name: true } },
    },
  });

  const archetypeByAgent = new Map<string, string>();
  for (let i = 0; i < runAgents.length; i++) {
    const a = runAgents[i]!;
    archetypeByAgent.set(a.id, labelArchetype(a.archetype ?? a.archetypeRef?.name ?? null));
  }

  const byArch = new Map<string, Bucket>();

  function bucket(key: string): Bucket {
    let b = byArch.get(key);
    if (!b) {
      b = emptyBucket();
      byArch.set(key, b);
    }
    return b;
  }

  for (let di = 0; di < decisions.length; di++) {
    const d = decisions[di]!;
    const arch = archetypeByAgent.get(d.agentId) ?? "(missing)";
    const b = bucket(arch);
    b.count++;
    const act = d.action as Action;
    if (act === "BUY") b.buy++;
    else if (act === "SELL") b.sell++;
    else b.hold++;

    const sig = d.distortedSignal;
    if (sig != null && Number.isFinite(sig)) {
      sigPush(b.sig, sig);
    }

    const nextKey = `${assetSymbol}:${d.step + 1}`;
    const nextRet = retByKey.get(nextKey);
    if (nextRet != null && Number.isFinite(nextRet)) {
      const truth = directionFromReturn(nextRet);
      b.accTot++;
      if (act === truth) b.accOk++;
    }
  }

  const rows: { arch: string; b: Bucket }[] = [];
  for (const e of byArch.entries()) {
    rows.push({ arch: e[0], b: e[1] });
  }
  rows.sort((a, b) => a.arch.localeCompare(b.arch));

  let bestAcc = -1;
  let worstAcc = 2;
  let minMean = Infinity;
  let maxMean = -Infinity;

  for (let i = 0; i < rows.length; i++) {
    const { b } = rows[i]!;
    if (b.accTot > 0) {
      const acc = b.accOk / b.accTot;
      if (acc > bestAcc) bestAcc = acc;
      if (acc < worstAcc) worstAcc = acc;
    }
    if (b.sig.n > 0) {
      if (b.sig.mean < minMean) minMean = b.sig.mean;
      if (b.sig.mean > maxMean) maxMean = b.sig.mean;
    }
  }

  const lines: string[] = [];
  lines.push("| archetype | accuracy | mean | std | buy% | sell% | hold% | count |");
  lines.push("|-----------|----------|------|-----|------|-------|-------|-------|");

  for (let i = 0; i < rows.length; i++) {
    const { arch, b } = rows[i]!;
    const accStr = b.accTot > 0 ? `${((100 * b.accOk) / b.accTot).toFixed(2)}%` : "—";
    const meanStr = b.sig.n > 0 ? b.sig.mean.toFixed(6) : "—";
    const stdStr = b.sig.n > 0 ? Math.sqrt(b.sig.m2 / b.sig.n).toFixed(6) : "—";
    const n = b.count;
    const p = (c: number) => (n > 0 ? `${((100 * c) / n).toFixed(2)}%` : "—");
    lines.push(
      `| ${arch} | ${accStr} | ${meanStr} | ${stdStr} | ${p(b.buy)} | ${p(b.sell)} | ${p(b.hold)} | ${b.count} |`,
    );
  }

  lines.push("");
  lines.push("| metric | value |");
  lines.push("|--------|-------|");

  const bestStr = bestAcc >= 0 ? `${(100 * bestAcc).toFixed(2)}%` : "—";
  const worstStr = worstAcc <= 1 ? `${(100 * worstAcc).toFixed(2)}%` : "—";
  const gapStr =
    bestAcc >= 0 && worstAcc <= 1 && bestAcc >= worstAcc
      ? `${(100 * (bestAcc - worstAcc)).toFixed(2)}%`
      : "—";
  const rangeStr =
    minMean !== Infinity && maxMean !== -Infinity ? (maxMean - minMean).toFixed(6) : "—";

  lines.push(`| best_archetype_accuracy | ${bestStr} |`);
  lines.push(`| worst_archetype_accuracy | ${worstStr} |`);
  lines.push(`| accuracy_gap | ${gapStr} |`);
  lines.push(`| mean_signal_range | ${rangeStr} |`);

  await prisma.$disconnect();

  process.stdout.write(lines.join("\n"));
}

main().catch((e) => {
  process.stderr.write(String(e instanceof Error ? e.message : e) + "\n");
  process.exit(1);
});
