/**
 * CLI: pnpm -C apps/worker run compute-rewards -- --runId <uuid> [--assetSymbol RUN] [--steps N] [--seed 123] [--overwrite true|false]
 * Reward Loop v1: ensures AssetStepReturn per step, computes per-agent pnl/regret/drawdown/rewardScore, persists AgentReward.
 * When overwrite=false, applies learning updates to agent traits (confidence, riskTolerance, herding) with decay.
 * Deterministic when overwrite=true (no learning).
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

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

function parseBool(v: unknown, defaultVal: boolean): boolean {
  if (v === undefined || v === null) return defaultVal;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return defaultVal;
}

function parseArgv(): {
  runId: string;
  assetSymbol: string;
  runVariantId: string | undefined;
  steps: number;
  seed: number | undefined;
  overwrite: boolean;
} {
  const args = process.argv.slice(2);
  let runId = "";
  let assetSymbol = "RUN";
  let runVariantId: string | undefined;
  let steps = 20;
  let seed: number | undefined;
  let overwrite = true; // Default: overwrite=true (no learning)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--runVariantId" && args[i + 1]) {
      runVariantId = args[++i]!.trim();
    } else if (arg === "--runId" && args[i + 1]) {
      runId = args[++i]!.trim();
    } else if (arg === "--assetSymbol" && args[i + 1]) {
      assetSymbol = args[++i]!.trim() || "RUN";
    } else if (arg === "--steps" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n) && n >= 1) steps = n;
    } else if (arg === "--seed" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n)) seed = n;
    } else if (arg.startsWith("--overwrite=")) {
      const value = arg.slice("--overwrite=".length);
      overwrite = parseBool(value, true);
    } else if (arg === "--overwrite") {
      if (args[i + 1] != null) {
        overwrite = parseBool(args[++i], true);
      } else {
        overwrite = true;
      }
    }
  }
  if (process.env.DEBUG_ARGS === "1" || process.env.DEBUG_ARGS === "true") {
    console.log(`[DEBUG_ARGS] raw argv: ${JSON.stringify(process.argv)}`);
    console.log(`[DEBUG_ARGS] parsed overwrite: ${overwrite}`);
  }
  if (runVariantId) {
    if (!runId) runId = "";
  } else {
    if (!runId) throw new Error("--runId is required (or use --runVariantId)");
  }
  return { runId, assetSymbol, runVariantId, steps, seed, overwrite };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function clamp01(x: number): number {
  return clamp(x, 0, 1);
}

function clamp11(x: number): number {
  return clamp(x, -1, 1);
}

/** Mulberry32 seeded RNG. */
function createSeededRng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic step return in [-0.05, 0.05] from run seed + step. */
function deterministicStepReturn(seed: number, step: number): number {
  const rng = createSeededRng(seed + step * 7919);
  const u = rng();
  return clamp(2 * u - 1, -0.05, 0.05);
}

type Action = "BUY" | "SELL" | "HOLD";

function pnlForAction(action: Action, stepReturn: number): number {
  if (action === "BUY") return stepReturn;
  if (action === "SELL") return -stepReturn;
  return 0;
}

function bestActionPnl(stepReturn: number): number {
  return Math.max(stepReturn, -stepReturn, 0);
}

/** rewardScore = pnl - 0.5*regret - 0.2*drawdown; store raw (can be negative). */
function rewardScoreRaw(pnl: number, regret: number, drawdown: number): number {
  return pnl - 0.5 * regret - 0.2 * drawdown;
}

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function main(): Promise<void> {
  loadEnv();
  const argv = parseArgv();
  const prisma = new PrismaClient();

  const { runId, assetSymbol, runVariantId } = await (async () => {
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
  })();

  log(
    `compute-rewards runId=${runId} assetSymbol=${assetSymbol} runVariantId=${runVariantId} steps=${argv.steps} seed=${argv.seed ?? "run"} overwrite=${argv.overwrite}`,
  );

  const run = await prisma.simulationRun.findUnique({
    where: { id: runId },
    select: { id: true, seed: true },
  });
  if (!run) throw new Error(`Run not found: ${runId}`);

  const globalSeed = argv.seed ?? run.seed ?? 0;

  // 1) Ensure AssetStepReturn for each step (deterministic)
  const existingReturns = await prisma.assetStepReturn.findMany({
    where: {
      runId,
      assetSymbol,
      step: { gte: 0, lt: argv.steps },
    },
    select: { step: true, stepReturn: true },
  });
  const returnByStep = new Map<number, number>();
  for (const r of existingReturns) {
    returnByStep.set(r.step, r.stepReturn);
  }
  for (let step = 0; step < argv.steps; step++) {
    if (!returnByStep.has(step)) {
      const stepReturn = deterministicStepReturn(globalSeed, step);
      await prisma.assetStepReturn.upsert({
        where: {
          runId_assetSymbol_step: { runId, assetSymbol, step },
        },
        create: { runId, assetSymbol, step, stepReturn },
        update: { stepReturn },
      });
      returnByStep.set(step, stepReturn);
    }
  }
  log(`AssetStepReturn ensured for steps 0..${argv.steps - 1}`);

  // 2) Load decisions for run+asset+steps (this variant)
  const decisions = await prisma.agentDecision.findMany({
    where: {
      runId,
      assetSymbol,
      runVariantId,
      step: { gte: 0, lt: argv.steps },
    },
    select: { agentId: true, step: true, action: true },
    orderBy: [{ step: "asc" }, { agentId: "asc" }],
  });

  const decisionsByStep = new Map<number, { agentId: string; action: Action }[]>();
  for (const d of decisions) {
    const list = decisionsByStep.get(d.step) ?? [];
    list.push({ agentId: d.agentId, action: d.action as Action });
    decisionsByStep.set(d.step, list);
  }

  // 3) Compute per-agent cumulative pnl and peak for drawdown
  const cumulativeByAgent = new Map<string, number>();
  const peakByAgent = new Map<string, number>();

  const rewardRows: {
    runId: string;
    runVariantId: string;
    agentId: string;
    assetSymbol: string;
    step: number;
    action: Action;
    stepReturn: number;
    pnl: number;
    regret: number;
    drawdown: number;
    rewardScore: number;
  }[] = [];

  for (let step = 0; step < argv.steps; step++) {
    const stepReturn = returnByStep.get(step) ?? deterministicStepReturn(globalSeed, step);
    const bestPnl = bestActionPnl(stepReturn);
    const stepDecs = decisionsByStep.get(step) ?? [];

    for (const { agentId, action } of stepDecs) {
      const pnl = pnlForAction(action, stepReturn);
      const regret = bestPnl - pnl;
      const cumulative = (cumulativeByAgent.get(agentId) ?? 0) + pnl;
      cumulativeByAgent.set(agentId, cumulative);
      const peak = Math.max(peakByAgent.get(agentId) ?? 0, cumulative);
      peakByAgent.set(agentId, peak);
      const drawdown = Math.max(0, peak - cumulative);
      const rewardScore = rewardScoreRaw(pnl, regret, drawdown);

      rewardRows.push({
        runId,
        runVariantId,
        agentId,
        assetSymbol,
        step,
        action,
        stepReturn,
        pnl,
        regret,
        drawdown,
        rewardScore,
      });
    }
  }

  // 4) Persist AgentReward (upsert)
  for (const r of rewardRows) {
    await prisma.agentReward.upsert({
      where: {
        runId_agentId_assetSymbol_step_runVariantId: {
          runId: r.runId,
          agentId: r.agentId,
          assetSymbol: r.assetSymbol,
          step: r.step,
          runVariantId: r.runVariantId,
        },
      },
      create: {
        runId: r.runId,
        runVariantId: r.runVariantId,
        agentId: r.agentId,
        assetSymbol: r.assetSymbol,
        step: r.step,
        action: r.action,
        stepReturn: r.stepReturn,
        pnl: r.pnl,
        regret: r.regret,
        drawdown: r.drawdown,
        rewardScore: r.rewardScore,
      },
      update: {
        action: r.action,
        stepReturn: r.stepReturn,
        pnl: r.pnl,
        regret: r.regret,
        drawdown: r.drawdown,
        rewardScore: r.rewardScore,
      },
    });
  }
  log(`Persisted ${rewardRows.length} AgentReward rows`);

  const BASELINE = 0.5;
  const DECAY = 0.02;
  const CONFIDENCE_RATE = 0.1;
  const RISK_TOLERANCE_RATE = -0.05;
  const HERDING_RATE = 0.05;
  const agentIds = [...new Set(rewardRows.map((r) => r.agentId))];
  const baselineByAgent = new Map<string, { confidence: number; riskTolerance: number; herding: number }>();
  const traits = await prisma.runAgentTrait.findMany({
    where: {
      agentId: { in: agentIds },
      key: { in: ["confidence", "riskTolerance", "herding"] },
    },
    select: { agentId: true, key: true, valueNum: true },
  });
  for (const t of traits) {
    let b = baselineByAgent.get(t.agentId);
    if (!b) {
      b = { confidence: BASELINE, riskTolerance: BASELINE, herding: BASELINE };
      baselineByAgent.set(t.agentId, b);
    }
    const v = typeof t.valueNum === "number" && Number.isFinite(t.valueNum) ? clamp01(t.valueNum) : BASELINE;
    if (t.key === "confidence") b.confidence = v;
    else if (t.key === "riskTolerance") b.riskTolerance = v;
    else if (t.key === "herding") b.herding = v;
  }
  for (const aid of agentIds) {
    if (!baselineByAgent.has(aid)) {
      baselineByAgent.set(aid, { confidence: BASELINE, riskTolerance: BASELINE, herding: BASELINE });
    }
  }

  if (argv.overwrite) {
    // Ensure baseline AgentState rows exist (do not overwrite confidence/riskTolerance/herding if row exists from decide)
    let created = 0;
    for (const r of rewardRows) {
      const base = baselineByAgent.get(r.agentId)!;
      const existing = await prisma.agentState.findUnique({
        where: {
          runId_assetSymbol_agentId_step_runVariantId: {
            runId: r.runId,
            assetSymbol: r.assetSymbol,
            agentId: r.agentId,
            step: r.step,
            runVariantId: r.runVariantId,
          },
        },
      });
      if (!existing) {
        await prisma.agentState.create({
          data: {
            runId: r.runId,
            runVariantId: r.runVariantId,
            assetSymbol: r.assetSymbol,
            agentId: r.agentId,
            step: r.step,
            confidence: base.confidence,
            riskTolerance: base.riskTolerance,
            herding: base.herding,
            infoSignal: 0,
            exposedCount: 0,
          },
        });
        created++;
      }
    }
    log(`AgentState baseline: ${created} rows created (overwrite=true)`);
  } else if (rewardRows.length > 0) {
    // Per-step learning: prev from AgentState(step-1), apply formula, persist to AgentState
    const rewardsByStep = new Map<number, typeof rewardRows>();
    for (const r of rewardRows) {
      const list = rewardsByStep.get(r.step) ?? [];
      list.push(r);
      rewardsByStep.set(r.step, list);
    }
    const debugLearning = process.env.DEBUG_LEARNING === "1" || process.env.DEBUG_LEARNING === "true";
    const firstAgentId = rewardRows[0]!.agentId;
    let updates = 0;
    for (let step = 0; step < argv.steps; step++) {
      const stepRewards = rewardsByStep.get(step) ?? [];
      for (const r of stepRewards) {
        const base = baselineByAgent.get(r.agentId)!;
        let prevConfidence = base.confidence;
        let prevRiskTolerance = base.riskTolerance;
        let prevHerding = base.herding;
        if (step > 0) {
          const prevRow = await prisma.agentState.findUnique({
            where: {
              runId_assetSymbol_agentId_step_runVariantId: {
                runId,
                assetSymbol,
                agentId: r.agentId,
                step: step - 1,
                runVariantId,
              },
            },
            select: { confidence: true, riskTolerance: true, herding: true },
          });
          if (prevRow) {
            prevConfidence = prevRow.confidence;
            prevRiskTolerance = prevRow.riskTolerance;
            prevHerding = prevRow.herding;
          } else {
            // Step-1 row missing - this shouldn't happen if decide ran first, but fall back to baseline
            if (debugLearning && r.agentId === firstAgentId) {
              log(`[DEBUG_LEARNING] WARNING: agent=${r.agentId} step=${step} prevRow(step-1=${step - 1}) not found, using baseline`);
            }
          }
        }
        const confidence = clamp01((prevConfidence + CONFIDENCE_RATE * r.rewardScore) * (1 - DECAY) + DECAY * base.confidence);
        const riskTolerance = clamp01((prevRiskTolerance + RISK_TOLERANCE_RATE * r.drawdown) * (1 - DECAY) + DECAY * base.riskTolerance);
        const herding = clamp01((prevHerding + HERDING_RATE * r.regret) * (1 - DECAY) + DECAY * base.herding);

        if (debugLearning && r.agentId === firstAgentId) {
          log(
            `[DEBUG_LEARNING] agent=${r.agentId} step=${step} rewardScore=${r.rewardScore.toFixed(4)} regret=${r.regret.toFixed(4)} drawdown=${r.drawdown.toFixed(4)} prev(conf=${prevConfidence.toFixed(3)} risk=${prevRiskTolerance.toFixed(3)} herding=${prevHerding.toFixed(3)}) -> new(conf=${confidence.toFixed(3)} risk=${riskTolerance.toFixed(3)} herding=${herding.toFixed(3)})`,
          );
        }

        const existingState = await prisma.agentState.findUnique({
          where: {
            runId_assetSymbol_agentId_step_runVariantId: {
              runId,
              assetSymbol,
              agentId: r.agentId,
              step,
              runVariantId,
            },
          },
          select: { exposedCount: true, infoSignal: true },
        });
        const exposedCount = existingState?.exposedCount ?? 0;
        const infoSignal = existingState?.infoSignal ?? 0;

        await prisma.agentState.upsert({
          where: {
            runId_assetSymbol_agentId_step_runVariantId: {
              runId,
              assetSymbol,
              agentId: r.agentId,
              step,
              runVariantId,
            },
          },
          create: {
            runId,
            runVariantId,
            assetSymbol,
            agentId: r.agentId,
            step,
            confidence,
            riskTolerance,
            herding,
            infoSignal,
            exposedCount,
          },
          update: { confidence, riskTolerance, herding },
        });
        updates++;
      }
    }
    log(`Learning updates (overwrite=${argv.overwrite}): ${updates} AgentState rows updated across ${agentIds.length} agents`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("compute-rewards failed:", err);
  process.exit(1);
});
