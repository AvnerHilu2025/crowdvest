/**
 * CV-058: Nearest-neighbor Euclidean distance between archetypes using REAL avg BUY/SELL/HOLD ratios
 * from the same rollups as CV-057 (per-agent ratios averaged within each archetype label).
 *
 * Env: RUN_ID (required). Optional: RUN_VARIANT_ID.
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";
import { loadArchetypeRatioRollups, rollupsToJsonStats } from "./cv-diag-archetype-ratio-rollups";

function loadEnv(): void {
  const repoRoot = path.resolve(__dirname, "../../../../.env");
  try {
    if (!fs.existsSync(repoRoot)) return;
    const content = fs.readFileSync(repoRoot, "utf8");
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

function euclidean3(buyI: number, sellI: number, holdI: number, buyJ: number, sellJ: number, holdJ: number): number {
  const db = buyI - buyJ;
  const ds = sellI - sellJ;
  const dh = holdI - holdJ;
  return Math.sqrt(db * db + ds * ds + dh * dh);
}

function safeCell(s: string): string {
  return s.replace(/\|/g, "\\|");
}

const FLAG_THRESHOLD = 0.08;

async function main(): Promise<void> {
  loadEnv();
  const runId = process.env.RUN_ID?.trim();
  if (!runId) throw new Error("RUN_ID is required");

  const variantId = process.env.RUN_VARIANT_ID?.trim();
  const prisma = new PrismaClient();
  const rollups = await loadArchetypeRatioRollups(prisma, runId, variantId);
  await prisma.$disconnect();

  const stats = rollupsToJsonStats(rollups);
  if (stats.length < 2) {
    process.stdout.write("=== NEAREST ARCHETYPES (REAL DATA) ===\n\n(need at least 2 archetypes with finite avg ratios)\n");
    return;
  }

  type Pair = { a: string; b: string; distance: number };
  const pairs: Pair[] = [];
  for (let i = 0; i < stats.length; i++) {
    for (let j = i + 1; j < stats.length; j++) {
      const pi = stats[i]!;
      const pj = stats[j]!;
      pairs.push({
        a: pi.archetype,
        b: pj.archetype,
        distance: euclidean3(pi.avg_buy_ratio, pi.avg_sell_ratio, pi.avg_hold_ratio, pj.avg_buy_ratio, pj.avg_sell_ratio, pj.avg_hold_ratio),
      });
    }
  }

  pairs.sort((x, y) => x.distance - y.distance);

  const lines: string[] = [];
  lines.push("=== NEAREST ARCHETYPES (REAL DATA) ===");
  lines.push("");
  lines.push("| archetype_a | archetype_b | distance |");
  lines.push("|-------------|-------------|----------|");
  for (const p of pairs) {
    lines.push(`| ${safeCell(p.a)} | ${safeCell(p.b)} | ${p.distance.toFixed(6)} |`);
  }

  lines.push("");
  lines.push("=== TOP 10 CLOSEST PAIRS ===");
  lines.push("");
  lines.push("| archetype_a | archetype_b | distance |");
  lines.push("|-------------|-------------|----------|");
  for (const p of pairs.slice(0, 10)) {
    lines.push(`| ${safeCell(p.a)} | ${safeCell(p.b)} | ${p.distance.toFixed(6)} |`);
  }

  const flagged = pairs.filter((p) => p.distance < FLAG_THRESHOLD);
  lines.push("");
  lines.push(`=== FLAG: EUCLIDEAN DISTANCE < ${FLAG_THRESHOLD} (weak behavioral separation) ===`);
  lines.push("");
  if (flagged.length === 0) {
    lines.push("(none)");
  } else {
    lines.push("| archetype_a | archetype_b | distance |");
    lines.push("|-------------|-------------|----------|");
    for (const p of flagged) {
      lines.push(`| ${safeCell(p.a)} | ${safeCell(p.b)} | ${p.distance.toFixed(6)} |`);
    }
  }

  lines.push("");
  lines.push(`| metric | value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| archetype_count_used | ${stats.length} |`);
  lines.push(`| pair_count | ${pairs.length} |`);
  lines.push(`| flagged_pair_count (distance < ${FLAG_THRESHOLD}) | ${flagged.length} |`);

  process.stdout.write(lines.join("\n") + "\n");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
