/**
 * Backfill RunVariant.durationMs for variants where it is null.
 * Computes from startedAt & completedAt when both exist.
 *
 * Usage: pnpm -C apps/worker backfill:variant-duration
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

function computeDurationMs(v: {
  startedAt: Date | null;
  completedAt: Date | null;
}): number | null {
  const start = v.startedAt;
  const end = v.completedAt;
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
    const variants = await prisma.runVariant.findMany({
      where: {
        durationMs: null,
        startedAt: { not: null },
        completedAt: { not: null },
      },
      select: {
        id: true,
        startedAt: true,
        completedAt: true,
      },
    });

    scanned = variants.length;
    console.log(
      `[backfill-variant-duration] Scanned ${scanned} variants with durationMs=null and startedAt+completedAt set`,
    );

    for (const v of variants) {
      const durationMs = computeDurationMs(v);
      if (durationMs == null) {
        skipped++;
        continue;
      }

      await prisma.runVariant.update({
        where: { id: v.id },
        data: { durationMs },
      });
      updated++;
    }

    console.log(`[backfill-variant-duration] Updated: ${updated}, Skipped: ${skipped}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("backfill-variant-duration failed:", err);
  process.exit(1);
});
