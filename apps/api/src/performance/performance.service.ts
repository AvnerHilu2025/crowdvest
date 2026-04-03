import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** One row per asset, matching persisted `RunAccuracy` (no `step` / `return` / `correct` per row). */
export type RunPerformanceByAsset = {
  assetSymbol: string;
  totalEvaluations: number;
  correctCount: number;
  accuracyRate: number;
  buyAccuracy: number;
  sellAccuracy: number;
  holdAccuracy: number;
};

/**
 * Truthful performance payload from `RunAccuracy` only.
 * Rows are created by `ForecastService.computeRunAccuracy` (e.g. GET /runs/:id/accuracy on a COMPLETED run).
 */
export type RunPerformanceResult = {
  runId: string;
  /**
   * Micro hit rate for the run: sum(correctCount) / sum(totalEvaluations) across assets.
   * `null` when there are no rows or zero evaluations.
   */
  hitRate: number | null;
  byAsset: RunPerformanceByAsset[];
};

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getRunPerformance(runId: string): Promise<RunPerformanceResult> {
    const rows = await this.prisma.runAccuracy.findMany({
      where: { runId },
      orderBy: { assetSymbol: "asc" },
    });

    if (!rows.length) {
      return { runId, hitRate: null, byAsset: [] };
    }

    const totalEvaluations = rows.reduce((sum, r) => sum + r.totalEvaluations, 0);
    const correctCount = rows.reduce((sum, r) => sum + r.correctCount, 0);
    const hitRate = totalEvaluations > 0 ? correctCount / totalEvaluations : null;

    const byAsset: RunPerformanceByAsset[] = rows.map((r) => ({
      assetSymbol: r.assetSymbol,
      totalEvaluations: r.totalEvaluations,
      correctCount: r.correctCount,
      accuracyRate: r.accuracyRate,
      buyAccuracy: r.buyAccuracy,
      sellAccuracy: r.sellAccuracy,
      holdAccuracy: r.holdAccuracy,
    }));

    return { runId, hitRate, byAsset };
  }
}
