/**
 * CV-VAL-053: crowd accuracy (GET /variants) vs per-variant archetype accuracy stats (051-style).
 * Env: RUN_ID (required). Optional: API_BASE (default http://127.0.0.1:4001)
 * Usage: RUN_ID=<uuid> npx tsx src/scripts/cv-val-053-crowd-vs-archetypes.ts
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

type Bucket051 = {
  accOk: number;
  accTot: number;
};

function emptyBucket051(): Bucket051 {
  return { accOk: 0, accTot: 0 };
}

function variantDisplayName(name: string, label: string | null): string {
  const n = name.trim();
  if (n !== "") return n;
  const l = (label ?? "").trim();
  if (l !== "") return l;
  return "variant";
}

type ApiVariantRow = {
  name?: string;
  accuracy?: number | null;
  agents?: number | null;
  pnl?: number | null;
};

type ArchetypeAgg = {
  meanArch: number | null;
  bestArch: number | null;
  worstArch: number | null;
};

async function fetchCrowdFromApi(
  apiBase: string,
  runId: string,
): Promise<Array<{ name: string; accuracy: number | null }>> {
  const url = `${apiBase.replace(/\/$/, "")}/variants?runId=${encodeURIComponent(runId)}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GET /variants failed ${res.status}: ${text.slice(0, 500)}`);
  }
  const raw = JSON.parse(text) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error("GET /variants: expected JSON array");
  }
  const out: Array<{ name: string; accuracy: number | null }> = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] as ApiVariantRow;
    const name = typeof row?.name === "string" ? row.name : "(unknown)";
    const acc = row?.accuracy;
    const accuracy =
      acc != null && typeof acc === "number" && Number.isFinite(acc) ? acc : null;
    out.push({ name, accuracy });
  }
  return out;
}

/** Same aggregation as cv-diag-051 for one runVariant + assetSymbol. */
async function archetypeAgg051ForVariant(
  prisma: PrismaClient,
  runId: string,
  runVariantId: string,
  assetSymbol: string,
): Promise<ArchetypeAgg> {
  const returns = await prisma.assetStepReturn.findMany({
    where: { runId, assetSymbol },
    select: { step: true, stepReturn: true },
  });
  const retByKey = new Map<string, number>();
  for (const r of returns) {
    retByKey.set(`${assetSymbol}:${r.step}`, r.stepReturn);
  }

  const decisions = await prisma.agentDecision.findMany({
    where: { runId, assetSymbol, runVariantId },
    select: { step: true, agentId: true, action: true },
  });

  const agentIdSet = new Set<string>();
  for (const d of decisions) agentIdSet.add(d.agentId);
  const agentIds = Array.from(agentIdSet);

  const runAgents = await prisma.runAgent.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, archetype: true, archetypeRef: { select: { name: true } } },
  });

  const archetypeByAgent = new Map<string, string>();
  for (const a of runAgents) {
    archetypeByAgent.set(a.id, labelArchetype(a.archetype ?? a.archetypeRef?.name ?? null));
  }

  const byArch = new Map<string, Bucket051>();
  function bucket(k: string): Bucket051 {
    let b = byArch.get(k);
    if (!b) {
      b = emptyBucket051();
      byArch.set(k, b);
    }
    return b;
  }

  for (const d of decisions) {
    const arch = archetypeByAgent.get(d.agentId) ?? "(missing)";
    const b = bucket(arch);
    const act = d.action as Action;
    const nextKey = `${assetSymbol}:${d.step + 1}`;
    const nextRet = retByKey.get(nextKey);
    if (nextRet != null && Number.isFinite(nextRet)) {
      const truth = directionFromReturn(nextRet);
      b.accTot++;
      if (act === truth) b.accOk++;
    }
  }

  let sumAcc = 0;
  let nArch = 0;
  let bestAcc = -1;
  let worstAcc = 2;

  for (const b of byArch.values()) {
    if (b.accTot <= 0) continue;
    const acc = b.accOk / b.accTot;
    sumAcc += acc;
    nArch++;
    if (acc > bestAcc) bestAcc = acc;
    if (acc < worstAcc) worstAcc = acc;
  }

  return {
    meanArch: nArch > 0 ? sumAcc / nArch : null,
    bestArch: nArch > 0 && bestAcc >= 0 ? bestAcc : null,
    worstArch: nArch > 0 && worstAcc <= 1 ? worstAcc : null,
  };
}

function pct(x: number | null): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${(100 * x).toFixed(2)}%`;
}

function diffPts(crowd: number | null, arch: number | null): string {
  if (crowd == null || arch == null || !Number.isFinite(crowd) || !Number.isFinite(arch)) {
    return "—";
  }
  return `${(100 * (crowd - arch)).toFixed(2)}`;
}

async function main(): Promise<void> {
  loadEnv();
  const runId = process.env.RUN_ID?.trim();
  if (!runId) {
    throw new Error("RUN_ID is required (set in environment)");
  }

  const apiBase = process.env.API_BASE?.trim() || "http://127.0.0.1:4001";
  const prisma = new PrismaClient();

  const apiRows = await fetchCrowdFromApi(apiBase, runId);

  const dbVariants = await prisma.runVariant.findMany({
    where: { runId },
    orderBy: [{ assetSymbol: "asc" }, { seed: "asc" }, { label: "asc" }],
    select: { id: true, name: true, label: true, assetSymbol: true },
  });

  if (dbVariants.length !== apiRows.length) {
    process.stderr.write(
      `[cv-val-053] warn: API variant count (${apiRows.length}) != DB variant count (${dbVariants.length}); zipping by index to min length.\n`,
    );
  }

  const n = Math.min(apiRows.length, dbVariants.length);
  const lines: string[] = [];
  lines.push("| variant | crowd | mean_arch | best_arch | vs_mean | vs_best | wisdom |");
  lines.push("|---------|-------|-----------|-----------|---------|---------|--------|");

  let anyWisdom = false;

  for (let i = 0; i < n; i++) {
    const api = apiRows[i]!;
    const v = dbVariants[i]!;
    const display = variantDisplayName(v.name, v.label);
    const crowd = api.accuracy;
    const agg = await archetypeAgg051ForVariant(prisma, runId, v.id, v.assetSymbol);
    const { meanArch, bestArch } = agg;

    const vsMean = diffPts(crowd, meanArch);
    const vsBest = diffPts(crowd, bestArch);
    const wisdom =
      crowd != null && meanArch != null && crowd > meanArch ? "yes" : "no";
    if (wisdom === "yes") anyWisdom = true;

    lines.push(
      `| ${display} | ${pct(crowd)} | ${pct(meanArch)} | ${pct(bestArch)} | ${vsMean} | ${vsBest} | ${wisdom} |`,
    );
  }

  lines.push("");
  lines.push(`| success (any wisdom) | ${anyWisdom ? "yes" : "no"} |`);
  lines.push("");
  lines.push(`| note | vs_mean / vs_best are percentage points (crowd − arch). |`);

  await prisma.$disconnect();
  process.stdout.write(lines.join("\n"));
}

main().catch((e) => {
  process.stderr.write(String(e instanceof Error ? e.message : e) + "\n");
  process.exit(1);
});
