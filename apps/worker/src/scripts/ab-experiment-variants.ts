/**
 * CV-VAL-006: A/B three crowd sizes on ONE runId, persist RunVariant rows, GET /variants.
 *
 *   pnpm -C apps/worker run ab-experiment
 *
 * Requires API up for POST /agents/generate and GET /runs/:id/accuracy (logged; per-variant
 * accuracy stored via runVariantId-scoped forecast math — see variant-forecast-accuracy.ts).
 *
 * Optional: --runId <uuid> (default: latest run that has enough AssetStepReturn).
 */
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import { PrismaClient, Prisma } from "@crowdvest/db";
import { computeVariantForecastAccuracy } from "../lib/variant-forecast-accuracy";
import { generateAgentsV1ForRun } from "../lib/generate-agents-v1";

const STEPS = 29;
const SEED = 1;
const MIN_RETURNS = 35;

const VARIANTS = [
  { name: "baseline_500_agents", agents: 500 },
  { name: "large_crowd_2000_agents", agents: 2000 },
  { name: "small_crowd_100_agents", agents: 100 },
] as const;

function loadEnv(): void {
  const cwd = process.cwd();
  for (const p of [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, "..", ".env"),
    path.resolve(cwd, "..", "..", ".env"),
    path.resolve(__dirname, "..", "..", "..", "..", ".env"),
  ]) {
    try {
      if (!fs.existsSync(p)) continue;
      const content = fs.readFileSync(p, "utf8");
      for (const line of content.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq <= 0) continue;
        const key = t.slice(0, eq).trim();
        const val = t.slice(eq + 1).trim();
        if (key && !(key in process.env)) process.env[key] = val;
      }
    } catch {
      // ignore
    }
  }
  if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is not set.");
}

function parseArgv(): { runId: string | undefined } {
  const args = process.argv.slice(2);
  let runId: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--runId" && args[i + 1]) runId = String(args[++i]).trim();
  }
  return { runId };
}

async function pickRunAndAsset(
  prisma: PrismaClient,
  explicitRunId: string | undefined,
): Promise<{ runId: string; assetSymbol: string }> {
  if (explicitRunId) {
    const grouped = await prisma.assetStepReturn.groupBy({
      by: ["assetSymbol"],
      where: { runId: explicitRunId },
      _count: { _all: true },
    });
    const ok = grouped.filter((g) => g._count._all >= MIN_RETURNS);
    ok.sort((a, b) => b._count._all - a._count._all);
    const assetSymbol = ok[0]?.assetSymbol;
    if (!assetSymbol) {
      throw new Error(
        `runId=${explicitRunId} has no asset with at least ${MIN_RETURNS} AssetStepReturn rows`,
      );
    }
    return { runId: explicitRunId, assetSymbol };
  }

  const candidates = await prisma.simulationRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true },
  });
  for (const c of candidates) {
    const grouped = await prisma.assetStepReturn.groupBy({
      by: ["assetSymbol"],
      where: { runId: c.id },
      _count: { _all: true },
    });
    const best = grouped.filter((g) => g._count._all >= MIN_RETURNS).sort((a, b) => b._count._all - a._count._all)[0];
    if (best) return { runId: c.id, assetSymbol: best.assetSymbol };
  }
  throw new Error(`No recent run has AssetStepReturn count >= ${MIN_RETURNS} for any symbol`);
}

function runWorker(script: "decide" | "compute-crowd-metrics", extra: string[], repoRoot: string): boolean {
  const r = spawnSync("pnpm", ["--filter", "worker", "run", script, "--", ...extra], {
    stdio: "inherit",
    cwd: repoRoot,
  });
  return r.status === 0;
}

/** Same contract as POST /agents/generate (Agents v1); in-process to avoid long HTTP transactions. */
async function generateAgents(
  prisma: PrismaClient,
  apiBase: string,
  runId: string,
  count: number,
  seed: number,
): Promise<void> {
  const url = `${apiBase.replace(/\/$/, "")}/agents/generate?runId=${encodeURIComponent(runId)}&overwrite=true`;
  const body = { count, seed, preset: "default" as const };
  console.log(`\n[EQUIV] POST ${url}`);
  console.log(`       body: ${JSON.stringify(body)}`);
  console.log(`       (executing via Prisma — same logic as AgentsV1Service.generate)`);
  const res = await generateAgentsV1ForRun(prisma, runId, {
    count,
    seed,
    overwrite: true,
  });
  console.log(`       -> ok total=${res.total} created=${res.createdCount} overwritten=${res.overwritten}`);
}

async function getRunAccuracy(apiBase: string, runId: string): Promise<void> {
  const url = `${apiBase.replace(/\/$/, "")}/runs/${encodeURIComponent(runId)}/accuracy?overwrite=true`;
  console.log(`\n[HTTP] GET ${url}`);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) console.warn(`[HTTP] GET accuracy ${res.status}: ${text.slice(0, 300)}`);
  else console.log(`[HTTP] -> ${res.status} (run-level; blended if multiple variants)`);
}

async function getVariants(apiBase: string, runId: string): Promise<unknown> {
  const url = `${apiBase.replace(/\/$/, "")}/variants?runId=${encodeURIComponent(runId)}`;
  console.log(`\n[HTTP] GET ${url}`);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`GET /variants failed ${res.status}: ${text}`);
  return JSON.parse(text) as unknown;
}

async function main(): Promise<void> {
  loadEnv();
  const { runId: argRunId } = parseArgv();
  const apiBase = process.env.API_BASE?.trim() || "http://127.0.0.1:4001";
  const workerRoot = path.resolve(__dirname, "..", "..");
  const repoRoot = path.resolve(workerRoot, "..", "..");

  const prisma = new PrismaClient();
  const { runId, assetSymbol } = await pickRunAndAsset(prisma, argRunId);
  console.log(`ab-experiment runId=${runId} assetSymbol=${assetSymbol} steps=${STEPS} seed=${SEED}`);
  console.log(`API_BASE=${apiBase}`);

  const persistMode = (process.env.AB_PERSIST ?? "lite").toLowerCase() === "full" ? "full" : "lite";

  for (const variant of VARIANTS) {
    console.log(`\n========== ${variant.name} (${variant.agents} agents) ==========`);

    await generateAgents(prisma, apiBase, runId, variant.agents, SEED);

    const decideArgs = [
      "--runId",
      runId,
      "--assetSymbol",
      assetSymbol,
      "--steps",
      String(STEPS),
      "--seed",
      String(SEED),
      "--label",
      variant.name,
      "--agents",
      String(variant.agents),
      "--overwrite",
      "true",
      "--allowSmallCrowd",
      "--persist",
      persistMode,
    ];
    console.log(`\n[CMD] pnpm --filter worker run decide -- ${decideArgs.join(" ")}`);
    if (!runWorker("decide", decideArgs, repoRoot)) {
      throw new Error(`decide failed for ${variant.name}`);
    }

    const rv = await prisma.runVariant.findUnique({
      where: {
        runId_assetSymbol_seed_label: {
          runId,
          assetSymbol,
          seed: SEED,
          label: variant.name,
        },
      },
      select: { id: true },
    });
    if (!rv) throw new Error(`RunVariant not found after decide: ${variant.name}`);

    const metricsArgs = ["--runVariantId", rv.id, "--overwrite", "true"];
    console.log(`\n[CMD] pnpm --filter worker run compute-crowd-metrics -- ${metricsArgs.join(" ")}`);
    if (!runWorker("compute-crowd-metrics", metricsArgs, repoRoot)) {
      throw new Error(`compute-crowd-metrics failed for ${variant.name}`);
    }

    await getRunAccuracy(apiBase, runId);

    const { accuracy, baselineBuy, baselineSell } = await computeVariantForecastAccuracy(
      prisma,
      runId,
      rv.id,
      assetSymbol,
    );

    await prisma.runVariant.update({
      where: { id: rv.id },
      data: {
        name: variant.name,
        agents: variant.agents,
        steps: STEPS,
        config: { agents: variant.agents, seed: SEED } as Prisma.InputJsonValue,
        accuracy,
        baselineBuy,
        baselineSell,
        completedAt: new Date(),
      },
    });

    console.log(
      `\nStored variant ${variant.name}: accuracy=${accuracy.toFixed(4)} baselineBuy=${baselineBuy.toFixed(4)}`,
    );
  }

  const table = await getVariants(apiBase, runId);
  console.log("\n========== GET /variants ==========\n", JSON.stringify(table, null, 2));

  const rows = table as { name?: string; accuracy?: number | null; baselineBuy?: number | null }[];
  const ranked = [...rows].filter((r) => r.accuracy != null).sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0));
  if (ranked.length) {
    const best = ranked[0]!;
    console.log(`\nBest performer (by stored accuracy): ${best.name} accuracy=${best.accuracy?.toFixed(4)}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ab-experiment failed:", e);
  process.exit(1);
});
