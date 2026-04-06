/**
 * Shared helpers for reports that score AgentDecision vs AssetStepReturn forward returns.
 * Mirrors decide.ts step-return loading (ordinal series; synthetic zeros when row count < steps).
 */
import { PrismaClient } from "@crowdvest/db";

export const EPS = 1e-9;

export type MetricBlock = {
  accuracy: number;
  avgReturnPerDecision: number;
  cumulativeReturn: number;
  sharpeLike: number;
  winRate: number;
  decisionCount: number;
};

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((s, x) => s + (x - m) ** 2, 0) / values.length;
  return Math.sqrt(v);
}

export function emptyMetrics(): MetricBlock {
  return {
    accuracy: 0,
    avgReturnPerDecision: 0,
    cumulativeReturn: 0,
    sharpeLike: 0,
    winRate: 0,
    decisionCount: 0,
  };
}

/**
 * Same forward-return series as decide.ts (~1715–1730): ordered rows, index s → simulation step s;
 * if fewer than `steps` rows exist, use all-zero returns (decide’s synthetic path).
 */
export async function loadStepReturnsLikeDecide(
  prisma: PrismaClient,
  runId: string,
  assetSymbol: string,
  steps: number,
): Promise<{ series: number[]; usedSynthetic: boolean; rowCount: number }> {
  const assetStepReturns = await prisma.assetStepReturn.findMany({
    where: { runId, assetSymbol },
    orderBy: { step: "asc" },
    select: { step: true, stepReturn: true },
  });
  const rowCount = assetStepReturns.length;
  if (assetStepReturns.length < steps) {
    return {
      series: Array.from({ length: steps }, () => 0),
      usedSynthetic: true,
      rowCount,
    };
  }
  const series: number[] = [];
  for (let s = 0; s < steps; s++) {
    series.push(assetStepReturns[s]!.stepReturn);
  }
  return { series, usedSynthetic: false, rowCount };
}

export async function computePredictiveMetrics(
  prisma: PrismaClient,
  runId: string,
  seriesBySymbol: Map<string, number[]>,
  runVariantIds: string[],
  steps: number,
): Promise<MetricBlock> {
  if (runVariantIds.length === 0) return emptyMetrics();

  const decisions = await prisma.agentDecision.findMany({
    where: {
      runId,
      runVariantId: { in: runVariantIds },
      step: { gte: 0, lt: steps },
    },
    select: { step: true, action: true, assetSymbol: true },
  });

  const pnls: number[] = [];
  let correct = 0;
  let total = 0;

  for (const d of decisions) {
    const series = seriesBySymbol.get(d.assetSymbol);
    const ret =
      series !== undefined && d.step >= 0 && d.step < series.length ? series[d.step]! : 0;
    let pnl = 0;
    if (d.action === "BUY") pnl = ret;
    else if (d.action === "SELL") pnl = -ret;
    else pnl = 0;

    pnls.push(pnl);
    total++;
    if (d.action === "BUY" && ret > EPS) correct++;
    else if (d.action === "SELL" && ret < -EPS) correct++;
    else if (d.action === "HOLD" && Math.abs(ret) <= EPS) correct++;
  }

  const accuracy = total > 0 ? correct / total : 0;
  const avgReturnPerDecision = pnls.length ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
  const cumulativeReturn = pnls.reduce((a, b) => a + b, 0);
  const sd = pnls.length >= 2 ? stdDev(pnls) : 0;
  const sharpeLike = sd > 1e-12 ? avgReturnPerDecision / sd : 0;
  const winRate = pnls.length ? pnls.filter((p) => p > 0).length / pnls.length : 0;

  return {
    accuracy,
    avgReturnPerDecision,
    cumulativeReturn,
    sharpeLike,
    winRate,
    decisionCount: total,
  };
}

export function variantIdsFromValidate(result: { bySeed: unknown[] }): string[] {
  const ids = new Set<string>();
  for (const row of result.bySeed as { runVariantId?: string }[]) {
    if (row?.runVariantId) ids.add(row.runVariantId);
  }
  return [...ids];
}
