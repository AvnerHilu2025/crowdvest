/**
 * CLI: pnpm -C apps/worker run compute-crowd-metrics -- --runId <uuid> [--assetSymbol RUN]
 * Computes CrowdMetrics from AgentDecision and persists.
 * Idempotent: upserts per (runId, assetSymbol, step).
 *
 * NOTE: RunVariantSummary (corr, directionalAccuracy, decisionsHash, returnsHash, decisionCounts)
 * is NOT computed here. It is computed in backtest-v0.ts after this script runs per seed.
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";
import { chunk } from "../lib/chunk";

const DATABASE_URL_MISSING =
  "DATABASE_URL is not set. Create a .env at the repository root with DATABASE_URL=postgresql://...";

function loadEnvFile(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

function loadEnv(): void {
  const cwd = process.cwd();
  for (const p of [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, "..", ".env"),
    path.resolve(cwd, "..", "..", ".env"),
    path.resolve(__dirname, "..", "..", "..", ".env"),
  ]) {
    loadEnvFile(p);
  }
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(`${DATABASE_URL_MISSING} (cwd: ${cwd})`);
  }
}

function parseArgv(): { runId: string; assetSymbol: string; runVariantId: string | undefined; overwrite: boolean } {
  const args = process.argv.slice(2);
  let runId = "";
  let assetSymbol = "RUN";
  let runVariantId: string | undefined;
  let overwrite = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--runVariantId" && args[i + 1]) {
      runVariantId = args[++i]!.trim();
    } else if (args[i] === "--runId" && args[i + 1]) {
      runId = args[++i]!.trim();
    } else if (args[i] === "--assetSymbol" && args[i + 1]) {
      assetSymbol = args[++i]!.trim() || "RUN";
    } else if (args[i] === "--overwrite" && args[i + 1]) {
      overwrite = String(args[++i]).trim().toLowerCase() === "true";
    }
  }
  if (runVariantId) {
    if (!runId) runId = ""; // will be resolved from RunVariant
  } else {
    if (!runId) throw new Error("--runId is required (or use --runVariantId)");
  }
  return { runId, assetSymbol, runVariantId, overwrite };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function clamp01(x: number): number {
  return clamp(x, 0, 1);
}

/** Standard deviation of values (0 if fewer than 2). */
function std(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Build trait map from RunAgentTrait[]. */
function traitMapFromTraits(traits: { key: string; valueNum: number | null }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of traits) {
    if (t.valueNum != null && Number.isFinite(t.valueNum)) {
      m.set(t.key, clamp01(t.valueNum));
    }
  }
  return m;
}

/**
 * diversityIndex = mean([std(riskTolerance), std(confidence), std(age/100)])
 * Uses available data; each series needs at least 2 values.
 */
function computeDiversityIndex(
  decisions: { confidence: number; traitMap: Map<string, number> }[],
): number | null {
  if (decisions.length < 2) return null;
  const riskTolerances = decisions
    .map((d) => d.traitMap.get("riskTolerance"))
    .filter((v): v is number => v != null && Number.isFinite(v));
  const confidences = decisions.map((d) => clamp01(d.confidence));
  const agesNorm = decisions
    .map((d) => {
      const age = d.traitMap.get("age");
      return age != null && Number.isFinite(age) ? clamp01(age / 100) : null;
    })
    .filter((v): v is number => v != null);

  const stds: number[] = [];
  if (riskTolerances.length >= 2) stds.push(std(riskTolerances));
  if (confidences.length >= 2) stds.push(std(confidences));
  if (agesNorm.length >= 2) stds.push(std(agesNorm));
  if (stds.length === 0) return null;
  return clamp01(stds.reduce((a, b) => a + b, 0) / stds.length);
}

/**
 * herdingIndex (0..1): how strongly decisions cluster around one action.
 * herdingIndex = clamp01((pMax - 1/3) / (1 - 1/3)); 0 when uniform, 1 when everyone same.
 */
function computeDecisionHerdingIndex(pMax: number): number {
  return clamp01((pMax - 1 / 3) / (1 - 1 / 3));
}

/**
 * independenceIndex = clamp(1 - herdingIndex - consensus, 0, 1)
 */
function computeIndependenceIndex(herdingIndex: number, consensus: number): number {
  return clamp01(1 - herdingIndex - consensus);
}

/**
 * noiseSensitivity (0..1): reaction to low-credibility events.
 * - Filter: events with credibility < 0.5 (strict).
 * - lowCredEventStrength = sum over those: abs(sentiment) * impact * (1 - credibility)
 *   (DB column is "reach"; API sends "impact" which is stored as reach.)
 * - decisionVolatility = 1 - pMax
 * - noiseSensitivity = clamp01(lowCredEventStrength * decisionVolatility)
 * - If no low-cred events at step => 0.
 * All math is floating point; no parseInt/Math.floor on intermediates.
 */
function computeNoiseSensitivity(
  events: { sentiment: number; credibility: number; impact: number }[],
  pMax: number,
): number {
  if (events.length === 0) return 0;
  const lowCred = events.filter((e) => e.credibility < 0.5);
  if (lowCred.length === 0) return 0;
  let lowCredEventStrength = 0;
  for (const e of lowCred) {
    lowCredEventStrength +=
      Math.abs(e.sentiment) * e.impact * (1 - e.credibility);
  }
  if (!Number.isFinite(lowCredEventStrength) || lowCredEventStrength <= 0)
    return 0;
  const decisionVolatility = 1 - pMax;
  const product = lowCredEventStrength * decisionVolatility;
  return Math.max(0, Math.min(1, product));
}

/** Compute CrowdMetrics for one step from AgentDecision rows. */
export function computeCrowdMetricsForStep(
  decisions: { action: string; confidence: number; traitMap: Map<string, number> }[],
  prevWeightedSignal: number | null,
): {
  signal: number;
  weightedSignal: number;
  consensus: number;
  polarization: number;
  uncertainty: number;
  minorityStrength: number;
  beliefMomentum: number | null;
  diversityIndex: number | null;
  independenceIndex: number;
  herdingIndex: number;
  wisdomScore: number | null;
} {
  const N = decisions.length;
  if (N === 0) {
    return {
      signal: 0,
      weightedSignal: 0,
      consensus: 0,
      polarization: 0,
      uncertainty: 1,
      minorityStrength: 0,
      beliefMomentum: null,
      diversityIndex: null,
      independenceIndex: 1,
      herdingIndex: 0,
      wisdomScore: null,
    };
  }

  let buyCount = 0;
  let sellCount = 0;
  let holdCount = 0;
  let weightedSum = 0;
  let confSum = 0;

  for (const d of decisions) {
    confSum += d.confidence;
    if (d.action === "BUY") {
      buyCount++;
      weightedSum += d.confidence;
    } else if (d.action === "SELL") {
      sellCount++;
      weightedSum -= d.confidence;
    } else {
      holdCount++;
    }
  }

  const signal = clamp((buyCount - sellCount) / N, -1, 1);
  const weightedSignal = clamp(weightedSum / N, -1, 1);
  const maxFraction = Math.max(buyCount, sellCount, holdCount) / N;
  const consensus = clamp(maxFraction, 0, 1);
  const polarization = clamp((2 * Math.min(buyCount, sellCount)) / N, 0, 1);
  const uncertainty = clamp(1 - confSum / N, 0, 1);
  const minorityStrength = clamp(1 - consensus, 0, 1);
  const beliefMomentum =
    prevWeightedSignal != null
      ? clamp(weightedSignal - prevWeightedSignal, -2, 2)
      : null;

  const diversityIndex = computeDiversityIndex(decisions);
  const herdingIndex = computeDecisionHerdingIndex(maxFraction);
  const independenceIndex = computeIndependenceIndex(herdingIndex, consensus);

  // wisdomScore = clamp(diversityIndex * independenceIndex * (1 - polarization) * (1 - uncertainty), 0, 1)
  const wisdomScore =
    diversityIndex != null
      ? clamp01(
          diversityIndex * independenceIndex * (1 - polarization) * (1 - uncertainty),
        )
      : null;

  return {
    signal,
    weightedSignal,
    consensus,
    polarization,
    uncertainty,
    minorityStrength,
    beliefMomentum,
    diversityIndex,
    independenceIndex,
    herdingIndex,
    wisdomScore,
  };
}

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

/** Resolve runId, assetSymbol, runVariantId. If runVariantId given, load from RunVariant; else use runId+assetSymbol and pick latest variant. */
async function resolveVariant(
  prisma: PrismaClient,
  argv: { runId: string; assetSymbol: string; runVariantId: string | undefined },
): Promise<{ runId: string; assetSymbol: string; runVariantId: string }> {
  if (argv.runVariantId) {
    const v = await prisma.runVariant.findUnique({
      where: { id: argv.runVariantId },
      select: { id: true, runId: true, assetSymbol: true },
    });
    if (!v) throw new Error(`RunVariant not found: ${argv.runVariantId}`);
    return { runId: v.runId, assetSymbol: v.assetSymbol, runVariantId: v.id };
  }
  const run = await prisma.simulationRun.findUnique({
    where: { id: argv.runId },
    select: { id: true },
  });
  if (!run) throw new Error(`Run not found: ${argv.runId}`);
  const v = await prisma.runVariant.findFirst({
    where: { runId: argv.runId, assetSymbol: argv.assetSymbol },
    orderBy: { createdAt: "desc" },
    select: { id: true, runId: true, assetSymbol: true },
  });
  if (!v) throw new Error(`No RunVariant for runId=${argv.runId} assetSymbol=${argv.assetSymbol}. Run decide first or pass --runVariantId.`);
  return { runId: v.runId, assetSymbol: v.assetSymbol, runVariantId: v.id };
}

async function main(): Promise<void> {
  loadEnv();
  const argv = parseArgv();
  const prisma = new PrismaClient();

  const { runId, assetSymbol, runVariantId } = await resolveVariant(prisma, argv);
  log(`compute-crowd-metrics runId=${runId} assetSymbol=${assetSymbol} runVariantId=${runVariantId} overwrite=${argv.overwrite}`);

  if (!argv.overwrite) {
    const crowdCount = await prisma.crowdMetrics.count({ where: { runVariantId } });
    if (crowdCount > 0) {
      const GREEN = "\x1b[32m";
      const RESET = "\x1b[0m";
      console.log(`${GREEN}✅ SKIP crowd-metrics (existing ${crowdCount}, overwrite=false)${RESET}`);
      await prisma.$disconnect();
      process.exit(0);
    }
  }

  const run = await prisma.simulationRun.findUnique({
    where: { id: runId },
    select: { id: true },
  });
  if (!run) throw new Error(`Run not found: ${runId}`);

  const decisions = await prisma.agentDecision.findMany({
    where: { runId, assetSymbol, runVariantId },
    select: {
      step: true,
      action: true,
      confidence: true,
      agent: { select: { traits: { select: { key: true, valueNum: true } } } },
    },
    orderBy: { step: "asc" },
  });

  const byStep = new Map<
    number,
    { action: string; confidence: number; traitMap: Map<string, number> }[]
  >();
  for (const d of decisions) {
    if (!byStep.has(d.step)) byStep.set(d.step, []);
    const traitMap = traitMapFromTraits(
      d.agent?.traits?.map((t) => ({ key: t.key, valueNum: t.valueNum })) ?? [],
    );
    byStep.get(d.step)!.push({
      action: String(d.action),
      confidence: d.confidence,
      traitMap,
    });
  }

  const steps = [...byStep.keys()].sort((a, b) => a - b);
  const assetSym = assetSymbol.trim() || "RUN";
  const debugCrowd = process.env.DEBUG_CROWD_METRICS === "1";

  let prevWeightedSignal: number | null = null;

  const crowdMetricsToInsert: {
    runId: string;
    runVariantId: string;
    assetSymbol: string;
    step: number;
    signal: number;
    weightedSignal: number;
    consensus: number;
    polarization: number;
    uncertainty: number;
    minorityStrength: number;
    beliefMomentum: number | null;
    diversityIndex: number | null;
    independenceIndex: number;
    herdingIndex: number;
    wisdomScore: number | null;
    noiseSensitivity: number;
  }[] = [];

  for (const step of steps) {
    const rows = byStep.get(step)!;
    const metrics = computeCrowdMetricsForStep(rows, prevWeightedSignal);
    prevWeightedSignal = metrics.weightedSignal;

    const eventsAtStep = await prisma.infoEvent.findMany({
      where: {
        runId,
        assetSymbol: assetSym,
        step,
      },
      select: { sentiment: true, credibility: true, reach: true },
    });
    const eventsForStep = eventsAtStep.map((e) => ({
      sentiment: e.sentiment,
      credibility: e.credibility,
      impact: e.reach,
    }));
    const pMax = metrics.consensus;
    const decisionVolatility = 1 - pMax;
    const noiseSensitivity = computeNoiseSensitivity(eventsForStep, pMax);

    if (debugCrowd && step === 4) {
      const lowCred = eventsForStep.filter((e) => e.credibility < 0.5);
      const lowCredEventStrength = lowCred.reduce(
        (s, e) => s + Math.abs(e.sentiment) * e.impact * (1 - e.credibility),
        0,
      );
      console.log(
        `[DEBUG_CROWD_METRICS] step=4 events=${eventsForStep.length} lowCred=${lowCred.length} lowCredEventStrength=${lowCredEventStrength} decisionVolatility=${decisionVolatility} noiseSensitivity=${noiseSensitivity}`,
      );
    }

    const d = metrics.diversityIndex ?? 0;
    const i = metrics.independenceIndex ?? 0;
    const w = metrics.wisdomScore ?? 0;
    console.log(
      `[CrowdMetrics] step=${step}\n   diversity=${d.toFixed(3)} independence=${i.toFixed(3)} wisdom=${w.toFixed(3)} herding=${metrics.herdingIndex.toFixed(3)} noiseSens=${noiseSensitivity.toFixed(3)}`,
    );

    crowdMetricsToInsert.push({
      runId,
      runVariantId,
      assetSymbol: assetSym,
      step,
      signal: metrics.signal,
      weightedSignal: metrics.weightedSignal,
      consensus: metrics.consensus,
      polarization: metrics.polarization,
      uncertainty: metrics.uncertainty,
      minorityStrength: metrics.minorityStrength,
      beliefMomentum: metrics.beliefMomentum,
      diversityIndex: metrics.diversityIndex,
      independenceIndex: metrics.independenceIndex,
      herdingIndex: metrics.herdingIndex,
      wisdomScore: metrics.wisdomScore,
      noiseSensitivity,
    });
  }

  if (argv.overwrite) {
    await prisma.crowdMetrics.deleteMany({ where: { runVariantId } });
  }
  for (const batch of chunk(crowdMetricsToInsert, 1000)) {
    await prisma.crowdMetrics.createMany({ data: batch });
  }
  log(`Persisted ${crowdMetricsToInsert.length} CrowdMetrics rows`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("compute-crowd-metrics failed:", err);
  process.exit(1);
});
