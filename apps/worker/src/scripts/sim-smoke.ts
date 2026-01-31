/**
 * CLI: Run a small simulation and validate it automatically (all in-process).
 *
 * Example usage:
 *   pnpm --filter worker sim:smoke
 *   pnpm --filter worker sim:smoke -- --agents 100 --steps 20
 *   pnpm --filter worker sim:smoke -- --strictVerify
 *   pnpm --filter worker sim:smoke -- --out /tmp/my-smoke.json
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";
import {
  runStep,
  createSeededRng,
  sampleMarketReturn,
  buildTraitValues,
  type AgentInSim,
} from "@crowdvest/sim-core";

const DATABASE_URL_MISSING =
  "DATABASE_URL is not set. Create a .env at the repository root with DATABASE_URL=postgresql://...";

const STARTING_CASH = 10_000;
const MODEL_VERSION = "stage1";
const SCHEMA_VERSION = "v1";
const MARKET_MEAN = 0.0005;
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

function log(msg: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function defaultSmokeName(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `smoke-${y}${m}${d}-${h}${min}${s}`;
}

interface SimSmokeArgv {
  name: string;
  agents: number;
  steps: number;
  out: string;
  strictVerify: boolean;
  maxNullRate: number;
}

function parseArgv(): SimSmokeArgv {
  const args = process.argv.slice(2);
  let name = defaultSmokeName();
  let agents = 50;
  let steps = 10;
  let out = "";
  let strictVerify = false;
  let maxNullRate = 1.0;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--name" && args[i + 1]) {
      name = args[++i].trim();
    } else if (args[i] === "--agents" && args[i + 1]) {
      const n = parseInt(args[++i], 10);
      if (Number.isFinite(n) && n >= 1) agents = Math.min(n, 10_000);
    } else if (args[i] === "--steps" && args[i + 1]) {
      const n = parseInt(args[++i], 10);
      if (Number.isFinite(n) && n >= 1) steps = Math.min(n, 1000);
    } else if (args[i] === "--out" && args[i + 1]) {
      out = args[++i].trim();
    } else if (args[i] === "--strictVerify") {
      strictVerify = true;
    } else if (args[i] === "--maxNullRate" && args[i + 1]) {
      const n = parseFloat(args[++i]);
      if (Number.isFinite(n) && n >= 0 && n <= 1) maxNullRate = n;
    }
  }
  const outPath = out !== "" ? path.resolve(process.cwd(), out) : path.join("/tmp", `${name}.json`);
  return { name, agents, steps, out: outPath, strictVerify, maxNullRate };
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
    };
  });

  const uniform = createSeededRng(runSeed);
  for (let stepIndex = 0; stepIndex < steps; stepIndex++) {
    const marketReturn = sampleMarketReturn(MARKET_MEAN, MARKET_STDEV, uniform);
    const ts = new Date();
    const result = runStep(agentsForSim, marketReturn, stepIndex, ts);
    const { experiences, snapshot } = result;

    await prisma.agentExperience.createMany({
      data: experiences.map((e) => ({
        runId,
        agentId: e.agentId,
        step: snapshot.stepIndex,
        ts,
        actionJson: { action: e.action },
        reward: e.reward,
        pnl: e.pnl,
        drawdown: e.drawdown,
        stateAfterJson: { wallet: e.walletAfter },
        learningMetaJson: e.meta as object,
      })),
    });
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

  await prisma.simulationRun.update({
    where: { id: runId },
    data: { status: "COMPLETED", finishedAt: new Date() },
  });
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
        by: ["agentId"],
        where: { runId },
        _count: { agentId: true },
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
        by: ["agentId"],
        where: { runId },
        _count: { agentId: true },
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
      orderBy: [{ step: "asc" }, { agentId: "asc" }],
      select: {
        agentId: true,
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
    agentId: e.agentId,
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

async function main(): Promise<number> {
  loadEnv();
  const argv = parseArgv();

  log(`sim:smoke name=${argv.name} agents=${argv.agents} steps=${argv.steps}`);

  const prisma = new PrismaClient();
  try {
    let runId: string;
    try {
      runId = await runSimulation(prisma, argv.name, argv.agents, argv.steps);
      log(`Run created: ${runId}`);
    } catch (err) {
      console.error("sim:smoke run failed:", err instanceof Error ? err.message : err);
      return 1;
    }

    const metrics = await getMetrics(prisma, runId);
    const checks = runChecks(metrics, argv.strictVerify, argv.maxNullRate);
    const overallOk = checks.every((c) => c.ok);

    if (!overallOk) {
      console.error("sim:smoke verify failed:");
      for (const c of checks) {
        if (!c.ok) console.error(`  FAIL ${c.name}: ${c.details}`);
      }
      return 1;
    }

    const payload = await buildExportPayload(prisma, runId);
    const outDir = path.dirname(argv.out);
    if (outDir !== "." && !fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const jsonPath = argv.out.endsWith(".json") ? argv.out : `${argv.out}.json`;
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");

    log("--- sim:smoke PASS ---");
    console.log("runId:", runId);
    console.log("summary: experiences=" + payload.summary.experiencesCount + ", snapshots=" + payload.summary.snapshotsCount + ", distinctAgents=" + payload.summary.distinctAgents);
    console.log("export:", path.resolve(jsonPath));
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("sim:smoke failed:", err);
    process.exit(1);
  });
