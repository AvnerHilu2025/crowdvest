/**
 * Backfill SimulationRun.runDurationMs for historical runs where it is null.
 * Computes from startedAt & finishedAt (or completedAt) when both exist.
 *
 * Usage: pnpm -C apps/worker backfill:run-duration
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

function computeDurationMs(run: {
  startedAt: Date | null;
  finishedAt: Date | null;
  completedAt: Date | null;
}): number | null {
  const start = run.startedAt;
  const end = run.finishedAt ?? run.completedAt ?? null;
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

async function main(): Promise<void> {
  loadEnv();

  const prisma = new PrismaClient();
  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  try {
    const runs = await prisma.simulationRun.findMany({
      where: {
        status: "COMPLETED",
        runDurationMs: null,
      },
      select: {
        id: true,
        startedAt: true,
        finishedAt: true,
        completedAt: true,
      },
    });

    scanned = runs.length;
    console.log(`[backfill-run-duration] Scanned ${scanned} runs with status=COMPLETED and runDurationMs=null`);

    for (const run of runs) {
      const durationMs = computeDurationMs(run);
      if (durationMs == null) {
        skipped++;
        continue;
      }

      await prisma.simulationRun.update({
        where: { id: run.id },
        data: { runDurationMs: durationMs },
      });
      updated++;
    }

    console.log(`[backfill-run-duration] Updated: ${updated}, Skipped: ${skipped}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-run-duration failed:", err);
  process.exit(1);
});
