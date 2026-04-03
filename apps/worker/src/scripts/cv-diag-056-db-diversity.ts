/**
 * CV-056: DB-first diversity diagnostic — action mix per agent via SQL aggregation only.
 *
 * Env: RUN_ID (required). Optional: RUN_VARIANT_ID.
 * Read-only; loads one aggregated row per agent into memory (not raw decisions).
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

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

type AgentAggRow = {
  agentId: string;
  total: bigint;
  buy_count: bigint;
  sell_count: bigint;
  hold_count: bigint;
};

function toNum(x: bigint): number {
  return Number(x);
}

/** Population variance (divide by n); n=0 → null, n=1 → 0 */
function popVariance(xs: number[]): number | null {
  const n = xs.length;
  if (n === 0) return null;
  if (n === 1) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  let s = 0;
  for (const x of xs) {
    const d = x - mean;
    s += d * d;
  }
  return s / n;
}

function fmt(x: number | null): string {
  if (x == null) return "—";
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(6);
}

async function main(): Promise<void> {
  loadEnv();
  const runId = process.env.RUN_ID?.trim();
  if (!runId) throw new Error("RUN_ID is required");

  const variantId = process.env.RUN_VARIANT_ID?.trim();
  const prisma = new PrismaClient();

  const rows: AgentAggRow[] = variantId
    ? await prisma.$queryRaw<AgentAggRow[]>`
        SELECT
          "agentId",
          COUNT(*)::bigint AS total,
          SUM(CASE WHEN "action"::text = 'BUY' THEN 1 ELSE 0 END)::bigint AS buy_count,
          SUM(CASE WHEN "action"::text = 'SELL' THEN 1 ELSE 0 END)::bigint AS sell_count,
          SUM(CASE WHEN "action"::text = 'HOLD' THEN 1 ELSE 0 END)::bigint AS hold_count
        FROM "AgentDecision"
        WHERE "runId" = ${runId}::uuid
          AND "runVariantId" = ${variantId}::uuid
        GROUP BY "agentId"
      `
    : await prisma.$queryRaw<AgentAggRow[]>`
        SELECT
          "agentId",
          COUNT(*)::bigint AS total,
          SUM(CASE WHEN "action"::text = 'BUY' THEN 1 ELSE 0 END)::bigint AS buy_count,
          SUM(CASE WHEN "action"::text = 'SELL' THEN 1 ELSE 0 END)::bigint AS sell_count,
          SUM(CASE WHEN "action"::text = 'HOLD' THEN 1 ELSE 0 END)::bigint AS hold_count
        FROM "AgentDecision"
        WHERE "runId" = ${runId}::uuid
        GROUP BY "agentId"
      `;

  await prisma.$disconnect();

  const buyRatios: number[] = [];
  const sellRatios: number[] = [];
  const holdRatios: number[] = [];

  for (const r of rows) {
    const t = toNum(r.total);
    if (t <= 0) continue;
    buyRatios.push(toNum(r.buy_count) / t);
    sellRatios.push(toNum(r.sell_count) / t);
    holdRatios.push(toNum(r.hold_count) / t);
  }

  const n = buyRatios.length;
  const avg = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

  const avgBuy = avg(buyRatios);
  const avgSell = avg(sellRatios);
  const avgHold = avg(holdRatios);
  const varBuy = popVariance(buyRatios);
  const varSell = popVariance(sellRatios);
  const varHold = popVariance(holdRatios);

  const lines: string[] = [];
  lines.push("=== DB DIVERSITY SUMMARY ===");
  lines.push("");
  lines.push("| metric | value |");
  lines.push("|--------|-------|");
  lines.push(`| agent_count | ${n} |`);
  lines.push(`| avg_buy_ratio | ${fmt(avgBuy)} |`);
  lines.push(`| avg_sell_ratio | ${fmt(avgSell)} |`);
  lines.push(`| avg_hold_ratio | ${fmt(avgHold)} |`);
  lines.push(`| variance_buy_ratio | ${fmt(varBuy)} |`);
  lines.push(`| variance_sell_ratio | ${fmt(varSell)} |`);
  lines.push(`| variance_hold_ratio | ${fmt(varHold)} |`);

  process.stdout.write(lines.join("\n") + "\n");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
