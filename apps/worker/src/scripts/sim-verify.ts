/**
 * CLI: Verify internal consistency of a simulation run.
 *
 * Example usage:
 *   pnpm --filter worker sim:verify -- --latest
 *   pnpm --filter worker sim:verify -- --name "smoke-2"
 *   pnpm --filter worker sim:verify -- --runId <uuid> --maxNullRate 0.5
 *   pnpm --filter worker sim:verify -- --latest --strict --json
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

interface SimVerifyArgv {
  runId?: string;
  latest: boolean;
  name?: string;
  strict: boolean;
  maxNullRate: number;
  json: boolean;
  quiet: boolean;
}

const runSelect = {
  id: true,
  name: true,
  status: true,
  datasetVersion: true,
  createdAt: true,
} as const;

function parseArgv(): SimVerifyArgv {
  const args = process.argv.slice(2);
  let runId: string | undefined;
  let latest = false;
  let name: string | undefined;
  let strict = false;
  let maxNullRate = 1.0;
  let json = false;
  let quiet = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--runId" && args[i + 1]) {
      runId = args[++i].trim();
    } else if (args[i] === "--latest") {
      latest = true;
    } else if (args[i] === "--name" && args[i + 1]) {
      name = args[++i].trim();
    } else if (args[i] === "--strict") {
      strict = true;
    } else if (args[i] === "--maxNullRate" && args[i + 1]) {
      const n = parseFloat(args[++i]);
      if (Number.isFinite(n) && n >= 0 && n <= 1) maxNullRate = n;
    } else if (args[i] === "--json") {
      json = true;
    } else if (args[i] === "--quiet") {
      quiet = true;
    }
  }
  return { runId, latest, name, strict, maxNullRate, json, quiet };
}

async function findRun(prisma: PrismaClient, argv: SimVerifyArgv) {
  if (argv.runId && argv.runId !== "") {
    return prisma.simulationRun.findUnique({
      where: { id: argv.runId },
      select: runSelect,
    });
  }
  if (argv.latest) {
    return prisma.simulationRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: runSelect,
    });
  }
  if (argv.name && argv.name !== "") {
    return prisma.simulationRun.findFirst({
      where: { name: argv.name },
      orderBy: { createdAt: "desc" },
      select: runSelect,
    });
  }
  return null;
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

async function getMetrics(prisma: PrismaClient, runId: string) {
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
        FROM "AgentExperience"
        WHERE "runId" = (${runId})::uuid
      `.then((rows) => toStepRange(rows[0])),
      prisma.$queryRaw<StepRangeRow[]>`
        SELECT COUNT(DISTINCT step) AS cnt, MIN(step) AS min, MAX(step) AS max
        FROM "CrowdSnapshot"
        WHERE "runId" = (${runId})::uuid
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
  metrics: Awaited<ReturnType<typeof getMetrics>>,
  argv: SimVerifyArgv,
): CheckResult[] {
  const checks: CheckResult[] = [];
  const m = metrics;

  checks.push({
    name: "run_exists",
    ok: true,
    details: "Run selected",
  });

  const expSpan = m.expMinStep != null && m.expMaxStep != null ? m.expMaxStep - m.expMinStep + 1 : 0;
  const snapSpan = m.snapMinStep != null && m.snapMaxStep != null ? m.snapMaxStep - m.snapMinStep + 1 : 0;

  const expContinuityOk =
    m.experiencesCount === 0
      ? true
      : m.expStepDistinctCount === m.expStepsExpected &&
        m.expMinStep === 0;
  checks.push({
    name: "experiences_step_continuity",
    ok: expContinuityOk,
    details: m.experiencesCount === 0
      ? "No experiences"
      : `distinct steps=${m.expStepDistinctCount}, expected ${m.expStepsExpected}, min=${m.expMinStep} (required 0)`,
  });

  const snapContinuityOk =
    m.snapshotsCount === 0
      ? true
      : m.snapStepDistinctCount === m.snapStepsExpected &&
        m.snapMinStep === 0;
  checks.push({
    name: "snapshots_step_continuity",
    ok: snapContinuityOk,
    details: m.snapshotsCount === 0
      ? "No snapshots"
      : `distinct steps=${m.snapStepDistinctCount}, expected ${m.snapStepsExpected}, min=${m.snapMinStep} (required 0)`,
  });

  const snapCountMatch = m.snapshotsCount === m.snapStepsExpected;
  checks.push({
    name: "snapshots_count_equals_span",
    ok: snapCountMatch,
    details: `snapshotsCount=${m.snapshotsCount}, snapMaxStep-snapMinStep+1=${m.snapStepsExpected}`,
  });

  const expCountMatch = m.experiencesCount === m.distinctAgents * expSpan;
  checks.push({
    name: "experiences_count_equals_agents_times_steps",
    ok: expCountMatch,
    details: `experiencesCount=${m.experiencesCount}, distinctAgents*steps=${m.distinctAgents * expSpan}`,
  });

  const rangeMatch =
    m.experiencesCount === 0 && m.snapshotsCount === 0
      ? false
      : m.expMinStep === m.snapMinStep && m.expMaxStep === m.snapMaxStep;
  checks.push({
    name: "exp_step_range_matches_snapshot_range",
    ok: rangeMatch,
    details:
      m.experiencesCount === 0 || m.snapshotsCount === 0
        ? "Zero rows in one table; cannot match"
        : `exp [${m.expMinStep},${m.expMaxStep}] vs snap [${m.snapMinStep},${m.snapMaxStep}]`,
  });

  const nullOk = argv.strict
    ? m.pnlNulls === 0 && m.drawdownNulls === 0
    : m.pnlNullRate <= argv.maxNullRate && m.drawdownNullRate <= argv.maxNullRate;
  checks.push({
    name: "null_coverage",
    ok: nullOk,
    details: argv.strict
      ? `pnlNulls=${m.pnlNulls}, drawdownNulls=${m.drawdownNulls} (strict: both must be 0)`
      : `pnlNullRate=${m.pnlNullRate.toFixed(4)}, drawdownNullRate=${m.drawdownNullRate.toFixed(4)}, maxNullRate=${argv.maxNullRate}`,
  });

  const actionJsonOk = m.actionJsonNulls === 0;
  checks.push({
    name: "actionjson_presence",
    ok: actionJsonOk,
    details: `actionJson nulls=${m.actionJsonNulls} (must be 0)`,
  });

  return checks;
}

async function main(): Promise<number> {
  loadEnv();
  const argv = parseArgv();

  const modesSet =
    (argv.runId != null && argv.runId !== "" ? 1 : 0) +
    (argv.latest ? 1 : 0) +
    (argv.name != null && argv.name !== "" ? 1 : 0);
  if (modesSet === 0) {
    console.error("Specify exactly one of: --runId <uuid>, --latest, or --name <string>");
    return 1;
  }
  if (modesSet > 1) {
    console.error("Use only one of: --runId, --latest, or --name");
    return 1;
  }

  const prisma = new PrismaClient();
  try {
    const run = await findRun(prisma, argv);
    if (!run) {
      if (argv.runId) console.error(`Run not found: ${argv.runId}`);
      else if (argv.latest) console.error("No run found (--latest).");
      else console.error(`No run found with name: ${argv.name}`);
      return 1;
    }

    const runId = run.id;
    const metrics = await getMetrics(prisma, runId);
    const checks = runChecks(metrics, argv);
    const overallOk = checks.every((c) => c.ok);

    const runMeta = {
      id: run.id,
      name: run.name,
      status: run.status,
      datasetVersion: run.datasetVersion,
      createdAt: run.createdAt.toISOString(),
    };

    const metricsOut = {
      experiencesCount: metrics.experiencesCount,
      snapshotsCount: metrics.snapshotsCount,
      distinctAgents: metrics.distinctAgents,
      expMinStep: metrics.expMinStep,
      expMaxStep: metrics.expMaxStep,
      snapMinStep: metrics.snapMinStep,
      snapMaxStep: metrics.snapMaxStep,
      pnlNulls: metrics.pnlNulls,
      drawdownNulls: metrics.drawdownNulls,
      actionJsonNulls: metrics.actionJsonNulls,
      pnlNullRate: metrics.pnlNullRate,
      drawdownNullRate: metrics.drawdownNullRate,
    };

    const payload = {
      run: runMeta,
      metrics: metricsOut,
      checks,
      ok: overallOk,
    };

    if (argv.json) {
      console.log(JSON.stringify(payload, null, 2));
      return overallOk ? 0 : 1;
    }

    if (!argv.quiet) {
      log("--- Simulation run verify ---");
      log(`Run ID:   ${run.id}`);
      log(`Name:     ${run.name}`);
      log(`Status:   ${run.status}`);
      log(`Created:  ${run.createdAt.toISOString()}`);
      log("");
      log(`Experiences: ${metrics.experiencesCount}, Snapshots: ${metrics.snapshotsCount}, Distinct agents: ${metrics.distinctAgents}`);
      log(`Exp step range: [${metrics.expMinStep}, ${metrics.expMaxStep}], Snap step range: [${metrics.snapMinStep}, ${metrics.snapMaxStep}]`);
      log("");
      for (const c of checks) {
        log(`${c.ok ? "PASS" : "FAIL"} ${c.name}: ${c.details}`);
      }
      log("");
      log(overallOk ? "Overall: PASS" : "Overall: FAIL");
      log("---");
      log("JSON:");
      console.log(JSON.stringify(payload, null, 2));
    } else {
      if (!overallOk) {
        for (const c of checks) {
          if (!c.ok) console.error(`FAIL ${c.name}: ${c.details}`);
        }
      }
    }

    return overallOk ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("sim:verify failed:", err);
    process.exit(1);
  });
