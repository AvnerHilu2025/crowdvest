import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
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

  /** GET /results/runs-v2 — UI-ready runs list with variant info. */
  async getRunsV2(
    limit: number,
    offset: number,
  ): Promise<{
    items: Array<{
      id: string;
      name: string;
      createdAt: string;
      status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
      startedAt: string | null;
      completedAt: string | null;
      failedAt: string | null;
      lastError: string | null;
      runDurationMs: number | null;
      assetSymbol: string | null;
      steps: number | null;
      agents: number | null;
      variantsCount: number;
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
          createdAt: true,
          status: true,
          startedAt: true,
          completedAt: true,
          failedAt: true,
          lastError: true,
          runDurationMs: true,
        },
      }),
      this.prisma.simulationRun.count(),
    ]);

    const items = await Promise.all(
      runs.map(async (r) => {
        const variantsCount = await this.prisma.runVariant.count({ where: { runId: r.id } });
        const defaultVariant = await this.prisma.runVariant.findFirst({
          where: { runId: r.id, seed: 1, OR: [{ label: "" }, { label: null }] },
          select: { assetSymbol: true, steps: true, agents: true },
        });
        const fallbackVariant =
          defaultVariant ??
          (await this.prisma.runVariant.findFirst({
            where: { runId: r.id },
            orderBy: { createdAt: "asc" },
            select: { assetSymbol: true, steps: true, agents: true },
          }));
        const status = this.normalizeRunStatus(r.status);
        return {
          id: r.id,
          name: r.name,
          createdAt: r.createdAt.toISOString(),
          status,
          startedAt: r.startedAt?.toISOString() ?? null,
          completedAt: r.completedAt?.toISOString() ?? null,
          failedAt: r.failedAt?.toISOString() ?? null,
          lastError: r.lastError,
          runDurationMs: r.runDurationMs ?? null,
          assetSymbol: fallbackVariant?.assetSymbol ?? null,
          steps: fallbackVariant?.steps ?? null,
          agents: fallbackVariant?.agents ?? null,
          variantsCount,
        };
      }),
    );

    return { items, total };
  }

  private normalizeRunStatus(
    status: string | number,
  ): "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" {
    const s = String(status).toUpperCase();
    if (s === "PENDING" || s === "RUNNING" || s === "COMPLETED" || s === "FAILED") return s;
    const n = Number(status);
    if (Number.isFinite(n)) {
      const map: Record<number, "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"> = {
        0: "PENDING",
        1: "RUNNING",
        2: "COMPLETED",
        3: "FAILED",
      };
      return map[n] ?? "PENDING";
    }
    return "PENDING";
  }

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

  /** GET /results/latest?assetSymbol=SPY — latest COMPLETED run, its default variant, and variant summary. */
  async latest(assetSymbol: string) {
    const sym = (assetSymbol ?? "SPY").trim() || "SPY";

    // 1) Find latest COMPLETED run that has at least one variant for this asset.
    // Prefer runs with completedAt set (never return PENDING/RUNNING).
    const run = await this.prisma.simulationRun.findFirst({
      where: {
        status: "COMPLETED",
        runVariants: { some: { assetSymbol: sym } },
        completedAt: { not: null },
      },
      orderBy: [{ completedAt: "desc" }, { startedAt: "desc" }],
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        failedAt: true,
        lastError: true,
      },
    });

    if (!run) {
      return { run: null, defaultVariant: null, summary: null };
    }

    // 2) Get variants for asset
    const variants = await this.prisma.runVariant.findMany({
      where: {
        runId: run.id,
        assetSymbol: sym,
      },
      orderBy: [{ label: "asc" }, { seed: "asc" }],
    });

    if (!variants.length) {
      return { run, defaultVariant: null, summary: null };
    }

    // Preferred variant = seed=1 and empty label, else first
    const preferred =
      variants.find((v) => v.seed === 1 && (v.label ?? "") === "") ?? variants[0];

    // 3) Load summary
    const summary = await this.prisma.runVariantSummary.findUnique({
      where: { runVariantId: preferred.id },
    });

    return {
      run,
      defaultVariant: preferred,
      summary,
    };
  }

  /** GET /results/crowd-state?runId=&assetSymbol= — per-step CrowdMetrics + recommendation (direction, strength, confidence, stability, explanation). */
  async getCrowdState(
    runId: string,
    assetSymbol: string,
  ): Promise<{
    runId: string;
    assetSymbol: string;
    perStep: {
      step: number;
      signal: number;
      weightedSignal: number;
      consensus: number;
      polarization: number;
      uncertainty: number;
      minorityStrength: number;
      beliefMomentum: number | null;
      diversityIndex: number | null;
      independenceIndex: number | null;
      herdingIndex: number | null;
      wisdomScore: number | null;
      noiseSensitivity: number | null;
    }[];
    recommendation: {
      direction: "bullish" | "bearish" | "neutral";
      strength: number;
      confidence: number;
      stability: number;
      explanation: string;
    };
  }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);

    const sym = (assetSymbol ?? "RUN").trim() || "RUN";
    let rows = await this.prisma.crowdMetrics.findMany({
      where: { runId, assetSymbol: sym },
      orderBy: { step: "asc" },
      select: {
        step: true,
        signal: true,
        weightedSignal: true,
        consensus: true,
        polarization: true,
        uncertainty: true,
        minorityStrength: true,
        beliefMomentum: true,
        diversityIndex: true,
        independenceIndex: true,
        herdingIndex: true,
        wisdomScore: true,
        noiseSensitivity: true,
      },
    });

    if (rows.length === 0) {
      const decisions = await this.prisma.agentDecision.findMany({
        where: { runId, assetSymbol: sym },
        select: { step: true, action: true, confidence: true },
      });
      const byStep = new Map<number, { action: string; confidence: number }[]>();
      for (const d of decisions) {
        if (!byStep.has(d.step)) byStep.set(d.step, []);
        byStep.get(d.step)!.push({
          action: String(d.action),
          confidence: d.confidence,
        });
      }
      const steps = [...byStep.keys()].sort((a, b) => a - b);
      let prevWS: number | null = null;
      rows = steps.map((step) => {
        const rowsForStep = byStep.get(step)!;
        const N = rowsForStep.length;
        if (N === 0) {
          return {
            step,
            signal: 0,
            weightedSignal: prevWS ?? 0,
            consensus: 0,
            polarization: 0,
            uncertainty: 1,
            minorityStrength: 0,
            beliefMomentum: null,
            diversityIndex: null,
            independenceIndex: null,
            herdingIndex: null,
            wisdomScore: null,
            noiseSensitivity: null,
          };
        }
        let buyCount = 0;
        let sellCount = 0;
        let holdCount = 0;
        let weightedSum = 0;
        let confSum = 0;
        for (const r of rowsForStep) {
          confSum += r.confidence;
          if (r.action === "BUY") {
            buyCount++;
            weightedSum += r.confidence;
          } else if (r.action === "SELL") {
            sellCount++;
            weightedSum -= r.confidence;
          } else holdCount++;
        }
        const clamp = (x: number, lo: number, hi: number) =>
          Math.max(lo, Math.min(hi, x));
        const signal = clamp((buyCount - sellCount) / N, -1, 1);
        const weightedSignal = clamp(weightedSum / N, -1, 1);
        const maxFrac = Math.max(buyCount, sellCount, holdCount) / N;
        const consensus = clamp(maxFrac, 0, 1);
        const polarization = clamp((2 * Math.min(buyCount, sellCount)) / N, 0, 1);
        const uncertainty = clamp(1 - confSum / N, 0, 1);
        const minorityStrength = clamp(1 - consensus, 0, 1);
        const beliefMomentum =
          prevWS != null ? clamp(weightedSignal - prevWS, -2, 2) : null;
        prevWS = weightedSignal;
        return {
          step,
          signal,
          weightedSignal,
          consensus,
          polarization,
          uncertainty,
          minorityStrength,
          beliefMomentum,
          diversityIndex: null,
          independenceIndex: null,
          herdingIndex: null,
          wisdomScore: null,
          noiseSensitivity: null,
        };
      });
    }

    type CrowdRow = {
      step: number;
      signal: number;
      weightedSignal: number;
      consensus: number;
      polarization: number;
      uncertainty: number;
      minorityStrength: number;
      beliefMomentum: number | null;
      diversityIndex?: number | null;
      independenceIndex?: number | null;
      herdingIndex?: number | null;
      wisdomScore?: number | null;
      noiseSensitivity?: number | null;
    };
    const typedRows = rows as CrowdRow[];
    const perStep = typedRows.map((r) => ({
      step: r.step,
      signal: r.signal,
      weightedSignal: r.weightedSignal,
      consensus: r.consensus,
      polarization: r.polarization,
      uncertainty: r.uncertainty,
      minorityStrength: r.minorityStrength,
      beliefMomentum: r.beliefMomentum,
      diversityIndex: r.diversityIndex ?? null,
      independenceIndex: r.independenceIndex ?? null,
      herdingIndex: r.herdingIndex ?? 0,
      wisdomScore: r.wisdomScore ?? null,
      noiseSensitivity: r.noiseSensitivity ?? 0,
    }));

    const step0 = perStep[0];
    if (step0) {
      console.log(
        `[api] step0 diversity=${step0.diversityIndex} independence=${step0.independenceIndex} wisdom=${step0.wisdomScore}`,
      );
    }
    const step4 = perStep[4];
    if (step4 != null && step4.noiseSensitivity != null) {
      console.log(`[api] step4 noiseSensitivity=${step4.noiseSensitivity}`);
    }

    const recommendation = this.buildRecommendation(perStep);
    return { runId, assetSymbol: sym, perStep, recommendation };
  }

  private buildRecommendation(
    perStep: {
      step: number;
      weightedSignal: number;
      consensus: number;
      polarization: number;
      uncertainty: number;
      wisdomScore?: number | null;
      diversityIndex?: number | null;
      independenceIndex?: number | null;
    }[],
  ): {
    direction: "bullish" | "bearish" | "neutral";
    strength: number;
    confidence: number;
    stability: number;
    explanation: string;
  } {
    if (perStep.length === 0) {
      return {
        direction: "neutral",
        strength: 0,
        confidence: 0,
        stability: 0,
        explanation: "No crowd data available.",
      };
    }
    const recent = perStep.slice(-5);
    const avgWS =
      recent.reduce((s, p) => s + p.weightedSignal, 0) / recent.length;
    const avgConsensus =
      recent.reduce((s, p) => s + p.consensus, 0) / recent.length;
    const avgPolarization =
      recent.reduce((s, p) => s + p.polarization, 0) / recent.length;
    const avgUncertainty =
      recent.reduce((s, p) => s + p.uncertainty, 0) / recent.length;
    const wisdomScores = recent
      .map((p) => p.wisdomScore)
      .filter((w): w is number => w != null && Number.isFinite(w));
    const avgWisdomScore =
      wisdomScores.length > 0
        ? wisdomScores.reduce((a, b) => a + b, 0) / wisdomScores.length
        : 0.5;

    const variance =
      recent.length > 1
        ? recent.reduce((s, p) => s + (p.weightedSignal - avgWS) ** 2, 0) /
          (recent.length - 1)
        : 0;
    const stability = Math.max(0, 1 - Math.min(1, Math.sqrt(variance) * 2));

    const t = 0.08;
    let direction: "bullish" | "bearish" | "neutral" = "neutral";
    if (avgWS > t) direction = "bullish";
    else if (avgWS < -t) direction = "bearish";

    const strength = Math.min(1, Math.abs(avgWS));
    let confidence = Math.max(
      0,
      avgConsensus * (1 - avgUncertainty) * (1 - avgPolarization * 0.5),
    );
    confidence *= 0.5 + 0.5 * avgWisdomScore;

    let baseExplanation: string;
    if (direction === "neutral") {
      baseExplanation = `Crowd is undecided (weightedSignal=${avgWS.toFixed(2)}). Low consensus or high polarization.`;
    } else if (direction === "bullish") {
      baseExplanation = `Crowd leans bullish (strength=${strength.toFixed(2)}, stability=${stability.toFixed(2)}). Consensus ${(avgConsensus * 100).toFixed(0)}%.`;
    } else {
      baseExplanation = `Crowd leans bearish (strength=${strength.toFixed(2)}, stability=${stability.toFixed(2)}). Consensus ${(avgConsensus * 100).toFixed(0)}%.`;
    }

    let wisdomNote = "";
    if (avgWisdomScore < 0.4 && wisdomScores.length > 0) {
      const lowDiv = recent.some((p) => (p.diversityIndex ?? 1) < 0.4);
      const lowInd = recent.some((p) => (p.independenceIndex ?? 1) < 0.4);
      if (lowDiv && lowInd) {
        wisdomNote = " Low wisdom: low diversity and herding.";
      } else if (lowDiv) {
        wisdomNote = " Low wisdom: low diversity.";
      } else if (lowInd) {
        wisdomNote = " Low wisdom: herding detected.";
      }
    }

    const explanation = baseExplanation + wisdomNote;

    return { direction, strength, confidence, stability, explanation };
  }

  /** GET /results/decisions?run_id=&step=&assetSymbol= — per-step decision summary from AgentDecision. */
  async getDecisions(
    runId: string,
    step: number,
    assetSymbol: string,
  ): Promise<{
    runId: string;
    step: number;
    assetSymbol: string;
    histogram: { BUY: number; SELL: number; HOLD: number };
    avgConfidence: number;
    sample: { agentId: string; action: string; confidence: number; rationale: string | null }[];
  }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);

    const decisions = await this.prisma.agentDecision.findMany({
      where: { runId, step, assetSymbol },
      select: { agentId: true, action: true, confidence: true, rationale: true },
      take: 1000,
    });

    const histogram = { BUY: 0, SELL: 0, HOLD: 0 };
    let sumConf = 0;
    for (const d of decisions) {
      const key = d.action as "BUY" | "SELL" | "HOLD";
      if (key in histogram) histogram[key]++;
      sumConf += d.confidence;
    }
    const n = decisions.length;
    const sample = decisions.slice(0, 10).map((d) => ({
      agentId: d.agentId,
      action: String(d.action),
      confidence: d.confidence,
      rationale: d.rationale,
    }));

    return {
      runId,
      step,
      assetSymbol,
      histogram,
      avgConfidence: n > 0 ? sumConf / n : 0,
      sample,
    };
  }

  /** GET /results/crowd-summary?run_id= — crowd metrics. When assetSymbol provided, aggregates from AgentDecision with recommendation. */
  async getCrowdSummary(runId: string, assetSymbol?: string): Promise<{
    runId: string;
    steps?: number;
    voteDistribution?: { buy: number; sell: number; hold: number };
    totals?: { buy: number; sell: number; hold: number };
    avgWallet?: number;
    avgReward?: number;
    stepSummaries?: { step: number; actionCounts: { buy: number; sell: number; hold: number }; avgWallet: number }[];
    overall?: { BUY: number; SELL: number; HOLD: number };
    perStep?: { step: number; BUY: number; SELL: number; HOLD: number }[];
    recommendation?: { action: "BUY" | "SELL" | "HOLD"; strength: number; weighted: number };
  }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);

    const sym = (assetSymbol ?? "").trim() || "RUN";
    if (assetSymbol != null && assetSymbol.trim() !== "") {
      const decisions = await this.prisma.agentDecision.findMany({
        where: { runId, assetSymbol: sym },
        select: { step: true, action: true, confidence: true },
      });
      const byStep = new Map<number, { BUY: number; SELL: number; HOLD: number }>();
      let totalBuy = 0;
      let totalSell = 0;
      let totalHold = 0;
      let weighted = 0;
      const N = decisions.length;
      for (const d of decisions) {
        if (!byStep.has(d.step)) byStep.set(d.step, { BUY: 0, SELL: 0, HOLD: 0 });
        const h = byStep.get(d.step)!;
        if (d.action === "BUY") {
          h.BUY++;
          totalBuy++;
          weighted += d.confidence;
        } else if (d.action === "SELL") {
          h.SELL++;
          totalSell++;
          weighted -= d.confidence;
        } else {
          h.HOLD++;
          totalHold++;
        }
      }
      const steps = [...byStep.keys()].sort((a, b) => a - b);
      const perStep = steps.map((step) => ({ step, ...byStep.get(step)! }));
      const t = 0.1;
      let action: "BUY" | "SELL" | "HOLD" = "HOLD";
      if (N > 0) {
        if (weighted > t) action = "BUY";
        else if (weighted < -t) action = "SELL";
      }
      const strength = N > 0 ? Math.abs(weighted) / N : 0;
      return {
        runId,
        overall: { BUY: totalBuy, SELL: totalSell, HOLD: totalHold },
        perStep,
        recommendation: { action, strength, weighted },
      };
    }

    const snapshots = await this.prisma.crowdSnapshot.findMany({
      where: { runId },
      orderBy: { step: "asc" },
      select: { step: true, aggregationJson: true },
    });

    let totalBuy = 0;
    let totalSell = 0;
    let totalHold = 0;
    let sumAvgWallet = 0;
    let sumAvgReward = 0;
    const stepSummaries: { step: number; actionCounts: { buy: number; sell: number; hold: number }; avgWallet: number }[] = [];

    for (const s of snapshots) {
      const agg = (s.aggregationJson ?? {}) as {
        actionCounts?: { buy?: number; sell?: number; hold?: number };
        avgWallet?: number;
        avgReward?: number;
      };
      const counts = agg.actionCounts ?? { buy: 0, sell: 0, hold: 0 };
      const buy = counts.buy ?? 0;
      const sell = counts.sell ?? 0;
      const hold = counts.hold ?? 0;
      totalBuy += buy;
      totalSell += sell;
      totalHold += hold;
      const avgWallet = agg.avgWallet ?? 0;
      const avgReward = agg.avgReward ?? 0;
      sumAvgWallet += avgWallet;
      sumAvgReward += avgReward;
      stepSummaries.push({
        step: s.step,
        actionCounts: { buy, sell, hold },
        avgWallet,
      });
    }

    const n = snapshots.length;
    return {
      runId,
      steps: n,
      voteDistribution: {
        buy: totalBuy,
        sell: totalSell,
        hold: totalHold,
      },
      totals: { buy: totalBuy, sell: totalSell, hold: totalHold },
      avgWallet: n > 0 ? sumAvgWallet / n : 0,
      avgReward: n > 0 ? sumAvgReward / n : 0,
      stepSummaries,
    };
  }

  /** GET /results/step-summary?run_id=&step= — per-step crowd snapshot. */
  async getStepSummary(
    runId: string,
    step: number,
  ): Promise<{
    runId: string;
    step: number;
    actionCounts: { buy: number; sell: number; hold: number };
    avgWallet: number;
    avgReward: number;
    marketReturn?: number;
  }> {
    const snapshot = await this.prisma.crowdSnapshot.findUnique({
      where: { runId_step: { runId, step } },
      select: { step: true, aggregationJson: true },
    });
    if (!snapshot) throw new NotFoundException(`Step ${step} not found for run ${runId}`);

    const agg = (snapshot.aggregationJson ?? {}) as {
      actionCounts?: { buy?: number; sell?: number; hold?: number };
      avgWallet?: number;
      avgReward?: number;
      marketReturn?: number;
    };
    const counts = agg.actionCounts ?? { buy: 0, sell: 0, hold: 0 };
    return {
      runId,
      step: snapshot.step,
      actionCounts: {
        buy: counts.buy ?? 0,
        sell: counts.sell ?? 0,
        hold: counts.hold ?? 0,
      },
      avgWallet: agg.avgWallet ?? 0,
      avgReward: agg.avgReward ?? 0,
      marketReturn: agg.marketReturn,
    };
  }

  /** GET /results/agent/:id/decisions?run_id= — AgentExperience for agent (RunAgent id) in run. */
  async getAgentDecisions(
    agentId: string,
    runId: string,
  ): Promise<{
    agentId: string;
    runId: string;
    decisions: { step: number; action: string; reward: number; pnl: number; drawdown: number }[];
  }> {
    const [run, experiences] = await Promise.all([
      this.prisma.simulationRun.findUnique({
        where: { id: runId },
        select: { id: true },
      }),
      this.prisma.agentExperience.findMany({
        where: { runAgentId: agentId, runId },
        orderBy: { step: "asc" },
        select: { step: true, actionJson: true, reward: true, pnl: true, drawdown: true },
      }),
    ]);
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);

    const decisions = experiences.map((e) => {
      const action =
        (e.actionJson as { action?: string } | null)?.action ?? "hold";
      return {
        step: e.step,
        action: String(action).toLowerCase(),
        reward: e.reward ?? 0,
        pnl: e.pnl ?? 0,
        drawdown: e.drawdown ?? 0,
      };
    });

    return { agentId, runId, decisions };
  }

  /** GET /results/agents-count?runId= — RunAgent count for a run (for smoke verification). */
  async getAgentsCount(runId: string): Promise<{ runId: string; count: number }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);
    const count = await this.prisma.runAgent.count({ where: { runId } });
    return { runId, count };
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
        runAgentId: true,
        pnl: true,
        drawdown: true,
        reward: true,
        actionJson: true,
        runAgent: { select: { archetype: true } },
      },
      orderBy: [{ runAgentId: "asc" }, { step: "asc" }],
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
      const archetypeId = e.runAgent?.archetype ?? "";
      const action = (e.actionJson as { action?: string } | null)?.action ?? "hold";
      if (!byAgent.has(e.runAgentId)) {
        byAgent.set(e.runAgentId, {
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
      const a = byAgent.get(e.runAgentId)!;
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

  /** Compute action histogram from AgentDecision for a run variant (works for persist=lite). */
  private async computeActionHistogramForVariant(runVariantId: string): Promise<{
    BUY: number;
    SELL: number;
    HOLD: number;
    OTHER: number;
    total: number;
  }> {
    const rows = await this.prisma.agentDecision.groupBy({
      by: ["action"],
      where: { runVariantId },
      _count: { id: true },
    });
    const hist = { BUY: 0, SELL: 0, HOLD: 0, OTHER: 0 };
    for (const r of rows) {
      const key = r.action as "BUY" | "SELL" | "HOLD";
      if (key in hist) hist[key] = r._count.id;
    }
    const total = hist.BUY + hist.SELL + hist.HOLD + hist.OTHER;
    return { ...hist, total };
  }

  /** Threshold for RISK_TOO_LOW warning (configurable via env). */
  private static readonly RISK_TOO_LOW_THRESHOLD =
    typeof process !== "undefined" && process.env.RESULTS_RISK_TOO_LOW_THRESHOLD != null
      ? Number(process.env.RESULTS_RISK_TOO_LOW_THRESHOLD)
      : 1e-8;

  /** GET /results/summary-compact?run_id= — compact post-run verification payload + warnings.
   * Canonical read only: RunVariantSummary (histogram from debugDecisionCounts). No recompute. */
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
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true, status: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);

    if (run.status !== "COMPLETED") {
      throw new BadRequestException(`Run ${runId} is not COMPLETED`);
    }

    const variantSummaries = await this.prisma.runVariantSummary.findMany({
      where: { runVariant: { runId } },
      include: { runVariant: { select: { id: true, seed: true, steps: true, agents: true } } },
      orderBy: { runVariant: { seed: "asc" } },
    });

    if (!variantSummaries.length) {
      throw new InternalServerErrorException(
        `No RunVariantSummary found for COMPLETED run ${runId}`,
      );
    }

    const firstSummary = variantSummaries[0]!;
    const firstVariant = firstSummary.runVariant;

    const rawCounts = firstSummary.debugDecisionCounts as
      | { BUY?: number; SELL?: number; HOLD?: number; OTHER?: number }
      | null
      | undefined;
    const persistedHistogram = {
      BUY: typeof rawCounts?.BUY === "number" ? rawCounts.BUY : 0,
      SELL: typeof rawCounts?.SELL === "number" ? rawCounts.SELL : 0,
      HOLD: typeof rawCounts?.HOLD === "number" ? rawCounts.HOLD : 0,
      OTHER: typeof rawCounts?.OTHER === "number" ? rawCounts.OTHER : 0,
    };

    const totalBuy = persistedHistogram.BUY;
    const totalSell = persistedHistogram.SELL;
    const totalHold = persistedHistogram.HOLD;
    const totalSteps = firstVariant.steps;
    const agentCount = firstVariant.agents;

    const sampleDecs = await this.prisma.agentDecision.findMany({
      where: { runVariantId: firstVariant.id },
      select: { agentId: true, step: true, action: true },
      orderBy: [{ step: "asc" }, { agentId: "asc" }],
      take: 10,
    });
    const sampleActions = sampleDecs.map((d) => ({
      agentId: d.agentId,
      step: d.step,
      action: String(d.action),
    }));

    const [summaryResult, simulationRun, runDebugResult] = await Promise.all([
      this.getSummary(runId),
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
    const { run: runAgg, byArchetype, validation } = summaryResult;
    const agentCountSum = byArchetype.reduce((s, a) => s + a.metrics.agentCount, 0);
    const totalPnlSum = byArchetype.reduce((s, a) => s + a.metrics.totalPnl, 0);

    const totalActions = persistedHistogram.BUY + persistedHistogram.SELL + persistedHistogram.HOLD + persistedHistogram.OTHER;
    const m = runAgg.metrics;
    const effectiveTotalSteps = totalSteps > 0 ? totalSteps : Math.max(0, Number(m.totalSteps) || 0);
    const effectiveAgentCount = agentCount > 0 ? agentCount : m.agentCount;

    let tradeRate = 0;
    let holdRate = 0;
    let buyRate = 0;
    let sellRate = 0;
    if (totalActions > 0) {
      tradeRate = (totalBuy + totalSell) / totalActions;
      holdRate = totalHold / totalActions;
      buyRate = totalBuy / totalActions;
      sellRate = totalSell / totalActions;
    } else if (effectiveTotalSteps > 0) {
      tradeRate = (totalBuy + totalSell) / effectiveTotalSteps;
      holdRate = totalHold / effectiveTotalSteps;
      buyRate = totalBuy / effectiveTotalSteps;
      sellRate = totalSell / effectiveTotalSteps;
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

    const warnings: string[] = [];
    if (totalBuy + totalSell === 0) warnings.push("NO_TRADES");
    if (totalSell === 0 && totalBuy > 0) warnings.push("NO_SELL_ACTIONS");
    if (totalActions > 0) {
      if (tradeRate < 0.05) warnings.push("LOW_TRADE_RATE");
      if (holdRate > 0.9) warnings.push("HIGH_HOLD_RATIO");
      if (totalSell === 0 && totalBuy > 0 && buyRate > 0.9) warnings.push("EXTREME_BUY_BIAS");
    }
    if (effectiveTotalSteps > 0 && totalActions === 0) {
      const legacyTradeRate = (m.totalBuy + m.totalSell) / effectiveTotalSteps;
      if (legacyTradeRate < 0.05) warnings.push("LOW_TRADE_RATE");
    }
    if (validation.pctProfitableAgents === 0 && agentCountSum > 0) warnings.push("ALL_AGENTS_LOSING");
    if (m.avgRisk < ResultsService.RISK_TOO_LOW_THRESHOLD && agentCountSum > 0) warnings.push("RISK_TOO_LOW");
    if (Math.abs(m.totalPnl) < 1e-6 && agentCountSum > 0) warnings.push("VERY_LOW_PNL_MAGNITUDE");

    const avgStepsPerAgent =
      effectiveAgentCount > 0 ? effectiveTotalSteps / effectiveAgentCount : 0;

    return {
      runId,
      metrics: {
        agentCount: effectiveAgentCount,
        totalPnl: m.totalPnl,
        avgPnl: m.avgPnl,
        avgRisk: m.avgRisk,
        totalSteps: effectiveTotalSteps,
        avgStepsPerAgent,
        totalBuy,
        totalSell,
        totalHold,
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
    completedAt: Date | null;
    failedAt: Date | null;
    lastError: string | null;
    runDurationMs: number | null;
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
        completedAt: true,
        failedAt: true,
        lastError: true,
        runDurationMs: true,
        seed: true,
        modelVersion: true,
        datasetVersion: true,
        schemaVersion: true,
      },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);
    return run;
  }

  /** GET /results/agent-rewards?runId=&assetSymbol=&agentId=&fromStep=&toStep= — reward rows (AgentReward). */
  async getAgentRewards(
    runId: string,
    assetSymbol: string,
    agentId?: string,
    fromStep?: number,
    toStep?: number,
  ): Promise<{
    runId: string;
    assetSymbol: string;
    items: {
      id: string;
      agentId: string;
      step: number;
      action: string;
      stepReturn: number;
      pnl: number;
      regret: number;
      drawdown: number;
      rewardScore: number;
      createdAt: Date;
    }[];
    total: number;
  }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);

    const sym = (assetSymbol ?? "RUN").trim() || "RUN";
    const where: {
      runId: string;
      assetSymbol: string;
      agentId?: string;
      step?: { gte?: number; lte?: number };
    } = { runId, assetSymbol: sym };
    if (agentId?.trim()) where.agentId = agentId.trim();
    if ((fromStep != null && Number.isFinite(fromStep)) || (toStep != null && Number.isFinite(toStep))) {
      where.step = {};
      if (fromStep != null && Number.isFinite(fromStep)) where.step.gte = fromStep;
      if (toStep != null && Number.isFinite(toStep)) where.step.lte = toStep;
    }

    const [items, total] = await Promise.all([
      this.prisma.agentReward.findMany({
        where,
        orderBy: [{ step: "asc" }, { agentId: "asc" }],
        select: {
          id: true,
          agentId: true,
          step: true,
          action: true,
          stepReturn: true,
          pnl: true,
          regret: true,
          drawdown: true,
          rewardScore: true,
          createdAt: true,
        },
      }),
      this.prisma.agentReward.count({ where }),
    ]);

    return {
      runId,
      assetSymbol: sym,
      items: items.map((r) => ({
        id: r.id,
        agentId: r.agentId,
        step: r.step,
        action: String(r.action),
        stepReturn: r.stepReturn,
        pnl: r.pnl,
        regret: r.regret,
        drawdown: r.drawdown,
        rewardScore: r.rewardScore,
        createdAt: r.createdAt,
      })),
      total,
    };
  }

  /** GET /results/agent-state?runId=&assetSymbol=&agentId=&historyLimit= — latest (max step) + last N steps ascending (AgentState). */
  async getAgentState(
    runId: string,
    assetSymbol: string,
    agentId: string,
    historyLimit: number = 10,
  ): Promise<{
    runId: string;
    assetSymbol: string;
    agentId: string;
    latest: {
      step: number;
      exposedCount: number;
      infoSignal: number;
      confidence: number;
      riskTolerance: number;
      herding: number;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    stepHistory: {
      step: number;
      exposedCount: number;
      infoSignal: number;
      confidence: number;
      riskTolerance: number;
      herding: number;
      createdAt: Date;
      updatedAt: Date;
    }[];
  }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);
    const sym = (assetSymbol ?? "RUN").trim() || "RUN";

    const [latestRow, historyRowsDesc] = await Promise.all([
      this.prisma.agentState.findFirst({
        where: { runId, assetSymbol: sym, agentId },
        orderBy: { step: "desc" },
        select: {
          step: true,
          exposedCount: true,
          infoSignal: true,
          confidence: true,
          riskTolerance: true,
          herding: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.agentState.findMany({
        where: { runId, assetSymbol: sym, agentId },
        orderBy: { step: "desc" },
        take: Math.min(Math.max(1, historyLimit), 100),
        select: {
          step: true,
          exposedCount: true,
          infoSignal: true,
          confidence: true,
          riskTolerance: true,
          herding: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    const historyRows = [...historyRowsDesc].reverse();

    const mapRow = (r: {
      step: number;
      exposedCount: number;
      infoSignal: number;
      confidence: number;
      riskTolerance: number;
      herding: number;
      createdAt: Date;
      updatedAt: Date;
    }) => ({
      step: r.step,
      exposedCount: r.exposedCount,
      infoSignal: r.infoSignal,
      confidence: r.confidence,
      riskTolerance: r.riskTolerance,
      herding: r.herding,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });

    return {
      runId,
      assetSymbol: sym,
      agentId,
      latest: latestRow ? mapRow(latestRow) : null,
      stepHistory: historyRows.map(mapRow), // ascending by step (oldest of last N first)
    };
  }

  /** GET /results/backtests?assetSymbol=&limit= — list BacktestResult (per-seed backtest v0). corr/directionalAccuracy nullable. */
  async getBacktests(
    assetSymbol: string,
    limit: number,
  ): Promise<{
    items: {
      id: string;
      runId: string;
      assetSymbol: string;
      seed: number;
      steps: number;
      agents: number;
      pairsCount: number | null;
      corr: number | null;
      directionalAccuracy: number | null;
      createdAt: Date;
    }[];
    total: number;
  }> {
    const sym = (assetSymbol ?? "").trim().toUpperCase() || "SPY";
    const [items, total] = await Promise.all([
      this.prisma.backtestResult.findMany({
        where: { assetSymbol: sym },
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(1, limit), 200),
        select: {
          id: true,
          runId: true,
          assetSymbol: true,
          seed: true,
          steps: true,
          agents: true,
          pairsCount: true,
          corr: true,
          directionalAccuracy: true,
          createdAt: true,
        },
      }),
      this.prisma.backtestResult.count({ where: { assetSymbol: sym } }),
    ]);
    return {
      items: items.map((r) => ({
        id: r.id,
        runId: r.runId,
        assetSymbol: r.assetSymbol,
        seed: r.seed,
        steps: r.steps,
        agents: r.agents,
        pairsCount: r.pairsCount,
        corr: r.corr,
        directionalAccuracy: r.directionalAccuracy,
        createdAt: r.createdAt,
      })),
      total,
    };
  }

  /** GET /results/backtest?symbol=&limit= — list BacktestWindowResult for a symbol. */
  async getBacktestResults(
    symbol: string,
    limit: number,
  ): Promise<{
    items: {
      id: string;
      symbol: string;
      runId: string;
      fromDate: string;
      toDate: string;
      window: number;
      stride: number;
      agents: number;
      seed: number;
      corr: number;
      hitRate: number;
      createdAt: Date;
    }[];
    total: number;
  }> {
    const sym = (symbol ?? "").trim().toUpperCase() || "SPY";
    const [items, total] = await Promise.all([
      this.prisma.backtestWindowResult.findMany({
        where: { symbol: sym },
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(1, limit), 200),
        select: {
          id: true,
          symbol: true,
          runId: true,
          fromDate: true,
          toDate: true,
          window: true,
          stride: true,
          agents: true,
          seed: true,
          corr: true,
          hitRate: true,
          createdAt: true,
        },
      }),
      this.prisma.backtestWindowResult.count({ where: { symbol: sym } }),
    ]);
    return {
      items: items.map((r) => ({
        id: r.id,
        symbol: r.symbol,
        runId: r.runId,
        fromDate: r.fromDate,
        toDate: r.toDate,
        window: r.window,
        stride: r.stride,
        agents: r.agents,
        seed: r.seed,
        corr: r.corr,
        hitRate: r.hitRate,
        createdAt: r.createdAt,
      })),
      total,
    };
  }

  /** GET /results/crowd-wisdom-dump — raw decisions + returns for Crowd Wisdom validation. Read-only projection. Run must be COMPLETED. */
  async getCrowdWisdomDump(
    runId: string,
    assetSymbol: string,
  ): Promise<{
    runId: string;
    assetSymbol: string;
    steps: number;
    agents: number;
    agentsRequested: number | null;
    agentsPersisted: number;
    decisionsCount: number;
    returnsCount: number;
    decisions: { step: number; agentId: string; action: "BUY" | "SELL" | "HOLD" }[];
    returns: { step: number; stepReturn: number }[];
  }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true, status: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);
    if (run.status !== "COMPLETED") {
      throw new ConflictException(`Run must be COMPLETED; current status: ${run.status}`);
    }

    const sym = (assetSymbol ?? "SPY").trim() || "SPY";
    const [decisionRows, returnRows, runVariant] = await Promise.all([
      this.prisma.agentDecision.findMany({
        where: { runId, assetSymbol: sym },
        select: { step: true, agentId: true, action: true },
      }),
      this.prisma.assetStepReturn.findMany({
        where: { runId, assetSymbol: sym },
        select: { step: true, stepReturn: true },
        orderBy: { step: "asc" },
      }),
      this.prisma.runVariant.findFirst({
        where: { runId, assetSymbol: sym },
        orderBy: { createdAt: "desc" },
        select: { agents: true },
      }),
    ]);

    const maxStep = returnRows.length > 0
      ? Math.max(...returnRows.map((r) => r.step), 0)
      : decisionRows.length > 0
        ? Math.max(...decisionRows.map((d) => d.step), 0)
        : 0;
    const steps = maxStep + 1;
    const agentIds = new Set(decisionRows.map((d) => d.agentId));
    const agentsPersisted = agentIds.size;

    return {
      runId,
      assetSymbol: sym,
      steps,
      agents: agentsPersisted,
      agentsRequested: runVariant?.agents ?? null,
      agentsPersisted,
      decisionsCount: decisionRows.length,
      returnsCount: returnRows.length,
      decisions: decisionRows.map((d) => ({
        step: d.step,
        agentId: d.agentId,
        action: d.action as "BUY" | "SELL" | "HOLD",
      })),
      returns: returnRows.map((r) => ({ step: r.step, stepReturn: r.stepReturn })),
    };
  }

  /** Majority vote per step (same tie-break as forecast validation). */
  private majorityFromCounts(buy: number, sell: number, hold: number): "BUY" | "SELL" | "HOLD" {
    const max = Math.max(buy, sell, hold);
    if (buy === max && buy > sell && buy > hold) return "BUY";
    if (sell === max && sell > buy && sell > hold) return "SELL";
    return "HOLD";
  }

  private actualFromReturn(stepReturn: number): "BUY" | "SELL" | "HOLD" {
    if (stepReturn > 0) return "BUY";
    if (stepReturn < 0) return "SELL";
    return "HOLD";
  }

  /**
   * Diagnostic only: per-step CrowdMetrics + crowd majority vs next-step return for two RunVariants (same run/asset/seed).
   * Does not modify simulation or metrics logic.
   */
  async getVariantStepwiseComparison(
    runId: string,
    labelA: string,
    labelB: string,
    opts?: { assetSymbol?: string; seed?: number },
  ): Promise<{
    runId: string;
    assetSymbol: string;
    seed: number;
    variantA: { label: string; runVariantId: string; agents: number };
    variantB: { label: string; runVariantId: string; agents: number };
    steps: Array<{
      step: number;
      a: {
        herdingIndex: number | null;
        diversityIndex: number | null;
        independenceIndex: number | null;
        wisdomScore: number | null;
        consensus: number | null;
        majorityDirection: string;
        nextStepReturn: number | null;
        actualDirection: string | null;
        crowdCorrect: boolean | null;
      };
      b: {
        herdingIndex: number | null;
        diversityIndex: number | null;
        independenceIndex: number | null;
        wisdomScore: number | null;
        consensus: number | null;
        majorityDirection: string;
        nextStepReturn: number | null;
        actualDirection: string | null;
        crowdCorrect: boolean | null;
      };
    }>;
    focus: {
      last10Steps: number[];
      topHerdingStepsA: number[];
      topHerdingStepsB: number[];
      wrongCrowdStepsA: number[];
      wrongCrowdStepsB: number[];
    };
  }> {
    const assetSymbol = (opts?.assetSymbol ?? "SPY").trim() || "SPY";
    const seed = typeof opts?.seed === "number" && Number.isFinite(opts.seed) ? Math.floor(opts.seed) : 1;

    const clean = (s: string) => s.trim();
    const la = clean(labelA);
    const lb = clean(labelB);
    if (!la || !lb) {
      throw new BadRequestException("labelA and labelB are required");
    }

    const [va, vb] = await Promise.all([
      this.prisma.runVariant.findUnique({
        where: {
          runId_assetSymbol_seed_label: {
            runId,
            assetSymbol,
            seed,
            label: la,
          },
        },
        select: { id: true, agents: true },
      }),
      this.prisma.runVariant.findUnique({
        where: {
          runId_assetSymbol_seed_label: {
            runId,
            assetSymbol,
            seed,
            label: lb,
          },
        },
        select: { id: true, agents: true },
      }),
    ]);
    if (!va) throw new NotFoundException(`RunVariant not found: ${la}`);
    if (!vb) throw new NotFoundException(`RunVariant not found: ${lb}`);

    const [metricsA, metricsB, returns, decisions] = await Promise.all([
      this.prisma.crowdMetrics.findMany({
        where: { runVariantId: va.id },
        orderBy: { step: "asc" },
        select: {
          step: true,
          herdingIndex: true,
          diversityIndex: true,
          independenceIndex: true,
          wisdomScore: true,
          consensus: true,
        },
      }),
      this.prisma.crowdMetrics.findMany({
        where: { runVariantId: vb.id },
        orderBy: { step: "asc" },
        select: {
          step: true,
          herdingIndex: true,
          diversityIndex: true,
          independenceIndex: true,
          wisdomScore: true,
          consensus: true,
        },
      }),
      this.prisma.assetStepReturn.findMany({
        where: { runId, assetSymbol },
        select: { step: true, stepReturn: true },
        orderBy: { step: "asc" },
      }),
      this.prisma.agentDecision.findMany({
        where: {
          runId,
          assetSymbol,
          runVariantId: { in: [va.id, vb.id] },
        },
        select: { runVariantId: true, step: true, action: true },
      }),
    ]);

    const retByStep = new Map<number, number>();
    for (const r of returns) {
      retByStep.set(r.step, r.stepReturn);
    }

    type Tallies = { BUY: number; SELL: number; HOLD: number };
    const tallyKey = (rvId: string, step: number) => `${rvId}:${step}`;
    const tallies = new Map<string, Tallies>();
    for (const d of decisions) {
      const k = tallyKey(d.runVariantId!, d.step);
      let t = tallies.get(k);
      if (!t) {
        t = { BUY: 0, SELL: 0, HOLD: 0 };
        tallies.set(k, t);
      }
      const a = String(d.action) as keyof Tallies;
      if (a in t) t[a]++;
    }

    const byStepA = new Map(metricsA.map((m) => [m.step, m]));
    const byStepB = new Map(metricsB.map((m) => [m.step, m]));
    const allSteps = [...new Set([...byStepA.keys(), ...byStepB.keys()])].sort((x, y) => x - y);

    const buildSide = (
      rvId: string,
      step: number,
      row: (typeof metricsA)[0] | undefined,
    ): {
      herdingIndex: number | null;
      diversityIndex: number | null;
      independenceIndex: number | null;
      wisdomScore: number | null;
      consensus: number | null;
      majorityDirection: string;
      nextStepReturn: number | null;
      actualDirection: string | null;
      crowdCorrect: boolean | null;
    } => {
      const t = tallies.get(tallyKey(rvId, step)) ?? { BUY: 0, SELL: 0, HOLD: 0 };
      const maj = this.majorityFromCounts(t.BUY, t.SELL, t.HOLD);
      const nextR = retByStep.get(step + 1);
      const totalV = t.BUY + t.SELL + t.HOLD;
      let actual: string | null = null;
      let correct: boolean | null = null;
      if (nextR != null && Number.isFinite(nextR) && totalV > 0) {
        actual = this.actualFromReturn(nextR);
        correct = maj === actual;
      }
      return {
        herdingIndex: row?.herdingIndex ?? null,
        diversityIndex: row?.diversityIndex ?? null,
        independenceIndex: row?.independenceIndex ?? null,
        wisdomScore: row?.wisdomScore ?? null,
        consensus: row?.consensus ?? null,
        majorityDirection: maj,
        nextStepReturn: nextR ?? null,
        actualDirection: actual,
        crowdCorrect: correct,
      };
    };

    const steps = allSteps.map((step) => ({
      step,
      a: buildSide(va.id, step, byStepA.get(step)),
      b: buildSide(vb.id, step, byStepB.get(step)),
    }));

    const maxStep = allSteps.length ? Math.max(...allSteps) : 0;
    const last10Steps = allSteps.filter((s) => s >= maxStep - 9);

    const rankedA = [...steps].sort(
      (x, y) => (y.a.herdingIndex ?? -1) - (x.a.herdingIndex ?? -1),
    );
    const rankedB = [...steps].sort(
      (x, y) => (y.b.herdingIndex ?? -1) - (x.b.herdingIndex ?? -1),
    );
    const topHerdingStepsA = rankedA.slice(0, 5).map((r) => r.step);
    const topHerdingStepsB = rankedB.slice(0, 5).map((r) => r.step);

    const wrongCrowdStepsA = steps
      .filter((r) => r.a.crowdCorrect === false)
      .map((r) => r.step);
    const wrongCrowdStepsB = steps
      .filter((r) => r.b.crowdCorrect === false)
      .map((r) => r.step);

    return {
      runId,
      assetSymbol,
      seed,
      variantA: { label: la, runVariantId: va.id, agents: va.agents },
      variantB: { label: lb, runVariantId: vb.id, agents: vb.agents },
      steps,
      focus: {
        last10Steps,
        topHerdingStepsA,
        topHerdingStepsB,
        wrongCrowdStepsA,
        wrongCrowdStepsB,
      },
    };
  }

  /** GET /results/run-debug-counts — counts for debugging (decisions, infoState, experiences, crowdMetrics). Guarded by NODE_ENV or X-Debug header. */
  async getRunDebugCounts(
    runId: string,
    assetSymbol: string,
  ): Promise<{
    decisions: number;
    infoState: number;
    experiences: number;
    crowdMetrics: number;
  }> {
    const sym = (assetSymbol ?? "RUN").trim() || "RUN";
    const [decisions, infoState, experiences, crowdMetrics] = await Promise.all([
      this.prisma.agentDecision.count({
        where: { runId, assetSymbol: sym },
      }),
      this.prisma.agentInfoState.count({
        where: { runId, assetSymbol: sym },
      }),
      this.prisma.agentExperience.count({ where: { runId } }),
      this.prisma.crowdMetrics.count({
        where: { runId, assetSymbol: sym },
      }),
    ]);
    return { decisions, infoState, experiences, crowdMetrics };
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
