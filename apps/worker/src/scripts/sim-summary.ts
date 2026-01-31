/**
 * CLI: Summarize a simulation run by runId, latest, or name.
 *
 * Example usage:
 *   pnpm --filter worker sim:summary -- --runId <uuid>
 *   pnpm --filter worker sim:summary -- --latest
 *   pnpm --filter worker sim:summary -- --name "smoke-1"
 *   pnpm --filter worker sim:summary -- --latest --out summary.json --topActions 10
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

interface SimSummaryArgv {
  runId?: string;
  latest?: boolean;
  name?: string;
  out?: string;
  topActions: number;
}

function parseArgv(): SimSummaryArgv {
  const args = process.argv.slice(2);
  let runId: string | undefined;
  let latest = false;
  let name: string | undefined;
  let out: string | undefined;
  let topActions = 20;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--runId" && args[i + 1]) {
      runId = args[++i];
    } else if (args[i] === "--latest") {
      latest = true;
    } else if (args[i] === "--name" && args[i + 1]) {
      name = args[++i];
    } else if (args[i] === "--out" && args[i + 1]) {
      out = args[++i];
    } else if (args[i] === "--topActions" && args[i + 1]) {
      const n = parseInt(args[++i], 10);
      if (Number.isFinite(n) && n >= 1) topActions = Math.min(n, 1000);
    }
  }
  return { runId, latest, name, out, topActions };
}

interface RunRow {
  id: string;
  name: string;
  status: string;
  datasetVersion: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

interface SummaryResult {
  run: {
    id: string;
    name: string;
    status: string;
    datasetVersion: string;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
  };
  experiencesCount: number;
  snapshotsCount: number;
  distinctAgents: number;
  experienceStepRange: { min: number | null; max: number | null };
  snapshotStepRange: { min: number | null; max: number | null };
  avgReward: number | null;
  pnlNulls: number;
  drawdownNulls: number;
  actionsDistribution: { action: string; n: number }[];
}

async function findRun(prisma: PrismaClient, argv: SimSummaryArgv): Promise<RunRow | null> {
  if (argv.runId && argv.runId.trim() !== "") {
    const run = await prisma.simulationRun.findUnique({
      where: { id: argv.runId.trim() },
      select: {
        id: true,
        name: true,
        status: true,
        datasetVersion: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
      },
    });
    return run as RunRow | null;
  }
  if (argv.latest) {
    const run = await prisma.simulationRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        datasetVersion: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
      },
    });
    return run as RunRow | null;
  }
  if (argv.name && argv.name.trim() !== "") {
    const run = await prisma.simulationRun.findFirst({
      where: { name: argv.name.trim() },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        datasetVersion: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
      },
    });
    return run as RunRow | null;
  }
  return null;
}

async function getSummary(prisma: PrismaClient, runId: string, topActions: number): Promise<Omit<SummaryResult, "run">> {
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
        FROM "AgentExperience"
        WHERE "runId" = (${runId})::uuid
        GROUP BY 1
        ORDER BY n DESC
        LIMIT ${topActions}
      `,
    ]);

  const actionsDistribution = actionsRows.map((row) => ({
    action: row.action ?? "unknown",
    n: Number(row.n),
  }));

  return {
    experiencesCount,
    snapshotsCount,
    distinctAgents,
    experienceStepRange: {
      min: experienceRange._min.step,
      max: experienceRange._max.step,
    },
    snapshotStepRange: {
      min: snapshotRange._min.step,
      max: snapshotRange._max.step,
    },
    avgReward,
    pnlNulls,
    drawdownNulls,
    actionsDistribution,
  };
}

function printHumanSummary(run: RunRow, summary: Omit<SummaryResult, "run">): void {
  log("--- Simulation run summary ---");
  log(`Run ID:        ${run.id}`);
  log(`Name:          ${run.name}`);
  log(`Status:        ${run.status}`);
  log(`Dataset:       ${run.datasetVersion}`);
  log(`Started:       ${run.startedAt?.toISOString() ?? "—"}`);
  log(`Finished:     ${run.finishedAt?.toISOString() ?? "—"}`);
  log(`Experiences:   ${summary.experiencesCount}`);
  log(`Snapshots:     ${summary.snapshotsCount}`);
  log(`Distinct agents: ${summary.distinctAgents}`);
  log(`Experience steps: ${summary.experienceStepRange.min ?? "—"} .. ${summary.experienceStepRange.max ?? "—"}`);
  log(`Snapshot steps:   ${summary.snapshotStepRange.min ?? "—"} .. ${summary.snapshotStepRange.max ?? "—"}`);
  log(`Avg reward:    ${summary.avgReward != null ? summary.avgReward.toFixed(6) : "—"}`);
  log(`PNL nulls:     ${summary.pnlNulls}`);
  log(`Drawdown nulls: ${summary.drawdownNulls}`);
  log("Top actions:");
  for (const { action, n } of summary.actionsDistribution) {
    log(`  ${action}: ${n}`);
  }
  log("--------------------------------------");
}

async function main(): Promise<void> {
  loadEnv();
  const argv = parseArgv();

  const prisma = new PrismaClient();
  try {
    const run = await findRun(prisma, argv);
    if (!run) {
      if (argv.runId) {
        console.error(`Run not found for runId: ${argv.runId}`);
      } else if (argv.latest) {
        console.error("No simulation run found (--latest).");
      } else if (argv.name) {
        console.error(`No simulation run found with name: ${argv.name}`);
      } else {
        console.error("Specify one of: --runId <uuid>, --latest, or --name <string>");
      }
      process.exit(1);
    }

    log(`Summarizing run: ${run.id} (${run.name})`);
    const summaryData = await getSummary(prisma, run.id, argv.topActions);

    const runForJson = {
      id: run.id,
      name: run.name,
      status: run.status,
      datasetVersion: run.datasetVersion,
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
      createdAt: run.createdAt.toISOString(),
    };

    const summary: SummaryResult = {
      run: runForJson,
      ...summaryData,
    };

    printHumanSummary(run, summaryData);

    const jsonOut = JSON.stringify(summary, null, 2);
    log("JSON summary:");
    console.log(jsonOut);

    if (argv.out && argv.out.trim() !== "") {
      const outPath = path.resolve(process.cwd(), argv.out.trim());
      fs.writeFileSync(outPath, jsonOut, "utf8");
      log(`Wrote summary to ${outPath}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("sim:summary failed:", err);
  process.exit(1);
});
