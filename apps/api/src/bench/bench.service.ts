import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RunsService } from "../runs/runs.service";
import { RunQueueService } from "../jobs/run-queue.service";
import { ForecastService } from "../forecast/forecast.service";

const BENCH_STEPS = 29;
const BENCH_AGENTS = 50;
const BENCH_SEEDS = [1, 2] as number[];

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
  perAsset: Record<
    string,
    {
      mean: { crowd: number; alwaysBuy: number; delta: number };
      std: { crowd: number; alwaysBuy: number; delta: number };
      winRate: number;
      rows: Array<{ runId: string; crowd: number; alwaysBuy: number; delta: number }>;
    }
  >;
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

    const perAsset: Record<
      string,
      {
        mean: { crowd: number; alwaysBuy: number; delta: number };
        std: { crowd: number; alwaysBuy: number; delta: number };
        winRate: number;
        rows: Array<{ runId: string; crowd: number; alwaysBuy: number; delta: number }>;
      }
    > = {};
    for (const sym of symbols) {
      perAsset[sym] = {
        mean: { crowd: 0, alwaysBuy: 0, delta: 0 },
        std: { crowd: 0, alwaysBuy: 0, delta: 0 },
        winRate: 0,
        rows: [],
      };
    }

    for (let i = 0; i < n; i++) {
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
        seedStart: 1,
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
        const delta = crowd - alwaysBuy;

        perAsset[symbol]!.rows.push({
          runId: result.runId,
          crowd,
          alwaysBuy,
          delta,
        });
      }
    }

    for (const symbol of symbols) {
      const rows = perAsset[symbol]!.rows;
      const crowdArr = rows.map((r) => r.crowd);
      const alwaysBuyArr = rows.map((r) => r.alwaysBuy);
      const deltaArr = rows.map((r) => r.delta);
      const winCount = rows.filter((r) => r.delta > 0).length;
      const mC = mean(crowdArr);
      const mA = mean(alwaysBuyArr);
      const mD = mean(deltaArr);

      perAsset[symbol] = {
        mean: { crowd: mC, alwaysBuy: mA, delta: mD },
        std: {
          crowd: std(crowdArr, mC),
          alwaysBuy: std(alwaysBuyArr, mA),
          delta: std(deltaArr, mD),
        },
        winRate: rows.length > 0 ? winCount / rows.length : 0,
        rows,
      };
    }

    return { symbols, points, n, perAsset };
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
