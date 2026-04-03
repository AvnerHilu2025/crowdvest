/**
 * Shared DB rollups for cv-diag-057 / cv-diag-058: per-archetype average BUY/SELL/HOLD ratios
 * (mean of per-agent ratios for that archetype). Same queries and join rules as CV-057.
 */
import { PrismaClient } from "@crowdvest/db";

export type AgentArchetypeAggRow = {
  archetype: string;
  agentId: string;
  total: bigint;
  buy_count: bigint;
  sell_count: bigint;
  hold_count: bigint;
};

export type ArchRollup = {
  archetype: string;
  agentCount: number;
  avgBuy: number | null;
  avgSell: number | null;
  avgHold: number | null;
  varBuy: number | null;
  varSell: number | null;
  varHold: number | null;
};

function toNum(x: bigint): number {
  return Number(x);
}

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

function avg(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Loads per-archetype rollups for a simulation run (optional variant). Caller must disconnect prisma if it passes a client. */
export async function loadArchetypeRatioRollups(prisma: PrismaClient, runId: string, variantId?: string): Promise<ArchRollup[]> {
  const rows: AgentArchetypeAggRow[] = variantId
    ? await prisma.$queryRaw<AgentArchetypeAggRow[]>`
        SELECT
          MAX(
            COALESCE(
              NULLIF(TRIM(ra."archetype"), ''),
              a."name",
              '(null)'
            )
          ) AS archetype,
          ad."agentId" AS "agentId",
          COUNT(*)::bigint AS total,
          SUM(CASE WHEN ad."action"::text = 'BUY' THEN 1 ELSE 0 END)::bigint AS buy_count,
          SUM(CASE WHEN ad."action"::text = 'SELL' THEN 1 ELSE 0 END)::bigint AS sell_count,
          SUM(CASE WHEN ad."action"::text = 'HOLD' THEN 1 ELSE 0 END)::bigint AS hold_count
        FROM "AgentDecision" ad
        INNER JOIN "RunAgent" ra ON ra.id = ad."agentId"
        LEFT JOIN "Archetype" a ON a.id = ra."archetypeId"
        WHERE ad."runId" = ${runId}::uuid
          AND ad."runVariantId" = ${variantId}::uuid
        GROUP BY ad."agentId"
      `
    : await prisma.$queryRaw<AgentArchetypeAggRow[]>`
        SELECT
          MAX(
            COALESCE(
              NULLIF(TRIM(ra."archetype"), ''),
              a."name",
              '(null)'
            )
          ) AS archetype,
          ad."agentId" AS "agentId",
          COUNT(*)::bigint AS total,
          SUM(CASE WHEN ad."action"::text = 'BUY' THEN 1 ELSE 0 END)::bigint AS buy_count,
          SUM(CASE WHEN ad."action"::text = 'SELL' THEN 1 ELSE 0 END)::bigint AS sell_count,
          SUM(CASE WHEN ad."action"::text = 'HOLD' THEN 1 ELSE 0 END)::bigint AS hold_count
        FROM "AgentDecision" ad
        INNER JOIN "RunAgent" ra ON ra.id = ad."agentId"
        LEFT JOIN "Archetype" a ON a.id = ra."archetypeId"
        WHERE ad."runId" = ${runId}::uuid
        GROUP BY ad."agentId"
      `;

  const byArch = new Map<
    string,
    {
      buyR: number[];
      sellR: number[];
      holdR: number[];
    }
  >();

  for (const r of rows) {
    const t = toNum(r.total);
    if (t <= 0) continue;
    const arch = r.archetype ?? "(null)";
    let b = byArch.get(arch);
    if (!b) {
      b = { buyR: [], sellR: [], holdR: [] };
      byArch.set(arch, b);
    }
    b.buyR.push(toNum(r.buy_count) / t);
    b.sellR.push(toNum(r.sell_count) / t);
    b.holdR.push(toNum(r.hold_count) / t);
  }

  const rollups: ArchRollup[] = [];
  for (const [archetype, b] of byArch) {
    rollups.push({
      archetype,
      agentCount: b.buyR.length,
      avgBuy: avg(b.buyR),
      avgSell: avg(b.sellR),
      avgHold: avg(b.holdR),
      varBuy: popVariance(b.buyR),
      varSell: popVariance(b.sellR),
      varHold: popVariance(b.holdR),
    });
  }

  rollups.sort((a, b) => a.archetype.localeCompare(b.archetype));
  return rollups;
}

export type ArchetypeRatioJsonRow = {
  archetype: string;
  avg_buy_ratio: number;
  avg_sell_ratio: number;
  avg_hold_ratio: number;
};

export function rollupsToJsonStats(rollups: ArchRollup[]): ArchetypeRatioJsonRow[] {
  return rollups
    .filter((r) => r.avgBuy != null && r.avgSell != null && r.avgHold != null && Number.isFinite(r.avgBuy) && Number.isFinite(r.avgSell) && Number.isFinite(r.avgHold))
    .map((r) => ({
      archetype: r.archetype,
      avg_buy_ratio: r.avgBuy as number,
      avg_sell_ratio: r.avgSell as number,
      avg_hold_ratio: r.avgHold as number,
    }));
}
