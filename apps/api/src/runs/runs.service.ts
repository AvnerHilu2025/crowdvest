import * as fs from "fs";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { setRunStatus } from "@crowdvest/db";
import { PrismaService } from "../prisma/prisma.service";
import type { RunSummaryResponse } from "./run-summary.types";
import { getDefaultSpyCsvPath } from "../common/default-dataset";
import { SPY29_DATASET_VERSION, SPY29_STEP_RETURNS } from "../common/spy29-returns";

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
  createdAt: Date;
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
    try {
      const run = await this.prisma.simulationRun.create({
      data: {
        name: runName,
        status: "PENDING",
        seed: Math.floor(Math.random() * 0x7fffffff),
        modelVersion: MODEL_VERSION,
        datasetVersion,
        schemaVersion: SCHEMA_VERSION,
      },
      });
      return { id: run.id };
    } catch (e) {
      if (e && typeof e === "object" && (e as { code?: string }).code === "P2002") {
        throw new ConflictException(
          `Run with name="${runName}" and datasetVersion="${datasetVersion}" already exists`,
        );
      }
      throw e;
    }
  }

  /** Import price data into AssetStepReturn for a run. Uses default SPY CSV when source=default. */
  async importRunPriceData(
    runId: string,
    assetSymbol: string,
    steps: number,
    source: string,
  ): Promise<{ ok: boolean; inserted: number }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException("Run not found");

    const csvPath = source === "default" ? getDefaultSpyCsvPath() : source;
    if (!fs.existsSync(csvPath)) throw new NotFoundException(`CSV not found: ${csvPath}`);

    const content = fs.readFileSync(csvPath, "utf8");
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new NotFoundException("CSV has no data rows");
    const headers = lines[0]!.split(",").map((h) => h.trim());
    const dateIdx = headers.indexOf("date");
    const priceIdx = headers.indexOf("close");
    if (dateIdx === -1 || priceIdx === -1) {
      throw new NotFoundException("CSV must have date and close columns");
    }

    const rows: { date: string; price: number }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]!.split(",").map((c) => c.trim());
      const date = cols[dateIdx];
      const price = parseFloat(cols[priceIdx] ?? "");
      if (date && Number.isFinite(price)) rows.push({ date, price });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    if (rows.length === 0) throw new NotFoundException("No valid date/price rows");

    const stepReturns: number[] = [0];
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]!.price;
      const curr = rows[i]!.price;
      stepReturns.push(prev === 0 ? 0 : (curr - prev) / prev);
    }
    const stepsToUpsert = Math.min(stepReturns.length, steps);
    if (stepsToUpsert < steps) {
      throw new NotFoundException(
        `CSV has only ${stepReturns.length} step returns; requested ${steps}. Use fewer steps.`,
      );
    }

    for (let step = 0; step < stepsToUpsert; step++) {
      await this.prisma.assetStepReturn.upsert({
        where: { runId_assetSymbol_step: { runId, assetSymbol, step } },
        create: { runId, assetSymbol, step, stepReturn: stepReturns[step]! },
        update: { stepReturn: stepReturns[step]! },
      });
    }
    return { ok: true, inserted: stepsToUpsert };
  }

  /** POST /runs/import/spy29 — create exactly 29 AssetStepReturn rows for SPY. Idempotent: returns already:true if rows exist. */
  async importSpy29(runId: string): Promise<{ ok: boolean; already?: boolean; count: number }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException("Run not found");

    const existing = await this.prisma.assetStepReturn.count({
      where: { runId, assetSymbol: "SPY" },
    });
    if (existing >= 29) {
      return { ok: true, already: true, count: 29 };
    }

    const data = SPY29_STEP_RETURNS.map((stepReturn, step) => ({
      runId,
      assetSymbol: "SPY",
      step,
      stepReturn,
    }));
    await this.prisma.assetStepReturn.createMany({
      data,
      skipDuplicates: true,
    });
    return { ok: true, count: 29 };
  }

  /** POST /runs/import/spy29 (no body) — create run with spy29 dataset, import, return { runId, ok, count, ... }. */
  async importSpy29OrCreate(runId?: string): Promise<{ runId: string; ok: boolean; already?: boolean; count: number }> {
    let targetRunId = runId?.trim() ?? "";
    if (!targetRunId) {
      const run = await this.prisma.simulationRun.create({
        data: {
          name: `spy29-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          status: "PENDING",
          seed: Math.floor(Math.random() * 0x7fffffff),
          modelVersion: MODEL_VERSION,
          datasetVersion: SPY29_DATASET_VERSION,
          schemaVersion: SCHEMA_VERSION,
        },
      });
      targetRunId = run.id;
    }
    const result = await this.importSpy29(targetRunId);
    return { runId: targetRunId, ...result };
  }

  /** POST /runs/create-unique — create run with unique name for lifecycle tests. */
  async createRunUnique(opts: {
    baseName?: string;
    seed?: number;
    modelVersion?: string;
    datasetVersion?: string;
    schemaVersion?: string;
  }): Promise<{ id: string; runId: string; name: string; datasetVersion: string }> {
    const latest = await this.prisma.simulationRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: { datasetVersion: true },
    });
    const importRun = await this.prisma.importRun.findFirst({
      where: { type: "archetypes" },
      orderBy: { startedAt: "desc" },
      select: { sourceHash: true },
    });
    const datasetVersion =
      opts.datasetVersion ?? latest?.datasetVersion ?? importRun?.sourceHash ?? "default";
    const baseName = (opts.baseName ?? "lifecycle").trim() || "lifecycle";
    const suffix = Math.random().toString(36).slice(2, 9);
    const name = `${baseName}-${Date.now()}-${suffix}`;

    const run = await this.prisma.simulationRun.create({
      data: {
        name,
        status: "PENDING",
        seed: opts.seed ?? Math.floor(Math.random() * 0x7fffffff),
        modelVersion: opts.modelVersion ?? MODEL_VERSION,
        datasetVersion,
        schemaVersion: opts.schemaVersion ?? SCHEMA_VERSION,
      },
    });
    return {
      id: run.id,
      runId: run.id,
      name: run.name,
      datasetVersion: run.datasetVersion,
    };
  }

  /** POST /runs/:id/retry — reset FAILED run to PENDING and enqueue. Only allowed when status == FAILED. */
  async retryRun(runId: string): Promise<{ ok: true; runId: string }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true, status: true },
    });
    if (!run) throw new NotFoundException("Run not found");
    if (run.status !== "FAILED") {
      throw new BadRequestException(`Retry not allowed: run status is ${run.status}, expected FAILED`);
    }
    await this.prisma.simulationRun.update({
      where: { id: runId },
      data: {
        status: "PENDING",
        failedAt: null,
        lastError: null,
        completedAt: null,
      },
    });
    return { ok: true, runId };
  }

  /** PATCH /runs/:runId/status — update run status. Only updates if current status is PENDING or RUNNING; never overwrites FAILED. */
  async updateRunStatus(runId: string, status: "COMPLETED" | "FAILED"): Promise<{ id: string; status: string; finishedAt: string | null }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true, status: true },
    });
    if (!run) throw new NotFoundException("Run not found");
    if (run.status === "FAILED") {
      return { id: runId, status: "FAILED", finishedAt: null };
    }
    const result = await setRunStatus(this.prisma, runId, status);
    if (result.count === 0) {
      return { id: runId, status: run.status, finishedAt: null };
    }
    // Backward compat: map finishedAt from completedAt (completedAt is always set for COMPLETED)
    const completedAt = result.run?.completedAt ?? result.run?.failedAt;
    return { id: runId, status, finishedAt: completedAt?.toISOString() ?? null };
  }

  /** GET /runs — lightweight list (no configJson). Each item includes metrics and warningsCount. */
  async findAll(
    limit: number,
    offset: number,
  ): Promise<{
    items: Array<{
      id: string;
      runId: string;
      name: string;
      status: string;
      createdAt: string;
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
    const [runs, total] = await Promise.all([
      this.prisma.simulationRun.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          startedAt: true,
          finishedAt: true,
          seed: true,
          modelVersion: true,
          datasetVersion: true,
          schemaVersion: true,
        },
      }),
      this.prisma.simulationRun.count(),
    ]);

    let aggByRun = new Map<string, RunListMetrics>();
    try {
      const aggRows = await this.prisma.$queryRaw<
        { runId: string; agentCount: bigint; totalSteps: bigint; totalPnl: number }[]
      >`
        SELECT "runId",
          COUNT(DISTINCT "runAgentId")::bigint AS "agentCount",
          COUNT(*)::bigint AS "totalSteps",
          COALESCE(SUM(pnl)::float, 0) AS "totalPnl"
        FROM "AgentExperience"
        GROUP BY "runId"
      `;
      aggByRun = new Map(
        aggRows.map((r: AggRow) => [
          r.runId,
          {
            agentCount: Number(r.agentCount),
            totalSteps: Number(r.totalSteps),
            totalPnl: Number(r.totalPnl),
          },
        ]),
      );
    } catch (e) {
      console.error(
        "[GET /runs] AgentExperience aggregation failed, using empty metrics:",
        e instanceof Error ? e.message : String(e),
        (e instanceof Error && e.stack) || "",
      );
    }

    const items = runs.map((r: RunsListRunRow) => {
      const m: RunListMetrics = aggByRun.get(r.id) ?? { agentCount: 0, totalSteps: 0, totalPnl: 0 };
      return {
        id: r.id,
        runId: r.id,
        name: r.name,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
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
        // Stored hashes for determinism validation (always included)
        decisionsHash: v.summary?.debugDecisionsHash ?? null,
        returnsHash: v.summary?.debugReturnsHash ?? null,
        summary:
          v.summary != null
            ? {
                corr: v.summary.corr,
                directionalAccuracy: v.summary.directionalAccuracy,
                pairsCount: v.summary.pairsCount,
                createdAt: v.summary.computedAt.toISOString(),
                // Deterministic debug fingerprints (seed isolation validation)
                decisionsHash: v.summary.debugDecisionsHash,
                returnsHash: v.summary.debugReturnsHash,
                decisionCounts: v.summary.debugDecisionCounts ?? undefined,
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
