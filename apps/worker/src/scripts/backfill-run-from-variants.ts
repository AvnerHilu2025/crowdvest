/**
 * Backfill SimulationRun.startedAt, finishedAt, runDurationMs from its variants.
 * When run timestamps are inconsistent with variant timestamps (or missing), recompute from
 * min(variant.startedAt) and max(variant.completedAt).
 *
 * Usage: pnpm -C apps/worker backfill:run-from-variants
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

const DATABASE_URL_MISSING =
  "DATABASE_URL is not set. Create a .env at the repository root with DATABASE_URL=postgresql://...";

const SUSPICIOUS_LARGE_MS = 5 * 60 * 1000; // 5 minutes
const DURATION_TOLERANCE_MS = 250;

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

function shouldUpdate(
  run: {
    startedAt: Date | null;
    finishedAt: Date | null;
    completedAt: Date | null;
    runDurationMs: number | null;
  },
  runStarted: Date,
  runFinished: Date,
  computedDurationMs: number,
): boolean {
  if (run.startedAt == null || run.finishedAt == null) return true;
  const end = run.finishedAt ?? run.completedAt ?? null;
  if (end == null) return true;
  if (run.finishedAt < runFinished) return true;
  if (run.startedAt > runStarted) return true;
  if (run.runDurationMs == null) return true;
  if (Math.abs(run.runDurationMs - computedDurationMs) > DURATION_TOLERANCE_MS) return true;
  if (
    run.runDurationMs > SUSPICIOUS_LARGE_MS &&
    computedDurationMs < SUSPICIOUS_LARGE_MS
  ) {
    return true;
  }
  return false;
}

async function main(): Promise<void> {
  loadEnv();

  const prisma = new PrismaClient();
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  const updatedExamples: Array<{ id: string; runDurationMs: number; startedAt: string; finishedAt: string }> = [];

  try {
    const runs = await prisma.simulationRun.findMany({
      where: { status: "COMPLETED" },
      select: {
        id: true,
        startedAt: true,
        finishedAt: true,
        completedAt: true,
        runDurationMs: true,
      },
    });

    scanned = runs.length;
    console.log(`[backfill-run-from-variants] Scanned ${scanned} COMPLETED runs`);

    for (const run of runs) {
      const variants = await prisma.runVariant.findMany({
        where: {
          runId: run.id,
          startedAt: { not: null },
          completedAt: { not: null },
        },
        select: { startedAt: true, completedAt: true },
      });

      if (variants.length < 1) {
        skipped++;
        continue;
      }

      const runStarted = new Date(
        Math.min(...variants.map((v) => v.startedAt!.getTime())),
      );
      const runFinished = new Date(
        Math.max(...variants.map((v) => v.completedAt!.getTime())),
      );
      const computedDurationMs = Math.max(
        0,
        runFinished.getTime() - runStarted.getTime(),
      );

      if (!shouldUpdate(run, runStarted, runFinished, computedDurationMs)) {
        skipped++;
        continue;
      }

      await prisma.simulationRun.update({
        where: { id: run.id },
        data: {
          startedAt: runStarted,
          finishedAt: runFinished,
          completedAt: runFinished,
          runDurationMs: computedDurationMs,
        },
      });

      updated++;
      if (updatedExamples.length < 5) {
        updatedExamples.push({
          id: run.id,
          runDurationMs: computedDurationMs,
          startedAt: runStarted.toISOString(),
          finishedAt: runFinished.toISOString(),
        });
      }
    }

    console.log(`[backfill-run-from-variants] Updated: ${updated}, Skipped: ${skipped}`);
    if (updatedExamples.length > 0) {
      console.log("Examples (updated):");
      for (const ex of updatedExamples) {
        console.log(`  ${ex.id} runDurationMs=${ex.runDurationMs} startedAt=${ex.startedAt} finishedAt=${ex.finishedAt}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-run-from-variants failed:", err);
  process.exit(1);
});
