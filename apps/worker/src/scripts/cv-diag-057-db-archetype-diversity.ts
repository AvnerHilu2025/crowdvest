/**
 * CV-057: DB-first archetype diversity — per-agent action mix in SQL, then per-archetype stats in memory.
 *
 * Join path: AgentDecision.agentId -> RunAgent.id (FK). Archetype label from RunAgent.archetype,
 * else Archetype.name via RunAgent.archetypeId -> Archetype.id.
 *
 * Do NOT require RunAgent.runId = AgentDecision.runId: decide.ts stores pool agents under the
 * shared pool SimulationRun id, while AgentDecision.runId is the backtest/simulation run id.
 *
 * Env: RUN_ID (required). Optional: RUN_VARIANT_ID.
 * Read-only; loads one aggregated row per agent (not raw decisions). */
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

function fmt(x: number | null): string {
  if (x == null) return "—";
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(6);
}

function safeCell(s: string): string {
  return s.replace(/\|/g, "\\|");
}

async function main(): Promise<void> {
  loadEnv();
  const runId = process.env.RUN_ID?.trim();
  if (!runId) throw new Error("RUN_ID is required");

  const variantId = process.env.RUN_VARIANT_ID?.trim();
  const prisma = new PrismaClient();

  const rollups = await loadArchetypeRatioRollups(prisma, runId, variantId);

  await prisma.$disconnect();

  const avgsBuy = rollups.map((r) => r.avgBuy).filter((x): x is number => x != null && Number.isFinite(x));
  const avgsSell = rollups.map((r) => r.avgSell).filter((x): x is number => x != null && Number.isFinite(x));
  const avgsHold = rollups.map((r) => r.avgHold).filter((x): x is number => x != null && Number.isFinite(x));

  const rangeOf = (xs: number[]): number | null => {
    if (xs.length === 0) return null;
    let mn = xs[0]!;
    let mx = xs[0]!;
    for (const x of xs) {
      if (x < mn) mn = x;
      if (x > mx) mx = x;
    }
    return mx - mn;
  };

  const archetypeCount = rollups.length;
  const buyRatioRange = rangeOf(avgsBuy);
  const sellRatioRange = rangeOf(avgsSell);
  const holdRatioRange = rangeOf(avgsHold);

  const lines: string[] = [];
  lines.push("=== DB ARCHETYPE DIVERSITY ===");
  lines.push("");
  lines.push(
    "| archetype | agent_count | avg_buy_ratio | avg_sell_ratio | avg_hold_ratio | variance_buy_ratio | variance_sell_ratio | variance_hold_ratio |",
  );
  lines.push(
    "|-----------|-------------|---------------|----------------|----------------|--------------------|---------------------|---------------------|",
  );
  for (const r of rollups) {
    lines.push(
      `| ${safeCell(r.archetype)} | ${r.agentCount} | ${fmt(r.avgBuy)} | ${fmt(r.avgSell)} | ${fmt(r.avgHold)} | ${fmt(r.varBuy)} | ${fmt(r.varSell)} | ${fmt(r.varHold)} |`,
    );
  }

  lines.push("");
  lines.push("=== CROSS-ARCHETYPE SUMMARY ===");
  lines.push("");
  lines.push("| metric | value |");
  lines.push("|--------|-------|");
  lines.push(`| archetype_count | ${archetypeCount} |`);
  lines.push(`| buy_ratio_range | ${fmt(buyRatioRange)} |`);
  lines.push(`| sell_ratio_range | ${fmt(sellRatioRange)} |`);
  lines.push(`| hold_ratio_range | ${fmt(holdRatioRange)} |`);

  const jsonStats = rollupsToJsonStats(rollups);
  lines.push("");
  lines.push("=== ARCHETYPE_RATIO_STATS_JSON ===");
  lines.push(JSON.stringify(jsonStats, null, 2));

  process.stdout.write(lines.join("\n") + "\n");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
