import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Raw aggregation row from AgentExperience GROUP BY. */
type AggRow = { runId: string; agentCount: bigint; totalSteps: bigint; totalPnl: number };

/** Metrics returned for each run in the list. */
type RunListMetrics = { totalPnl: number; agentCount: number; totalSteps: number };

/** Run row from findAll findMany select. */
type RunsListRunRow = {
  id: string;
  name: string;
  status: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  seed: number;
  modelVersion: string;
  datasetVersion: string;
  schemaVersion: string;
};

@Injectable()
export class RunsService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /runs — lightweight list (no configJson). Each item includes metrics and warningsCount. */
  async findAll(
    limit: number,
    offset: number,
  ): Promise<{
    items: Array<{
      runId: string;
      name: string;
      status: string;
      startedAt: string | null;
      finishedAt: string | null;
      seed: number;
      modelVersion: string;
      datasetVersion: string;
      schemaVersion: string;
      metrics: { totalPnl: number; agentCount: number; totalSteps: number };
      warningsCount: number;
    }>;
    total: number;
  }> {
    const [runs, total, aggRows] = await Promise.all([
      this.prisma.simulationRun.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          seed: true,
          modelVersion: true,
          datasetVersion: true,
          schemaVersion: true,
        },
      }),
      this.prisma.simulationRun.count(),
      this.prisma.$queryRaw<
        { runId: string; agentCount: bigint; totalSteps: bigint; totalPnl: number }[]
      >`
        SELECT "runId",
          COUNT(DISTINCT "agentId")::bigint AS "agentCount",
          COUNT(*)::bigint AS "totalSteps",
          COALESCE(SUM(pnl)::float, 0) AS "totalPnl"
        FROM "AgentExperience"
        GROUP BY "runId"
      `,
    ]);
    const aggByRun = new Map<string, RunListMetrics>(
      aggRows.map((r: AggRow) => [
        r.runId,
        {
          agentCount: Number(r.agentCount),
          totalSteps: Number(r.totalSteps),
          totalPnl: Number(r.totalPnl),
        },
      ]),
    );
    const items = runs.map((r: RunsListRunRow) => {
      const m: RunListMetrics = aggByRun.get(r.id) ?? { agentCount: 0, totalSteps: 0, totalPnl: 0 };
      return {
        runId: r.id,
        name: r.name,
        status: r.status,
        startedAt: r.startedAt?.toISOString() ?? null,
        finishedAt: r.finishedAt?.toISOString() ?? null,
        seed: r.seed,
        modelVersion: r.modelVersion,
        datasetVersion: r.datasetVersion,
        schemaVersion: r.schemaVersion,
        metrics: {
          totalPnl: m.totalPnl,
          agentCount: m.agentCount,
          totalSteps: m.totalSteps,
        },
        warningsCount: 0,
      };
    });
    return { items, total };
  }
}
