import { Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import {
  computeValidationMetrics,
  type SimulationRunResult,
  type AgentResult,
  type RunAggregate,
  type ArchetypeAggregate,
  type AggregateMetrics,
  type ValidationMetrics,
} from "@crowdvest/shared";
import {
  normalizeRunPayload,
  type NormalizedRunPayload,
} from "../common/normalize-run-payload";

const STATUS_MAP: Record<string, number> = {
  PENDING: 0,
  RUNNING: 1,
  COMPLETED: 2,
  FAILED: 3,
};

function configHash(seed: number, modelVersion: string, datasetVersion: string, schemaVersion: string): string {
  const payload = JSON.stringify({ seed, modelVersion, datasetVersion, schemaVersion });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

function statusToCode(status: string): number {
  return STATUS_MAP[status] ?? 0;
}

/** Shape of run row from getRuns / getRunById select. */
type ResultsRunRow = {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  seed: number;
  modelVersion: string;
  datasetVersion: string;
  schemaVersion: string;
  _count: { crowdSnapshots: number };
};

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /results/runs — list runs (Results Data Model shape). */
  async getRuns(limit: number, offset: number): Promise<{ items: SimulationRunResult[]; total: number }> {
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
          seed: true,
          modelVersion: true,
          datasetVersion: true,
          schemaVersion: true,
          _count: { select: { crowdSnapshots: true } },
        },
      }),
      this.prisma.simulationRun.count(),
    ]);

    const items: SimulationRunResult[] = runs.map((r: ResultsRunRow) => ({
      id: r.id,
      timestamp: r.createdAt.getTime(),
      configHash: configHash(r.seed, r.modelVersion, r.datasetVersion, r.schemaVersion),
      name: r.name,
      status: statusToCode(r.status),
      steps: r._count.crowdSnapshots,
    }));

    return { items, total };
  }

  /** GET /results/runs/:id — one run by id. */
  async getRunById(id: string): Promise<SimulationRunResult> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        seed: true,
        modelVersion: true,
        datasetVersion: true,
        schemaVersion: true,
        _count: { select: { crowdSnapshots: true } },
      },
    });
    if (!run) throw new NotFoundException(`Run not found: ${id}`);
    return {
      id: run.id,
      timestamp: run.createdAt.getTime(),
      configHash: configHash(run.seed, run.modelVersion, run.datasetVersion, run.schemaVersion),
      name: run.name,
      status: statusToCode(run.status),
      steps: run._count.crowdSnapshots,
    };
  }

  /** GET /results/agents?run_id= — per-agent rolled-up results for a run. Returns { items, total }. */
  async getAgents(runId: string): Promise<{ items: AgentResult[]; total: number }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);

    const experiences = await this.prisma.agentExperience.findMany({
      where: { runId },
      select: {
        agentId: true,
        pnl: true,
        drawdown: true,
        reward: true,
        actionJson: true,
        agent: { select: { archetypeId: true } },
      },
      orderBy: [{ agentId: "asc" }, { step: "asc" }],
    });

    type Acc = {
      archetypeId: string;
      steps: number;
      pnl: number;
      risk: number;
      totalReward: number;
      buy: number;
      sell: number;
      hold: number;
    };
    const byAgent = new Map<string, Acc>();

    for (const e of experiences) {
      const archetypeId = e.agent?.archetypeId ?? "";
      const action = (e.actionJson as { action?: string } | null)?.action ?? "hold";
      if (!byAgent.has(e.agentId)) {
        byAgent.set(e.agentId, {
          archetypeId,
          steps: 0,
          pnl: 0,
          risk: 0,
          totalReward: 0,
          buy: 0,
          sell: 0,
          hold: 0,
        });
      }
      const a = byAgent.get(e.agentId)!;
      a.steps += 1;
      a.pnl += e.pnl ?? 0;
      a.risk = Math.max(a.risk, e.drawdown ?? 0);
      a.totalReward += e.reward ?? 0;
      if (action === "buy") a.buy += 1;
      else if (action === "sell") a.sell += 1;
      else a.hold += 1;
    }

    const results: AgentResult[] = [];
    for (const [agentId, a] of byAgent) {
      results.push({
        agentId,
        archetypeId: a.archetypeId,
        runId,
        steps: a.steps,
        durationMs: 0,
        pnl: a.pnl,
        risk: a.risk,
        totalReward: a.totalReward,
        actionCounts: { buy: a.buy, sell: a.sell, hold: a.hold },
      });
    }
    results.sort((x, y) => x.agentId.localeCompare(y.agentId));
    return { items: results, total: results.length };
  }

  /** GET /results/summary?run_id= — run-level + by-archetype aggregates + validation metrics. */
  async getSummary(runId: string): Promise<{
    run: RunAggregate;
    byArchetype: ArchetypeAggregate[];
    validation: ValidationMetrics;
  }> {
    const { items: agents } = await this.getAgents(runId);
    if (agents.length === 0) {
      const runAgg: RunAggregate = {
        scope: 1,
        runId,
        metrics: {
          agentCount: 0,
          totalPnl: 0,
          avgPnl: 0,
          avgRisk: 0,
          totalSteps: 0,
          avgStepsPerAgent: 0,
          totalBuy: 0,
          totalSell: 0,
          totalHold: 0,
          totalReward: 0,
          avgReward: 0,
        },
      };
      const validation = computeValidationMetrics([]);
      return { run: runAgg, byArchetype: [], validation };
    }

    const runMetrics = this.aggregateMetrics(agents);
    const run: RunAggregate = {
      scope: 1,
      runId,
      metrics: runMetrics,
    };

    const byArchetypeMap = new Map<string, AgentResult[]>();
    for (const a of agents) {
      if (!byArchetypeMap.has(a.archetypeId)) byArchetypeMap.set(a.archetypeId, []);
      byArchetypeMap.get(a.archetypeId)!.push(a);
    }

    const byArchetype: ArchetypeAggregate[] = [];
    for (const [archetypeId, list] of byArchetypeMap) {
      byArchetype.push({
        scope: 2,
        archetypeId,
        runId,
        metrics: this.aggregateMetrics(list),
      });
    }
    byArchetype.sort((a, b) => a.archetypeId.localeCompare(b.archetypeId));

    const validation = computeValidationMetrics(
      agents.map((a) => ({ pnl: a.pnl, risk: a.risk, archetypeId: a.archetypeId })),
    );

    return { run, byArchetype, validation };
  }

  /** Threshold for RISK_TOO_LOW warning (configurable via env). */
  private static readonly RISK_TOO_LOW_THRESHOLD =
    typeof process !== "undefined" && process.env.RESULTS_RISK_TOO_LOW_THRESHOLD != null
      ? Number(process.env.RESULTS_RISK_TOO_LOW_THRESHOLD)
      : 1e-8;

  /** GET /results/summary-compact?run_id= — compact post-run verification payload + warnings. */
  async getSummaryCompact(runId: string): Promise<{
    runId: string;
    metrics: {
      agentCount: number;
      totalPnl: number;
      avgPnl: number;
      avgRisk: number;
      totalSteps: number;
      avgStepsPerAgent: number;
      totalBuy: number;
      totalSell: number;
      totalHold: number;
      totalReward: number;
      avgReward: number;
      tradeRate: number;
      holdRate: number;
      buyRate: number;
      sellRate: number;
    };
    validation: {
      totalPnlSum: number;
      pctProfitableAgents: number;
      archetypeDispersion: number;
    };
    archetypeTotals: { agentCountSum: number; totalPnlSum: number };
    debug: {
      decisionHistogram?: { BUY: number; SELL: number; HOLD: number; OTHER: number } | null;
      sampleDecisions?: { agentId: string; step: number; action: string }[] | null;
      prePersistHistogram: { BUY: number; SELL: number; HOLD: number; OTHER: number } | null;
      persistedHistogram: { BUY: number; SELL: number; HOLD: number; OTHER: number };
      actionHistogram: { BUY: number; SELL: number; HOLD: number; OTHER: number };
      samplePrePersistActions: { agentId: string; step: number; action: string }[] | null;
      sampleActions: { agentId: string; step: number; action: string }[];
      mappingNotes?: string;
    };
    warnings: string[];
  }> {
    const [summaryResult, rawExperiences, simulationRun, runDebugResult] = await Promise.all([
      this.getSummary(runId),
      this.prisma.agentExperience.findMany({
        where: { runId },
        select: { agentId: true, step: true, actionJson: true },
        orderBy: [{ step: "asc" }, { agentId: "asc" }],
      }),
      this.prisma.simulationRun.findUnique({
        where: { id: runId },
        select: { configJson: true },
      }),
      this.prisma
        .$queryRaw<
          { prePersistHistogram: unknown; samplePrePersistActions: unknown }[]
        >`SELECT "prePersistHistogram", "samplePrePersistActions" FROM "RunDebug" WHERE "runId" = ${runId}::uuid LIMIT 1`
        .catch(() => []),
    ]);
    const runDebug = Array.isArray(runDebugResult) && runDebugResult[0] ? runDebugResult[0] : null;
    const { run, byArchetype, validation } = summaryResult;
    const agentCountSum = byArchetype.reduce((s, a) => s + a.metrics.agentCount, 0);
    const totalPnlSum = byArchetype.reduce((s, a) => s + a.metrics.totalPnl, 0);

    const persistedHistogram = { BUY: 0, SELL: 0, HOLD: 0, OTHER: 0 };
    const sampleActions: { agentId: string; step: number; action: string }[] = [];
    for (let i = 0; i < rawExperiences.length; i++) {
      const e = rawExperiences[i];
      const action =
        (e.actionJson as { action?: string } | null)?.action?.toLowerCase() ?? "hold";
      const key =
        action === "buy" ? "BUY" : action === "sell" ? "SELL" : action === "hold" ? "HOLD" : "OTHER";
      persistedHistogram[key]++;
      if (sampleActions.length < 10) {
        sampleActions.push({ agentId: e.agentId, step: e.step, action: key });
      }
    }

    const config = (simulationRun?.configJson as Record<string, unknown> | null) ?? {};
    const rawDecision = config.decisionHistogram as { BUY?: number; SELL?: number; HOLD?: number; OTHER?: number } | undefined;
    const decisionHistogram = rawDecision
      ? {
          BUY: rawDecision.BUY ?? 0,
          SELL: rawDecision.SELL ?? 0,
          HOLD: rawDecision.HOLD ?? 0,
          OTHER: rawDecision.OTHER ?? 0,
        }
      : undefined;
    const sampleDecisions = config.sampleDecisions as { agentId: string; step: number; action: string }[] | undefined;

    const rawPrePersist = runDebug?.prePersistHistogram as
      | { BUY?: number; SELL?: number; HOLD?: number; OTHER?: number }
      | null
      | undefined;
    const prePersistHistogram =
      rawPrePersist != null
        ? {
            BUY: rawPrePersist.BUY ?? 0,
            SELL: rawPrePersist.SELL ?? 0,
            HOLD: rawPrePersist.HOLD ?? 0,
            OTHER: rawPrePersist.OTHER ?? 0,
          }
        : null;
    const samplePrePersistActions =
      runDebug != null
        ? (runDebug.samplePrePersistActions as { agentId: string; step: number; action: string }[] | null) ?? []
        : null;
    let mappingNotes: string | undefined;
    if (
      prePersistHistogram != null &&
      (persistedHistogram.SELL !== prePersistHistogram.SELL ||
        persistedHistogram.BUY !== prePersistHistogram.BUY ||
        persistedHistogram.HOLD !== prePersistHistogram.HOLD)
    ) {
      mappingNotes = "prePersistHistogram differs from persistedHistogram; possible mapper loss";
    }
    const m = run.metrics;
    const warnings: string[] = [];
    if (m.totalSell === 0) warnings.push("NO_SELL_ACTIONS");
    if (m.totalSteps > 0) {
      const tradeRate = (m.totalBuy + m.totalSell) / m.totalSteps;
      if (tradeRate < 0.05) warnings.push("LOW_TRADE_RATE");
      if (m.totalHold / m.totalSteps > 0.9) warnings.push("HIGH_HOLD_RATIO");
    }
    if (validation.pctProfitableAgents === 0) warnings.push("ALL_AGENTS_LOSING");
    if (m.avgRisk < ResultsService.RISK_TOO_LOW_THRESHOLD) warnings.push("RISK_TOO_LOW");
    if (m.totalBuy + m.totalSell === 0) warnings.push("NO_TRADES");
    if (m.totalSell === 0 && m.totalBuy > 0 && m.totalSteps > 0 && m.totalBuy / m.totalSteps > 0.9) warnings.push("EXTREME_BUY_BIAS");
    if (Math.abs(m.totalPnl) < 1e-6) warnings.push("VERY_LOW_PNL_MAGNITUDE");

    const totalSteps = Math.max(0, Number(m.totalSteps) || 0);
    const totalBuy = Number(m.totalBuy) || 0;
    const totalSell = Number(m.totalSell) || 0;
    const totalHold = Number(m.totalHold) || 0;
    let tradeRate = 0;
    let holdRate = 0;
    let buyRate = 0;
    let sellRate = 0;
    if (totalSteps > 0) {
      tradeRate = (totalBuy + totalSell) / totalSteps;
      holdRate = totalHold / totalSteps;
      buyRate = totalBuy / totalSteps;
      sellRate = totalSell / totalSteps;
    }

    return {
      runId,
      metrics: {
        agentCount: m.agentCount,
        totalPnl: m.totalPnl,
        avgPnl: m.avgPnl,
        avgRisk: m.avgRisk,
        totalSteps: m.totalSteps,
        avgStepsPerAgent: m.avgStepsPerAgent,
        totalBuy: m.totalBuy,
        totalSell: m.totalSell,
        totalHold: m.totalHold,
        totalReward: m.totalReward,
        avgReward: m.avgReward,
        tradeRate,
        holdRate,
        buyRate,
        sellRate,
      },
      validation: {
        totalPnlSum: validation.totalPnlSum,
        pctProfitableAgents: validation.pctProfitableAgents,
        archetypeDispersion: validation.archetypeDispersion,
      },
      archetypeTotals: { agentCountSum, totalPnlSum },
      debug: {
        ...(decisionHistogram ? { decisionHistogram } : {}),
        ...(sampleDecisions ? { sampleDecisions } : {}),
        prePersistHistogram: prePersistHistogram ?? null,
        persistedHistogram,
        actionHistogram: persistedHistogram,
        samplePrePersistActions: samplePrePersistActions ?? null,
        sampleActions,
        ...(mappingNotes ? { mappingNotes } : {}),
      },
      warnings,
    };
  }

  /** GET /runs/latest and GET /runs/:id — normalized payload (prePersistHistogram and persistedHistogram never null). */
  async getRunPayload(runId: string, includeDebug = false): Promise<NormalizedRunPayload & { debug?: { decisionHistogram: unknown; sampleDecisions: unknown[] } }> {
    const [compact, runMeta] = await Promise.all([
      this.getSummaryCompact(runId),
      this.getRunMetadata(runId),
    ]);
    const payload = normalizeRunPayload(
      compact as Parameters<typeof normalizeRunPayload>[0],
      runMeta as Parameters<typeof normalizeRunPayload>[1],
    );
    if (!includeDebug) return payload;
    const d = (compact as { debug?: { decisionHistogram?: unknown; sampleDecisions?: unknown[] } }).debug;
    return {
      ...payload,
      debug: {
        decisionHistogram: d?.decisionHistogram ?? { BUY: 0, SELL: 0, HOLD: 0, OTHER: 0 },
        sampleDecisions: (d?.sampleDecisions ?? []) as unknown[],
      },
    };
  }

  /** Fetch run metadata for normalizeRunPayload. */
  async getRunMetadata(runId: string): Promise<{
    id: string;
    name: string;
    status: string;
    startedAt: Date | null;
    finishedAt: Date | null;
    seed: number;
    modelVersion: string;
    datasetVersion: string;
    schemaVersion: string;
  }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
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
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);
    return run;
  }

  private aggregateMetrics(agents: AgentResult[]): AggregateMetrics {
    const n = agents.length;
    let totalPnl = 0;
    let totalRisk = 0;
    let totalSteps = 0;
    let totalReward = 0;
    let totalBuy = 0;
    let totalSell = 0;
    let totalHold = 0;
    for (const a of agents) {
      totalPnl += a.pnl;
      totalRisk += a.risk;
      totalSteps += a.steps;
      totalReward += a.totalReward;
      totalBuy += a.actionCounts.buy;
      totalSell += a.actionCounts.sell;
      totalHold += a.actionCounts.hold;
    }
    return {
      agentCount: n,
      totalPnl,
      avgPnl: n > 0 ? totalPnl / n : 0,
      avgRisk: n > 0 ? totalRisk / n : 0,
      totalSteps,
      avgStepsPerAgent: n > 0 ? totalSteps / n : 0,
      totalBuy,
      totalSell,
      totalHold,
      totalReward,
      avgReward: n > 0 ? totalReward / n : 0,
    };
  }
}
