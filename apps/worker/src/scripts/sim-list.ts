/**
 * CLI: List simulation runs with optional filters.
 *
 * Example usage:
 *   pnpm --filter worker sim:list
 *   pnpm --filter worker sim:list -- --limit 20 --status COMPLETED
 *   pnpm --filter worker sim:list -- --name "smoke-1" --json
 */
import path from "path";
import fs from "fs";
import { PrismaClient, SimulationRunStatus } from "@crowdvest/db";

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

const VALID_STATUSES = Object.values(SimulationRunStatus) as SimulationRunStatus[];

function parseStatus(s: string): SimulationRunStatus {
  const upper = s.trim().toUpperCase();
  const found = VALID_STATUSES.find((v) => v === upper);
  if (found) return found;
  console.error(`Invalid --status "${s}". Allowed: ${VALID_STATUSES.join(", ")}`);
  process.exit(1);
}

interface SimListArgv {
  limit: number;
  status?: SimulationRunStatus;
  name?: string;
  json: boolean;
}

function parseArgv(): SimListArgv {
  const args = process.argv.slice(2);
  let limit = 10;
  let status: SimulationRunStatus | undefined;
  let name: string | undefined;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      const n = parseInt(args[++i], 10);
      if (Number.isFinite(n) && n >= 1) limit = Math.min(n, 500);
    } else if (args[i] === "--status" && args[i + 1]) {
      status = parseStatus(args[++i]);
    } else if (args[i] === "--name" && args[i + 1]) {
      name = args[++i];
    } else if (args[i] === "--json") {
      json = true;
    }
  }
  return { limit, status, name, json };
}

interface RunRow {
  id: string;
  name: string;
  status: string;
  datasetVersion: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

function formatDate(d: Date | null): string {
  return d ? d.toISOString() : "—";
}

function printTable(runs: RunRow[]): void {
  const idLen = 36;
  const nameLen = Math.min(24, Math.max(8, ...runs.map((r) => r.name.length)) || 8);
  const statusLen = 10;
  const dsLen = Math.min(20, Math.max(12, ...runs.map((r) => r.datasetVersion.length)) || 12);
  const dateLen = 24;
  const header = [
    "id".padEnd(idLen),
    "name".padEnd(nameLen),
    "status".padEnd(statusLen),
    "datasetVersion".padEnd(dsLen),
    "createdAt".padEnd(dateLen),
    "startedAt".padEnd(dateLen),
    "finishedAt".padEnd(dateLen),
  ].join(" ");
  log("--- Simulation runs ---");
  console.log(header);
  console.log("-".repeat(header.length));
  for (const r of runs) {
    const row = [
      r.id.padEnd(idLen),
      r.name.slice(0, nameLen).padEnd(nameLen),
      r.status.padEnd(statusLen),
      r.datasetVersion.slice(0, dsLen).padEnd(dsLen),
      formatDate(r.createdAt).padEnd(dateLen),
      formatDate(r.startedAt).padEnd(dateLen),
      formatDate(r.finishedAt).padEnd(dateLen),
    ].join(" ");
    console.log(row);
  }
  log("--------------------------------------");
}

async function main(): Promise<void> {
  loadEnv();
  const argv = parseArgv();

  const prisma = new PrismaClient();
  try {
    const where: { status?: SimulationRunStatus; name?: string } = {};
    if (argv.status) where.status = argv.status;
    if (argv.name != null && argv.name.trim() !== "") where.name = argv.name.trim();

    const runs = await prisma.simulationRun.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: "desc" },
      take: argv.limit,
      select: {
        id: true,
        name: true,
        status: true,
        datasetVersion: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
      },
    });

    const rows: RunRow[] = runs.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      datasetVersion: r.datasetVersion,
      createdAt: r.createdAt,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
    }));

    const jsonOut = rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      datasetVersion: r.datasetVersion,
      createdAt: r.createdAt.toISOString(),
      startedAt: r.startedAt?.toISOString() ?? null,
      finishedAt: r.finishedAt?.toISOString() ?? null,
    }));

    if (argv.json) {
      console.log(JSON.stringify(jsonOut, null, 2));
      return;
    }

    printTable(rows);
    log("JSON:");
    console.log(JSON.stringify(jsonOut, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("sim:list failed:", err);
  process.exit(1);
});
