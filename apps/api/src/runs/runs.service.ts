import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RunSummaryResponse } from "./run-summary.types";

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

const MODEL_VERSION = "stage1";
const SCHEMA_VERSION = "v1";

@Injectable()
export class RunsService {
  constructor(private readonly prisma: PrismaService) {}

  /** POST /runs — create a new SimulationRun. Returns { id }. Used by smoke tests for deterministic runs. */
  async createRun(name?: string): Promise<{ id: string }> {
    const latest = await this.prisma.simulationRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: { datasetVersion: true },
    });
    const importRun = await this.prisma.importRun.findFirst({
      where: { type: "archetypes" },
      orderBy: { startedAt: "desc" },
      select: { sourceHash: true },
    });
    const datasetVersion = latest?.datasetVersion ?? importRun?.sourceHash ?? "default";
    const runName =
      (name ?? "").trim() || `spy-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const run = await this.prisma.simulationRun.create({
      data: {
        name: runName,
        status: "PENDING",
        seed: Math.floor(Math.random() * 0x7fffffff),
        modelVersion: MODEL_VERSION,
        datasetVersion,
        schemaVersion: SCHEMA_VERSION,
        startedAt: new Date(),
      },
    });
    return { id: run.id };
  }

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

  /** GET /runs/:runId/summary?assetSymbol= — read-only snapshot for run+asset (latest variant). Returns 404 if run not found. */
  async getRunSummary(runId: string, assetSymbol: string): Promise<RunSummaryResponse> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true, createdAt: true, updatedAt: true },
    });
    if (!run) throw new NotFoundException("Run not found");

    const sym = assetSymbol.trim();

    const latestVariant = await this.prisma.runVariant.findFirst({
      where: { runId, assetSymbol: sym },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const variantFilter = latestVariant?.id ?? null;

    const [
      agentStateGroups,
      assetStepReturnAgg,
      agentStateRows,
      rewardsRows,
      crowdMetricsRows,
      assetStepReturnRows,
      latestCrowd,
      latestBacktest,
    ] = await Promise.all([
      this.prisma.agentState.groupBy({
        by: ["agentId"],
        where: { runId, assetSymbol: sym, ...(variantFilter ? { runVariantId: variantFilter } : {}) },
      }),
      this.prisma.assetStepReturn.aggregate({
        where: { runId, assetSymbol: sym },
        _max: { step: true },
      }),
      this.prisma.agentState.count({
        where: { runId, assetSymbol: sym, ...(variantFilter ? { runVariantId: variantFilter } : {}) },
      }),
      this.prisma.agentReward.count({
        where: { runId, assetSymbol: sym, ...(variantFilter ? { runVariantId: variantFilter } : {}) },
      }),
      this.prisma.crowdMetrics.count({
        where: { runId, assetSymbol: sym, ...(variantFilter ? { runVariantId: variantFilter } : {}) },
      }),
      this.prisma.assetStepReturn.count({ where: { runId, assetSymbol: sym } }),
      this.prisma.crowdMetrics.findFirst({
        where: { runId, assetSymbol: sym, ...(variantFilter ? { runVariantId: variantFilter } : {}) },
        orderBy: { step: "desc" },
        select: {
          step: true,
          wisdomScore: true,
          herdingIndex: true,
          noiseSensitivity: true,
          diversityIndex: true,
          independenceIndex: true,
        },
      }),
      this.prisma.backtestResult.findFirst({
        where: { runId, assetSymbol: sym, ...(variantFilter ? { runVariantId: variantFilter } : {}) },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          seed: true,
          steps: true,
          agents: true,
          pairsCount: true,
          corr: true,
          directionalAccuracy: true,
        },
      }),
    ]);

    const maxStep = assetStepReturnAgg._max.step ?? null;
    const steps = maxStep !== null ? maxStep + 1 : 0;

    const latestStep = latestCrowd?.step ?? null;
    const crowd =
      latestCrowd != null
        ? {
            wisdomScore: latestCrowd.wisdomScore ?? null,
            herdingIndex: latestCrowd.herdingIndex ?? null,
            noiseSensitivity: latestCrowd.noiseSensitivity ?? null,
            diversityIndex: latestCrowd.diversityIndex ?? null,
            independenceIndex: latestCrowd.independenceIndex ?? null,
            decisionHistogram: null as { BUY: number; SELL: number; HOLD: number; OTHER: number } | null,
          }
        : null;

    const backtest =
      latestBacktest != null
        ? {
            id: latestBacktest.id,
            createdAt: latestBacktest.createdAt.toISOString(),
            seed: latestBacktest.seed,
            steps: latestBacktest.steps,
            agents: latestBacktest.agents,
            pairsCount: latestBacktest.pairsCount,
            corr: latestBacktest.corr,
            directionalAccuracy: latestBacktest.directionalAccuracy,
          }
        : null;

    return {
      run: {
        id: run.id,
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
      },
      asset: { symbol: sym },
      counts: {
        agents: agentStateGroups.length,
        steps,
        agentStateRows,
        rewardsRows,
        crowdMetricsRows,
        assetStepReturnRows,
      },
      latest: {
        step: latestStep,
        crowd,
        backtest,
      },
      health: {
        marketDataPresent: assetStepReturnRows > 0,
        learningPresent: agentStateRows > 0,
        rewardsPresent: rewardsRows > 0,
        crowdMetricsPresent: crowdMetricsRows > 0,
        backtestPresent: latestBacktest != null,
      },
    };
  }

  /** GET /runs/:runId/variants — list RunVariants for run with optional filters; returns { items, total }. */
  async getVariantsForRun(
    runId: string,
    opts: {
      assetSymbol?: string;
      label?: string;
      limit: number;
      offset: number;
    },
  ): Promise<{
    items: Array<{
      id: string;
      runId: string;
      assetSymbol: string;
      seed: number;
      agents: number;
      steps: number;
      label: string | null;
      createdAt: string;
      summary: {
        corr: number | null;
        directionalAccuracy: number | null;
        pairsCount: number | null;
        createdAt: string;
      } | null;
    }>;
    total: number;
  }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException("Run not found");

    const where: { runId: string; assetSymbol?: string; label?: string } = { runId };
    if (opts.assetSymbol != null && opts.assetSymbol !== "") {
      where.assetSymbol = opts.assetSymbol;
    }
    if (opts.label != null && opts.label !== "") {
      where.label = opts.label;
    }

    const [variants, total] = await Promise.all([
      this.prisma.runVariant.findMany({
        where,
        take: opts.limit,
        skip: opts.offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          runId: true,
          assetSymbol: true,
          seed: true,
          agents: true,
          steps: true,
          label: true,
          createdAt: true,
          summary: {
            select: {
              corr: true,
              directionalAccuracy: true,
              pairsCount: true,
              computedAt: true,
              debugDecisionCounts: true,
              debugPairsSample: true,
              debugDecisionsHash: true,
              debugReturnsHash: true,
            },
          },
        },
      }),
      this.prisma.runVariant.count({ where }),
    ]);

    return {
      items: variants.map((v) => ({
        id: v.id,
        runId: v.runId,
        assetSymbol: v.assetSymbol,
        seed: v.seed,
        agents: v.agents,
        steps: v.steps,
        label: v.label,
        createdAt: v.createdAt.toISOString(),
        summary:
          v.summary != null
            ? {
                corr: v.summary.corr,
                directionalAccuracy: v.summary.directionalAccuracy,
                pairsCount: v.summary.pairsCount,
                createdAt: v.summary.computedAt.toISOString(),
                debug:
                  v.summary.debugDecisionsHash != null
                    ? {
                        decisionCounts: v.summary.debugDecisionCounts,
                        pairsSample: v.summary.debugPairsSample,
                        decisionsHash: v.summary.debugDecisionsHash,
                        returnsHash: v.summary.debugReturnsHash,
                      }
                    : undefined,
              }
            : null,
      })),
      total,
    };
  }

  /** GET /variants/:variantId/summary — one variant's RunVariant + BacktestResult. */
  async getVariantSummary(variantId: string): Promise<{
    variant: {
      id: string;
      runId: string;
      assetSymbol: string;
      seed: number;
      agents: number;
      steps: number;
      label: string | null;
      createdAt: string;
    };
    summary: {
      pairsCount: number | null;
      corr: number | null;
      directionalAccuracy: number | null;
      createdAt: string | null;
    } | null;
  }> {
    const variant = await this.prisma.runVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        runId: true,
        assetSymbol: true,
        seed: true,
        agents: true,
        steps: true,
        label: true,
        createdAt: true,
      },
    });
    if (!variant) throw new NotFoundException("Variant not found");

    const backtest = await this.prisma.backtestResult.findFirst({
      where: { runVariantId: variantId },
      orderBy: { createdAt: "desc" },
      select: {
        pairsCount: true,
        corr: true,
        directionalAccuracy: true,
        createdAt: true,
      },
    });
    return {
      variant: {
        id: variant.id,
        runId: variant.runId,
        assetSymbol: variant.assetSymbol,
        seed: variant.seed,
        agents: variant.agents,
        steps: variant.steps,
        label: variant.label,
        createdAt: variant.createdAt.toISOString(),
      },
      summary: backtest
        ? {
            pairsCount: backtest.pairsCount,
            corr: backtest.corr,
            directionalAccuracy: backtest.directionalAccuracy,
            createdAt: backtest.createdAt.toISOString(),
          }
        : null,
    };
  }
}
