import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RunQueueService } from "../jobs/run-queue.service";
import { BenchService } from "../bench/bench.service";
import { LaunchPlanService } from "../launch-plan/launch-plan.service";
import { MarketDataService } from "../market-data/market-data.service";
import { StrategyProfilesService } from "../strategy-profiles/strategy-profiles.service";
import { SignalsService } from "../signals/signals.service";

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

/** Deterministic string hash for RNG seed. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

/** Mulberry32 deterministic PRNG. Returns [0, 1). */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
  driftAsset: {
    window: number;
    count: number;
    regimeShift: boolean;
    reason: string;
    riskMean: number;
    riskDelta: number;
    deltaRisk: number;
    deltaSign: number;
    deltaCorr: number;
    direction: "UP" | "DOWN" | "STABLE";
    riskSeries: number[];
  };
  driftGlobal: {
    window: number;
    count: number;
    regimeShift: boolean;
    reason: string;
    riskMean: number;
    riskDelta: number;
    deltaRisk: number;
    deltaSign: number;
    deltaCorr: number;
    direction: "UP" | "DOWN" | "STABLE";
    riskSeries: number[];
  };
  forecastAccuracy: {
    runId: string | null;
    items: Array<{
      assetSymbol: string;
      overall: { accuracyRate: number; totalEvaluations: number; correctCount: number };
      rolling10: { accuracyRate: number; totalEvaluations: number; correctCount: number };
      baselines: {
        alwaysBuy: { accuracyRate: number; totalEvaluations: number; correctCount: number };
        random: { accuracyRate: number; totalEvaluations: number; correctCount: number };
      };
    }>;
  };
  productionAggregationMode: {
    aggregationMode: string;
    snapshotId: string;
    datasetVersion: string | null;
    modelVersion: string | null;
  } | null;
  aggregationModeRanking: Array<{
    aggregationMode: string;
    rawScore: number;
  }>;
  strategyProfile: {
    key: string;
    name: string;
    aggregationMode: string;
    selectionPolicy: string;
    intendedUse: string;
  };
  strategyDefaults: {
    benchmarkDefaults: {
      aggregationMode: string;
      selectionPolicy: string;
      symbols: string[];
      windows: number[];
      n: number;
    };
    runDefaults: {
      aggregationMode: string;
      selectionPolicy: string;
      assetSymbols: string[];
      points: number;
    };
  };
  runFlowDefaults: {
    assetSymbols: string[];
    points: number;
    aggregationMode: string;
    selectionPolicy: string;
  };
  executionPreset: {
    runPreset: {
      assetSymbols: string[];
      points: number;
      aggregationMode: string;
      selectionPolicy: string;
    };
    benchmarkPreset: {
      symbols: string[];
      windows: number[];
      n: number;
      aggregationMode: string;
      selectionPolicy: string;
      baselineTag: string;
    };
  };
  launchPlan: {
    runPlan: {
      endpoint: string;
      method: string;
      params: { symbols: string[]; points: number };
      resolved: { aggregationMode: string; selectionPolicy: string };
    };
    benchmarkPlan: {
      endpoint: string;
      method: string;
      params: {
        symbols: string[];
        windows: number[];
        n: number;
        aggregationMode: string;
        baselineTag: string;
      };
      resolved: {
        aggregationMode: string;
        selectionPolicy: string;
        baselineTag: string;
      };
    };
    governance: {
      baselineFamilyTag: string;
      candidateMode: string;
      recommendedMode: string;
      notes: string[];
    };
  };
  dataSource: {
    type: "synthetic" | "market-data";
    datasetVersion: string | null;
    provider: string | null;
  };
  crowdSignals: {
    window: number;
    items: Array<{
      symbol: string;
      signal: string;
      confidence: number;
      disagreement: number;
      instability: number;
      runsUsed: number;
    }>;
  };
  signalValidation: {
    total: number;
    validated: number;
    accuracyRate: number | null;
    latestItems: Array<{
      symbol: string;
      signal: string;
      realizedDirection: "UP" | "DOWN" | "FLAT" | null;
      correct: boolean | null;
      confidence: number;
    }>;
  };
  signalHistoryStats?: {
    totalSnapshots: number;
    symbolsCovered: number;
  };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runQueue: RunQueueService,
    private readonly benchService: BenchService,
    private readonly launchPlanService: LaunchPlanService,
    private readonly marketDataService: MarketDataService,
    private readonly strategyProfilesService: StrategyProfilesService,
    private readonly signalsService: SignalsService,
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

    const safeProductionMode = (async (): Promise<DashboardSummary["productionAggregationMode"]> => {
      try {
        const r = await this.benchService.getProductionAggregationMode();
        return r?.snapshot
          ? {
              aggregationMode: r.snapshot.aggregationMode,
              snapshotId: r.snapshot.id,
              datasetVersion: r.snapshot.datasetVersion ?? null,
              modelVersion: r.snapshot.modelVersion ?? null,
            }
          : null;
      } catch {
        return null;
      }
    })();

    const safeRanking = (async (): Promise<DashboardSummary["aggregationModeRanking"]> => {
      try {
        const r = await this.benchService.getModeLeaderboard({
          symbols: ["SPY", "QQQ", "IWM"],
          windows: [29, 60, 120],
          n: 20,
        });
        return Array.isArray(r?.ranking) ? r.ranking : [];
      } catch {
        return [];
      }
    })();

    const safeCrowdSignals = (async () => {
      try {
        const d = this.strategyProfilesService.getDefaults();
        const symbols = d.runDefaults?.assetSymbols ?? ["SPY", "QQQ", "IWM"];
        return this.signalsService.getCrowdSignalsForSummary(symbols);
      } catch {
        return { window: 20, items: [] };
      }
    })().catch(() => ({ window: 20, items: [] }));

    const safeSignalValidation = (async () => {
      try {
        const d = this.strategyProfilesService.getDefaults();
        const symbols = d.runDefaults?.assetSymbols ?? ["SPY", "QQQ", "IWM"];
        return this.signalsService.getSignalValidationForSummary(symbols);
      } catch {
        return { total: 0, validated: 0, accuracyRate: null, latestItems: [] };
      }
    })().catch(() => ({ total: 0, validated: 0, accuracyRate: null, latestItems: [] }));

    const safeSignalHistoryStats = (async () => {
      try {
        return this.signalsService.getSignalHistoryStats();
      } catch {
        return { totalSnapshots: 0, symbolsCovered: 0 };
      }
    })().catch(() => ({ totalSnapshots: 0, symbolsCovered: 0 }));

    const [consensus, driftAsset, driftGlobal, forecastAccuracy, productionAggregationMode, aggregationModeRanking, crowdSignals, signalValidation, signalHistoryStats] =
      await Promise.all([
        this.fetchConsensus(latestRun?.id ?? null, sym),
        this.getDrift({ assetSymbol: sym, window: 30 }).catch(() => ({
        window: 0,
        count: 0,
        regimeShift: false,
        reason: "error",
        riskMean: 0,
        riskDelta: 0,
        deltaRisk: 0,
        deltaSign: 0,
        deltaCorr: 0,
        direction: "STABLE" as const,
        riskSeries: [] as number[],
      })),
      this.getDrift({ window: 30 }).catch(() => ({
        window: 0,
        count: 0,
        regimeShift: false,
        reason: "error",
        riskMean: 0,
        riskDelta: 0,
        deltaRisk: 0,
        deltaSign: 0,
        deltaCorr: 0,
        direction: "STABLE" as const,
        riskSeries: [] as number[],
      })),
      this.fetchForecastAccuracy(latestRun?.id ?? null),
      safeProductionMode,
      safeRanking,
      safeCrowdSignals,
      safeSignalValidation,
      safeSignalHistoryStats,
    ]);

    let strategyProfile: DashboardSummary["strategyProfile"];
    try {
      const p = this.strategyProfilesService.getActiveProfile();
      strategyProfile = {
        key: p.key,
        name: p.name,
        aggregationMode: p.aggregationMode,
        selectionPolicy: p.selectionPolicy,
        intendedUse: p.intendedUse,
      };
    } catch {
      strategyProfile = {
        key: "conservative",
        name: "Conservative",
        aggregationMode: "top_20pct_only",
        selectionPolicy: "top_20pct_agents",
        intendedUse: "production",
      };
    }

    let strategyDefaults: DashboardSummary["strategyDefaults"];
    let runFlowDefaults: DashboardSummary["runFlowDefaults"];
    try {
      const d = this.strategyProfilesService.getDefaults();
      strategyDefaults = {
        benchmarkDefaults: d.benchmarkDefaults,
        runDefaults: d.runDefaults,
      };
      runFlowDefaults = {
        assetSymbols: d.runDefaults.assetSymbols,
        points: d.runDefaults.points,
        aggregationMode: d.runDefaults.aggregationMode,
        selectionPolicy: d.runDefaults.selectionPolicy,
      };
    } catch {
      strategyDefaults = {
        benchmarkDefaults: {
          aggregationMode: "top_20pct_only",
          selectionPolicy: "top_20pct_agents",
          symbols: ["SPY", "QQQ", "IWM"],
          windows: [29, 60, 120],
          n: 20,
        },
        runDefaults: {
          aggregationMode: "top_20pct_only",
          selectionPolicy: "top_20pct_agents",
          assetSymbols: ["SPY", "QQQ", "IWM"],
          points: 29,
        },
      };
      runFlowDefaults = {
        assetSymbols: ["SPY", "QQQ", "IWM"],
        points: 29,
        aggregationMode: "top_20pct_only",
        selectionPolicy: "top_20pct_agents",
      };
    }

    let executionPreset: DashboardSummary["executionPreset"];
    try {
      const d = this.strategyProfilesService.getDefaults();
      const baselineTag = d.benchmarkDefaults.aggregationMode === "top_20pct_only" ? "baseline-top20-v1" : "baseline-v2";
      executionPreset = {
        runPreset: {
          assetSymbols: [...d.runDefaults.assetSymbols],
          points: d.runDefaults.points,
          aggregationMode: d.runDefaults.aggregationMode,
          selectionPolicy: d.runDefaults.selectionPolicy,
        },
        benchmarkPreset: {
          symbols: [...d.benchmarkDefaults.symbols],
          windows: [...d.benchmarkDefaults.windows],
          n: d.benchmarkDefaults.n,
          aggregationMode: d.benchmarkDefaults.aggregationMode,
          selectionPolicy: d.benchmarkDefaults.selectionPolicy,
          baselineTag,
        },
      };
    } catch {
      executionPreset = {
        runPreset: {
          assetSymbols: ["SPY", "QQQ", "IWM"],
          points: 29,
          aggregationMode: "top_20pct_only",
          selectionPolicy: "top_20pct_agents",
        },
        benchmarkPreset: {
          symbols: ["SPY", "QQQ", "IWM"],
          windows: [29, 60, 120],
          n: 20,
          aggregationMode: "top_20pct_only",
          selectionPolicy: "top_20pct_agents",
          baselineTag: "baseline-top20-v1",
        },
      };
    }

    let launchPlan: DashboardSummary["launchPlan"];
    try {
      const lp = await this.launchPlanService.getLaunchPlan();
      launchPlan = {
        runPlan: lp.runPlan,
        benchmarkPlan: lp.benchmarkPlan,
        governance: lp.governance,
      };
    } catch {
      launchPlan = {
        runPlan: {
          endpoint: "/runs/import/prices",
          method: "POST",
          params: { symbols: ["SPY", "QQQ", "IWM"], points: 29 },
          resolved: { aggregationMode: "top_20pct_only", selectionPolicy: "top_20pct_agents" },
        },
        benchmarkPlan: {
          endpoint: "/bench/windows/run-and-compare",
          method: "POST",
          params: {
            symbols: ["SPY", "QQQ", "IWM"],
            windows: [29, 60, 120],
            n: 20,
            aggregationMode: "top_20pct_only",
            baselineTag: "baseline-top20-v1",
          },
          resolved: {
            aggregationMode: "top_20pct_only",
            selectionPolicy: "top_20pct_agents",
            baselineTag: "baseline-top20-v1",
          },
        },
        governance: {
          baselineFamilyTag: "baseline-top20-v1",
          candidateMode: "top_20pct_only",
          recommendedMode: "top_20pct_only",
          notes: ["Launch plan fallback (strategy/profile unavailable)."],
        },
      };
    }

    let dataSource: DashboardSummary["dataSource"];
    try {
      dataSource = await this.marketDataService.getDataSourceInfo();
    } catch {
      dataSource = { type: "synthetic", datasetVersion: null, provider: null };
    }

    return {
      consensus,
      latestRun,
      health,
      scalingRows,
      stabilityRows,
      driftAsset,
      driftGlobal,
      forecastAccuracy,
      productionAggregationMode,
      aggregationModeRanking,
      strategyProfile,
      strategyDefaults,
      runFlowDefaults,
      executionPreset,
      launchPlan,
      dataSource,
      crowdSignals,
      signalValidation,
      signalHistoryStats,
    };
  }

  private async fetchForecastAccuracy(
    runId: string | null,
  ): Promise<DashboardSummary["forecastAccuracy"]> {
    if (!runId) {
      return { runId: null, items: [] };
    }

    const [runAccuracies, forecastResults, stepReturns] = await Promise.all([
      this.prisma.runAccuracy.findMany({
        where: { runId },
        orderBy: { assetSymbol: "asc" },
      }),
      this.prisma.forecastResult.findMany({
        where: { runId },
        orderBy: [{ assetSymbol: "asc" }, { step: "desc" }],
      }),
      this.prisma.assetStepReturn.findMany({
        where: { runId },
        orderBy: [{ assetSymbol: "asc" }, { step: "asc" }],
        select: { assetSymbol: true, step: true, stepReturn: true },
      }),
    ]);

    const assetSymbols = [
      ...new Set([
        ...runAccuracies.map((r) => r.assetSymbol),
        ...stepReturns.map((r) => r.assetSymbol),
      ]),
    ].sort();

    const items: DashboardSummary["forecastAccuracy"]["items"] = [];

    for (const assetSymbol of assetSymbols) {
      const ra = runAccuracies.find((r) => r.assetSymbol === assetSymbol);
      const overall = ra
        ? {
            accuracyRate: ra.accuracyRate,
            totalEvaluations: ra.totalEvaluations,
            correctCount: ra.correctCount,
          }
        : { accuracyRate: 0, totalEvaluations: 0, correctCount: 0 };

      const frForAsset = forecastResults.filter((r) => r.assetSymbol === assetSymbol);
      const rolling10Rows = frForAsset.slice(0, 10);
      const rolling10Total = rolling10Rows.length;
      const rolling10Correct = rolling10Rows.filter((r) => r.isCorrect).length;
      const rolling10 = {
        accuracyRate: rolling10Total > 0 ? rolling10Correct / rolling10Total : 0,
        totalEvaluations: rolling10Total,
        correctCount: rolling10Correct,
      };

      const returnsForAsset = stepReturns.filter((r) => r.assetSymbol === assetSymbol);
      const returnByStep = new Map(returnsForAsset.map((r) => [r.step, r.stepReturn]));

      const maxStep = returnsForAsset.length > 0
        ? Math.max(...returnsForAsset.map((r) => r.step))
        : 0;

      let alwaysBuyCorrect = 0;
      let randomCorrect = 0;
      let baselineTotal = 0;
      const rng = mulberry32(hashString(runId + assetSymbol));

      for (let t = 0; t <= maxStep - 1; t++) {
        const nextRet = returnByStep.get(t + 1);
        if (nextRet == null || !Number.isFinite(nextRet)) continue;
        baselineTotal++;

        if (nextRet > 0) alwaysBuyCorrect++;

        const rand = rng();
        const pred = rand < 1 / 3 ? "BUY" : rand < 2 / 3 ? "SELL" : "HOLD";
        const actual = nextRet > 0 ? "BUY" : nextRet < 0 ? "SELL" : "HOLD";
        if (pred === actual) randomCorrect++;
      }
      const baselines = {
        alwaysBuy: {
          accuracyRate: baselineTotal > 0 ? alwaysBuyCorrect / baselineTotal : 0,
          totalEvaluations: baselineTotal,
          correctCount: alwaysBuyCorrect,
        },
        random: {
          accuracyRate: baselineTotal > 0 ? randomCorrect / baselineTotal : 0,
          totalEvaluations: baselineTotal,
          correctCount: randomCorrect,
        },
      };

      items.push({ assetSymbol, overall, rolling10, baselines });
    }

    return { runId, items };
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

  async getDrift(params: { assetSymbol?: string; window: number }) {
    const { assetSymbol, window } = params;
    const win = Math.max(1, Math.min(200, window));

    const runs = await this.prisma.simulationRun.findMany({
      where: {
        status: "COMPLETED",
        ...(assetSymbol
          ? { runVariants: { some: { assetSymbol: assetSymbol.trim() } } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: win,
      select: { id: true },
    });

    if (runs.length === 0) {
      return {
        window: win,
        count: 0,
        regimeShift: false,
        reason: "insufficient_history",
        riskMean: 0,
        riskDelta: 0,
        deltaRisk: 0,
        deltaSign: 0,
        deltaCorr: 0,
        direction: "STABLE" as const,
        riskSeries: [],
      };
    }

    const runIds = runs.map((r) => r.id);
    const sym = assetSymbol?.trim() || null;

    const variantRows = await this.prisma.runVariant.findMany({
      where: {
        runId: { in: runIds },
        ...(sym ? { assetSymbol: sym } : {}),
      },
      select: {
        runId: true,
        seed: true,
        summary: { select: { corr: true, directionalAccuracy: true } },
      },
    });

    const variantsByRunId = new Map<string, typeof variantRows>();
    for (const v of variantRows) {
      const list = variantsByRunId.get(v.runId) ?? [];
      list.push(v);
      variantsByRunId.set(v.runId, list);
    }

    const riskSeries: number[] = [];
    const signSeries: number[] = [];
    const corrSeries: number[] = [];

    for (const run of runs) {
      const variants = variantsByRunId.get(run.id) ?? [];
      if (variants.length < 2) {
        riskSeries.push(10);
        signSeries.push(1);
        corrSeries.push(0);
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
      const accStdDev = accs.length >= 2 ? stdDev(accs) : null;

      const medianSign = median(corrs);
      const targetSign = medianSign == null ? null : medianSign >= 0 ? 1 : -1;
      const matching =
        targetSign != null
          ? corrs.filter((c) => (c >= 0 ? 1 : -1) === targetSign).length
          : 0;
      const signAgreementRate =
        medianSign != null && corrs.length > 0 ? matching / corrs.length : null;

      const riskScore = stabilityRiskScore({
        isLegacyTiming: false,
        label: "multi-seed",
        corrSpread,
        accStdDev,
        signAgreementRate,
      });

      riskSeries.push(riskScore);
      signSeries.push(signAgreementRate ?? 1);
      corrSeries.push(corrSpread ?? 0);
    }

    function mean(arr: number[]) {
      return arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
    }

    if (riskSeries.length < 10) {
      return {
        window: Math.min(5, riskSeries.length),
        count: runs.length,
        regimeShift: false,
        reason: "insufficient_history",
        riskMean: mean(riskSeries),
        riskDelta: 0,
        deltaRisk: 0,
        deltaSign: 0,
        deltaCorr: 0,
        direction: "STABLE" as const,
        riskSeries,
      };
    }

    const windowSize = Math.min(5, Math.floor(riskSeries.length / 2));
    const recentRisk = riskSeries.slice(0, windowSize);
    const olderRisk = riskSeries.slice(-windowSize);

    const recentMean = mean(recentRisk);
    const olderMean = mean(olderRisk);

    const deltaRisk = (recentMean - olderMean) / (olderMean || 1);

    const recentSign = mean(signSeries.slice(0, windowSize));
    const olderSign = mean(signSeries.slice(-windowSize));
    const deltaSign = recentSign - olderSign;

    const recentCorr = mean(corrSeries.slice(0, windowSize));
    const olderCorr = mean(corrSeries.slice(-windowSize));
    const deltaCorr = recentCorr - olderCorr;

    /*
     * Regime Shift Conditions:
     * 1) Risk increase > 15%
     * 2) AND at least one structural metric also worsening
     */
    const regimeShift =
      deltaRisk > 0.15 && (deltaSign < -0.01 || deltaCorr > 0.02);

    let direction: "UP" | "DOWN" | "STABLE" = "STABLE";
    if (deltaRisk > 0.05) direction = "UP";
    else if (deltaRisk < -0.05) direction = "DOWN";

    return {
      window: windowSize,
      count: runs.length,
      riskMean: mean(riskSeries),
      riskDelta: deltaRisk,
      deltaRisk,
      deltaSign,
      deltaCorr,
      direction,
      regimeShift,
      reason: regimeShift ? "multi_factor_threshold" : "within_thresholds",
      riskSeries,
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
