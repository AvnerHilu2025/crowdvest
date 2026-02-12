/**
 * CLI: CI command – run smoke, verify, export, optionally cleanup (all in-process).
 *
 * Example usage:
 *   pnpm --filter worker sim:ci
 *   pnpm --filter worker sim:ci -- --strict          # enforce strict verify (pnl/drawdown non-null)
 *   pnpm --filter worker sim:ci -- --agents 100 --steps 20
 *   pnpm --filter worker sim:ci -- --keepLast 5 --quiet
 *
 * Flags:
 *   --strict    Run verification in strict mode (same as sim:verify --strict). Fail with exit 1 if
 *               any check fails (e.g. pnl/drawdown nulls must be 0). Without --strict, verify uses
 *               --maxNullRate for null coverage only.
 */
import path from "path";
import fs from "fs";
import { PrismaClient, setRunStatus } from "@crowdvest/db";
import {
  runStep,
  createSeededRng,
  sampleMarketReturn,
  buildTraitValues,
  getSellConfig,
  type AgentInSim,
} from "@crowdvest/sim-core";

const DATABASE_URL_MISSING =
  "DATABASE_URL is not set. Create a .env at the repository root with DATABASE_URL=postgresql://...";

const STARTING_CASH = 10_000;
const MODEL_VERSION = "stage1";
const SCHEMA_VERSION = "v1";
const MARKET_MEAN = 0.002;
const MARKET_STDEV = 0.01;
const TOP_ACTIONS_DEFAULT = 20;

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
    // ignore read errors
  }
}

function loadEnv(): void {
  const cwd = process.cwd();
  const paths = [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, "..", ".env"),
    path.resolve(cwd, "..", "..", ".env"),
    path.resolve(__dirname, "..", "..", "..", ".env"),
  ];
  for (const p of paths) loadEnvFile(p);
  const url = process.env.DATABASE_URL;
  if (!url || String(url).trim() === "") {
    throw new Error(`${DATABASE_URL_MISSING} (process.cwd(): ${process.cwd()})`);
  }
}

function log(msg: string, quiet: boolean): void {
  if (quiet) return;
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function defaultCiName(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `ci-${y}${m}${d}-${h}${min}${s}`;
}

interface SimCiArgv {
  name: string;
  agents: number;
  steps: number;
  outDir: string;
  maxNullRate: number;
  strict: boolean;
  keepLast: number | undefined;
  quiet: boolean;
}

function parseArgv(): SimCiArgv {
  const args = process.argv.slice(2);
  let name = defaultCiName();
  let agents = 50;
  let steps = 10;
  let outDir = "/tmp";
  let maxNullRate = 1.0;
  let strict = false;
  let keepLast: number | undefined;
  let quiet = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--name" && args[i + 1]) {
      name = args[++i].trim();
    } else if (args[i] === "--agents" && args[i + 1]) {
      const n = parseInt(args[++i], 10);
      if (Number.isFinite(n) && n >= 1) agents = Math.min(n, 10_000);
    } else if (args[i] === "--steps" && args[i + 1]) {
      const n = parseInt(args[++i], 10);
      if (Number.isFinite(n) && n >= 1) steps = Math.min(n, 1000);
    } else if (args[i] === "--outDir" && args[i + 1]) {
      outDir = args[++i].trim();
    } else if (args[i] === "--maxNullRate" && args[i + 1]) {
      const n = parseFloat(args[++i]);
      if (Number.isFinite(n) && n >= 0 && n <= 1) maxNullRate = n;
    } else if (args[i] === "--strict") {
      strict = true;
    } else if (args[i] === "--keepLast" && args[i + 1]) {
      const n = parseInt(args[++i], 10);
      if (Number.isFinite(n) && n >= 0) keepLast = n;
    } else if (args[i] === "--quiet") {
      quiet = true;
    }
  }
  const resolvedOutDir = path.isAbsolute(outDir) ? outDir : path.resolve(process.cwd(), outDir);
  return { name, agents, steps, outDir: resolvedOutDir, maxNullRate, strict, keepLast, quiet };
}

async function resolveDatasetVersion(prisma: PrismaClient): Promise<string> {
  const latestRun = await prisma.simulationRun.findFirst({
    orderBy: { createdAt: "desc" },
    select: { datasetVersion: true },
  });
  if (latestRun) return latestRun.datasetVersion;
  const latestImport = await prisma.importRun.findFirst({
    where: { type: "archetypes" },
    orderBy: { startedAt: "desc" },
    select: { sourceHash: true },
  });
  if (latestImport) return latestImport.sourceHash;
  throw new Error("No SimulationRun or archetype ImportRun in DB. Run seed first.");
}

async function runSimulation(
  prisma: PrismaClient,
  name: string,
  agents: number,
  steps: number,
  quiet: boolean,
): Promise<string> {
  const datasetVersion = await resolveDatasetVersion(prisma);
  const archetypes = await prisma.archetype.findMany({
    include: {
      traitProfiles: {
        include: { traitDefinition: { select: { key: true } } },
      },
    },
  });
  if (archetypes.length === 0) throw new Error("No archetypes in DB. Run seed first.");

  const profileByArchetype = new Map<string, Record<string, number>>();
  for (const a of archetypes) {
    const traits: Record<string, number> = {};
    for (const p of a.traitProfiles) {
      const key = p.traitDefinition?.key;
      if (key && typeof p.baselineValue === "number") traits[key] = p.baselineValue;
    }
    profileByArchetype.set(a.id, traits);
  }

  const runSeed = Math.abs(name.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0));
  const run = await prisma.simulationRun.create({
    data: {
      name,
      status: "PENDING",
      seed: runSeed,
      modelVersion: MODEL_VERSION,
      datasetVersion,
      schemaVersion: SCHEMA_VERSION,
      startedAt: new Date(),
    },
  });
  const runId = run.id;

  const pad = String(agents).length;
  const agentPayloads = [];
  for (let i = 0; i < agents; i++) {
    const archetype = archetypes[i % archetypes.length];
    agentPayloads.push({
      displayName: `Agent ${String(i + 1).padStart(pad, "0")}`,
      archetypeId: archetype.id,
      stateJson: { wallet: STARTING_CASH },
    });
  }
  const createdAgents = await prisma.agent.createManyAndReturn({
    data: agentPayloads,
    select: { id: true, archetypeId: true, stateJson: true, displayName: true },
  });
  type AgentRow = { id: string; archetypeId: string; stateJson: unknown; displayName: string | null };
  createdAgents.sort((a: AgentRow, b: AgentRow) =>
    (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, { numeric: true }),
  );
  const agentsForSim: AgentInSim[] = (createdAgents as AgentRow[]).map((a) => {
    const state = (a.stateJson as { wallet?: number } | null) ?? {};
    const wallet = typeof state.wallet === "number" ? state.wallet : STARTING_CASH;
    const traits = profileByArchetype.get(a.archetypeId) ?? {};
    return {
      agentId: a.id,
      archetypeId: a.archetypeId,
      wallet,
      peakWallet: wallet,
      traitValues: buildTraitValues(traits),
      positionOpen: false,
      entryWallet: 0,
      entryStep: 0,
      holdingSteps: 0,
      hasBought: false,
      hasSoldAfterBuy: false,
    };
  });

  const uniform = createSeededRng(runSeed);
  const sellConfig = getSellConfig({ seed: runSeed, steps, startingCash: STARTING_CASH });
  const decisionHistogram = { BUY: 0, SELL: 0, HOLD: 0, OTHER: 0 };
  const sampleDecisions: { agentId: string; step: number; action: string }[] = [];
  const prePersistHistogram = { BUY: 0, SELL: 0, HOLD: 0, OTHER: 0 };
  const samplePrePersistActions: { agentId: string; step: number; action: string }[] = [];

  for (let stepIndex = 0; stepIndex < steps; stepIndex++) {
    const marketReturn = sampleMarketReturn(MARKET_MEAN, MARKET_STDEV, uniform);
    const ts = new Date();
    const result = runStep(agentsForSim, marketReturn, stepIndex, ts, sellConfig);
    const { experiences, snapshot } = result;

    for (const e of experiences) {
      const action = String(e.action).toLowerCase();
      const key = action === "buy" ? "BUY" : action === "sell" ? "SELL" : action === "hold" ? "HOLD" : "OTHER";
      decisionHistogram[key]++;
      if (sampleDecisions.length < 10) {
        sampleDecisions.push({ agentId: e.agentId, step: snapshot.stepIndex, action: key });
      }
    }

    const data = experiences.map((e) => ({
      runId,
      runAgentId: e.agentId,
      step: snapshot.stepIndex,
      ts,
      actionJson: { action: e.action },
      reward: e.reward,
      pnl: e.pnl,
      drawdown: e.drawdown,
      stateAfterJson: { wallet: e.walletAfter },
      learningMetaJson: e.meta as object,
    }));

    for (const d of data) {
      const action = ((d.actionJson as { action?: string })?.action ?? "hold").toLowerCase();
      const key = action === "buy" ? "BUY" : action === "sell" ? "SELL" : action === "hold" ? "HOLD" : "OTHER";
      prePersistHistogram[key]++;
      if (samplePrePersistActions.length < 10) {
        samplePrePersistActions.push({ agentId: d.runAgentId, step: d.step, action: key });
      }
    }

    await prisma.agentExperience.createMany({ data });
    await prisma.crowdSnapshot.create({
      data: {
        runId,
        step: snapshot.stepIndex,
        ts,
        aggregationJson: {
          avgReward: snapshot.avgReward,
          actionCounts: snapshot.actionCounts,
          avgWallet: snapshot.avgWallet,
          marketReturn: snapshot.marketReturn,
        },
      },
    });
    // runStep mutates agentsForSim (wallet, peakWallet) in-place
  }

  const prePersistJson = JSON.stringify(prePersistHistogram);
  const sampleJson = JSON.stringify(samplePrePersistActions);
  await setRunStatus(prisma, runId, "COMPLETED");
  await prisma.$transaction([
    prisma.simulationRun.update({
      where: { id: runId },
      data: {
        configJson: { decisionHistogram, sampleDecisions } as object,
      },
    }),
    prisma.$executeRaw`
      INSERT INTO "RunDebug" ("runId", "prePersistHistogram", "samplePrePersistActions")
      VALUES (${runId}::uuid, ${prePersistJson}::jsonb, ${sampleJson}::jsonb)
      ON CONFLICT ("runId") DO UPDATE SET
        "prePersistHistogram" = EXCLUDED."prePersistHistogram",
        "samplePrePersistActions" = EXCLUDED."samplePrePersistActions"
    `,
  ]);
  return runId;
}

interface StepRangeRow {
  cnt: number | bigint;
  min: number | bigint | null;
  max: number | bigint | null;
}

function toStepRange(row: StepRangeRow | undefined): { cnt: number; min: number | null; max: number | null } {
  if (!row) return { cnt: 0, min: null, max: null };
  return {
    cnt: Number(row.cnt),
    min: row.min != null ? Number(row.min) : null,
    max: row.max != null ? Number(row.max) : null,
  };
}

interface Metrics {
  experiencesCount: number;
  snapshotsCount: number;
  distinctAgents: number;
  expMinStep: number | null;
  expMaxStep: number | null;
  snapMinStep: number | null;
  snapMaxStep: number | null;
  expStepDistinctCount: number;
  snapStepDistinctCount: number;
  expStepsExpected: number;
  snapStepsExpected: number;
  pnlNulls: number;
  drawdownNulls: number;
  actionJsonNulls: number;
  pnlNullRate: number;
  drawdownNullRate: number;
}

async function getMetrics(prisma: PrismaClient, runId: string): Promise<Metrics> {
  const [experiencesCount, snapshotsCount, distinctAgents, expRange, snapRange, pnlNulls, drawdownNulls, actionJsonNulls, expStepStats, snapStepStats] =
    await Promise.all([
      prisma.agentExperience.count({ where: { runId } }),
      prisma.crowdSnapshot.count({ where: { runId } }),
      prisma.agentExperience.groupBy({
        by: ["runAgentId"],
        where: { runId },
        _count: { runAgentId: true },
      }).then((groups) => groups.length),
      prisma.agentExperience.aggregate({
        where: { runId },
        _min: { step: true },
        _max: { step: true },
      }),
      prisma.crowdSnapshot.aggregate({
        where: { runId },
        _min: { step: true },
        _max: { step: true },
      }),
      prisma.agentExperience.count({ where: { runId, pnl: null } }),
      prisma.agentExperience.count({ where: { runId, drawdown: null } }),
      prisma.$queryRaw<{ n: number | bigint }[]>`
        SELECT COUNT(*)::int AS n FROM "AgentExperience"
        WHERE "runId" = (${runId})::uuid AND "actionJson" IS NULL
      `.then((rows) => Number(rows[0]?.n ?? 0)),
      prisma.$queryRaw<StepRangeRow[]>`
        SELECT COUNT(DISTINCT step) AS cnt, MIN(step) AS min, MAX(step) AS max
        FROM "AgentExperience" WHERE "runId" = (${runId})::uuid
      `.then((rows) => toStepRange(rows[0])),
      prisma.$queryRaw<StepRangeRow[]>`
        SELECT COUNT(DISTINCT step) AS cnt, MIN(step) AS min, MAX(step) AS max
        FROM "CrowdSnapshot" WHERE "runId" = (${runId})::uuid
      `.then((rows) => toStepRange(rows[0])),
    ]);

  const expMinStep = expRange._min.step;
  const expMaxStep = expRange._max.step;
  const snapMinStep = snapRange._min.step;
  const snapMaxStep = snapRange._max.step;
  const expStepsExpected = expMinStep != null && expMaxStep != null ? expMaxStep - expMinStep + 1 : 0;
  const snapStepsExpected = snapMinStep != null && snapMaxStep != null ? snapMaxStep - snapMinStep + 1 : 0;
  const pnlNullRate = experiencesCount > 0 ? pnlNulls / experiencesCount : 0;
  const drawdownNullRate = experiencesCount > 0 ? drawdownNulls / experiencesCount : 0;

  return {
    experiencesCount,
    snapshotsCount,
    distinctAgents,
    expMinStep,
    expMaxStep,
    snapMinStep,
    snapMaxStep,
    expStepDistinctCount: expStepStats.cnt,
    snapStepDistinctCount: snapStepStats.cnt,
    expStepsExpected,
    snapStepsExpected,
    pnlNulls,
    drawdownNulls,
    actionJsonNulls,
    pnlNullRate,
    drawdownNullRate,
  };
}

interface CheckResult {
  name: string;
  ok: boolean;
  details: string;
}

function runChecks(
  metrics: Metrics,
  strict: boolean,
  maxNullRate: number,
): CheckResult[] {
  const m = metrics;
  const checks: CheckResult[] = [];

  const expContinuityOk =
    m.experiencesCount === 0 ||
    (m.expStepDistinctCount === m.expStepsExpected && m.expMinStep === 0);
  checks.push({
    name: "experiences_step_continuity",
    ok: expContinuityOk,
    details: m.experiencesCount === 0 ? "No experiences" : `distinct=${m.expStepDistinctCount}, expected=${m.expStepsExpected}, min=${m.expMinStep}`,
  });

  const snapContinuityOk =
    m.snapshotsCount === 0 ||
    (m.snapStepDistinctCount === m.snapStepsExpected && m.snapMinStep === 0);
  checks.push({
    name: "snapshots_step_continuity",
    ok: snapContinuityOk,
    details: m.snapshotsCount === 0 ? "No snapshots" : `distinct=${m.snapStepDistinctCount}, expected=${m.snapStepsExpected}, min=${m.snapMinStep}`,
  });

  const snapCountMatch = m.snapshotsCount === m.snapStepsExpected;
  checks.push({
    name: "snapshots_count_equals_span",
    ok: snapCountMatch,
    details: `snapshotsCount=${m.snapshotsCount}, span=${m.snapStepsExpected}`,
  });

  const expSpan = m.expMinStep != null && m.expMaxStep != null ? m.expMaxStep - m.expMinStep + 1 : 0;
  const expCountMatch = m.experiencesCount === m.distinctAgents * expSpan;
  checks.push({
    name: "experiences_count_equals_agents_times_steps",
    ok: expCountMatch,
    details: `experiencesCount=${m.experiencesCount}, agents*steps=${m.distinctAgents * expSpan}`,
  });

  const rangeMatch =
    m.experiencesCount > 0 &&
    m.snapshotsCount > 0 &&
    m.expMinStep === m.snapMinStep &&
    m.expMaxStep === m.snapMaxStep;
  checks.push({
    name: "exp_step_range_matches_snapshot_range",
    ok: rangeMatch,
    details: `exp [${m.expMinStep},${m.expMaxStep}] vs snap [${m.snapMinStep},${m.snapMaxStep}]`,
  });

  const nullOk = strict
    ? m.pnlNulls === 0 && m.drawdownNulls === 0
    : m.pnlNullRate <= maxNullRate && m.drawdownNullRate <= maxNullRate;
  checks.push({
    name: "null_coverage",
    ok: nullOk,
    details: strict
      ? `pnlNulls=${m.pnlNulls}, drawdownNulls=${m.drawdownNulls} (strict)`
      : `pnlRate=${m.pnlNullRate.toFixed(4)}, drawdownRate=${m.drawdownNullRate.toFixed(4)}, maxNullRate=${maxNullRate}`,
  });

  const actionJsonOk = m.actionJsonNulls === 0;
  checks.push({
    name: "actionjson_presence",
    ok: actionJsonOk,
    details: `actionJson nulls=${m.actionJsonNulls}`,
  });

  return checks;
}

async function getSummary(prisma: PrismaClient, runId: string) {
  const [experiencesCount, snapshotsCount, experienceRange, snapshotRange, avgReward, pnlNulls, drawdownNulls, distinctAgents, actionsRows] =
    await Promise.all([
      prisma.agentExperience.count({ where: { runId } }),
      prisma.crowdSnapshot.count({ where: { runId } }),
      prisma.agentExperience.aggregate({
        where: { runId },
        _min: { step: true },
        _max: { step: true },
      }),
      prisma.crowdSnapshot.aggregate({
        where: { runId },
        _min: { step: true },
        _max: { step: true },
      }),
      prisma.agentExperience.aggregate({
        where: { runId },
        _avg: { reward: true },
      }).then((r) => r._avg.reward),
      prisma.agentExperience.count({ where: { runId, pnl: null } }),
      prisma.agentExperience.count({ where: { runId, drawdown: null } }),
      prisma.agentExperience.groupBy({
        by: ["runAgentId"],
        where: { runId },
        _count: { runAgentId: true },
      }).then((groups) => groups.length),
      prisma.$queryRaw<{ action: string | null; n: bigint }[]>`
        SELECT COALESCE("actionJson"->>'action', 'unknown') AS action, COUNT(*)::bigint AS n
        FROM "AgentExperience" WHERE "runId" = (${runId})::uuid
        GROUP BY 1 ORDER BY n DESC LIMIT ${TOP_ACTIONS_DEFAULT}
      `,
    ]);
  return {
    experiencesCount,
    snapshotsCount,
    distinctAgents,
    experienceStepRange: { min: experienceRange._min.step, max: experienceRange._max.step },
    snapshotStepRange: { min: snapshotRange._min.step, max: snapshotRange._max.step },
    avgReward,
    pnlNulls,
    drawdownNulls,
    actionsDistribution: actionsRows.map((row) => ({ action: row.action ?? "unknown", n: Number(row.n) })),
  };
}

async function buildExportPayload(prisma: PrismaClient, runId: string) {
  const run = await prisma.simulationRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      name: true,
      status: true,
      datasetVersion: true,
      seed: true,
      modelVersion: true,
      schemaVersion: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      updatedAt: true,
      configJson: true,
    },
  });
  if (!run) throw new Error(`Run not found: ${runId}`);

  const [summary, snapshots, experiencesRows] = await Promise.all([
    getSummary(prisma, runId),
    prisma.crowdSnapshot.findMany({
      where: { runId },
      orderBy: { step: "asc" },
      select: { step: true, ts: true, confidence: true, aggregationJson: true },
    }),
    prisma.agentExperience.findMany({
      where: { runId },
      orderBy: [{ step: "asc" }, { runAgentId: "asc" }],
      select: {
        runAgentId: true,
        step: true,
        ts: true,
        reward: true,
        pnl: true,
        drawdown: true,
        actionJson: true,
        signalsJson: true,
      },
    }),
  ]);

  const runMeta = {
    id: run.id,
    name: run.name,
    status: run.status,
    datasetVersion: run.datasetVersion,
    seed: run.seed,
    modelVersion: run.modelVersion,
    schemaVersion: run.schemaVersion,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    configJson: run.configJson,
  };

  const snapshotsForJson = snapshots.map((s) => ({
    step: s.step,
    ts: s.ts.toISOString(),
    confidence: s.confidence,
    aggregationJson: s.aggregationJson,
  }));

  const experiences = experiencesRows.map((e) => ({
    runAgentId: e.runAgentId,
    step: e.step,
    ts: e.ts.toISOString(),
    reward: e.reward,
    pnl: e.pnl,
    drawdown: e.drawdown,
    actionJson: e.actionJson,
    signalsJson: e.signalsJson,
  }));

  return {
    run: runMeta,
    summary,
    snapshots: snapshotsForJson,
    experiences,
  };
}

async function cleanupKeepLast(prisma: PrismaClient, keepLast: number, quiet: boolean): Promise<void> {
  const all = await prisma.simulationRun.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const toDelete = all.slice(keepLast);
  if (toDelete.length === 0) return;
  const ids = toDelete.map((r) => r.id);
  await prisma.simulationRun.deleteMany({
    where: { id: { in: ids } },
  });
  log(`Cleanup: kept last ${keepLast}, deleted ${ids.length} runs`, quiet);
}

async function main(): Promise<number> {
  loadEnv();
  const argv = parseArgv();

  log(`sim:ci name=${argv.name} agents=${argv.agents} steps=${argv.steps}`, argv.quiet);

  const prisma = new PrismaClient();
  try {
    let runId: string;
    try {
      runId = await runSimulation(prisma, argv.name, argv.agents, argv.steps, argv.quiet);
      log(`Run created: ${runId}`, argv.quiet);
    } catch (err) {
      console.error("sim:ci run failed:", err instanceof Error ? err.message : err);
      return 1;
    }

    const metrics = await getMetrics(prisma, runId);
    const checks = runChecks(metrics, argv.strict, argv.maxNullRate);
    const overallOk = checks.every((c) => c.ok);

    if (!overallOk) {
      console.error("sim:ci verify failed:");
      for (const c of checks) {
        if (!c.ok) console.error(`  FAIL ${c.name}: ${c.details}`);
      }
      return 1;
    }

    const payload = await buildExportPayload(prisma, runId);
    if (!fs.existsSync(argv.outDir)) {
      fs.mkdirSync(argv.outDir, { recursive: true });
    }
    const exportPath = path.join(argv.outDir, `${argv.name}.json`);
    fs.writeFileSync(exportPath, JSON.stringify(payload, null, 2), "utf8");

    if (argv.keepLast != null && argv.keepLast >= 0) {
      await cleanupKeepLast(prisma, argv.keepLast, argv.quiet);
    }

    const resolvedExport = path.resolve(exportPath);
    console.log(`PASS runId=${runId} export=${resolvedExport}`);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("sim:ci failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
