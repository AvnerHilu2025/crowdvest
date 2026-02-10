import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type PnlRow = { totalPnl: number };

@Injectable()
export class TimeseriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Run totalPnl from AgentExperience (same source as /runs and settlement). */
  private async getRunTotalPnl(runId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<PnlRow[]>`
      SELECT COALESCE(SUM(pnl)::float, 0) AS "totalPnl"
      FROM "AgentExperience"
      WHERE "runId" = ${runId}::uuid
    `;
    return rows[0] ? Number(rows[0].totalPnl) : 0;
  }

  /**
   * Ensure run timeseries exists. If missing, generate linear curve and insert.
   * Linear: value(step) = (step / N) * totalPnl for steps 0..N.
   * Idempotent via upsert.
   */
  async ensureRunTimeseries(runId: string): Promise<void> {
    const existing = await this.prisma.runTimeSeries.findFirst({
      where: { runId },
      select: { id: true },
    });
    if (existing) return;

    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true, _count: { select: { crowdSnapshots: true } } },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);

    const steps = run._count.crowdSnapshots;
    if (steps < 1) throw new NotFoundException(`Run ${runId} has no steps`);

    const totalPnl = await this.getRunTotalPnl(runId);

    const points = Array.from({ length: steps + 1 }, (_, step) => ({
      runId,
      step,
      value: (step / steps) * totalPnl,
    }));

    await this.prisma.runTimeSeries.createMany({
      data: points.map((p) => ({ runId: p.runId, step: p.step, value: p.value })),
      skipDuplicates: true,
    });
  }

  /** Get timeseries for a run. Auto-generates if missing. */
  async getTimeseries(runId: string): Promise<{
    runId: string;
    steps: number;
    points: { step: number; value: number }[];
  }> {
    await this.ensureRunTimeseries(runId);

    const points = await this.prisma.runTimeSeries.findMany({
      where: { runId },
      select: { step: true, value: true },
      orderBy: { step: "asc" },
    });

    const steps = points.length > 0 ? Math.max(...points.map((p) => p.step)) : 0;
    return {
      runId,
      steps,
      points: points.map((p) => ({ step: p.step, value: Number(p.value) })),
    };
  }

  /** Value at step (same market truth as settlement). Interpolates between steps. */
  async getValueAtStep(runId: string, step: number): Promise<number> {
    const { points, steps: lastStep } = await this.getTimeseries(runId);
    const valueByStep = new Map(points.map((p) => [p.step, p.value]));
    const v = valueByStep.get(step);
    if (v != null) return v;
    if (step <= 0) return valueByStep.get(0) ?? 0;
    if (step >= lastStep) return valueByStep.get(lastStep) ?? 0;
    const lo = Math.floor(step);
    const hi = Math.ceil(step);
    const vLo = valueByStep.get(lo) ?? 0;
    const vHi = valueByStep.get(hi) ?? vLo;
    return vLo + ((step - lo) / (hi - lo || 1)) * (vHi - vLo);
  }
}
