import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type Direction = "BUY" | "SELL" | "HOLD";

/** Majority vote: max wins, ties => HOLD (deterministic). */
function majorityDirection(buy: number, sell: number, hold: number): Direction {
  const max = Math.max(buy, sell, hold);
  if (buy === max && buy > sell && buy > hold) return "BUY";
  if (sell === max && sell > buy && sell > hold) return "SELL";
  return "HOLD";
}

/** Ground truth direction from step return. */
function directionFromReturn(stepReturn: number): Direction {
  if (stepReturn > 0) return "BUY";
  if (stepReturn < 0) return "SELL";
  return "HOLD";
}

@Injectable()
export class ForecastService {
  constructor(private readonly prisma: PrismaService) {}

  async computeRunAccuracy(
    runId: string,
    opts?: { overwrite?: boolean },
  ): Promise<{ items: Array<Record<string, unknown>>; diagnostics: Array<Record<string, unknown>> }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true, status: true },
    });
    if (!run) {
      throw new NotFoundException("Run not found");
    }
    if (run.status !== "COMPLETED") {
      throw new BadRequestException("Run must be COMPLETED to compute accuracy");
    }

    const overwrite = opts?.overwrite === true;

    if (!overwrite) {
      const [existingAcc, existingDiag] = await Promise.all([
        this.prisma.runAccuracy.findMany({
          where: { runId },
          orderBy: { assetSymbol: "asc" },
        }),
        this.prisma.runSignalDiagnostics.findMany({
          where: { runId },
          orderBy: { assetSymbol: "asc" },
        }),
      ]);
      if (existingAcc.length > 0) {
        return {
          items: existingAcc as unknown as Array<Record<string, unknown>>,
          diagnostics: existingDiag as unknown as Array<Record<string, unknown>>,
        };
      }
    }

    if (overwrite) {
      await this.prisma.$transaction([
        this.prisma.forecastResult.deleteMany({ where: { runId } }),
        this.prisma.runAccuracy.deleteMany({ where: { runId } }),
        this.prisma.runSignalDiagnostics.deleteMany({ where: { runId } }),
      ]);
    }

    const decisions = await this.prisma.agentDecision.findMany({
      where: { runId },
      select: { assetSymbol: true, step: true, action: true },
    });

    const returns = await this.prisma.assetStepReturn.findMany({
      where: { runId },
      select: { assetSymbol: true, step: true, stepReturn: true },
    });

    const returnByKey = new Map<string, number>();
    for (const r of returns) {
      returnByKey.set(`${r.assetSymbol}:${r.step}`, r.stepReturn);
    }

    const countsByKey = new Map<string, { BUY: number; SELL: number; HOLD: number }>();
    for (const d of decisions) {
      const key = `${d.assetSymbol}:${d.step}`;
      let c = countsByKey.get(key);
      if (!c) {
        c = { BUY: 0, SELL: 0, HOLD: 0 };
        countsByKey.set(key, c);
      }
      if (d.action in c) (c as Record<string, number>)[d.action]++;
    }

    const forecastResults: Array<{
      id: string;
      runId: string;
      assetSymbol: string;
      step: number;
      forecastDirection: Direction;
      totalVotes: number;
      buyVotes: number;
      sellVotes: number;
      holdVotes: number;
      groundTruthDirection: Direction;
      isCorrect: boolean;
    }> = [];

    for (const [key, counts] of countsByKey) {
      const [assetSymbol, stepStr] = key.split(":");
      const step = parseInt(stepStr!, 10);
      const nextRet = returnByKey.get(`${assetSymbol}:${step + 1}`);
      if (nextRet == null || !Number.isFinite(nextRet)) continue;

      const totalVotes = counts.BUY + counts.SELL + counts.HOLD;
      if (totalVotes === 0) continue;

      const forecastDirection = majorityDirection(counts.BUY, counts.SELL, counts.HOLD);
      const groundTruthDirection = directionFromReturn(nextRet);
      const isCorrect = forecastDirection === groundTruthDirection;

      forecastResults.push({
        id: crypto.randomUUID(),
        runId,
        assetSymbol,
        step,
        forecastDirection,
        totalVotes,
        buyVotes: counts.BUY,
        sellVotes: counts.SELL,
        holdVotes: counts.HOLD,
        groundTruthDirection,
        isCorrect,
      });
    }

    if (forecastResults.length > 0) {
      await this.prisma.forecastResult.createMany({
        data: forecastResults,
      });
    }

    const byAsset = new Map<
      string,
      {
        totalEvaluations: number;
        correctCount: number;
        buyCorrect: number;
        buyTotal: number;
        sellCorrect: number;
        sellTotal: number;
        holdCorrect: number;
        holdTotal: number;
      }
    >();

    for (const fr of forecastResults) {
      let agg = byAsset.get(fr.assetSymbol);
      if (!agg) {
        agg = {
          totalEvaluations: 0,
          correctCount: 0,
          buyCorrect: 0,
          buyTotal: 0,
          sellCorrect: 0,
          sellTotal: 0,
          holdCorrect: 0,
          holdTotal: 0,
        };
        byAsset.set(fr.assetSymbol, agg);
      }
      agg.totalEvaluations++;
      if (fr.isCorrect) agg.correctCount++;
      if (fr.forecastDirection === "BUY") {
        agg.buyTotal++;
        if (fr.isCorrect) agg.buyCorrect++;
      } else if (fr.forecastDirection === "SELL") {
        agg.sellTotal++;
        if (fr.isCorrect) agg.sellCorrect++;
      } else {
        agg.holdTotal++;
        if (fr.isCorrect) agg.holdCorrect++;
      }
    }

    const runAccuracyRows: Array<{
      id: string;
      runId: string;
      assetSymbol: string;
      totalEvaluations: number;
      correctCount: number;
      accuracyRate: number;
      buyAccuracy: number;
      sellAccuracy: number;
      holdAccuracy: number;
    }> = [];

    for (const [assetSymbol, agg] of byAsset) {
      const accuracyRate =
        agg.totalEvaluations > 0 ? agg.correctCount / agg.totalEvaluations : 0;
      const buyAccuracy = agg.buyTotal > 0 ? agg.buyCorrect / agg.buyTotal : 0;
      const sellAccuracy = agg.sellTotal > 0 ? agg.sellCorrect / agg.sellTotal : 0;
      const holdAccuracy = agg.holdTotal > 0 ? agg.holdCorrect / agg.holdTotal : 0;

      runAccuracyRows.push({
        id: crypto.randomUUID(),
        runId,
        assetSymbol,
        totalEvaluations: agg.totalEvaluations,
        correctCount: agg.correctCount,
        accuracyRate,
        buyAccuracy,
        sellAccuracy,
        holdAccuracy,
      });
    }

    if (runAccuracyRows.length > 0) {
      await this.prisma.runAccuracy.createMany({
        data: runAccuracyRows,
      });
    }

    const diagRows: Array<{
      id: string;
      runId: string;
      assetSymbol: string;
      totalSteps: number;
      pctCrowdBuy: number;
      pctCrowdSell: number;
      pctCrowdHold: number;
      pctMarketUp: number;
      pctMarketDown: number;
      pctMarketFlat: number;
      buyCorrect: number;
      buyWrong: number;
      sellCorrect: number;
      sellWrong: number;
      holdCorrect: number;
      holdWrong: number;
    }> = [];

    for (const [assetSymbol, agg] of byAsset) {
      const frForAsset = forecastResults.filter((r) => r.assetSymbol === assetSymbol);
      const totalSteps = frForAsset.length;
      if (totalSteps === 0) continue;

      let crowdBuy = 0;
      let crowdSell = 0;
      let crowdHold = 0;
      let upCount = 0;
      let downCount = 0;
      let flatCount = 0;
      let buyCorrect = 0;
      let buyWrong = 0;
      let sellCorrect = 0;
      let sellWrong = 0;
      let holdCorrect = 0;
      let holdWrong = 0;

      for (const fr of frForAsset) {
        if (fr.forecastDirection === "BUY") {
          crowdBuy++;
          if (fr.isCorrect) buyCorrect++;
          else buyWrong++;
        } else if (fr.forecastDirection === "SELL") {
          crowdSell++;
          if (fr.isCorrect) sellCorrect++;
          else sellWrong++;
        } else {
          crowdHold++;
          if (fr.isCorrect) holdCorrect++;
          else holdWrong++;
        }

        const nextRet = returnByKey.get(`${assetSymbol}:${fr.step + 1}`);
        if (nextRet != null && Number.isFinite(nextRet)) {
          if (nextRet > 0) upCount++;
          else if (nextRet < 0) downCount++;
          else flatCount++;
        }
      }

      diagRows.push({
        id: crypto.randomUUID(),
        runId,
        assetSymbol,
        totalSteps,
        pctCrowdBuy: totalSteps > 0 ? crowdBuy / totalSteps : 0,
        pctCrowdSell: totalSteps > 0 ? crowdSell / totalSteps : 0,
        pctCrowdHold: totalSteps > 0 ? crowdHold / totalSteps : 0,
        pctMarketUp: totalSteps > 0 ? upCount / totalSteps : 0,
        pctMarketDown: totalSteps > 0 ? downCount / totalSteps : 0,
        pctMarketFlat: totalSteps > 0 ? flatCount / totalSteps : 0,
        buyCorrect,
        buyWrong,
        sellCorrect,
        sellWrong,
        holdCorrect,
        holdWrong,
      });
    }

    if (diagRows.length > 0) {
      await this.prisma.runSignalDiagnostics.createMany({
        data: diagRows,
      });
    }

    const items = await this.prisma.runAccuracy.findMany({
      where: { runId },
      orderBy: { assetSymbol: "asc" },
    });

    const diagnostics = await this.prisma.runSignalDiagnostics.findMany({
      where: { runId },
      orderBy: { assetSymbol: "asc" },
    });

    return {
      items: items as unknown as Array<Record<string, unknown>>,
      diagnostics: diagnostics as unknown as Array<Record<string, unknown>>,
    };
  }
}
