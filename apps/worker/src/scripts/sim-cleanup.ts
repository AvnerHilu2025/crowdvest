/**
 * CLI: Delete simulation runs (with cascade to AgentExperience and CrowdSnapshot).
 *
 * Modes (mutually exclusive):
 *   --keepLast <n>       Keep last N runs by createdAt; delete older ones.
 *   --deleteRunId <uuid> Delete a single run by id.
 *   --deleteName <string> Delete all runs with exact name.
 *
 * Safety: --yes required to confirm unless --dryRun.
 *
 * Example usage:
 *   pnpm --filter worker sim:cleanup -- --keepLast 5 --dryRun
 *   pnpm --filter worker sim:cleanup -- --keepLast 5 --yes
 *   pnpm --filter worker sim:cleanup -- --deleteRunId <uuid> --yes
 *   pnpm --filter worker sim:cleanup -- --deleteName "smoke-1" --dryRun
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

type CleanupMode = "keepLast" | "deleteRunId" | "deleteName";

interface SimCleanupArgv {
  mode: CleanupMode;
  keepLastN: number;
  deleteRunId: string;
  deleteName: string;
  dryRun: boolean;
  yes: boolean;
}

function parseArgv(): SimCleanupArgv {
  const args = process.argv.slice(2);
  let keepLastN = 0;
  let deleteRunId = "";
  let deleteName = "";
  let dryRun = false;
  let yes = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--keepLast" && args[i + 1]) {
      const n = parseInt(args[++i], 10);
      if (Number.isFinite(n) && n >= 0) keepLastN = n;
    } else if (args[i] === "--deleteRunId" && args[i + 1]) {
      deleteRunId = args[++i].trim();
    } else if (args[i] === "--deleteName" && args[i + 1]) {
      deleteName = args[++i].trim();
    } else if (args[i] === "--dryRun") {
      dryRun = true;
    } else if (args[i] === "--yes") {
      yes = true;
    }
  }
  const modes: CleanupMode[] = [];
  if (keepLastN > 0) modes.push("keepLast");
  if (deleteRunId !== "") modes.push("deleteRunId");
  if (deleteName !== "") modes.push("deleteName");
  const mode: CleanupMode = modes.length === 1 ? modes[0] : "keepLast";
  return {
    mode,
    keepLastN,
    deleteRunId,
    deleteName,
    dryRun,
    yes,
  };
}

async function getRunIdsToDelete(prisma: PrismaClient, argv: SimCleanupArgv): Promise<string[]> {
  if (argv.mode === "keepLast") {
    const all = await prisma.simulationRun.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const toDelete = all.slice(argv.keepLastN);
    return toDelete.map((r) => r.id);
  }
  if (argv.mode === "deleteRunId") {
    const run = await prisma.simulationRun.findUnique({
      where: { id: argv.deleteRunId },
      select: { id: true },
    });
    return run ? [run.id] : [];
  }
  if (argv.mode === "deleteName") {
    const runs = await prisma.simulationRun.findMany({
      where: { name: argv.deleteName },
      select: { id: true },
    });
    return runs.map((r) => r.id);
  }
  return [];
}

async function main(): Promise<void> {
  loadEnv();
  const argv = parseArgv();

  const modesSet =
    (argv.keepLastN > 0 ? 1 : 0) +
    (argv.deleteRunId !== "" ? 1 : 0) +
    (argv.deleteName !== "" ? 1 : 0);
  if (modesSet === 0) {
    console.error("Specify exactly one mode: --keepLast <n>, --deleteRunId <uuid>, or --deleteName <string>");
    process.exit(1);
  }
  if (modesSet > 1) {
    console.error("Modes are mutually exclusive. Use only one of: --keepLast, --deleteRunId, --deleteName.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const runIds = await getRunIdsToDelete(prisma, argv);
    if (runIds.length === 0) {
      log("No runs to delete.");
      return;
    }

    const [experienceCount, snapshotCount] = await Promise.all([
      prisma.agentExperience.count({ where: { runId: { in: runIds } } }),
      prisma.crowdSnapshot.count({ where: { runId: { in: runIds } } }),
    ]);

    log(`Runs to delete: ${runIds.length}`);
    log(`AgentExperience to delete: ${experienceCount}`);
    log(`CrowdSnapshot to delete: ${snapshotCount}`);
    if (runIds.length <= 10) {
      for (const id of runIds) log(`  runId: ${id}`);
    } else {
      for (const id of runIds.slice(0, 5)) log(`  runId: ${id}`);
      log(`  ... and ${runIds.length - 5} more`);
    }

    if (argv.dryRun) {
      log("Dry run: no changes made. Remove --dryRun and add --yes to delete.");
      return;
    }

    if (!argv.yes) {
      console.error("Add --yes to confirm deletion.");
      process.exit(1);
    }

    const deleteResult = await prisma.simulationRun.deleteMany({
      where: { id: { in: runIds } },
    });

    log("--- Cleanup complete ---");
    log(`SimulationRun deleted: ${deleteResult.count}`);
    log(`AgentExperience deleted (cascade): ${experienceCount}`);
    log(`CrowdSnapshot deleted (cascade): ${snapshotCount}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("sim:cleanup failed:", err);
  process.exit(1);
});
