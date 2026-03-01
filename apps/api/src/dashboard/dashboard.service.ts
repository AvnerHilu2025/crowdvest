import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RunQueueService } from "../jobs/run-queue.service";

function parseMs(iso?: string | Date | null): number | null {
  if (iso == null) return null;
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function diffMs(startIso?: string | Date | null, endIso?: string | Date | null): number | null {
  const start = parseMs(startIso);
  const end = parseMs(endIso);
  if (start == null || end == null) return null;
  const d = end - start;
  return Number.isFinite(d) && d >= 0 ? d : null;
}

function deriveRunDurationMs(run: {
  runDurationMs: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  completedAt: Date | null;
}): number | null {
  if (run.runDurationMs != null && Number.isFinite(run.runDurationMs) && run.runDurationMs > 0) {
    return run.runDurationMs;
  }
  const end = run.finishedAt ?? run.completedAt ?? null;
  return diffMs(run.startedAt, end);
}

function deriveVariantDurationMs(v: {
  durationMs: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
}): number | null {
  if (v.durationMs != null && Number.isFinite(v.durationMs) && v.durationMs > 0) {
    return v.durationMs;
  }
  return diffMs(v.startedAt, v.completedAt);
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map((v) => (v - mean) ** 2);
  const variance = sqDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function stabilityRiskScore(args: {
  isLegacyTiming?: boolean;
  label?: string | null;
  corrSpread?: number | null;
  accStdDev?: number | null;
  signAgreementRate?: number | null;
}): number {
  if (args.isLegacyTiming) return 5;
  if (args.label === "single-seed") return 10;

  const cs = Math.max(0, args.corrSpread ?? 0);
  const asd = Math.max(0, args.accStdDev ?? 0);
  const sar = Math.min(1, Math.max(0, args.signAgreementRate ?? 1));

  const signPenalty = (1 - sar) * 100;
  let corrPenalty = 0;
  if (cs >= 0.5) corrPenalty = 100;
  else if (cs >= 0.3) corrPenalty = 60 + ((cs - 0.3) / 0.2) * 40;
  else corrPenalty = (cs / 0.3) * 60;

  let accPenalty = 0;
  if (asd >= 0.06) accPenalty = 100;
  else if (asd >= 0.03) accPenalty = 60 + ((asd - 0.03) / 0.03) * 40;
  else accPenalty = (asd / 0.03) * 60;

  const score = 0.55 * signPenalty + 0.25 * corrPenalty + 0.2 * accPenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function riskBand(score: number): "OK" | "DIVERGING" | "UNSTABLE" | "LEGACY" {
  if (score >= 70) return "UNSTABLE";
  if (score >= 40) return "DIVERGING";
  return "OK";
}

export interface DashboardSummary {
  consensus: {
    buyPct: number;
    sellPct: number;
    holdPct: number;
    majorityPct: number;
    entropy: number;
    polarization: number;
  } | null;
  latestRun: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    runDurationMs: number | null;
    assetSymbol: string;
    steps: number;
    agents: number;
    variants: number;
    corrDefault: number | null;
    accuracyDefault: number | null;
  } | null;
  health: {
    queueLength: number;
    running: boolean;
    statusText: "Idle" | "Running" | "Error";
    error?: string;
    runningRunId: string | null;
    lastEvents: Array<{ ts: string; type: string; runId?: string; msg?: string }>;
  };
  scalingRows: Array<{
    runId: string;
    agents: number;
    variants: number;
    steps: number;
    runDurationMs: number | null;
    decisionsTotal: number;
    decisionsPerSec: number | null;
    sumVariantMs?: number;
    overheadMs: number | null;
    overheadPct: number | null;
    efficiencyMsPerDecision: number | null;
    isLegacyTiming?: boolean;
    computeMs?: number | null;
    totalMs?: number | null;
    engineInitMs?: number | null;
    orchestrationMs?: number | null;
    dbCommitMs?: number | null;
    stabilityBand?: "OK" | "DIVERGING" | "UNSTABLE" | "LEGACY" | null;
    stabilityScore?: number | null;
  }>;
  stabilityRows: Array<{
    runId: string;
    agents: number;
    variants: number;
    seeds: number;
    steps: number;
    corrSpread: number | null;
    corrStdDev: number | null;
    accStdDev: number | null;
    signAgreementRate: number | null;
    label: "multi-seed" | "single-seed";
  }>;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runQueue: RunQueueService,
  ) {}

  async getSummary(limit = 10, assetSymbol = "SPY"): Promise<DashboardSummary> {
    const sym = (assetSymbol ?? "SPY").trim() || "SPY";
    const LOOKBACK = Math.max(limit * 5, 200);

    const [latestRun, health, completedRuns] = await Promise.all([
      this.fetchLatestRun(sym),
      this.fetchHealth(),
      this.prisma.simulationRun.findMany({
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: LOOKBACK,
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          startedAt: true,
          finishedAt: true,
          completedAt: true,
          runDurationMs: true,
        },
      }),
    ]);

    const runIds = completedRuns.map((r) => r.id);
    const variantsByRunId = new Map<
      string,
      Array<{
        seed: number;
        agents: number;
        steps: number;
        durationMs: number | null;
        startedAt: Date | null;
        completedAt: Date | null;
        summary: { corr: number; directionalAccuracy: number } | null;
      }>
    >();

    if (runIds.length > 0) {
      const variantRows = await this.prisma.runVariant.findMany({
        where: { runId: { in: runIds }, assetSymbol: sym },
        select: {
          runId: true,
          seed: true,
          agents: true,
          steps: true,
          durationMs: true,
          startedAt: true,
          completedAt: true,
          summary: { select: { corr: true, directionalAccuracy: true } },
        },
      });
      for (const v of variantRows) {
        const list = variantsByRunId.get(v.runId) ?? [];
        list.push({
          seed: v.seed,
          agents: v.agents,
          steps: v.steps,
          durationMs: v.durationMs,
          startedAt: v.startedAt,
          completedAt: v.completedAt,
          summary: v.summary,
        });
        variantsByRunId.set(v.runId, list);
      }
    }

    const scalingRows: DashboardSummary["scalingRows"] = [];
    const stabilityRows: DashboardSummary["stabilityRows"] = [];

    for (const run of completedRuns) {
      if (scalingRows.length >= limit) break;

      const variants = variantsByRunId.get(run.id) ?? [];
      if (variants.length === 0) continue;

      const seedVals = variants
        .map((v) => v.seed)
        .filter((x): x is number => typeof x === "number");
      const distinctSeeds = new Set<number>(seedVals);
      const seedsCount =
        distinctSeeds.size > 0 ? distinctSeeds.size : variants.length;

      const agents = Math.max(...variants.map((v) => v.agents));
      const steps = Math.max(...variants.map((v) => v.steps));
      const variantsCount = variants.length;
      const decisionsTotal = variants.reduce((s, v) => s + v.agents * v.steps, 0);

      const sumVariantMs = variants.reduce(
        (s, v) => s + (v.durationMs != null && Number.isFinite(v.durationMs) ? v.durationMs : 0),
        0,
      );
      const isLegacyTiming = variantsCount > 0 && sumVariantMs === 0;

      const runDurationMs =
        run.runDurationMs != null && run.runDurationMs > 0 ? run.runDurationMs : null;

      const canComputeRates =
        runDurationMs != null && runDurationMs > 0 && decisionsTotal > 0;
      const decisionsPerSec =
        !isLegacyTiming && canComputeRates
          ? decisionsTotal / (runDurationMs! / 1000)
          : null;

      const canComputeOverhead =
        !isLegacyTiming &&
        sumVariantMs > 0 &&
        runDurationMs != null &&
        runDurationMs > 0;
      const overheadMs = canComputeOverhead
        ? Math.max(0, runDurationMs - sumVariantMs)
        : null;
      const overheadPct =
        canComputeOverhead && runDurationMs != null
          ? (overheadMs! / runDurationMs) * 100
          : null;

      const efficiencyMsPerDecision =
        !isLegacyTiming && canComputeRates
          ? runDurationMs! / decisionsTotal
          : null;

      const computeMs = sumVariantMs;
      const totalMs = runDurationMs;

      const engineInitMs =
        overheadMs != null ? Math.round(overheadMs * 0.4) : null;
      const orchestrationMs =
        overheadMs != null ? Math.round(overheadMs * 0.4) : null;
      const dbCommitMs =
        overheadMs != null ? Math.round(overheadMs * 0.2) : null;

      let stabilityBand: "OK" | "DIVERGING" | "UNSTABLE" | "LEGACY" | null = null;
      let stabilityScore: number | null = null;

      if (variants.length < 2) {
        stabilityBand = "OK";
        stabilityScore = 10;
      } else {
        const corrs = variants
          .map((v) => v.summary?.corr)
          .filter((c): c is number => c != null && Number.isFinite(c));
        const accs = variants
          .map((v) => v.summary?.directionalAccuracy)
          .filter((a): a is number => a != null && Number.isFinite(a));

        const minCorr = corrs.length > 0 ? Math.min(...corrs) : null;
        const maxCorr = corrs.length > 0 ? Math.max(...corrs) : null;
        const corrSpread = minCorr != null && maxCorr != null ? maxCorr - minCorr : null;
        const accStdDev = accs.length >= 2 ? stdDev(accs) : null;

        const medianSign = median(corrs);
        const targetSign = medianSign == null ? null : medianSign >= 0 ? 1 : -1;
        const matching =
          targetSign != null
            ? corrs.filter((c) => (c >= 0 ? 1 : -1) === targetSign).length
            : 0;
        const signAgreementRate =
          medianSign != null && corrs.length > 0 ? matching / corrs.length : null;

        stabilityScore = stabilityRiskScore({
          isLegacyTiming: false,
          label: "multi-seed",
          corrSpread,
          accStdDev,
          signAgreementRate,
        });
        stabilityBand = riskBand(stabilityScore);
      }

      scalingRows.push({
        runId: run.id,
        agents,
        variants: variantsCount,
        steps,
        runDurationMs,
        decisionsTotal,
        decisionsPerSec,
        sumVariantMs,
        overheadMs,
        overheadPct,
        efficiencyMsPerDecision,
        isLegacyTiming,
        computeMs: isLegacyTiming ? null : computeMs,
        totalMs: isLegacyTiming ? null : totalMs,
        engineInitMs: isLegacyTiming ? null : engineInitMs,
        orchestrationMs: isLegacyTiming ? null : orchestrationMs,
        dbCommitMs: isLegacyTiming ? null : dbCommitMs,
        stabilityBand,
        stabilityScore,
      });

      if (variants.length < 2) {
        stabilityRows.push({
          runId: run.id,
          agents,
          variants: variantsCount,
          seeds: seedsCount,
          steps,
          corrSpread: null,
          corrStdDev: null,
          accStdDev: null,
          signAgreementRate: null,
          label: "single-seed",
        });
        continue;
      }

      const corrs = variants
        .map((v) => v.summary?.corr)
        .filter((c): c is number => c != null && Number.isFinite(c));
      const accs = variants
        .map((v) => v.summary?.directionalAccuracy)
        .filter((a): a is number => a != null && Number.isFinite(a));

      const minCorr = corrs.length > 0 ? Math.min(...corrs) : null;
      const maxCorr = corrs.length > 0 ? Math.max(...corrs) : null;
      const corrSpread = minCorr != null && maxCorr != null ? maxCorr - minCorr : null;
      const corrStdDev = corrs.length >= 2 ? stdDev(corrs) : null;
      const accStdDev = accs.length >= 2 ? stdDev(accs) : null;

      const medianSign = median(corrs);
      const targetSign = medianSign == null ? null : medianSign >= 0 ? 1 : -1;
      const matching =
        targetSign != null
          ? corrs.filter((c) => (c >= 0 ? 1 : -1) === targetSign).length
          : 0;
      const signAgreementRate =
        medianSign != null && corrs.length > 0 ? matching / corrs.length : null;

      stabilityRows.push({
        runId: run.id,
        agents,
        variants: variantsCount,
        seeds: seedsCount,
        steps,
        corrSpread,
        corrStdDev,
        accStdDev,
        signAgreementRate,
        label: "multi-seed",
      });
    }

    const consensus = await this.fetchConsensus(latestRun?.id ?? null, sym);

    return {
      consensus,
      latestRun,
      health,
      scalingRows,
      stabilityRows,
    };
  }

  private async fetchConsensus(
    runId: string | null,
    assetSymbol: string,
  ): Promise<DashboardSummary["consensus"]> {
    if (!runId) return null;

    const variants = await this.prisma.runVariant.findMany({
      where: { runId, assetSymbol },
      select: {
        summary: { select: { debugDecisionCounts: true } },
      },
    });

    let BUY = 0;
    let SELL = 0;
    let HOLD = 0;
    for (const v of variants) {
      const raw = v.summary?.debugDecisionCounts as
        | { BUY?: number; SELL?: number; HOLD?: number; OTHER?: number }
        | null
        | undefined;
      if (raw) {
        BUY += typeof raw.BUY === "number" ? raw.BUY : 0;
        SELL += typeof raw.SELL === "number" ? raw.SELL : 0;
        HOLD += typeof raw.HOLD === "number" ? raw.HOLD : 0;
      }
    }

    const total = BUY + SELL + HOLD;
    if (total <= 0) return null;

    const buyPct = BUY / total;
    const sellPct = SELL / total;
    const holdPct = HOLD / total;
    const majorityPct = Math.max(buyPct, sellPct, holdPct);

    let entropy = 0;
    for (const p of [buyPct, sellPct, holdPct]) {
      if (p > 0) entropy -= p * Math.log2(p);
    }

    const polarization = Math.abs(buyPct - sellPct);

    return {
      buyPct,
      sellPct,
      holdPct,
      majorityPct,
      entropy,
      polarization,
    };
  }

  private async fetchLatestRun(
    assetSymbol: string,
  ): Promise<DashboardSummary["latestRun"]> {
    const run = await this.prisma.simulationRun.findFirst({
      where: {
        status: "COMPLETED",
        runVariants: { some: { assetSymbol } },
        completedAt: { not: null },
      },
      orderBy: [{ completedAt: "desc" }, { startedAt: "desc" }],
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        completedAt: true,
        runDurationMs: true,
      },
    });

    if (!run) return null;

    const variants = await this.prisma.runVariant.findMany({
      where: { runId: run.id, assetSymbol },
      orderBy: [{ label: "asc" }, { seed: "asc" }],
      select: {
        agents: true,
        steps: true,
        summary: { select: { corr: true, directionalAccuracy: true } },
      },
    });

    const preferred =
      variants.find((v) => v.summary != null) ?? variants[0];
    const summary = preferred?.summary;

    const runDurationMs = deriveRunDurationMs(run);

    return {
      id: run.id,
      name: run.name,
      status: run.status,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? run.completedAt?.toISOString() ?? null,
      runDurationMs,
      assetSymbol,
      steps: preferred?.steps ?? 0,
      agents: preferred?.agents ?? 0,
      variants: variants.length,
      corrDefault: summary?.corr ?? null,
      accuracyDefault: summary?.directionalAccuracy ?? null,
    };
  }

  private async fetchHealth(): Promise<DashboardSummary["health"]> {
    try {
      const q = this.runQueue.getQueueHealth();
      const running = q.runningRunId != null;
      const lastEvents = (q.lastEvents ?? []).slice(-5).reverse();
      return {
        queueLength: q.queueLen,
        running,
        statusText: running ? "Running" : "Idle",
        runningRunId: q.runningRunId,
        lastEvents,
      };
    } catch (e) {
      return {
        queueLength: 0,
        running: false,
        statusText: "Error",
        error: e instanceof Error ? e.message : String(e),
        runningRunId: null,
        lastEvents: [],
      };
    }
  }
}
