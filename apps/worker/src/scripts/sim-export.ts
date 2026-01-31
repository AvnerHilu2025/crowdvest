/**
 * CLI: Export a simulation run to JSON or CSV.
 *
 * Example usage:
 *   pnpm --filter worker sim:export -- --latest --out export/run.json
 *   pnpm --filter worker sim:export -- --runId <uuid> --out out.json --format csv
 *   pnpm --filter worker sim:export -- --name "smoke-2" --out /tmp/smoke-2.json
 *   pnpm --filter worker sim:export -- --latest --out data --format csv --limitExperiences 10000
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

const TOP_ACTIONS_DEFAULT = 20;

interface SimExportArgv {
  runId?: string;
  latest: boolean;
  name?: string;
  out: string;
  format: "json" | "csv";
  limitExperiences?: number;
}

const runSelect = {
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
} as const;

function parseArgv(): SimExportArgv {
  const args = process.argv.slice(2);
  let runId: string | undefined;
  let latest = false;
  let name: string | undefined;
  let out = "";
  let format: "json" | "csv" = "json";
  let limitExperiences: number | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--runId" && args[i + 1]) {
      runId = args[++i].trim();
    } else if (args[i] === "--latest") {
      latest = true;
    } else if (args[i] === "--name" && args[i + 1]) {
      name = args[++i].trim();
    } else if (args[i] === "--out" && args[i + 1]) {
      out = args[++i].trim();
    } else if (args[i] === "--format" && args[i + 1]) {
      const f = args[++i].toLowerCase();
      if (f === "json" || f === "csv") format = f;
    } else if (args[i] === "--limitExperiences" && args[i + 1]) {
      const n = parseInt(args[++i], 10);
      if (Number.isFinite(n) && n >= 1) limitExperiences = n;
    }
  }
  return { runId, latest, name, out, format, limitExperiences };
}

async function findRun(prisma: PrismaClient, argv: SimExportArgv) {
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

async function getSummary(prisma: PrismaClient, runId: string, topActions: number) {
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
    actionsDistribution: actionsRows.map((row) => ({
      action: row.action ?? "unknown",
      n: Number(row.n),
    })),
  };
}

function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function main(): Promise<void> {
  loadEnv();
  const argv = parseArgv();

  const modesSet =
    (argv.runId != null && argv.runId !== "" ? 1 : 0) +
    (argv.latest ? 1 : 0) +
    (argv.name != null && argv.name !== "" ? 1 : 0);
  if (modesSet === 0) {
    console.error("Specify exactly one of: --runId <uuid>, --latest, or --name <string>");
    process.exit(1);
  }
  if (modesSet > 1) {
    console.error("Use only one of: --runId, --latest, or --name");
    process.exit(1);
  }
  if (!argv.out) {
    console.error("--out <path> is required");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const run = await findRun(prisma, argv);
    if (!run) {
      if (argv.runId) {
        console.error(`Run not found: ${argv.runId}`);
      } else if (argv.latest) {
        console.error("No run found (--latest).");
      } else {
        console.error(`No run found with name: ${argv.name}`);
      }
      process.exit(1);
    }

    const runId = run.id;
    log(`Exporting run: ${runId} (${run.name})`);

    const [summary, snapshots, experiencesRows] = await Promise.all([
      getSummary(prisma, runId, TOP_ACTIONS_DEFAULT),
      prisma.crowdSnapshot.findMany({
        where: { runId },
        orderBy: { step: "asc" },
        select: { step: true, ts: true, confidence: true, aggregationJson: true },
      }),
      prisma.agentExperience.findMany({
        where: { runId },
        orderBy: [{ step: "asc" }, { agentId: "asc" }],
        take: argv.limitExperiences ?? undefined,
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

    const snapshotsForJson = snapshots.map((s) => ({
      step: s.step,
      ts: s.ts.toISOString(),
      confidence: s.confidence,
      aggregationJson: s.aggregationJson,
    }));

    const outPath = path.resolve(process.cwd(), argv.out);
    const outDir = path.dirname(outPath);
    if (outDir !== "." && !fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    if (argv.format === "json") {
      const payload = {
        run: runMeta,
        summary,
        snapshots: snapshotsForJson,
        experiences,
      };
      const jsonPath = outPath.endsWith(".json") ? outPath : `${outPath}.json`;
      fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");
      log(`Wrote: ${path.resolve(jsonPath)}`);
      return;
    }

    const base = outPath.replace(/\.(json|csv)$/i, "") || outPath;
    const snapshotsCsvPath = `${base}.snapshots.csv`;
    const experiencesCsvPath = `${base}.experiences.csv`;

    const snapshotHeader = "step,ts,confidence,aggregationJson";
    const snapshotLines = [
      snapshotHeader,
      ...snapshots.map((s) =>
        [
          s.step,
          s.ts.toISOString(),
          s.confidence ?? "",
          escapeCsvCell(JSON.stringify(s.aggregationJson ?? {})),
        ].join(","),
      ),
    ];
    fs.writeFileSync(snapshotsCsvPath, snapshotLines.join("\n"), "utf8");
    log(`Wrote: ${path.resolve(snapshotsCsvPath)}`);

    const expHeader = "agentId,step,ts,reward,pnl,drawdown,actionJson,signalsJson";
    const expLines = [
      expHeader,
      ...experiencesRows.map((e) =>
        [
          e.agentId,
          e.step,
          e.ts.toISOString(),
          e.reward ?? "",
          e.pnl ?? "",
          e.drawdown ?? "",
          escapeCsvCell(JSON.stringify(e.actionJson ?? {})),
          escapeCsvCell(JSON.stringify(e.signalsJson ?? {})),
        ].join(","),
      ),
    ];
    fs.writeFileSync(experiencesCsvPath, expLines.join("\n"), "utf8");
    log(`Wrote: ${path.resolve(experiencesCsvPath)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("sim:export failed:", err);
  process.exit(1);
});
