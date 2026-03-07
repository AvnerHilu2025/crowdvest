import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RunsService } from "../runs/runs.service";
import { RunQueueService } from "../jobs/run-queue.service";
import { ForecastService } from "../forecast/forecast.service";
import { SPY29_DATASET_VERSION } from "../common/spy29-returns";

const BENCH_STEPS = 29;
const BENCH_AGENTS = 50;
const BENCH_SEEDS = [1, 2] as number[];
const BENCH_MODEL_VERSION = "stage1";
const SEED_STRIDE = 1000;

/** Deterministic hash for baseSeed. Same params => same baseSeed. */
function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h = h | 0;
  }
  return (h >>> 0) & 0x7fffffff;
}

function makePayload(assetSymbol: string) {
  return {
    assetSymbol,
    steps: BENCH_STEPS,
    agents: BENCH_AGENTS,
    seedStart: 1,
    seeds: BENCH_SEEDS,
  };
}

const POLL_INTERVAL_MS = 500;
const MAX_WAIT_MS = 60_000;

/** Compute alwaysBuy accuracy from AssetStepReturn. Deterministic. */
function computeAlwaysBuyRate(
  returns: Array<{ step: number; stepReturn: number }>,
): number {
  if (returns.length === 0) return 0;
  const returnByStep = new Map(returns.map((r) => [r.step, r.stepReturn]));
  const maxStep = Math.max(...returns.map((r) => r.step));
  let correct = 0;
  let total = 0;
  for (let t = 0; t <= maxStep - 1; t++) {
    const nextRet = returnByStep.get(t + 1);
    if (nextRet == null || !Number.isFinite(nextRet)) continue;
    total++;
    if (nextRet > 0) correct++;
  }
  return total > 0 ? correct / total : 0;
}

/** Compute alwaysSell accuracy: correct when stepReturn[t+1] < 0. Deterministic. */
function computeAlwaysSellRate(
  returns: Array<{ step: number; stepReturn: number }>,
): number {
  if (returns.length === 0) return 0;
  const returnByStep = new Map(returns.map((r) => [r.step, r.stepReturn]));
  const maxStep = Math.max(...returns.map((r) => r.step));
  let correct = 0;
  let total = 0;
  for (let t = 0; t <= maxStep - 1; t++) {
    const nextRet = returnByStep.get(t + 1);
    if (nextRet == null || !Number.isFinite(nextRet)) continue;
    total++;
    if (nextRet < 0) correct++;
  }
  return total > 0 ? correct / total : 0;
}

/** Seeded RNG for deterministic random baseline. Returns 0..1. */
function createSeededRng(seed: number) {
  let s = (seed >>> 0) | 0;
  return function () {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s = (s + 0x6d2b79f5) | 0;
    return (s >>> 0) / 4294967296;
  };
}

/** Compute random baseline accuracy. Samples BUY/SELL/HOLD uniformly per step with seeded RNG. Deterministic. */
function computeRandomAccuracy(
  returns: Array<{ step: number; stepReturn: number }>,
  seed: number,
): number {
  if (returns.length === 0) return 0;
  const returnByStep = new Map(returns.map((r) => [r.step, r.stepReturn]));
  const maxStep = Math.max(...returns.map((r) => r.step));
  let correct = 0;
  let total = 0;
  for (let t = 0; t <= maxStep - 1; t++) {
    const nextRet = returnByStep.get(t + 1);
    if (nextRet == null || !Number.isFinite(nextRet)) continue;
    total++;
    const truth: "BUY" | "SELL" | "HOLD" =
      nextRet > 0 ? "BUY" : nextRet < 0 ? "SELL" : "HOLD";
    const rng = createSeededRng(seed * 10000 + t);
    const r = rng();
    const action: "BUY" | "SELL" | "HOLD" =
      r < 1 / 3 ? "BUY" : r < 2 / 3 ? "SELL" : "HOLD";
    if (action === truth) correct++;
  }
  return total > 0 ? correct / total : 0;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[], m?: number): number {
  if (arr.length < 2) return 0;
  const avg = m ?? mean(arr);
  const variance =
    arr.reduce((sum, x) => sum + (x - avg) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

export interface BenchSpy29Result {
  n: number;
  mean: { crowd: number; alwaysBuy: number; delta: number };
  std: { crowd: number; alwaysBuy: number; delta: number };
  winRate: number;
  rows: Array<{ runId: string; crowd: number; alwaysBuy: number; delta: number }>;
}

export interface BenchAssetsResult {
  symbols: string[];
  n: number;
  perAsset: Record<
    string,
    {
      meanCrowd: number;
      meanAlwaysBuy: number;
      meanDelta: number;
      winRate: number;
      rows: Array<{ runId: string; crowd: number; alwaysBuy: number; delta: number }>;
    }
  >;
}

export interface BenchPricesResult {
  symbols: string[];
  points: number;
  n: number;
  seeds: number[];
  perAsset: Record<
    string,
    {
      mean: {
        crowd: number;
        alwaysBuy: number;
        alwaysSell: number;
        random: number;
        delta: number;
        deltaVsAlwaysBuy: number;
        deltaVsAlwaysSell: number;
        deltaVsRandom: number;
      };
      std: { crowd: number; alwaysBuy: number; delta: number };
      winRate: number;
      winRates: { vsAlwaysBuy: number; vsAlwaysSell: number; vsRandom: number };
      rows: Array<{
        runId: string;
        crowd: number;
        alwaysBuy: number;
        alwaysSell: number;
        random: number;
        delta: number;
        seed: number;
      }>;
    }
  >;
}

export interface BenchWindowsResult {
  symbols: string[];
  windows: number[];
  n: number;
  perSymbol: Record<
    string,
    {
      perWindow: Record<
        string,
        {
          mean: {
            crowd: number;
            alwaysBuy: number;
            alwaysSell: number;
            random: number;
            delta: number;
            deltaVsAlwaysBuy: number;
            deltaVsAlwaysSell: number;
            deltaVsRandom: number;
          };
          std: { crowd: number; alwaysBuy: number; delta: number };
          winRate: number;
          winRates: { vsAlwaysBuy: number; vsAlwaysSell: number; vsRandom: number };
        }
      >;
      stability: { deltaStd: number; score: number };
    }
  >;
}

type CompareBenchWindowsInput = {
  baselineTag: string;
  current: string;
  symbols?: string[];
  windows?: number[];
  n?: number;
};

type BenchWindowDiffLite = {
  deltaVsAlwaysBuy: number;
  delta: number;
  crowd: number;
  alwaysBuy: number;
  random: number;
};

type CompareBenchWindowsResult = {
  baseline: {
    id: string;
    tag: string;
    createdAt: string;
    symbols: string[];
    windows: number[];
    n: number;
    datasetVersion: string | null;
    modelVersion: string | null;
  };
  current: {
    id: string;
    createdAt: string;
    symbols: string[];
    windows: number[];
    n: number;
    datasetVersion: string | null;
    modelVersion: string | null;
  };
  diff: {
    perSymbol: Record<
      string,
      { perWindow: Record<string, { mean: BenchWindowDiffLite }> }
    >;
  };
  summary: {
    score: number;
    count: number;
    bySymbol: Record<string, number>;
  };
};

export type RunAndCompareBenchWindowsResult = CompareBenchWindowsResult & {
  verdict: "PASS" | "REGRESSION" | "IMPROVEMENT";
  snapshotId: string;
  reusedSnapshot: boolean;
};

const GATE_THRESHOLD = -0.01;

const PROMOTE_MIN_SCORE = 0.03;
const PROMOTE_MAX_SYMBOL_REGRESSION = -0.1;

function shouldPromote(
  score: number,
  bySymbol: Record<string, number>,
): { ok: boolean; reason: string } {
  if (score < PROMOTE_MIN_SCORE) {
    return { ok: false, reason: `score ${score} below ${PROMOTE_MIN_SCORE}` };
  }
  for (const [symbol, v] of Object.entries(bySymbol)) {
    if (v <= PROMOTE_MAX_SYMBOL_REGRESSION) {
      return { ok: false, reason: `${symbol} regression ${v} <= ${PROMOTE_MAX_SYMBOL_REGRESSION}` };
    }
  }
  return { ok: true, reason: "candidate passed promotion gate" };
}

export type GateCheckResult = {
  ok: boolean;
  verdict: "PASS" | "REGRESSION" | "IMPROVEMENT";
  snapshotId: string;
  reusedSnapshot: boolean;
  score: number;
  threshold: number;
  bySymbol: Record<string, number>;
};

/** Resolve current benchmark identity (datasetVersion, modelVersion) used when bench/windows persists. Same source as runWindowsBench persist logic. */
function resolveCurrentBenchmarkVersion(): {
  datasetVersion: string;
  modelVersion: string;
} {
  return {
    datasetVersion: SPY29_DATASET_VERSION,
    modelVersion: BENCH_MODEL_VERSION,
  };
}

/** Normalize symbols to sorted comma string. Deterministic. */
function normalizeSymbolsKey(symbols: string[]): string {
  return [...symbols].filter(Boolean).sort().join(",");
}

/** Normalize windows to sorted comma string. Deterministic. */
function normalizeWindowsKey(windows: number[]): string {
  return [...windows]
    .filter((w) => Number.isFinite(w) && w > 0)
    .sort((a, b) => a - b)
    .map(String)
    .join(",");
}

/** Convert DB row symbols/windows CSV strings to arrays for API response. */
function rowToSnapshotDto(
  row: {
    id: string;
    createdAt: Date;
    symbols: string;
    windows: string;
    n: number;
    datasetVersion: string | null;
    modelVersion: string | null;
    payloadJson?: unknown;
    tag?: string | null;
    isBaseline?: boolean;
  },
  opts?: { includePayload: boolean },
) {
  const symbols = (row.symbols ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
  const windows = (row.windows ?? "")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  const base = {
    id: row.id,
    createdAt: row.createdAt,
    symbols,
    windows,
    n: row.n,
    datasetVersion: row.datasetVersion,
    modelVersion: row.modelVersion,
    ...(row.tag != null && { tag: row.tag }),
    ...(row.isBaseline != null && { isBaseline: row.isBaseline }),
  };
  if (opts?.includePayload !== false && row.payloadJson != null) {
    return { ...base, payload: row.payloadJson as object };
  }
  return base;
}

/** Parse and validate payloadJson from BenchWindowSnapshot. Throws BadRequestException if invalid. */
function parseBenchWindowsPayload(x: unknown): BenchWindowsResult {
  if (x == null) {
    throw new BadRequestException("Snapshot payloadJson is null");
  }
  if (typeof x !== "object") {
    throw new BadRequestException("Invalid snapshot payloadJson shape: expected object");
  }
  const obj = x as Record<string, unknown>;
  if (!Array.isArray(obj.symbols)) {
    throw new BadRequestException("Invalid snapshot payloadJson shape: symbols must be array");
  }
  if (!Array.isArray(obj.windows)) {
    throw new BadRequestException("Invalid snapshot payloadJson shape: windows must be array");
  }
  if (typeof obj.n !== "number" || !Number.isFinite(obj.n)) {
    throw new BadRequestException("Invalid snapshot payloadJson shape: n must be finite number");
  }
  if (typeof obj.perSymbol !== "object" || obj.perSymbol == null) {
    throw new BadRequestException("Invalid snapshot payloadJson shape: perSymbol must be object");
  }
  return obj as unknown as BenchWindowsResult;
}

interface MeanSnapshot {
  crowd: number;
  alwaysBuy: number;
  alwaysSell: number;
  random: number;
  deltaVsAlwaysBuy: number;
  deltaVsAlwaysSell: number;
  deltaVsRandom: number;
}

export interface BenchWindowSnapshotDiffResult {
  currentId: string;
  baselineId: string;
  meta: {
    symbols: string[];
    windows: number[];
    datasetVersionCurrent: string | null;
    datasetVersionBaseline: string | null;
    modelVersionCurrent: string | null;
    modelVersionBaseline: string | null;
    epsilon: number;
  };
  perSymbol: Record<
    string,
    {
      perWindow: Record<
        string,
        {
          current: MeanSnapshot;
          baseline: MeanSnapshot;
          diff: {
            crowd: number;
            alwaysBuy: number;
            alwaysSell: number;
            random: number;
            deltaVsAlwaysBuy: number;
            deltaVsAlwaysSell: number;
            deltaVsRandom: number;
          };
          flags: {
            regressionVsAlwaysBuy: boolean;
            regressionVsAlwaysSell: boolean;
            regressionVsRandom: boolean;
            improvementVsAlwaysBuy: boolean;
            improvementVsAlwaysSell: boolean;
            improvementVsRandom: boolean;
          };
        }
      >;
      regressionFlags: {
        vsAlwaysBuy: boolean;
        vsAlwaysSell: boolean;
        vsRandom: boolean;
      };
    }
  >;
  summary: {
    regressionsCount: number;
    improvementsCount: number;
    unchangedCount: number;
    epsilon: number;
    countImprovedVsAlwaysBuy: number;
    countRegressedVsAlwaysBuy: number;
    meanDeltaChange: number;
    maxImprovement: { symbol: string; window: string; value: number };
    maxRegression: { symbol: string; window: string; value: number };
  };
}

@Injectable()
export class BenchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runsService: RunsService,
    private readonly runQueue: RunQueueService,
    private readonly forecastService: ForecastService,
  ) {}

  async runSpy29Bench(opts: {
    n: number;
    overwrite: boolean;
  }): Promise<BenchSpy29Result> {
    const n = Math.min(Math.max(1, opts.n), 50);
    const overwrite = opts.overwrite === true;

    const rows: Array<{ runId: string; crowd: number; alwaysBuy: number; delta: number }> = [];

    for (let i = 0; i < n; i++) {
      const result = await this.runsService.importSpy29OrCreate(undefined);
      const runId = result.runId;

      if (result.count === BENCH_STEPS) {
        const enqueueResult = await this.runQueue.enqueueBacktest(
          runId,
          makePayload("SPY"),
        );
        if (!enqueueResult.ok || !enqueueResult.enqueued) {
          throw new BadRequestException(
            `Enqueue failed for run ${runId}: ${enqueueResult.reason ?? "unknown"}`,
          );
        }
      }

      const completed = await this.pollUntilCompleted(runId);
      if (!completed) {
        throw new BadRequestException(
          `Run ${runId} did not complete within ${MAX_WAIT_MS}ms`,
        );
      }

      await this.forecastService.computeRunAccuracy(runId, { overwrite });

      const accuracyItems = await this.prisma.runAccuracy.findMany({
        where: { runId, assetSymbol: "SPY" },
        select: { accuracyRate: true },
      });
      const crowd =
        accuracyItems.length > 0 ? accuracyItems[0]!.accuracyRate : 0;

      const returns = await this.prisma.assetStepReturn.findMany({
        where: { runId, assetSymbol: "SPY" },
        select: { step: true, stepReturn: true },
      });
      const alwaysBuy = computeAlwaysBuyRate(returns);

      const delta = crowd - alwaysBuy;
      rows.push({ runId, crowd, alwaysBuy, delta });
    }

    const crowdArr = rows.map((r) => r.crowd);
    const alwaysBuyArr = rows.map((r) => r.alwaysBuy);
    const deltaArr = rows.map((r) => r.delta);

    const winCount = rows.filter((r) => r.delta > 0).length;

    return {
      n,
      mean: {
        crowd: mean(crowdArr),
        alwaysBuy: mean(alwaysBuyArr),
        delta: mean(deltaArr),
      },
      std: {
        crowd: std(crowdArr),
        alwaysBuy: std(alwaysBuyArr),
        delta: std(deltaArr),
      },
      winRate: n > 0 ? winCount / n : 0,
      rows,
    };
  }

  private async pollUntilCompleted(runId: string): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < MAX_WAIT_MS) {
      const run = await this.prisma.simulationRun.findUnique({
        where: { id: runId },
        select: { status: true },
      });
      if (run?.status === "COMPLETED") return true;
      if (run?.status === "FAILED") return false;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    return false;
  }

  async runAssetsBench(opts: {
    symbols: string[];
    n: number;
    overwrite: boolean;
  }): Promise<BenchAssetsResult> {
    const symbols = opts.symbols.filter((s) => s?.trim()).slice(0, 10);
    if (symbols.length === 0) {
      throw new BadRequestException("symbols is required (1..10)");
    }
    const n = Math.min(Math.max(1, opts.n), 50);
    const overwrite = opts.overwrite === true;

    const perAsset: Record<
      string,
      {
        meanCrowd: number;
        meanAlwaysBuy: number;
        meanDelta: number;
        winRate: number;
        rows: Array<{ runId: string; crowd: number; alwaysBuy: number; delta: number }>;
      }
    > = {};
    for (const sym of symbols) {
      perAsset[sym] = {
        meanCrowd: 0,
        meanAlwaysBuy: 0,
        meanDelta: 0,
        winRate: 0,
        rows: [],
      };
    }

    for (let i = 0; i < n; i++) {
      const runIdsBySymbol = new Map<string, string>();

      for (const symbol of symbols) {
        const result = await this.runsService.importSymbol29OrCreate(symbol);
        runIdsBySymbol.set(symbol, result.runId);

        if (result.count === BENCH_STEPS) {
          const enqueueResult = await this.runQueue.enqueueBacktest(
            result.runId,
            makePayload(symbol),
          );
          if (!enqueueResult.ok || !enqueueResult.enqueued) {
            throw new BadRequestException(
              `Enqueue failed for ${symbol}: ${enqueueResult.reason ?? "unknown"}`,
            );
          }
        }
      }

      const allRunIds = [...runIdsBySymbol.values()];
      const completed = await this.pollUntilAllCompleted(allRunIds);
      if (!completed) {
        throw new BadRequestException(
          `Runs did not complete within ${MAX_WAIT_MS}ms`,
        );
      }

      for (const symbol of symbols) {
        const runId = runIdsBySymbol.get(symbol)!;
        await this.forecastService.computeRunAccuracy(runId, { overwrite });

        const accuracyItems = await this.prisma.runAccuracy.findMany({
          where: { runId, assetSymbol: symbol },
          select: { accuracyRate: true },
        });
        const crowd =
          accuracyItems.length > 0 ? accuracyItems[0]!.accuracyRate : 0;

        const returns = await this.prisma.assetStepReturn.findMany({
          where: { runId, assetSymbol: symbol },
          select: { step: true, stepReturn: true },
        });
        const alwaysBuy = computeAlwaysBuyRate(returns);
        const delta = crowd - alwaysBuy;

        perAsset[symbol]!.rows.push({ runId, crowd, alwaysBuy, delta });
      }
    }

    for (const symbol of symbols) {
      const rows = perAsset[symbol]!.rows;
      const crowdArr = rows.map((r) => r.crowd);
      const alwaysBuyArr = rows.map((r) => r.alwaysBuy);
      const deltaArr = rows.map((r) => r.delta);
      const winCount = rows.filter((r) => r.delta > 0).length;

      perAsset[symbol] = {
        meanCrowd: mean(crowdArr),
        meanAlwaysBuy: mean(alwaysBuyArr),
        meanDelta: mean(deltaArr),
        winRate: rows.length > 0 ? winCount / rows.length : 0,
        rows,
      };
    }

    return { symbols, n, perAsset };
  }

  async runPricesBench(opts: {
    symbols: string[];
    points?: number;
    n: number;
    overwrite: boolean;
  }): Promise<BenchPricesResult> {
    const symbols = opts.symbols.filter((s) => s?.trim()).slice(0, 10);
    if (symbols.length === 0) {
      throw new BadRequestException("symbols is required (1..10)");
    }
    const points = Math.min(Math.max(2, opts.points ?? 29), 365);
    const n = Math.min(Math.max(1, opts.n), 50);
    const overwrite = opts.overwrite === true;

    const baseSeed =
      simpleHash(
        `bench:prices:${symbols.join(",")}:${points}:${n}:${SPY29_DATASET_VERSION}:${BENCH_MODEL_VERSION}`,
      ) >>> 0;
    const seedsUsed: number[] = [];

    const perAsset: Record<
      string,
      {
        mean: {
          crowd: number;
          alwaysBuy: number;
          alwaysSell: number;
          random: number;
          delta: number;
          deltaVsAlwaysBuy: number;
          deltaVsAlwaysSell: number;
          deltaVsRandom: number;
        };
        std: { crowd: number; alwaysBuy: number; delta: number };
        winRate: number;
        winRates: { vsAlwaysBuy: number; vsAlwaysSell: number; vsRandom: number };
        rows: Array<{
          runId: string;
          crowd: number;
          alwaysBuy: number;
          alwaysSell: number;
          random: number;
          delta: number;
          seed: number;
        }>;
      }
    > = {};
    for (const sym of symbols) {
      perAsset[sym] = {
        mean: {
          crowd: 0,
          alwaysBuy: 0,
          alwaysSell: 0,
          random: 0,
          delta: 0,
          deltaVsAlwaysBuy: 0,
          deltaVsAlwaysSell: 0,
          deltaVsRandom: 0,
        },
        std: { crowd: 0, alwaysBuy: 0, delta: 0 },
        winRate: 0,
        winRates: { vsAlwaysBuy: 0, vsAlwaysSell: 0, vsRandom: 0 },
        rows: [],
      };
    }

    for (let i = 0; i < n; i++) {
      const seedStart = baseSeed + i * SEED_STRIDE;
      seedsUsed.push(seedStart);

      const result = await this.runsService.importFromPrices({
        symbols,
        points,
        seeds: BENCH_SEEDS,
      });

      const err = await this.runQueue.enqueueBacktest(result.runId, {
        assetSymbol: result.symbols.length === 1 ? result.symbols[0]! : "",
        symbols: result.symbols,
        steps: points,
        agents: BENCH_AGENTS,
        seedStart,
        seeds: BENCH_SEEDS,
      });
      if (!err.ok || !err.enqueued) {
        throw new BadRequestException(
          `Enqueue failed: ${err.reason ?? "unknown"}`,
        );
      }

      const completed = await this.pollUntilCompleted(result.runId);
      if (!completed) {
        throw new BadRequestException(
          `Run ${result.runId} did not complete within ${MAX_WAIT_MS}ms`,
        );
      }

      await this.forecastService.computeRunAccuracy(result.runId, { overwrite });

      for (const symbol of result.symbols) {
        const accuracyItems = await this.prisma.runAccuracy.findMany({
          where: { runId: result.runId, assetSymbol: symbol },
          select: { accuracyRate: true },
        });
        const crowd =
          accuracyItems.length > 0 ? accuracyItems[0]!.accuracyRate : 0;

        const returns = await this.prisma.assetStepReturn.findMany({
          where: { runId: result.runId, assetSymbol: symbol },
          select: { step: true, stepReturn: true },
        });
        const alwaysBuy = computeAlwaysBuyRate(returns);
        const alwaysSell = computeAlwaysSellRate(returns);
        const randomAcc = computeRandomAccuracy(returns, seedStart);
        const delta = crowd - alwaysBuy;

        perAsset[symbol]!.rows.push({
          runId: result.runId,
          crowd,
          alwaysBuy,
          alwaysSell,
          random: randomAcc,
          delta,
          seed: seedStart,
        });
      }
    }

    for (const symbol of symbols) {
      const rows = perAsset[symbol]!.rows;
      const crowdArr = rows.map((r) => r.crowd);
      const alwaysBuyArr = rows.map((r) => r.alwaysBuy);
      const alwaysSellArr = rows.map((r) => r.alwaysSell);
      const randomArr = rows.map((r) => r.random);
      const deltaArr = rows.map((r) => r.delta);
      const deltaVsAlwaysSellArr = rows.map((r) => r.crowd - r.alwaysSell);
      const deltaVsRandomArr = rows.map((r) => r.crowd - r.random);
      const winCountVsAlwaysBuy = rows.filter((r) => r.crowd > r.alwaysBuy).length;
      const winCountVsAlwaysSell = rows.filter((r) => r.crowd > r.alwaysSell).length;
      const winCountVsRandom = rows.filter((r) => r.crowd > r.random).length;
      const mC = mean(crowdArr);
      const mA = mean(alwaysBuyArr);
      const mAS = mean(alwaysSellArr);
      const mR = mean(randomArr);
      const mD = mean(deltaArr);

      perAsset[symbol] = {
        mean: {
          crowd: mC,
          alwaysBuy: mA,
          alwaysSell: mAS,
          random: mR,
          delta: mD,
          deltaVsAlwaysBuy: mD,
          deltaVsAlwaysSell: mean(deltaVsAlwaysSellArr),
          deltaVsRandom: mean(deltaVsRandomArr),
        },
        std: {
          crowd: std(crowdArr, mC),
          alwaysBuy: std(alwaysBuyArr, mA),
          delta: std(deltaArr, mD),
        },
        winRate: rows.length > 0 ? winCountVsAlwaysBuy / rows.length : 0,
        winRates: {
          vsAlwaysBuy: rows.length > 0 ? winCountVsAlwaysBuy / rows.length : 0,
          vsAlwaysSell: rows.length > 0 ? winCountVsAlwaysSell / rows.length : 0,
          vsRandom: rows.length > 0 ? winCountVsRandom / rows.length : 0,
        },
        rows,
      };
    }

    return { symbols, points, n, seeds: seedsUsed, perAsset };
  }

  async runWindowsBench(opts: {
    symbols: string[];
    windows: number[];
    n: number;
    overwrite: boolean;
    persist?: boolean;
  }): Promise<
    BenchWindowsResult & {
      snapshotId?: string;
      createdAt?: Date;
      datasetVersion?: string | null;
      modelVersion?: string | null;
    }
  > {
    const symbols = opts.symbols.filter((s) => s?.trim()).slice(0, 10);
    if (symbols.length === 0) {
      throw new BadRequestException("symbols is required (1..10)");
    }
    const windows = opts.windows
      .map((w) => parseInt(String(w), 10))
      .filter((v) => Number.isFinite(v) && v >= 2 && v <= 365)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 5);
    if (windows.length === 0) {
      throw new BadRequestException(
        "windows is required: comma-separated ints 2..365, max 5 (e.g. windows=29,60,120)",
      );
    }
    const n = Math.min(Math.max(1, opts.n), 50);
    const overwrite = opts.overwrite === true;

    const perSymbol: BenchWindowsResult["perSymbol"] = {};
    for (const sym of symbols) {
      perSymbol[sym] = {
        perWindow: {},
        stability: { deltaStd: 0, score: 0 },
      };
    }

    const meanDeltaBySymbolAndWindow = new Map<string, Map<number, number>>();
    for (const sym of symbols) {
      meanDeltaBySymbolAndWindow.set(sym, new Map());
    }

    let firstRunId: string | null = null;

    for (const windowPoints of windows) {
      const result = await this.runPricesBench({
        symbols,
        points: windowPoints,
        n,
        overwrite,
      });
      if (!firstRunId && symbols.length > 0) {
        const firstAsset = result.perAsset[symbols[0]!];
        if (firstAsset?.rows?.[0]?.runId) {
          firstRunId = firstAsset.rows[0].runId;
        }
      }
      const key = String(windowPoints);
      for (const symbol of symbols) {
        const asset = result.perAsset[symbol];
        if (!asset) continue;
        perSymbol[symbol]!.perWindow[key] = {
          mean: asset.mean,
          std: asset.std,
          winRate: asset.winRate,
          winRates: asset.winRates,
        };
        meanDeltaBySymbolAndWindow.get(symbol)!.set(windowPoints, asset.mean.delta);
      }
    }

    for (const symbol of symbols) {
      const deltas = windows
        .map((w) => meanDeltaBySymbolAndWindow.get(symbol)!.get(w))
        .filter((v): v is number => v != null && Number.isFinite(v));
      const deltaStd = deltas.length >= 2 ? std(deltas) : 0;
      const score = Math.max(0, Math.min(1, 1 - deltaStd));
      perSymbol[symbol]!.stability = { deltaStd, score };
    }

    const response: BenchWindowsResult & {
      snapshotId?: string;
      createdAt?: Date;
      datasetVersion?: string | null;
      modelVersion?: string | null;
    } = {
      symbols,
      windows,
      n,
      perSymbol,
    };

    if (opts.persist === true) {
      let datasetVersion: string | null = null;
      let modelVersion: string | null = null;
      if (firstRunId) {
        const run = await this.prisma.simulationRun.findUnique({
          where: { id: firstRunId },
          select: { datasetVersion: true, modelVersion: true },
        });
        if (run) {
          datasetVersion = run.datasetVersion ?? null;
          modelVersion = run.modelVersion ?? null;
        }
      }
      const points = windows.length > 0 ? Math.max(...windows) : null;
      const snapshot = await this.prisma.benchWindowSnapshot.create({
        data: {
          symbols: [...symbols].sort().join(","),
          windows: [...windows].sort((a, b) => a - b).map(String).join(","),
          n,
          points,
          overwrite,
          datasetVersion: datasetVersion ?? SPY29_DATASET_VERSION,
          modelVersion: modelVersion ?? BENCH_MODEL_VERSION,
          payloadJson: response as object,
        },
      });
      response.snapshotId = snapshot.id;
      response.createdAt = snapshot.createdAt;
      response.datasetVersion = snapshot.datasetVersion;
      response.modelVersion = snapshot.modelVersion;
    }

    return response;
  }

  /** Find latest snapshot matching symbols, windows, n, datasetVersion, modelVersion. Returns metadata only (no payload). Used for fast-path reuse. */
  async findMatchingBenchWindowSnapshot(opts: {
    symbols: string[];
    windows: number[];
    n: number;
    datasetVersion?: string;
    modelVersion?: string;
  }) {
    const symbolsKey = normalizeSymbolsKey(opts.symbols);
    const windowsKey = normalizeWindowsKey(opts.windows);
    const { datasetVersion, modelVersion } = resolveCurrentBenchmarkVersion();

    const dv = opts.datasetVersion ?? datasetVersion;
    const mv = opts.modelVersion ?? modelVersion;

    const row = await this.prisma.benchWindowSnapshot.findFirst({
      where: {
        symbols: symbolsKey,
        windows: windowsKey,
        n: opts.n,
        datasetVersion: dv,
        modelVersion: mv,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        symbols: true,
        windows: true,
        n: true,
        datasetVersion: true,
        modelVersion: true,
        tag: true,
        isBaseline: true,
      },
    });
    if (!row) return null;
    return rowToSnapshotDto({ ...row, payloadJson: null }, { includePayload: false });
  }

  async listBenchWindowSnapshots(limit: number = 20) {
    const rows = await this.prisma.benchWindowSnapshot.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(1, limit), 100),
      select: {
        id: true,
        createdAt: true,
        symbols: true,
        windows: true,
        n: true,
        datasetVersion: true,
        modelVersion: true,
        tag: true,
        isBaseline: true,
      },
    });
    return rows.map((r) => rowToSnapshotDto({ ...r, payloadJson: null }, { includePayload: false }));
  }

  async getBenchWindowSnapshot(id: string) {
    const row = await this.prisma.benchWindowSnapshot.findUnique({
      where: { id },
    });
    if (!row) return null;
    return rowToSnapshotDto(row);
  }

  async tagBenchWindowSnapshot(
    id: string,
    tag: string,
    overwrite: boolean,
  ): Promise<{ created: boolean; snapshot: ReturnType<typeof rowToSnapshotDto> }> {
    const cleanTag = (tag ?? "").trim();
    if (!cleanTag) throw new BadRequestException("tag is required");

    return this.prisma.$transaction(async (tx) => {
      const target = await tx.benchWindowSnapshot.findUnique({ where: { id } });
      if (!target) {
        throw new BadRequestException(`Snapshot ${id} not found`);
      }

      if (target.tag === cleanTag) {
        return {
          created: false,
          snapshot: rowToSnapshotDto(target),
        };
      }

      if (target.tag && target.tag !== cleanTag && !overwrite) {
        throw new ConflictException(
          `Snapshot ${id} already tagged as '${target.tag}'. Use overwrite=true to replace it.`,
        );
      }

      const owner = await tx.benchWindowSnapshot.findFirst({
        where: { tag: cleanTag },
        select: { id: true },
      });

      if (owner && owner.id !== id && !overwrite) {
        throw new ConflictException(
          `Tag '${cleanTag}' already used by snapshot ${owner.id}. Use overwrite=true to move it.`,
        );
      }

      if (owner && owner.id !== id) {
        await tx.benchWindowSnapshot.update({
          where: { id: owner.id },
          data: { tag: null, isBaseline: false },
        });
      }

      await tx.benchWindowSnapshot.update({
        where: { id },
        data: { tag: cleanTag, isBaseline: true },
      });

      const updated = await tx.benchWindowSnapshot.findUnique({
        where: { id },
      });
      return {
        created: true,
        snapshot: rowToSnapshotDto(updated!),
      };
    });
  }

  async getBenchWindowSnapshotByTag(tag: string) {
    const normalizedTag = (tag ?? "").trim();
    if (!normalizedTag) {
      throw new BadRequestException("tag is required");
    }

    const row = await this.prisma.benchWindowSnapshot.findFirst({
      where: { tag: normalizedTag },
    });

    if (!row) {
      throw new BadRequestException(
        `Snapshot with tag '${normalizedTag}' not found`,
      );
    }

    return rowToSnapshotDto(row);
  }

  async promoteCandidateBenchWindow(opts: {
    candidateId: string;
    baselineTag: string;
    newTag: string;
    overwrite: boolean;
  }): Promise<{
    ok: boolean;
    verdict: "PROMOTED" | "REJECTED";
    candidateId: string;
    baselineTag: string;
    newTag: string;
    score: number;
    bySymbol: Record<string, number>;
    reason: string;
    promotedSnapshotId?: string;
  }> {
    const { candidateId, baselineTag, newTag, overwrite } = opts;

    const compareResult = await this.compareBenchWindowsSnapshots({
      baselineTag,
      current: candidateId,
    });

    const score = compareResult.summary.score;
    const bySymbol = compareResult.summary.bySymbol;
    const { ok, reason } = shouldPromote(score, bySymbol);

    const verdict: "PROMOTED" | "REJECTED" = ok ? "PROMOTED" : "REJECTED";

    if (!ok) {
      return {
        ok: false,
        verdict: "REJECTED",
        candidateId,
        baselineTag,
        newTag,
        score,
        bySymbol,
        reason,
      };
    }

    await this.tagBenchWindowSnapshot(candidateId, newTag, overwrite);

    return {
      ok: true,
      verdict: "PROMOTED",
      candidateId,
      baselineTag,
      newTag,
      score,
      bySymbol,
      reason,
      promotedSnapshotId: candidateId,
    };
  }

  async compareBenchWindowsSnapshots(
    input: CompareBenchWindowsInput,
  ): Promise<CompareBenchWindowsResult> {
    const { baselineTag, current, symbols, windows, n } = input;

    const baselineRow = await this.prisma.benchWindowSnapshot.findFirst({
      where: { tag: baselineTag },
      orderBy: { createdAt: "desc" },
    });

    if (!baselineRow) {
      throw new BadRequestException(`Baseline tag '${baselineTag}' not found`);
    }

    const baselinePayload = parseBenchWindowsPayload(baselineRow.payloadJson);

    let currentRow = null as Awaited<
      ReturnType<typeof this.prisma.benchWindowSnapshot.findUnique>
    > | null;

    if (current === "latest") {
      if (!symbols?.length || !windows?.length) {
        throw new BadRequestException(
          "current=latest requires symbols and windows query params",
        );
      }

      const symbolsKey = [...symbols].sort().join(",");
      const windowsKey = [...windows].sort((a, b) => a - b).map(String).join(",");

      currentRow = await this.prisma.benchWindowSnapshot.findFirst({
        where: {
          symbols: symbolsKey,
          windows: windowsKey,
          ...(typeof n === "number" && Number.isFinite(n) ? { n } : {}),
        },
        orderBy: { createdAt: "desc" },
      });

      if (!currentRow) {
        currentRow = await this.prisma.benchWindowSnapshot.findFirst({
          where: { symbols: symbolsKey, windows: windowsKey },
          orderBy: { createdAt: "desc" },
        });
      }
    } else {
      currentRow = await this.prisma.benchWindowSnapshot.findUnique({
        where: { id: current },
      });
    }

    if (!currentRow) {
      throw new BadRequestException(
        `Current snapshot not found (current='${current}')`,
      );
    }

    const currentPayload = parseBenchWindowsPayload(currentRow.payloadJson);

    const outDiff: CompareBenchWindowsResult["diff"] = { perSymbol: {} };
    const bySymbol: Record<string, number> = {};
    let total = 0;
    let count = 0;

    const symList = Object.keys(currentPayload.perSymbol ?? {});
    for (const sym of symList) {
      const curSym = currentPayload.perSymbol[sym];
      const baseSym = baselinePayload.perSymbol?.[sym];
      if (!curSym?.perWindow || !baseSym?.perWindow) continue;

      outDiff.perSymbol[sym] = { perWindow: {} };

      const winList = Object.keys(curSym.perWindow);
      let symTotal = 0;
      let symCount = 0;

      for (const w of winList) {
        const curMean = curSym.perWindow[w]?.mean;
        const baseMean = baseSym.perWindow[w]?.mean;
        if (!curMean || !baseMean) continue;

        const curDeltaVsBuy =
          Number(curMean.deltaVsAlwaysBuy ?? curMean.delta ?? 0);
        const baseDeltaVsBuy =
          Number(baseMean.deltaVsAlwaysBuy ?? baseMean.delta ?? 0);

        const d = curDeltaVsBuy - baseDeltaVsBuy;

        const mean: BenchWindowDiffLite = {
          deltaVsAlwaysBuy: d,
          delta:
            Number(curMean.delta ?? 0) - Number(baseMean.delta ?? 0),
          crowd:
            Number(curMean.crowd ?? 0) - Number(baseMean.crowd ?? 0),
          alwaysBuy:
            Number(curMean.alwaysBuy ?? 0) - Number(baseMean.alwaysBuy ?? 0),
          random:
            Number(curMean.random ?? 0) - Number(baseMean.random ?? 0),
        };

        outDiff.perSymbol[sym].perWindow[String(w)] = { mean };

        symTotal += d;
        symCount += 1;
        total += d;
        count += 1;
      }

      bySymbol[sym] = symCount ? symTotal / symCount : 0;
    }

    const result: CompareBenchWindowsResult = {
      baseline: {
        id: baselineRow.id,
        tag: baselineRow.tag ?? baselineTag,
        createdAt: baselineRow.createdAt.toISOString(),
        symbols: baselinePayload.symbols ?? [],
        windows: baselinePayload.windows ?? [],
        n: baselinePayload.n ?? baselineRow.n ?? 0,
        datasetVersion: baselineRow.datasetVersion ?? null,
        modelVersion: baselineRow.modelVersion ?? null,
      },
      current: {
        id: currentRow.id,
        createdAt: currentRow.createdAt.toISOString(),
        symbols: currentPayload.symbols ?? [],
        windows: currentPayload.windows ?? [],
        n: currentPayload.n ?? currentRow.n ?? 0,
        datasetVersion: currentRow.datasetVersion ?? null,
        modelVersion: currentRow.modelVersion ?? null,
      },
      diff: outDiff,
      summary: {
        score: count ? total / count : 0,
        count,
        bySymbol,
      },
    };

    return result;
  }

  async runAndCompareBenchWindows(opts: {
    baselineTag: string;
    symbols: string[];
    windows: number[];
    n: number;
    overwrite: boolean;
    forceRun?: boolean;
  }): Promise<RunAndCompareBenchWindowsResult> {
    const { baselineTag, symbols, windows, n, overwrite, forceRun } = opts;

    let snapshotId: string;
    let reusedSnapshot: boolean;

    if (forceRun !== true) {
      const existing = await this.findMatchingBenchWindowSnapshot({
        symbols,
        windows,
        n,
      });
      if (existing) {
        snapshotId = existing.id;
        reusedSnapshot = true;
      } else {
        snapshotId = (await this.runWindowsBenchWithPersist({
          symbols,
          windows,
          n,
          overwrite,
        })) as string;
        reusedSnapshot = false;
      }
    } else {
      snapshotId = (await this.runWindowsBenchWithPersist({
        symbols,
        windows,
        n,
        overwrite,
      })) as string;
      reusedSnapshot = false;
    }

    const compareResult = await this.compareBenchWindowsSnapshots({
      baselineTag,
      current: snapshotId,
    });

    const score = compareResult.summary.score;
    const verdict: RunAndCompareBenchWindowsResult["verdict"] =
      score < -0.01 ? "REGRESSION" : score > 0.01 ? "IMPROVEMENT" : "PASS";

    return {
      ...compareResult,
      verdict,
      snapshotId,
      reusedSnapshot,
    };
  }

  /** CI-friendly regression gate. Reuses snapshot when forceRun=false; runs only when forceRun=true if no match. Returns compact verdict. */
  async runGateCheck(opts: {
    baselineTag: string;
    symbols: string[];
    windows: number[];
    n: number;
    overwrite: boolean;
    forceRun?: boolean;
  }): Promise<GateCheckResult> {
    const { baselineTag, symbols, windows, n, overwrite, forceRun } = opts;

    if (forceRun !== true) {
      const existing = await this.findMatchingBenchWindowSnapshot({
        symbols,
        windows,
        n,
      });
      if (!existing) {
        throw new BadRequestException(
          "No matching snapshot. Use forceRun=true to run benchmark.",
        );
      }
    }

    const result = await this.runAndCompareBenchWindows({
      baselineTag,
      symbols,
      windows,
      n,
      overwrite,
      forceRun: forceRun === true,
    });

    const score = result.summary.score;
    const ok = score >= GATE_THRESHOLD;

    return {
      ok,
      verdict: result.verdict,
      snapshotId: result.snapshotId,
      reusedSnapshot: result.reusedSnapshot,
      score,
      threshold: GATE_THRESHOLD,
      bySymbol: result.summary.bySymbol,
    };
  }

  /** Run bench/windows with persist=true, return snapshotId. Shared by run-and-compare slow path. */
  private async runWindowsBenchWithPersist(opts: {
    symbols: string[];
    windows: number[];
    n: number;
    overwrite: boolean;
  }): Promise<string> {
    const runResult = await this.runWindowsBench({
      ...opts,
      persist: true,
    });
    const snapshotId = runResult.snapshotId;
    if (!snapshotId) {
      throw new BadRequestException(
        "runWindowsBench with persist=true did not return snapshotId",
      );
    }
    return snapshotId;
  }

  async getBaselineByTag(tag: string) {
    const trimmed = tag?.trim();
    if (!trimmed) {
      throw new BadRequestException("tag query param is required");
    }
    const row = await this.prisma.benchWindowSnapshot.findUnique({
      where: { tag: trimmed },
    });
    if (!row) return null;
    return rowToSnapshotDto(row);
  }

  async getBaselineFamilyReport(opts: {
    symbols: string[];
    windows: number[];
    n: number;
  }): Promise<{
    snapshots: {
      baselineV1: {
        id: string;
        createdAt: string;
        tag: string;
        n: number;
        datasetVersion: string | null;
        modelVersion: string | null;
      } | null;
      baselineV2: {
        id: string;
        createdAt: string;
        tag: string;
        n: number;
        datasetVersion: string | null;
        modelVersion: string | null;
      } | null;
      latest: {
        id: string;
        createdAt: string;
        n: number;
        datasetVersion: string | null;
        modelVersion: string | null;
      } | null;
    };
    comparisons: {
      v2_vs_v1: { score: number; bySymbol: Record<string, number> } | null;
      latest_vs_v2: { score: number; bySymbol: Record<string, number> } | null;
      latest_vs_v1: { score: number; bySymbol: Record<string, number> } | null;
    };
  }> {
    const { symbols, windows, n } = opts;

    const baselineV1 = await this.getBaselineByTag("baseline-v1");
    const baselineV2 = await this.getBaselineByTag("baseline-v2");
    const latest = await this.findMatchingBenchWindowSnapshot({ symbols, windows, n });

    if (!baselineV1) {
      throw new BadRequestException("baseline-v1 not found. Tag a snapshot as baseline-v1 first.");
    }

    const toBaselineMeta = (dto: { id: string; createdAt: Date; n: number; datasetVersion?: string | null; modelVersion?: string | null; tag?: string }) => ({
      id: dto.id,
      createdAt: dto.createdAt instanceof Date ? dto.createdAt.toISOString() : String(dto.createdAt),
      tag: dto.tag ?? "",
      n: dto.n,
      datasetVersion: dto.datasetVersion ?? null,
      modelVersion: dto.modelVersion ?? null,
    });

    const snapshots = {
      baselineV1: toBaselineMeta(baselineV1),
      baselineV2: baselineV2 ? toBaselineMeta(baselineV2) : null,
      latest: latest
        ? {
            id: latest.id,
            createdAt: latest.createdAt instanceof Date ? latest.createdAt.toISOString() : String(latest.createdAt),
            n: latest.n,
            datasetVersion: latest.datasetVersion ?? null,
            modelVersion: latest.modelVersion ?? null,
          }
        : null,
    };

    let v2_vs_v1: { score: number; bySymbol: Record<string, number> } | null = null;
    let latest_vs_v2: { score: number; bySymbol: Record<string, number> } | null = null;
    let latest_vs_v1: { score: number; bySymbol: Record<string, number> } | null = null;

    if (baselineV2) {
      const cmp = await this.compareBenchWindowsSnapshots({
        baselineTag: "baseline-v1",
        current: baselineV2.id,
      });
      v2_vs_v1 = { score: cmp.summary.score, bySymbol: cmp.summary.bySymbol };
    }

    if (latest && baselineV2) {
      const cmp = await this.compareBenchWindowsSnapshots({
        baselineTag: "baseline-v2",
        current: latest.id,
      });
      latest_vs_v2 = { score: cmp.summary.score, bySymbol: cmp.summary.bySymbol };
    }

    if (latest) {
      const cmp = await this.compareBenchWindowsSnapshots({
        baselineTag: "baseline-v1",
        current: latest.id,
      });
      latest_vs_v1 = { score: cmp.summary.score, bySymbol: cmp.summary.bySymbol };
    }

    return {
      snapshots,
      comparisons: {
        v2_vs_v1,
        latest_vs_v2,
        latest_vs_v1,
      },
    };
  }

  async getWeakSymbolReport(opts: {
    baselineTag: string;
    symbols: string[];
    windows: number[];
    n: number;
  }): Promise<{
    latestSnapshot: {
      id: string;
      createdAt: string;
      n: number;
      datasetVersion: string | null;
      modelVersion: string | null;
    } | null;
    baselineTag: string;
    items: Array<{
      assetSymbol: string;
      benchmarkDeltaScore: number;
      attribution: {
        avgSyntheticSignal: number;
        avgRegimeSignal: number;
        avgDistortedSignal: number;
        avgBeliefDrift: number;
        avgPrefBUY: number;
        avgPrefSELL: number;
        avgPrefHOLD: number;
        actionMix: { buyPct: number; sellPct: number; holdPct: number };
      };
    }>;
  }> {
    const { baselineTag, symbols, windows, n } = opts;

    const latest = await this.findMatchingBenchWindowSnapshot({
      symbols,
      windows,
      n,
    });

    if (!latest) {
      throw new BadRequestException(
        `No matching snapshot found for symbols=${symbols.join(",")} windows=${windows.join(",")} n=${n}. Run benchmark first.`,
      );
    }

    const compareResult = await this.compareBenchWindowsSnapshots({
      baselineTag,
      current: latest.id,
    });

    const bySymbol = compareResult.summary.bySymbol;

    const runIdsBySymbol = new Map<string, Set<string>>();
    for (const sym of symbols) {
      const rows = await this.prisma.agentDecision.findMany({
        where: { assetSymbol: sym },
        select: { runId: true },
        distinct: ["runId"],
      });
      runIdsBySymbol.set(sym, new Set(rows.map((r) => r.runId)));
    }

    let candidateRunIds: string[] = [];
    if (symbols.length > 0) {
      const first = runIdsBySymbol.get(symbols[0]!);
      if (first) {
        candidateRunIds = [...first];
        for (let i = 1; i < symbols.length; i++) {
          const nextSet = runIdsBySymbol.get(symbols[i]!);
          if (!nextSet) {
            candidateRunIds = [];
            break;
          }
          candidateRunIds = candidateRunIds.filter((id) => nextSet.has(id));
        }
      }
    }

    let attributionBySymbol = new Map<
      string,
      {
        avgSyntheticSignal: number;
        avgRegimeSignal: number;
        avgDistortedSignal: number;
        avgBeliefDrift: number;
        avgPrefBUY: number;
        avgPrefSELL: number;
        avgPrefHOLD: number;
        actionMix: { buyPct: number; sellPct: number; holdPct: number };
      }
    >();

    if (candidateRunIds.length > 0) {
      const runs = await this.prisma.simulationRun.findMany({
        where: {
          id: { in: candidateRunIds },
          ...(latest.datasetVersion != null && { datasetVersion: latest.datasetVersion }),
          ...(latest.modelVersion != null && { modelVersion: latest.modelVersion }),
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      });
      let matchRunId: string | undefined = runs[0]?.id;
      if (!matchRunId && candidateRunIds.length > 0) {
        const fallback = await this.prisma.simulationRun.findFirst({
          where: { id: { in: candidateRunIds } },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        matchRunId = fallback?.id ?? undefined;
      }
      if (matchRunId) {
        try {
          const attr = await this.runsService.getAttributionSummary(matchRunId);
          for (const item of attr.items) {
            attributionBySymbol.set(item.assetSymbol, {
              avgSyntheticSignal: item.avgSyntheticSignal,
              avgRegimeSignal: item.avgRegimeSignal,
              avgDistortedSignal: item.avgDistortedSignal,
              avgBeliefDrift: item.avgBeliefDrift,
              avgPrefBUY: item.avgPrefBUY,
              avgPrefSELL: item.avgPrefSELL,
              avgPrefHOLD: item.avgPrefHOLD,
              actionMix: item.actionMix,
            });
          }
        } catch {
          attributionBySymbol = new Map();
        }
      }
    }

    const defaultAttribution = {
      avgSyntheticSignal: 0,
      avgRegimeSignal: 0,
      avgDistortedSignal: 0,
      avgBeliefDrift: 0,
      avgPrefBUY: 0,
      avgPrefSELL: 0,
      avgPrefHOLD: 0,
      actionMix: { buyPct: 0, sellPct: 0, holdPct: 0 },
    };

    const items = symbols.map((assetSymbol) => ({
      assetSymbol,
      benchmarkDeltaScore: bySymbol[assetSymbol] ?? 0,
      attribution: attributionBySymbol.get(assetSymbol) ?? defaultAttribution,
    }));

    items.sort((a, b) => a.benchmarkDeltaScore - b.benchmarkDeltaScore);

    return {
      latestSnapshot: {
        id: latest.id,
        createdAt: latest.createdAt instanceof Date ? latest.createdAt.toISOString() : String(latest.createdAt),
        n: latest.n,
        datasetVersion: latest.datasetVersion ?? null,
        modelVersion: latest.modelVersion ?? null,
      },
      baselineTag,
      items,
    };
  }

  async getLatestBenchWindowSnapshot(
    symbols: string,
    windows: string,
    n?: number,
  ) {
    const where: { symbols: string; windows: string; n?: number } = {
      symbols,
      windows,
    };
    if (n != null && Number.isFinite(n)) {
      where.n = n;
    }
    const row = await this.prisma.benchWindowSnapshot.findFirst({
      where,
      orderBy: { createdAt: "desc" },
    });
    if (!row) return null;
    return rowToSnapshotDto(row);
  }

  async getBenchWindowSnapshotDiff(
    currentId: string,
    baselineId: string,
  ): Promise<BenchWindowSnapshotDiffResult> {
    const [current, baseline] = await Promise.all([
      this.prisma.benchWindowSnapshot.findUnique({ where: { id: currentId } }),
      this.prisma.benchWindowSnapshot.findUnique({ where: { id: baselineId } }),
    ]);
    if (!current) {
      throw new BadRequestException(`Snapshot ${currentId} not found`);
    }
    if (!baseline) {
      throw new BadRequestException(`Baseline snapshot ${baselineId} not found`);
    }
    const symbolsA = (current.symbols ?? "").split(",").filter(Boolean).sort().join(",");
    const symbolsB = (baseline.symbols ?? "").split(",").filter(Boolean).sort().join(",");
    const windowsA = (current.windows ?? "").split(",").filter(Boolean).sort().join(",");
    const windowsB = (baseline.windows ?? "").split(",").filter(Boolean).sort().join(",");
    if (symbolsA !== symbolsB || windowsA !== windowsB) {
      throw new BadRequestException(
        `Symbols or windows mismatch: current (symbols=${symbolsA}, windows=${windowsA}) vs baseline (symbols=${symbolsB}, windows=${windowsB})`,
      );
    }

    const payloadA = parseBenchWindowsPayload(current.payloadJson);
    const payloadB = parseBenchWindowsPayload(baseline.payloadJson);
    const perSymbolA = payloadA.perSymbol ?? {};
    const perSymbolB = payloadB.perSymbol ?? {};

    const EPSILON = 0.02;
    const perSymbol: BenchWindowSnapshotDiffResult["perSymbol"] = {};
    let regressionsCount = 0;
    let improvementsCount = 0;
    let unchangedCount = 0;

    for (const symbol of symbolsA.split(",").filter(Boolean)) {
      const psA = perSymbolA[symbol]?.perWindow ?? {};
      const psB = perSymbolB[symbol]?.perWindow ?? {};
      const windowKeys = [...new Set([...Object.keys(psA), ...Object.keys(psB)])].sort(
        (a, b) => parseInt(a, 10) - parseInt(b, 10),
      );

      const perWindow: BenchWindowSnapshotDiffResult["perSymbol"][string]["perWindow"] = {};
      let vsAlwaysBuyReg = false;
      let vsAlwaysSellReg = false;
      let vsRandomReg = false;

      for (const w of windowKeys) {
        const mA = psA[w]?.mean;
        const mB = psB[w]?.mean;
        const cur: MeanSnapshot = {
          crowd: mA?.crowd ?? 0,
          alwaysBuy: mA?.alwaysBuy ?? 0,
          alwaysSell: mA?.alwaysSell ?? 0,
          random: mA?.random ?? 0,
          deltaVsAlwaysBuy: mA?.deltaVsAlwaysBuy ?? 0,
          deltaVsAlwaysSell: mA?.deltaVsAlwaysSell ?? 0,
          deltaVsRandom: mA?.deltaVsRandom ?? 0,
        };
        const base: MeanSnapshot = {
          crowd: mB?.crowd ?? 0,
          alwaysBuy: mB?.alwaysBuy ?? 0,
          alwaysSell: mB?.alwaysSell ?? 0,
          random: mB?.random ?? 0,
          deltaVsAlwaysBuy: mB?.deltaVsAlwaysBuy ?? 0,
          deltaVsAlwaysSell: mB?.deltaVsAlwaysSell ?? 0,
          deltaVsRandom: mB?.deltaVsRandom ?? 0,
        };
        const diff = {
          crowd: cur.crowd - base.crowd,
          alwaysBuy: cur.alwaysBuy - base.alwaysBuy,
          alwaysSell: cur.alwaysSell - base.alwaysSell,
          random: cur.random - base.random,
          deltaVsAlwaysBuy: cur.deltaVsAlwaysBuy - base.deltaVsAlwaysBuy,
          deltaVsAlwaysSell: cur.deltaVsAlwaysSell - base.deltaVsAlwaysSell,
          deltaVsRandom: cur.deltaVsRandom - base.deltaVsRandom,
        };

        const regVsAlwaysBuy = diff.deltaVsAlwaysBuy < -EPSILON;
        const impVsAlwaysBuy = diff.deltaVsAlwaysBuy > EPSILON;
        const regVsAlwaysSell = diff.deltaVsAlwaysSell < -EPSILON;
        const impVsAlwaysSell = diff.deltaVsAlwaysSell > EPSILON;
        const regVsRandom = diff.deltaVsRandom < -EPSILON;
        const impVsRandom = diff.deltaVsRandom > EPSILON;

        if (regVsAlwaysBuy) {
          regressionsCount++;
          vsAlwaysBuyReg = true;
        } else if (impVsAlwaysBuy) {
          improvementsCount++;
        } else {
          unchangedCount++;
        }
        if (regVsAlwaysSell) {
          regressionsCount++;
          vsAlwaysSellReg = true;
        } else if (impVsAlwaysSell) {
          improvementsCount++;
        } else {
          unchangedCount++;
        }
        if (regVsRandom) {
          regressionsCount++;
          vsRandomReg = true;
        } else if (impVsRandom) {
          improvementsCount++;
        } else {
          unchangedCount++;
        }

        perWindow[w] = {
          current: cur,
          baseline: base,
          diff,
          flags: {
            regressionVsAlwaysBuy: regVsAlwaysBuy,
            regressionVsAlwaysSell: regVsAlwaysSell,
            regressionVsRandom: regVsRandom,
            improvementVsAlwaysBuy: impVsAlwaysBuy,
            improvementVsAlwaysSell: impVsAlwaysSell,
            improvementVsRandom: impVsRandom,
          },
        };
      }

      perSymbol[symbol] = {
        perWindow,
        regressionFlags: {
          vsAlwaysBuy: vsAlwaysBuyReg,
          vsAlwaysSell: vsAlwaysSellReg,
          vsRandom: vsRandomReg,
        },
      };
    }

    const symbolList = symbolsA.split(",").filter(Boolean);
    const windowList = windowsA.split(",").filter(Boolean);
    const deltaChanges: number[] = [];
    let countImprovedVsAlwaysBuy = 0;
    let countRegressedVsAlwaysBuy = 0;
    let maxImprovement = { symbol: "", window: "", value: -Infinity };
    let maxRegression = { symbol: "", window: "", value: Infinity };
    for (const sym of symbolList) {
      const pw = perSymbol[sym]?.perWindow ?? {};
      for (const w of Object.keys(pw)) {
        const d = pw[w]?.diff?.deltaVsAlwaysBuy;
        if (d != null && Number.isFinite(d)) {
          deltaChanges.push(d);
          if (d > EPSILON) countImprovedVsAlwaysBuy++;
          if (d < -EPSILON) countRegressedVsAlwaysBuy++;
          if (d > maxImprovement.value) {
            maxImprovement = { symbol: sym, window: w, value: d };
          }
          if (d < maxRegression.value) {
            maxRegression = { symbol: sym, window: w, value: d };
          }
        }
      }
    }
    const meanDeltaChange =
      deltaChanges.length > 0
        ? deltaChanges.reduce((a, b) => a + b, 0) / deltaChanges.length
        : 0;

    return {
      currentId,
      baselineId,
      meta: {
        symbols: symbolList,
        windows: windowList.map((w) => parseInt(w, 10)).filter((v) => Number.isFinite(v)),
        datasetVersionCurrent: current.datasetVersion,
        datasetVersionBaseline: baseline.datasetVersion,
        modelVersionCurrent: current.modelVersion,
        modelVersionBaseline: baseline.modelVersion,
        epsilon: EPSILON,
      },
      perSymbol,
      summary: {
        regressionsCount,
        improvementsCount,
        unchangedCount,
        epsilon: EPSILON,
        countImprovedVsAlwaysBuy,
        countRegressedVsAlwaysBuy,
        meanDeltaChange,
        maxImprovement:
          maxImprovement.value > -Infinity
            ? maxImprovement
            : { symbol: "", window: "", value: 0 },
        maxRegression:
          maxRegression.value < Infinity
            ? maxRegression
            : { symbol: "", window: "", value: 0 },
      },
    };
  }

  private async pollUntilAllCompleted(runIds: string[]): Promise<boolean> {
    const start = Date.now();
    const pending = new Set(runIds);
    while (Date.now() - start < MAX_WAIT_MS && pending.size > 0) {
      for (const runId of [...pending]) {
        const run = await this.prisma.simulationRun.findUnique({
          where: { id: runId },
          select: { status: true },
        });
        if (run?.status === "COMPLETED") pending.delete(runId);
        if (run?.status === "FAILED") return false;
      }
      if (pending.size === 0) return true;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    return pending.size === 0;
  }
}
