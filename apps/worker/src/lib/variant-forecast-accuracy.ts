import type { PrismaClient } from "@crowdvest/db";

type Direction = "BUY" | "SELL" | "HOLD";

function majorityDirection(buy: number, sell: number, hold: number): Direction {
  const max = Math.max(buy, sell, hold);
  if (buy === max && buy > sell && buy > hold) return "BUY";
  if (sell === max && sell > buy && sell > hold) return "SELL";
  return "HOLD";
}

function actualFromReturn(returnNext: number): Direction {
  if (returnNext > 0) return "BUY";
  if (returnNext < 0) return "SELL";
  return "HOLD";
}

/** Crowd majority vs next-step return; scoped to one RunVariant (fair A/B). */
export async function computeVariantForecastAccuracy(
  prisma: PrismaClient,
  runId: string,
  runVariantId: string,
  assetSymbol: string,
): Promise<{ accuracy: number; baselineBuy: number; baselineSell: number }> {
  const decisions = await prisma.agentDecision.findMany({
    where: { runId, runVariantId },
    select: { step: true, action: true },
  });
  const returns = await prisma.assetStepReturn.findMany({
    where: { runId, assetSymbol },
    orderBy: { step: "asc" },
    select: { step: true, stepReturn: true },
  });
  const returnByKey = new Map<string, number>();
  for (const r of returns) {
    returnByKey.set(`${r.step}`, r.stepReturn);
  }

  const countsByStep = new Map<number, { BUY: number; SELL: number; HOLD: number }>();
  for (const d of decisions) {
    let c = countsByStep.get(d.step);
    if (!c) {
      c = { BUY: 0, SELL: 0, HOLD: 0 };
      countsByStep.set(d.step, c);
    }
    if (d.action in c) (c as Record<string, number>)[d.action]++;
  }

  const rows: { prediction: Direction; actual: Direction; isCorrect: boolean }[] = [];

  for (const [step, counts] of countsByStep) {
    const returnNext = returnByKey.get(String(step + 1));
    if (returnNext == null || !Number.isFinite(returnNext)) continue;
    const totalVotes = counts.BUY + counts.SELL + counts.HOLD;
    if (totalVotes === 0) continue;
    const prediction = majorityDirection(counts.BUY, counts.SELL, counts.HOLD);
    const actual = actualFromReturn(returnNext);
    rows.push({ prediction, actual, isCorrect: prediction === actual });
  }

  const total = rows.length;
  const correct = rows.filter((r) => r.isCorrect).length;
  const accuracy = total > 0 ? correct / total : 0;

  let buyCorrect = 0;
  let sellCorrect = 0;
  for (const r of rows) {
    if (r.actual === "BUY") buyCorrect++;
    if (r.actual === "SELL") sellCorrect++;
  }
  const baselineBuy = total > 0 ? buyCorrect / total : 0;
  const baselineSell = total > 0 ? sellCorrect / total : 0;

  return { accuracy, baselineBuy, baselineSell };
}
