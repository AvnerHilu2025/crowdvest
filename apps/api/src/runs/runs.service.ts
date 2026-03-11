import * as fs from "fs";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MarketDataService } from "../market-data/market-data.service";
import { StrategyProfilesService } from "../strategy-profiles/strategy-profiles.service";
import type { RunSummaryResponse } from "./run-summary.types";
import { getDefaultSpyCsvPath } from "../common/default-dataset";
import { SPY29_DATASET_VERSION } from "../common/spy29-returns";
import { deriveStepReturnsFromSpy, STEPS as SYMBOL29_STEPS } from "../common/symbol-returns";

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
  completedAt: Date | null;
  createdAt: Date;
  runDurationMs: number | null;
  seed: number;
  modelVersion: string;
  datasetVersion: string;
  schemaVersion: string;
};

function deriveRunDurationMsForList(r: {
  runDurationMs: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  completedAt?: Date | null;
}): number | null {
  if (r.runDurationMs != null && Number.isFinite(r.runDurationMs) && r.runDurationMs > 0) {
    return r.runDurationMs;
  }
  const start = r.startedAt;
  const end = r.finishedAt ?? r.completedAt ?? null;
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

const MODEL_VERSION = "stage1";
const SCHEMA_VERSION = "v1";

function computeStepReturnsFromCloses(closes: number[]): number[] {
  if (closes.length < 2) return [];
  const out: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) out.push(0);
    else {
      const prev = closes[i - 1]!;
      const curr = closes[i]!;
      out.push(prev === 0 ? 0 : (curr - prev) / prev);
    }
  }
  return out;
}

function correctnessFromDecision(action: string, stepReturn: number): boolean {
  if (action === "BUY") return stepReturn > 0;
  if (action === "SELL") return stepReturn < 0;
  return stepReturn === 0;
}

function bucketTrait(value: number): "low" | "mid" | "high" {
  if (value < 0.33) return "low";
  if (value < 0.66) return "mid";
  return "high";
}

/** Per-agent metric row shared by agent-alpha and selection-simulation. */
type AgentMetricRow = {
  agentId: string;
  archetypeName: string | null;
  totalDecisions: number;
  correctCount: number;
  accuracyRate: number;
  avgConfidence: number;
};

const RUN_FLOW_FALLBACK_SYMBOLS = ["SPY", "QQQ", "IWM"];
const RUN_FLOW_FALLBACK_POINTS = 29;

export interface RunMetadata {
  datasetVersion: string;
  modelVersion: string;
  strategyProfile: string;
  aggregationMode: string;
  selectionPolicy: string;
  simulationSeed: number;
}

@Injectable()
export class RunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketDataService: MarketDataService,
    private readonly strategyProfilesService: StrategyProfilesService,
  ) {}

  /** Resolve run metadata for new runs: dataset from market-data or synthetic, profile from active strategy. */
  async resolveRunMetadata(): Promise<{
    datasetVersion: string;
    modelVersion: string;
    strategyProfile: string;
    aggregationMode: string;
    selectionPolicy: string;
    simulationSeed: number;
  }> {
    let datasetVersion = "default";
    try {
      const ds = await this.marketDataService.getDataSourceInfo();
      if (ds.type === "market-data" && ds.datasetVersion) {
        datasetVersion = ds.datasetVersion;
      }
    } catch {
      // fallback: use latest run's dataset or import hash
      const latest = await this.prisma.simulationRun.findFirst({
        orderBy: { createdAt: "desc" },
        select: { datasetVersion: true },
      });
      const importRun = await this.prisma.importRun.findFirst({
        where: { type: "archetypes" },
        orderBy: { startedAt: "desc" },
        select: { sourceHash: true },
      });
      datasetVersion = latest?.datasetVersion ?? importRun?.sourceHash ?? "default";
    }

    let strategyProfile = "conservative";
    let aggregationMode = "top_20pct_only";
    let selectionPolicy = "top_20pct_agents";
    try {
      const p = this.strategyProfilesService.getActiveProfile();
      strategyProfile = p.key;
      aggregationMode = p.aggregationMode;
      selectionPolicy = p.selectionPolicy;
    } catch {
      // fallbacks
    }

    return {
      datasetVersion,
      modelVersion: MODEL_VERSION,
      strategyProfile,
      aggregationMode,
      selectionPolicy,
      simulationSeed: Math.floor(Math.random() * 0x7fffffff),
    };
  }

  /** GET /runs/:runId/metadata — return RunMetadata for a run. Throws NotFoundException if run missing. */
  async getRunMetadata(runId: string): Promise<RunMetadata & { runId: string }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        datasetVersion: true,
        modelVersion: true,
        strategyProfile: true,
        aggregationMode: true,
        selectionPolicy: true,
        seed: true,
      },
    });
    if (!run) throw new NotFoundException("Run not found");
    return {
      runId: run.id,
      datasetVersion: run.datasetVersion ?? "default",
      modelVersion: run.modelVersion ?? MODEL_VERSION,
      strategyProfile: run.strategyProfile ?? "conservative",
      aggregationMode: run.aggregationMode ?? "top_20pct_only",
      selectionPolicy: run.selectionPolicy ?? "top_20pct_agents",
      simulationSeed: run.seed,
    };
  }

  /**
   * Resolve run/import query defaults: explicit params > strategy defaults > conservative fallback.
   * Returns { symbols, points } for use in POST /runs/import/prices.
   */
  resolveRunFlowDefaults(input: {
    symbolsStr?: string;
    pointsStr?: string;
  }): { symbols: string[]; points: number } {
    let symbols: string[];
    let points: number;

    const parsedSymbols = (input.symbolsStr ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, 10);

    if (parsedSymbols.length > 0) {
      symbols = parsedSymbols;
    } else {
      try {
        const d = this.strategyProfilesService.getDefaults();
        symbols = Array.isArray(d.runDefaults?.assetSymbols) && d.runDefaults.assetSymbols.length > 0
          ? d.runDefaults.assetSymbols.slice(0, 10)
          : RUN_FLOW_FALLBACK_SYMBOLS;
      } catch {
        symbols = RUN_FLOW_FALLBACK_SYMBOLS;
      }
    }

    const parsedPoints = parseInt(input.pointsStr ?? "", 10);
    if (Number.isFinite(parsedPoints) && parsedPoints >= 2 && parsedPoints <= 365) {
      points = parsedPoints;
    } else {
      try {
        const d = this.strategyProfilesService.getDefaults();
        const p = d.runDefaults?.points;
        points = typeof p === "number" && p >= 2 && p <= 365
          ? Math.min(Math.max(2, p), 365)
          : RUN_FLOW_FALLBACK_POINTS;
      } catch {
        points = RUN_FLOW_FALLBACK_POINTS;
      }
    }

    points = Math.min(Math.max(2, points), 365);
    return { symbols, points };
  }

  /** POST /runs — create a new SimulationRun. Returns { id }. Used by smoke tests for deterministic runs. */
  async createRun(name?: string): Promise<{ id: string }> {
    const meta = await this.resolveRunMetadata();
    const runName =
      (name ?? "").trim() || `spy-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    try {
      const run = await this.prisma.simulationRun.create({
        data: {
          name: runName,
          status: "PENDING",
          seed: meta.simulationSeed,
          modelVersion: meta.modelVersion,
          datasetVersion: meta.datasetVersion,
          strategyProfile: meta.strategyProfile,
          aggregationMode: meta.aggregationMode,
          selectionPolicy: meta.selectionPolicy,
          schemaVersion: SCHEMA_VERSION,
        },
      });
      return { id: run.id };
    } catch (e) {
      if (e && typeof e === "object" && (e as { code?: string }).code === "P2002") {
        throw new ConflictException(
          `Run with name="${runName}" and datasetVersion="${meta.datasetVersion}" already exists`,
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

  /** POST /runs/import/spy29 — create 29 AssetStepReturn rows (steps 0–28) for SPY from PriceSeriesPoint. Idempotent. */
  async importSpy29(runId: string): Promise<{ ok: boolean; already?: boolean; count: number }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException("Run not found");

    const existing = await this.prisma.assetStepReturn.count({
      where: { runId, assetSymbol: "SPY" },
    });
    const REQUIRED = 29;
    if (existing >= REQUIRED) {
      return { ok: true, already: true, count: REQUIRED };
    }

    const points = await this.prisma.priceSeriesPoint.findMany({
      where: { symbol: "SPY" },
      orderBy: { date: "asc" },
      take: REQUIRED,
      select: { close: true },
    });

    if (points.length < REQUIRED) {
      throw new BadRequestException(
        `PriceSeriesPoint missing SPY data: have ${points.length}, need 29. Run pnpm --dir packages/db run db:seed`,
      );
    }

    const closes = points.map((p: { close: number }) => p.close);
    const stepReturns = computeStepReturnsFromCloses(closes);
    if (stepReturns.length < REQUIRED) {
      throw new BadRequestException(
        `PriceSeriesPoint SPY data insufficient: computed ${stepReturns.length} step returns, need 29. Run pnpm --dir packages/db run db:seed`,
      );
    }

    const data: Array<{ runId: string; assetSymbol: string; step: number; stepReturn: number }> = [];
    for (let step = 0; step < REQUIRED; step++) {
      data.push({
        runId,
        assetSymbol: "SPY",
        step,
        stepReturn: stepReturns[step]!,
      });
    }
    await this.prisma.assetStepReturn.createMany({
      data,
      skipDuplicates: true,
    });
    return { ok: true, count: REQUIRED };
  }

  /** POST /runs/import/spy29 (no body) — create run with spy29 dataset, import, return { runId, ok, count, ... }. */
  async importSpy29OrCreate(runId?: string): Promise<{ runId: string; ok: boolean; already?: boolean; count: number }> {
    let targetRunId = runId?.trim() ?? "";
    if (!targetRunId) {
      const meta = await this.resolveRunMetadata();
      const run = await this.prisma.simulationRun.create({
        data: {
          name: `spy29-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          status: "PENDING",
          seed: meta.simulationSeed,
          modelVersion: meta.modelVersion,
          datasetVersion: meta.datasetVersion,
          strategyProfile: meta.strategyProfile,
          aggregationMode: meta.aggregationMode,
          selectionPolicy: meta.selectionPolicy,
          schemaVersion: SCHEMA_VERSION,
        },
      });
      targetRunId = run.id;
    }
    const result = await this.importSpy29(targetRunId);
    return { runId: targetRunId, ...result };
  }

  /** Import 29 AssetStepReturn rows for a symbol into runId. Idempotent. SPY reads from PriceSeriesPoint; others use derived data. */
  async importSymbol29(runId: string, symbol: string): Promise<{ ok: boolean; already?: boolean; count: number }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException("Run not found");

    const assetSymbol = symbol.trim().toUpperCase() || "SPY";
    const existing = await this.prisma.assetStepReturn.count({
      where: { runId, assetSymbol },
    });
    if (existing >= SYMBOL29_STEPS) {
      return { ok: true, already: true, count: SYMBOL29_STEPS };
    }

    let stepReturns: number[];
    const requiredRows = SYMBOL29_STEPS + 1;
    const count = await this.prisma.priceSeriesPoint.count({
      where: { symbol: assetSymbol },
    });
    if (count >= requiredRows) {
      stepReturns = await this.getStepReturnsFromPriceSeriesPoint(assetSymbol);
    } else {
      const spyReturns = await this.getStepReturnsFromPriceSeriesPoint("SPY");
      stepReturns = deriveStepReturnsFromSpy(spyReturns, assetSymbol);
    }

    const data: Array<{ runId: string; assetSymbol: string; step: number; stepReturn: number }> = [];
    for (let step = 0; step < stepReturns.length; step++) {
      data.push({
        runId,
        assetSymbol,
        step,
        stepReturn: stepReturns[step]!,
      });
    }
    if (data.length === 0) return { ok: true, count: 0 };
    await this.prisma.assetStepReturn.createMany({
      data,
      skipDuplicates: true,
    });
    return { ok: true, count: stepReturns.length };
  }

  /** Fetch step returns from PriceSeriesPoint. Requires points+1 rows for points step returns. Throws BadRequestException if missing. */
  private async getStepReturnsFromPriceSeriesPoint(
    symbol: string,
    points: number = SYMBOL29_STEPS,
  ): Promise<number[]> {
    const requiredRows = points + 1;
    const rows = await this.prisma.priceSeriesPoint.findMany({
      where: { symbol },
      orderBy: { date: "asc" },
      take: requiredRows,
      select: { close: true },
    });
    if (rows.length === 0) {
      throw new BadRequestException(
        `PriceSeriesPoint has 0 rows for ${symbol}; run pnpm --filter @crowdvest/db run db:seed`,
      );
    }
    if (rows.length < requiredRows) {
      throw new BadRequestException(
        `PriceSeriesPoint missing data for ${symbol} (have ${rows.length}, need ${requiredRows}); run pnpm --filter @crowdvest/db run db:seed`,
      );
    }
    const closes = rows.map((r: { close: number }) => r.close);
    return computeStepReturnsFromCloses(closes).slice(0, points + 1);
  }

  /** Import multiple symbols from PriceSeriesPoint into one run. Creates run if runId omitted. Returns { runId, symbols, counts }. */
  async importPricesFromPriceSeriesPoint(opts: {
    symbols: string[];
    points?: number;
    runId?: string;
    nameSuffix?: string;
    /** Seeds used for backtest; expectedVariants = symbols.length * seeds.length stored in configJson. */
    seeds?: number[];
  }): Promise<{ runId: string; symbols: string[]; counts: Record<string, number> }> {
    const symbols = opts.symbols
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 10);
    if (symbols.length === 0) {
      throw new BadRequestException("symbols is required (1..10)");
    }
    const points = Math.min(Math.max(1, opts.points ?? 29), 365);

    const missing: Array<{ symbol: string; have: number; need: number }> = [];
    const seriesBySymbol = new Map<string, Array<{ date: string; close: number }>>();
    for (const symbol of symbols) {
      const rows = await this.prisma.priceSeriesPoint.findMany({
        where: { symbol },
        orderBy: { date: "asc" },
        take: points,
        select: { date: true, close: true },
      });
      seriesBySymbol.set(symbol, rows);
      if (rows.length < points) {
        missing.push({ symbol, have: rows.length, need: points });
      }
    }
    if (missing.length > 0) {
      const details = missing.map((m) => `${m.symbol} have ${m.have} need ${m.need}`).join(", ");
      throw new BadRequestException(
        `PriceSeriesPoint missing data: ${details}; run pnpm --dir packages/db run db:seed (symbols=[${symbols.join(",")}], points=${points})`,
      );
    }

    const seeds = opts.seeds ?? [1, 2];
    const expectedVariants = symbols.length * seeds.length;
    let targetRunId = opts.runId?.trim() ?? "";
    if (!targetRunId) {
      const meta = await this.resolveRunMetadata();
      const suffix = (opts.nameSuffix ?? "").trim() || Math.random().toString(36).slice(2, 9);
      const run = await this.prisma.simulationRun.create({
        data: {
          name: `prices-${Date.now()}-${suffix}`,
          status: "PENDING",
          seed: meta.simulationSeed,
          modelVersion: meta.modelVersion,
          datasetVersion: meta.datasetVersion,
          strategyProfile: meta.strategyProfile,
          aggregationMode: meta.aggregationMode,
          selectionPolicy: meta.selectionPolicy,
          schemaVersion: SCHEMA_VERSION,
          configJson: { expectedVariants, symbols } as object,
        },
      });
      targetRunId = run.id;
    } else {
      await this.prisma.simulationRun.update({
        where: { id: targetRunId },
        data: { configJson: { expectedVariants, symbols } as object },
      });
    }

    const requiredRows = points + 1;
    const counts: Record<string, number> = {};
    for (const symbol of symbols) {
      const rows = seriesBySymbol.get(symbol)!;
      const closes = rows.map((r) => r.close);
      const stepReturns = computeStepReturnsFromCloses(closes).slice(0, requiredRows);
      const existing = await this.prisma.assetStepReturn.count({
        where: { runId: targetRunId, assetSymbol: symbol },
      });
      if (existing < stepReturns.length) {
        const data = stepReturns.map((stepReturn, step) => ({
          runId: targetRunId,
          assetSymbol: symbol,
          step,
          stepReturn,
        }));
        await this.prisma.assetStepReturn.createMany({
          data,
          skipDuplicates: true,
        });
      }
      counts[symbol] = stepReturns.length;
    }
    return { runId: targetRunId, symbols, counts };
  }

  /** Import from PriceSeriesPoint. Alias for importPricesFromPriceSeriesPoint. Returns { runId, ok, symbols, points }. */
  async importFromPrices(opts: {
    symbols: string[];
    points?: number;
    nameSuffix?: string;
    seeds?: number[];
  }): Promise<{ runId: string; ok: true; symbols: string[]; points: number }> {
    const points = Math.min(Math.max(2, opts.points ?? 29), 365);
    const result = await this.importPricesFromPriceSeriesPoint({
      symbols: opts.symbols,
      points,
      nameSuffix: opts.nameSuffix,
      seeds: opts.seeds,
    });
    return { runId: result.runId, ok: true as const, symbols: result.symbols, points };
  }

  /** Create run and import symbol29 data. Returns { runId, ok, count }. */
  async importSymbol29OrCreate(
    symbol: string,
    runId?: string,
  ): Promise<{ runId: string; ok: boolean; already?: boolean; count: number }> {
    const assetSymbol = symbol.trim().toUpperCase() || "SPY";
    let targetRunId = runId?.trim() ?? "";
    if (!targetRunId) {
      const meta = await this.resolveRunMetadata();
      const run = await this.prisma.simulationRun.create({
        data: {
          name: `${assetSymbol.toLowerCase()}29-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          status: "PENDING",
          seed: meta.simulationSeed,
          modelVersion: meta.modelVersion,
          datasetVersion: meta.datasetVersion,
          strategyProfile: meta.strategyProfile,
          aggregationMode: meta.aggregationMode,
          selectionPolicy: meta.selectionPolicy,
          schemaVersion: SCHEMA_VERSION,
        },
      });
      targetRunId = run.id;
    }
    const result = await this.importSymbol29(targetRunId, assetSymbol);
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
    const meta = await this.resolveRunMetadata();
    const datasetVersion = opts.datasetVersion ?? meta.datasetVersion;
    const baseName = (opts.baseName ?? "lifecycle").trim() || "lifecycle";
    const suffix = Math.random().toString(36).slice(2, 9);
    const name = `${baseName}-${Date.now()}-${suffix}`;

    const run = await this.prisma.simulationRun.create({
      data: {
        name,
        status: "PENDING",
        seed: opts.seed ?? meta.simulationSeed,
        modelVersion: opts.modelVersion ?? meta.modelVersion,
        datasetVersion,
        strategyProfile: meta.strategyProfile,
        aggregationMode: meta.aggregationMode,
        selectionPolicy: meta.selectionPolicy,
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

  /** PATCH /runs/:runId/status — update run status. Validates transitions, idempotent for COMPLETED/FAILED. */
  async updateRunStatus(runId: string, status: "COMPLETED" | "FAILED", lastError?: string): Promise<{ id: string; status: string; finishedAt: string | null }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true, status: true, startedAt: true, completedAt: true, failedAt: true, lastError: true },
    });
    if (!run) throw new NotFoundException("Run not found");

    const from = run.status;
    const to = status;

    // Block invalid transitions: COMPLETED -> anything except COMPLETED (idempotent)
    if (from === "COMPLETED" && to !== "COMPLETED") {
      throw new ConflictException(`Invalid status transition: ${from} -> ${to}`);
    }

    const now = new Date();
    let data: Record<string, unknown>;

    if (to === "COMPLETED") {
      // Idempotent: completedAt only if null; startedAt if null (defensive)
      data = {
        status: "COMPLETED",
        completedAt: run.completedAt ?? now,
        failedAt: null,
        lastError: null,
        startedAt: run.startedAt ?? now,
      };
    } else {
      // FAILED
      // Idempotent: failedAt only if null; lastError: use provided or keep existing
      const effectiveLastError =
        lastError !== undefined ? lastError.slice(0, 1000) : (run.lastError ?? "unknown error");
      data = {
        status: "FAILED",
        failedAt: run.failedAt ?? now,
        completedAt: null,
        lastError: effectiveLastError,
        startedAt: run.startedAt ?? now,
      };
    }

    const updated = await this.prisma.simulationRun.update({
      where: { id: runId },
      data,
      select: { id: true, status: true, completedAt: true, failedAt: true },
    });

    const finishedAt =
      updated.status === "COMPLETED"
        ? updated.completedAt?.toISOString() ?? null
        : updated.status === "FAILED"
          ? updated.failedAt?.toISOString() ?? null
          : null;

    return { id: updated.id, status: updated.status, finishedAt };
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
      runDurationMs: number | null;
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
          completedAt: true,
          runDurationMs: true,
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
      const runDurationMs = deriveRunDurationMsForList(r) ?? r.runDurationMs ?? null;
      return {
        id: r.id,
        runId: r.id,
        name: r.name,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        startedAt: r.startedAt?.toISOString() ?? null,
        finishedAt: r.finishedAt?.toISOString() ?? null,
        runDurationMs,
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

  /** GET /runs/:id/return-audit — per-asset step returns from AssetStepReturn (lineage audit). */
  async getReturnAudit(runId: string): Promise<{
    runId: string;
    items: Array<{
      assetSymbol: string;
      steps: number;
      avgStepReturn: number;
      minStepReturn: number;
      maxStepReturn: number;
      first5StepReturns: number[];
      last5StepReturns: number[];
    }>;
  }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException("Run not found");

    const rows = await this.prisma.assetStepReturn.findMany({
      where: { runId },
      orderBy: { step: "asc" },
      select: { assetSymbol: true, step: true, stepReturn: true },
    });

    const bySymbol = new Map<
      string,
      { stepReturns: number[] }
    >();
    for (const r of rows) {
      let agg = bySymbol.get(r.assetSymbol);
      if (!agg) {
        agg = { stepReturns: [] };
        bySymbol.set(r.assetSymbol, agg);
      }
      agg.stepReturns.push(r.stepReturn);
    }

    const items: Array<{
      assetSymbol: string;
      steps: number;
      avgStepReturn: number;
      minStepReturn: number;
      maxStepReturn: number;
      first5StepReturns: number[];
      last5StepReturns: number[];
    }> = [];

    for (const [assetSymbol, agg] of bySymbol) {
      const arr = agg.stepReturns;
      const sum = arr.reduce((s, x) => s + x, 0);
      const avg = arr.length > 0 ? sum / arr.length : 0;
      const min = arr.length > 0 ? Math.min(...arr) : 0;
      const max = arr.length > 0 ? Math.max(...arr) : 0;
      const first5 = arr.slice(0, 5);
      const last5 = arr.slice(-5);
      items.push({
        assetSymbol,
        steps: arr.length,
        avgStepReturn: avg,
        minStepReturn: min,
        maxStepReturn: max,
        first5StepReturns: first5,
        last5StepReturns: last5,
      });
    }

    items.sort((a, b) => a.assetSymbol.localeCompare(b.assetSymbol));
    return { runId, items };
  }

  /** GET /runs/:id/attribution-summary — averages of attribution fields per assetSymbol. */
  async getAttributionSummary(runId: string): Promise<{
    runId: string;
    items: Array<{
      assetSymbol: string;
      avgSyntheticSignal: number;
      avgInfoSignal: number;
      avgEventSignal: number;
      avgRegimeSignal: number;
      avgDistortedSignal: number;
      avgBeliefDrift: number;
      avgPrefBUY: number;
      avgPrefSELL: number;
      avgPrefHOLD: number;
      actionMix: { buyPct: number; sellPct: number; holdPct: number };
    }>;
  }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException("Run not found");

    const rows = await this.prisma.agentDecision.findMany({
      where: { runId },
      select: {
        assetSymbol: true,
        action: true,
        syntheticSignal: true,
        infoSignal: true,
        eventSignal: true,
        regimeSignal: true,
        distortedSignal: true,
        beliefDrift: true,
        prefBUY: true,
        prefSELL: true,
        prefHOLD: true,
      },
    });

    const bySymbol = new Map<
      string,
      {
        synthetic: number[];
        info: number[];
        event: number[];
        regime: number[];
        distorted: number[];
        belief: number[];
        prefBUY: number[];
        prefSELL: number[];
        prefHOLD: number[];
        buy: number;
        sell: number;
        hold: number;
      }
    >();

    for (const r of rows) {
      const sym = r.assetSymbol;
      let agg = bySymbol.get(sym);
      if (!agg) {
        agg = {
          synthetic: [],
          info: [],
          event: [],
          regime: [],
          distorted: [],
          belief: [],
          prefBUY: [],
          prefSELL: [],
          prefHOLD: [],
          buy: 0,
          sell: 0,
          hold: 0,
        };
        bySymbol.set(sym, agg);
      }
      if (r.syntheticSignal != null && Number.isFinite(r.syntheticSignal)) agg.synthetic.push(r.syntheticSignal);
      if (r.infoSignal != null && Number.isFinite(r.infoSignal)) agg.info.push(r.infoSignal);
      if (r.eventSignal != null && Number.isFinite(r.eventSignal)) agg.event.push(r.eventSignal);
      if (r.regimeSignal != null && Number.isFinite(r.regimeSignal)) agg.regime.push(r.regimeSignal);
      if (r.distortedSignal != null && Number.isFinite(r.distortedSignal)) agg.distorted.push(r.distortedSignal);
      if (r.beliefDrift != null && Number.isFinite(r.beliefDrift)) agg.belief.push(r.beliefDrift);
      if (r.prefBUY != null && Number.isFinite(r.prefBUY)) agg.prefBUY.push(r.prefBUY);
      if (r.prefSELL != null && Number.isFinite(r.prefSELL)) agg.prefSELL.push(r.prefSELL);
      if (r.prefHOLD != null && Number.isFinite(r.prefHOLD)) agg.prefHOLD.push(r.prefHOLD);
      if (r.action === "BUY") agg.buy++;
      else if (r.action === "SELL") agg.sell++;
      else agg.hold++;
    }

    const items: Array<{
      assetSymbol: string;
      avgSyntheticSignal: number;
      avgInfoSignal: number;
      avgEventSignal: number;
      avgRegimeSignal: number;
      avgDistortedSignal: number;
      avgBeliefDrift: number;
      avgPrefBUY: number;
      avgPrefSELL: number;
      avgPrefHOLD: number;
      actionMix: { buyPct: number; sellPct: number; holdPct: number };
    }> = [];

    for (const [assetSymbol, agg] of bySymbol) {
      const n = agg.buy + agg.sell + agg.hold;
      const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
      const avg = (a: number[]) => (a.length > 0 ? sum(a) / a.length : 0);
      items.push({
        assetSymbol,
        avgSyntheticSignal: avg(agg.synthetic),
        avgInfoSignal: avg(agg.info),
        avgEventSignal: avg(agg.event),
        avgRegimeSignal: avg(agg.regime),
        avgDistortedSignal: avg(agg.distorted),
        avgBeliefDrift: avg(agg.belief),
        avgPrefBUY: avg(agg.prefBUY),
        avgPrefSELL: avg(agg.prefSELL),
        avgPrefHOLD: avg(agg.prefHOLD),
        actionMix: {
          buyPct: n > 0 ? agg.buy / n : 0,
          sellPct: n > 0 ? agg.sell / n : 0,
          holdPct: n > 0 ? agg.hold / n : 0,
        },
      });
    }

    items.sort((a, b) => a.assetSymbol.localeCompare(b.assetSymbol));
    return { runId, items };
  }

  /** Shared helper: fetches decisions, returns, agents; computes per-agent metrics and baseline. Used by agent-alpha and selection-simulation. */
  private async _getRunAgentMetricsData(runId: string): Promise<{
    decisions: Array<{ agentId: string; step: number; assetSymbol: string; action: string; confidence: number }>;
    returnByKey: Map<string, number>;
    agentStats: AgentMetricRow[];
    baselineCorrect: number;
    baselineTotal: number;
    agentsWithTraits: Array<{ id: string; archetype: string | null; traits: Array<{ key: string; valueNum: number | null }> }>;
  }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true, status: true },
    });
    if (!run) throw new NotFoundException("Run not found");
    if (run.status !== "COMPLETED") {
      throw new BadRequestException("Run must be COMPLETED for agent-alpha, selection-simulation, weighted-crowd-simulation and aggregation-mode-benchmark analytics");
    }

    const [decisions, returns, agentsWithTraits] = await Promise.all([
      this.prisma.agentDecision.findMany({
        where: { runId },
        select: { agentId: true, step: true, assetSymbol: true, action: true, confidence: true },
      }),
      this.prisma.assetStepReturn.findMany({
        where: { runId },
        select: { assetSymbol: true, step: true, stepReturn: true },
      }),
      this.prisma.runAgent.findMany({
        where: { decisions: { some: { runId } } },
        select: {
          id: true,
          archetype: true,
          traits: { select: { key: true, valueNum: true } },
        },
      }),
    ]);

    const returnByKey = new Map<string, number>();
    for (const r of returns) {
      returnByKey.set(`${r.assetSymbol}:${r.step}`, r.stepReturn);
    }

    const agentMap = new Map<string, { archetype: string | null; traits: Array<{ key: string; valueNum: number | null }> }>();
    for (const a of agentsWithTraits) {
      agentMap.set(a.id, {
        archetype: a.archetype ?? null,
        traits: a.traits.map((t) => ({ key: t.key, valueNum: t.valueNum })),
      });
    }

    const byAgent = new Map<string, { total: number; correct: number; confidenceSum: number }>();
    let baselineCorrect = 0;
    let baselineTotal = 0;

    for (const d of decisions) {
      const nextRet = returnByKey.get(`${d.assetSymbol}:${d.step + 1}`);
      if (nextRet == null || !Number.isFinite(nextRet)) continue;

      baselineTotal++;
      if (correctnessFromDecision(d.action, nextRet)) baselineCorrect++;

      let agg = byAgent.get(d.agentId);
      if (!agg) {
        agg = { total: 0, correct: 0, confidenceSum: 0 };
        byAgent.set(d.agentId, agg);
      }
      agg.total++;
      if (correctnessFromDecision(d.action, nextRet)) agg.correct++;
      agg.confidenceSum += Number.isFinite(d.confidence) ? d.confidence : 0;
    }

    const agentStats: AgentMetricRow[] = [];
    for (const [agentId, agg] of byAgent) {
      const info = agentMap.get(agentId);
      agentStats.push({
        agentId,
        archetypeName: info?.archetype ?? null,
        totalDecisions: agg.total,
        correctCount: agg.correct,
        accuracyRate: agg.total > 0 ? agg.correct / agg.total : 0,
        avgConfidence: agg.total > 0 ? agg.confidenceSum / agg.total : 0,
      });
    }

    return {
      decisions,
      returnByKey,
      agentStats,
      baselineCorrect,
      baselineTotal,
      agentsWithTraits: agentsWithTraits.map((a) => ({
        id: a.id,
        archetype: a.archetype ?? null,
        traits: a.traits.map((t) => ({ key: t.key, valueNum: t.valueNum })),
      })),
    };
  }

  /** Compute crowd accuracy for a run+symbol. Used by bench with aggregationMode. equal_weight uses RunAccuracy; top_20pct_only computes from AgentDecision. */
  async getCrowdAccuracyForRun(
    runId: string,
    assetSymbol: string,
    aggregationMode: "equal_weight" | "top_20pct_only",
  ): Promise<number> {
    if (aggregationMode === "equal_weight") {
      const acc = await this.prisma.runAccuracy.findFirst({
        where: { runId, assetSymbol },
        select: { accuracyRate: true },
      });
      return acc?.accuracyRate ?? 0;
    }

    const { decisions, returnByKey, agentStats } = await this._getRunAgentMetricsData(runId);
    const agentByAccuracy = [...agentStats].sort((a, b) => {
      const ar = b.accuracyRate - a.accuracyRate;
      if (ar !== 0) return ar;
      const td = b.totalDecisions - a.totalDecisions;
      if (td !== 0) return td;
      return a.agentId.localeCompare(b.agentId);
    });
    const top20Count = Math.max(1, Math.ceil(0.2 * agentStats.length));
    const top20Ids = new Set(agentByAccuracy.slice(0, top20Count).map((s) => s.agentId));

    function actionValue(action: string): number {
      if (action === "BUY") return 1;
      if (action === "SELL") return -1;
      return 0;
    }
    function scoreToAction(score: number): string {
      if (score > 0) return "BUY";
      if (score < 0) return "SELL";
      return "HOLD";
    }

    const byStep = new Map<number, Array<{ agentId: string; action: string }>>();
    for (const d of decisions) {
      if (d.assetSymbol !== assetSymbol) continue;
      let list = byStep.get(d.step);
      if (!list) {
        list = [];
        byStep.set(d.step, list);
      }
      list.push({ agentId: d.agentId, action: d.action });
    }

    let correct = 0;
    let total = 0;
    for (const [step, decs] of byStep) {
      const stepReturn = returnByKey.get(`${assetSymbol}:${step + 1}`);
      if (stepReturn == null || !Number.isFinite(stepReturn)) continue;
      total++;
      let score = 0;
      for (const d of decs) {
        if (top20Ids.has(d.agentId)) score += actionValue(d.action);
      }
      const crowdAction = scoreToAction(score);
      if (correctnessFromDecision(crowdAction, stepReturn)) correct++;
    }
    return total > 0 ? correct / total : 0;
  }

  /** GET /runs/:id/agent-alpha — agent/archetype/trait alpha analytics for completed runs. */
  async getRunAgentAlpha(runId: string): Promise<{
    runId: string;
    summary: {
      totalAgents: number;
      totalDecisions: number;
      avgAgentAccuracy: number;
      bestAgentAccuracy: number;
      worstAgentAccuracy: number;
    };
    topAgents: Array<{
      agentId: string;
      archetypeName: string | null;
      totalDecisions: number;
      correctCount: number;
      accuracyRate: number;
      avgConfidence: number;
    }>;
    bottomAgents: Array<{
      agentId: string;
      archetypeName: string | null;
      totalDecisions: number;
      correctCount: number;
      accuracyRate: number;
      avgConfidence: number;
    }>;
    archetypes: Array<{
      archetypeName: string;
      agentCount: number;
      totalDecisions: number;
      correctCount: number;
      accuracyRate: number;
      avgConfidence: number;
    }>;
    traits: Array<{
      traitKey: string;
      bucket: "low" | "mid" | "high";
      agentCount: number;
      totalDecisions: number;
      correctCount: number;
      accuracyRate: number;
    }>;
  }> {
    const { decisions, returnByKey, agentStats, baselineTotal, agentsWithTraits } =
      await this._getRunAgentMetricsData(runId);

    const agentStatsSorted = [...agentStats];
    agentStatsSorted.sort((a, b) => {
      const ar = a.accuracyRate - b.accuracyRate;
      if (ar !== 0) return -ar;
      const td = b.totalDecisions - a.totalDecisions;
      if (td !== 0) return td;
      return a.agentId.localeCompare(b.agentId);
    });

    const topAgents = agentStatsSorted.slice(0, 10).map((s) => ({
      agentId: s.agentId,
      archetypeName: s.archetypeName,
      totalDecisions: s.totalDecisions,
      correctCount: s.correctCount,
      accuracyRate: s.accuracyRate,
      avgConfidence: s.avgConfidence,
    }));

    agentStatsSorted.sort((a, b) => {
      const ar = a.accuracyRate - b.accuracyRate;
      if (ar !== 0) return ar;
      const td = b.totalDecisions - a.totalDecisions;
      if (td !== 0) return td;
      return a.agentId.localeCompare(b.agentId);
    });

    const bottomAgents = agentStatsSorted.slice(0, 10).map((s) => ({
      agentId: s.agentId,
      archetypeName: s.archetypeName,
      totalDecisions: s.totalDecisions,
      correctCount: s.correctCount,
      accuracyRate: s.accuracyRate,
      avgConfidence: s.avgConfidence,
    }));

    const byArchetype = new Map<
      string,
      { agentIds: Set<string>; total: number; correct: number; confidenceSum: number }
    >();

    for (const s of agentStats) {
      const name = s.archetypeName ?? "(unknown)";
      let agg = byArchetype.get(name);
      if (!agg) {
        agg = { agentIds: new Set(), total: 0, correct: 0, confidenceSum: 0 };
        byArchetype.set(name, agg);
      }
      agg.agentIds.add(s.agentId);
      agg.total += s.totalDecisions;
      agg.correct += s.correctCount;
      agg.confidenceSum += s.totalDecisions * s.avgConfidence;
    }

    const archetypes = Array.from(byArchetype.entries())
      .map(([archetypeName, agg]) => ({
        archetypeName,
        agentCount: agg.agentIds.size,
        totalDecisions: agg.total,
        correctCount: agg.correct,
        accuracyRate: agg.total > 0 ? agg.correct / agg.total : 0,
        avgConfidence: agg.total > 0 ? agg.confidenceSum / agg.total : 0,
      }))
      .sort((a, b) => b.accuracyRate - a.accuracyRate);

    const totalDecisions = agentStats.reduce((s, a) => s + a.totalDecisions, 0);
    const avgAgentAccuracy =
      agentStats.length > 0
        ? agentStats.reduce((s, a) => s + a.accuracyRate, 0) / agentStats.length
        : 0;

    const byTraitBucket = new Map<
      string,
      { agentIds: Set<string>; total: number; correct: number }
    >();

    for (const a of agentsWithTraits) {
      const agentStat = agentStats.find((s) => s.agentId === a.id);
      if (!agentStat) continue;
      for (const t of a.traits) {
        const v = t.valueNum;
        if (v == null || !Number.isFinite(v)) continue;
        const bucket = bucketTrait(v);
        const key = `${t.key}:${bucket}`;
        let agg = byTraitBucket.get(key);
        if (!agg) {
          agg = { agentIds: new Set(), total: 0, correct: 0 };
          byTraitBucket.set(key, agg);
        }
        agg.agentIds.add(a.id);
        agg.total += agentStat.totalDecisions;
        agg.correct += agentStat.correctCount;
      }
    }

    const traits = Array.from(byTraitBucket.entries())
      .map(([key, agg]) => {
        const lastColon = key.lastIndexOf(":");
        const traitKey = lastColon >= 0 ? key.slice(0, lastColon) : key;
        const bucket = (lastColon >= 0 ? key.slice(lastColon + 1) : "mid") as "low" | "mid" | "high";
        return {
          traitKey,
          bucket,
          agentCount: agg.agentIds.size,
          totalDecisions: agg.total,
          correctCount: agg.correct,
          accuracyRate: agg.total > 0 ? agg.correct / agg.total : 0,
        };
      })
      .sort((a, b) => {
        const da = Math.abs(a.accuracyRate - avgAgentAccuracy);
        const db = Math.abs(b.accuracyRate - avgAgentAccuracy);
        if (db !== da) return db - da;
        return b.totalDecisions - a.totalDecisions;
      })
      .slice(0, 30);

    const bestAgentAccuracy = agentStats.length > 0 ? Math.max(...agentStats.map((s) => s.accuracyRate)) : 0;
    const worstAgentAccuracy = agentStats.length > 0 ? Math.min(...agentStats.map((s) => s.accuracyRate)) : 0;

    return {
      runId,
      summary: {
        totalAgents: agentStats.length,
        totalDecisions,
        avgAgentAccuracy,
        bestAgentAccuracy,
        worstAgentAccuracy,
      },
      topAgents,
      bottomAgents,
      archetypes,
      traits,
    };
  }

  /** GET /runs/:id/selection-simulation — simulates selection policies (completed runs only). */
  async getRunSelectionSimulation(runId: string): Promise<{
    runId: string;
    baseline: {
      totalAgents: number;
      totalDecisions: number;
      accuracyRate: number;
    };
    scenarios: Array<{
      name: string;
      selectedAgents: number;
      selectedDecisions: number;
      accuracyRate: number | null;
      deltaVsBaseline: number | null;
    }>;
    topContributors: Array<{
      agentId: string;
      archetypeName: string | null;
      accuracyRate: number;
      totalDecisions: number;
      avgConfidence: number;
    }>;
  }> {
    const { decisions, returnByKey, agentStats, baselineCorrect, baselineTotal } =
      await this._getRunAgentMetricsData(runId);

    const baselineAccuracyRate = baselineTotal > 0 ? baselineCorrect / baselineTotal : 0;

    function accuracyForSelectedAgents(selectedAgentIds: Set<string>): { total: number; correct: number } {
      let total = 0;
      let correct = 0;
      for (const d of decisions) {
        const nextRet = returnByKey.get(`${d.assetSymbol}:${d.step + 1}`);
        if (nextRet == null || !Number.isFinite(nextRet)) continue;
        if (!selectedAgentIds.has(d.agentId)) continue;
        total++;
        if (correctnessFromDecision(d.action, nextRet)) correct++;
      }
      return { total, correct };
    }

    const agentStatsByAccuracy = [...agentStats].sort((a, b) => {
      const ar = b.accuracyRate - a.accuracyRate;
      if (ar !== 0) return ar;
      return b.totalDecisions - a.totalDecisions;
    });

    const n = agentStats.length;
    const top10Ids = new Set(agentStatsByAccuracy.slice(0, Math.max(1, Math.ceil(0.1 * n))).map((s) => s.agentId));
    const top20Ids = new Set(agentStatsByAccuracy.slice(0, Math.max(1, Math.ceil(0.2 * n))).map((s) => s.agentId));
    const top30Ids = new Set(agentStatsByAccuracy.slice(0, Math.max(1, Math.ceil(0.3 * n))).map((s) => s.agentId));
    const accGte50Ids = new Set(agentStats.filter((s) => s.accuracyRate >= 0.5).map((s) => s.agentId));

    const s10 = accuracyForSelectedAgents(top10Ids);
    const s20 = accuracyForSelectedAgents(top20Ids);
    const s30 = accuracyForSelectedAgents(top30Ids);
    const s50 = accuracyForSelectedAgents(accGte50Ids);

    const weightSum = agentStats.reduce((s, a) => s + a.avgConfidence * a.totalDecisions, 0);
    const weightedCorrectSum = agentStats.reduce(
      (s, a) => s + a.accuracyRate * a.avgConfidence * a.totalDecisions,
      0,
    );
    const confidenceWeightedAccuracy = weightSum > 0 ? weightedCorrectSum / weightSum : null;

    function scenario(
      name: string,
      selectedAgents: number,
      selectedDecisions: number,
      accuracyRate: number | null,
    ): { name: string; selectedAgents: number; selectedDecisions: number; accuracyRate: number | null; deltaVsBaseline: number | null } {
      return {
        name,
        selectedAgents,
        selectedDecisions,
        accuracyRate,
        deltaVsBaseline: accuracyRate != null ? accuracyRate - baselineAccuracyRate : null,
      };
    }

    const scenarios: Array<{
      name: string;
      selectedAgents: number;
      selectedDecisions: number;
      accuracyRate: number | null;
      deltaVsBaseline: number | null;
    }> = [
      scenario(
        "top_10pct_agents",
        top10Ids.size,
        s10.total,
        s10.total > 0 ? s10.correct / s10.total : null,
      ),
      scenario(
        "top_20pct_agents",
        top20Ids.size,
        s20.total,
        s20.total > 0 ? s20.correct / s20.total : null,
      ),
      scenario(
        "top_30pct_agents",
        top30Ids.size,
        s30.total,
        s30.total > 0 ? s30.correct / s30.total : null,
      ),
      scenario(
        "accuracy_gte_0_50",
        accGte50Ids.size,
        s50.total,
        accGte50Ids.size === 0 ? null : s50.total > 0 ? s50.correct / s50.total : null,
      ),
      scenario(
        "confidence_weighted_all_agents",
        n,
        baselineTotal,
        confidenceWeightedAccuracy,
      ),
    ];

    const topContributors = agentStatsByAccuracy.slice(0, 10).map((s) => ({
      agentId: s.agentId,
      archetypeName: s.archetypeName,
      accuracyRate: s.accuracyRate,
      totalDecisions: s.totalDecisions,
      avgConfidence: s.avgConfidence,
    }));

    return {
      runId,
      baseline: {
        totalAgents: n,
        totalDecisions: baselineTotal,
        accuracyRate: baselineAccuracyRate,
      },
      scenarios,
      topContributors,
    };
  }

  /** GET /runs/:id/weighted-crowd-simulation — weighted crowd voting simulation (completed runs only). */
  async getRunWeightedCrowdSimulation(runId: string): Promise<{
    runId: string;
    baseline: {
      equalWeightAccuracyRate: number;
      totalAgents: number;
      totalDecisions: number;
    };
    scenarios: Array<{
      name: string;
      accuracyRate: number;
      deltaVsBaseline: number;
    }>;
  }> {
    const { decisions, returnByKey, agentStats } = await this._getRunAgentMetricsData(runId);

    const agentById = new Map<string, AgentMetricRow>();
    for (const a of agentStats) agentById.set(a.agentId, a);

    const agentByAccuracy = [...agentStats].sort((a, b) => b.accuracyRate - a.accuracyRate);
    const top20Count = Math.max(1, Math.ceil(0.2 * agentStats.length));
    const top20Ids = new Set(agentByAccuracy.slice(0, top20Count).map((s) => s.agentId));

    function actionValue(action: string): number {
      if (action === "BUY") return 1;
      if (action === "SELL") return -1;
      return 0;
    }

    function scoreToAction(score: number): string {
      if (score > 0) return "BUY";
      if (score < 0) return "SELL";
      return "HOLD";
    }

    const byStep = new Map<string, Array<{ agentId: string; action: string }>>();
    for (const d of decisions) {
      const key = `${d.assetSymbol}:${d.step}`;
      let list = byStep.get(key);
      if (!list) {
        list = [];
        byStep.set(key, list);
      }
      list.push({ agentId: d.agentId, action: d.action });
    }

    let equalCorrect = 0;
    let accCorrect = 0;
    let accConfCorrect = 0;
    let top20Correct = 0;
    let total = 0;

    for (const [key, decs] of byStep) {
      const [assetSymbol, stepStr] = key.split(":");
      const step = parseInt(stepStr!, 10);
      const stepReturn = returnByKey.get(`${assetSymbol}:${step + 1}`);
      if (stepReturn == null || !Number.isFinite(stepReturn)) continue;

      total++;

      let scoreEqual = 0;
      let scoreAcc = 0;
      let scoreAccConf = 0;
      let scoreTop20 = 0;

      for (const d of decs) {
        const v = actionValue(d.action);
        const agent = agentById.get(d.agentId);
        const acc = agent ? agent.accuracyRate : 0;
        const conf = agent ? agent.avgConfidence : 0;

        scoreEqual += v;

        const wAcc = Math.max(0.01, acc);
        scoreAcc += v * wAcc;

        const wAccConf = Math.max(0.01, acc * conf);
        scoreAccConf += v * wAccConf;

        if (top20Ids.has(d.agentId)) scoreTop20 += v;
      }

      const crowdEqual = scoreToAction(scoreEqual);
      const crowdAcc = scoreToAction(scoreAcc);
      const crowdAccConf = scoreToAction(scoreAccConf);
      const crowdTop20 = scoreToAction(scoreTop20);

      if (correctnessFromDecision(crowdEqual, stepReturn)) equalCorrect++;
      if (correctnessFromDecision(crowdAcc, stepReturn)) accCorrect++;
      if (correctnessFromDecision(crowdAccConf, stepReturn)) accConfCorrect++;
      if (correctnessFromDecision(crowdTop20, stepReturn)) top20Correct++;
    }

    const equalWeightAccuracyRate = total > 0 ? equalCorrect / total : 0;
    const accAccuracyRate = total > 0 ? accCorrect / total : 0;
    const accConfAccuracyRate = total > 0 ? accConfCorrect / total : 0;
    const top20AccuracyRate = total > 0 ? top20Correct / total : 0;

    return {
      runId,
      baseline: {
        equalWeightAccuracyRate,
        totalAgents: agentStats.length,
        totalDecisions: total,
      },
      scenarios: [
        { name: "equal_weight", accuracyRate: equalWeightAccuracyRate, deltaVsBaseline: 0 },
        { name: "weight_by_agent_accuracy", accuracyRate: accAccuracyRate, deltaVsBaseline: accAccuracyRate - equalWeightAccuracyRate },
        { name: "weight_by_agent_accuracy_x_confidence", accuracyRate: accConfAccuracyRate, deltaVsBaseline: accConfAccuracyRate - equalWeightAccuracyRate },
        { name: "weight_top_20pct_only", accuracyRate: top20AccuracyRate, deltaVsBaseline: top20AccuracyRate - equalWeightAccuracyRate },
      ],
    };
  }

  /** GET /runs/:id/aggregation-mode-benchmark — benchmark equal_weight vs top_20pct_only (completed runs only). */
  async getRunAggregationModeBenchmark(runId: string): Promise<{
    runId: string;
    modes: Array<{
      name: string;
      accuracyRate: number;
      totalPredictions: number;
      deltaVsEqualWeight?: number;
    }>;
    selectedAgents: {
      top20pct: Array<{
        agentId: string;
        archetypeName: string | null;
        accuracyRate: number;
        totalDecisions: number;
        avgConfidence: number;
      }>;
    };
  }> {
    const { decisions, returnByKey, agentStats } = await this._getRunAgentMetricsData(runId);

    const agentById = new Map<string, AgentMetricRow>();
    for (const a of agentStats) agentById.set(a.agentId, a);

    const agentByAccuracy = [...agentStats].sort((a, b) => {
      const ar = b.accuracyRate - a.accuracyRate;
      if (ar !== 0) return ar;
      const td = b.totalDecisions - a.totalDecisions;
      if (td !== 0) return td;
      return a.agentId.localeCompare(b.agentId);
    });
    const top20Count = Math.max(1, Math.ceil(0.2 * agentStats.length));
    const top20Agents = agentByAccuracy.slice(0, top20Count);
    const top20Ids = new Set(top20Agents.map((s) => s.agentId));

    function actionValue(action: string): number {
      if (action === "BUY") return 1;
      if (action === "SELL") return -1;
      return 0;
    }

    function scoreToAction(score: number): string {
      if (score > 0) return "BUY";
      if (score < 0) return "SELL";
      return "HOLD";
    }

    const byStep = new Map<string, Array<{ agentId: string; action: string }>>();
    for (const d of decisions) {
      const key = `${d.assetSymbol}:${d.step}`;
      let list = byStep.get(key);
      if (!list) {
        list = [];
        byStep.set(key, list);
      }
      list.push({ agentId: d.agentId, action: d.action });
    }

    let equalCorrect = 0;
    let top20Correct = 0;
    let total = 0;

    for (const [key, decs] of byStep) {
      const [assetSymbol, stepStr] = key.split(":");
      const step = parseInt(stepStr!, 10);
      const stepReturn = returnByKey.get(`${assetSymbol}:${step + 1}`);
      if (stepReturn == null || !Number.isFinite(stepReturn)) continue;

      total++;

      let scoreEqual = 0;
      let scoreTop20 = 0;

      for (const d of decs) {
        const v = actionValue(d.action);
        scoreEqual += v;
        if (top20Ids.has(d.agentId)) scoreTop20 += v;
      }

      const crowdEqual = scoreToAction(scoreEqual);
      const crowdTop20 = scoreToAction(scoreTop20);

      if (correctnessFromDecision(crowdEqual, stepReturn)) equalCorrect++;
      if (correctnessFromDecision(crowdTop20, stepReturn)) top20Correct++;
    }

    const equalWeightAccuracyRate = total > 0 ? equalCorrect / total : 0;
    const top20AccuracyRate = total > 0 ? top20Correct / total : 0;

    return {
      runId,
      modes: [
        { name: "equal_weight", accuracyRate: equalWeightAccuracyRate, totalPredictions: total },
        {
          name: "top_20pct_only",
          accuracyRate: top20AccuracyRate,
          totalPredictions: total,
          deltaVsEqualWeight: top20AccuracyRate - equalWeightAccuracyRate,
        },
      ],
      selectedAgents: {
        top20pct: top20Agents.map((s) => ({
          agentId: s.agentId,
          archetypeName: s.archetypeName,
          accuracyRate: s.accuracyRate,
          totalDecisions: s.totalDecisions,
          avgConfidence: s.avgConfidence,
        })),
      },
    };
  }

  /** GET /runs/:id/attribution-sample?assetSymbol=SPY&limit=20 — sample of AgentDecision rows with attribution fields. */
  async getAttributionSample(
    runId: string,
    opts: { assetSymbol?: string; limit: number },
  ): Promise<{
    items: Array<{
      step: number;
      action: string;
      confidence: number;
      syntheticSignal: number | null;
      infoSignal: number | null;
      eventSignal: number | null;
      regimeSignal: number | null;
      distortedSignal: number | null;
      beliefDrift: number | null;
      prefBUY: number | null;
      prefSELL: number | null;
      prefHOLD: number | null;
    }>;
  }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException("Run not found");

    const where: { runId: string; assetSymbol?: string } = { runId };
    if (opts.assetSymbol) where.assetSymbol = opts.assetSymbol;

    const rows = await this.prisma.agentDecision.findMany({
      where,
      orderBy: [{ step: "asc" }, { agentId: "asc" }],
      take: opts.limit,
      select: {
        step: true,
        action: true,
        confidence: true,
        syntheticSignal: true,
        infoSignal: true,
        eventSignal: true,
        regimeSignal: true,
        distortedSignal: true,
        beliefDrift: true,
        prefBUY: true,
        prefSELL: true,
        prefHOLD: true,
      },
    });

    return {
      items: rows.map((r) => ({
        step: r.step,
        action: r.action,
        confidence: r.confidence,
        syntheticSignal: r.syntheticSignal,
        infoSignal: r.infoSignal,
        eventSignal: r.eventSignal,
        regimeSignal: r.regimeSignal,
        distortedSignal: r.distortedSignal,
        beliefDrift: r.beliefDrift,
        prefBUY: r.prefBUY,
        prefSELL: r.prefSELL,
        prefHOLD: r.prefHOLD,
      })),
    };
  }

  /** GET /runs/:runId/variants — list RunVariants for run with optional filters; returns { items, total, agreementMatrix }. */
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
      durationMs: number | null;
      startedAt: string | null;
      completedAt: string | null;
      summary: {
        corr: number | null;
        directionalAccuracy: number | null;
        pairsCount: number | null;
        createdAt: string;
      } | null;
    }>;
    total: number;
    agreementMatrix: Array<{ seedA: number; seedB: number; agreement: number }>;
    seedProfiles: Array<{
      seed: number;
      buyPct: number;
      sellPct: number;
      holdPct: number;
      netBias: number;
      dominantDirection: "BUY" | "SELL" | "HOLD";
    }>;
    stepAgreement: Array<{ step: number; agreementPct: number }>;
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
          durationMs: true,
          startedAt: true,
          completedAt: true,
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
        durationMs: v.durationMs ?? null,
        startedAt: v.startedAt?.toISOString() ?? null,
        completedAt: v.completedAt?.toISOString() ?? null,
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
      agreementMatrix: await this.computeAgreementMatrix(variants),
      seedProfiles: await this.computeSeedProfiles(variants),
      stepAgreement: await this.computeStepAgreement(variants),
    };
  }

  private async computeStepAgreement(
    variants: Array<{ id: string; seed: number }>,
  ): Promise<Array<{ step: number; agreementPct: number }>> {
    if (variants.length < 2) return [];

    const variantIds = variants.map((v) => v.id);
    const allDecisions = await this.prisma.agentDecision.findMany({
      where: { runVariantId: { in: variantIds } },
      select: { runVariantId: true, step: true, agentId: true, action: true },
      orderBy: [{ step: "asc" }, { agentId: "asc" }],
    });

    const byVariantAndStep = new Map<string, Map<number, Map<string, number>>>();
    for (const d of allDecisions) {
      const vid = d.runVariantId;
      if (!vid) continue;
      if (!byVariantAndStep.has(vid)) {
        byVariantAndStep.set(vid, new Map());
      }
      const stepMap = byVariantAndStep.get(vid)!;
      if (!stepMap.has(d.step)) {
        stepMap.set(d.step, new Map([["BUY", 0], ["SELL", 0], ["HOLD", 0]]));
      }
      const freq = stepMap.get(d.step)!;
      const action = String(d.action);
      if (action === "BUY" || action === "SELL" || action === "HOLD") {
        freq.set(action, (freq.get(action) ?? 0) + 1);
      }
    }

    const stepsSet = new Set<number>();
    for (const [, stepMap] of byVariantAndStep) {
      for (const step of stepMap.keys()) {
        stepsSet.add(step);
      }
    }
    const steps = [...stepsSet].sort((a, b) => a - b);
    const totalSeeds = variants.length;

    return steps.map((step) => {
      const freq: { BUY: number; SELL: number; HOLD: number } = {
        BUY: 0,
        SELL: 0,
        HOLD: 0,
      };
      for (const v of variants) {
        const stepMap = byVariantAndStep.get(v.id);
        if (!stepMap) continue;
        const variantFreq = stepMap.get(step);
        if (!variantFreq) continue;
        const buyC = variantFreq.get("BUY") ?? 0;
        const sellC = variantFreq.get("SELL") ?? 0;
        const holdC = variantFreq.get("HOLD") ?? 0;
        const maxC = Math.max(buyC, sellC, holdC);
        if (maxC === 0) continue;
        if (buyC >= sellC && buyC >= holdC) freq.BUY++;
        else if (sellC >= buyC && sellC >= holdC) freq.SELL++;
        else freq.HOLD++;
      }
      const maxCount = Math.max(freq.BUY, freq.SELL, freq.HOLD);
      const agreementPct = totalSeeds > 0 ? maxCount / totalSeeds : 0;
      return { step, agreementPct };
    });
  }

  private async computeSeedProfiles(
    variants: Array<{ id: string; seed: number }>,
  ): Promise<
    Array<{
      seed: number;
      buyPct: number;
      sellPct: number;
      holdPct: number;
      netBias: number;
      dominantDirection: "BUY" | "SELL" | "HOLD";
    }>
  > {
    if (variants.length === 0) return [];

    const variantIds = variants.map((v) => v.id);
    const allDecisions = await this.prisma.agentDecision.findMany({
      where: { runVariantId: { in: variantIds } },
      select: { runVariantId: true, action: true },
    });

    const countsByVariant = new Map<
      string,
      { BUY: number; SELL: number; HOLD: number }
    >();
    for (const d of allDecisions) {
      const vid = d.runVariantId;
      if (!vid) continue;
      if (!countsByVariant.has(vid)) {
        countsByVariant.set(vid, { BUY: 0, SELL: 0, HOLD: 0 });
      }
      const c = countsByVariant.get(vid)!;
      const action = String(d.action);
      if (action === "BUY") c.BUY++;
      else if (action === "SELL") c.SELL++;
      else if (action === "HOLD") c.HOLD++;
    }

    return variants.map((v) => {
      const c = countsByVariant.get(v.id) ?? { BUY: 0, SELL: 0, HOLD: 0 };
      const total = c.BUY + c.SELL + c.HOLD;
      const buyPct = total > 0 ? c.BUY / total : 0;
      const sellPct = total > 0 ? c.SELL / total : 0;
      const holdPct = total > 0 ? c.HOLD / total : 0;
      const netBias = buyPct - sellPct;

      let dominantDirection: "BUY" | "SELL" | "HOLD" = "HOLD";
      if (buyPct > sellPct && buyPct > holdPct) dominantDirection = "BUY";
      else if (sellPct > buyPct && sellPct > holdPct) dominantDirection = "SELL";

      return {
        seed: v.seed,
        buyPct,
        sellPct,
        holdPct,
        netBias,
        dominantDirection,
      };
    });
  }

  private async computeAgreementMatrix(
    variants: Array<{ id: string; seed: number }>,
  ): Promise<Array<{ seedA: number; seedB: number; agreement: number }>> {
    if (variants.length < 2) return [];

    const variantIds = variants.map((v) => v.id);
    const decisionsByVariant = new Map<string, Map<string, string>>();

    const allDecisions = await this.prisma.agentDecision.findMany({
      where: { runVariantId: { in: variantIds } },
      select: { runVariantId: true, step: true, agentId: true, action: true },
      orderBy: [{ step: "asc" }, { agentId: "asc" }],
    });

    for (const d of allDecisions) {
      const vid = d.runVariantId;
      if (!vid) continue;
      const key = `${d.step}_${d.agentId}`;
      if (!decisionsByVariant.has(vid)) {
        decisionsByVariant.set(vid, new Map());
      }
      decisionsByVariant.get(vid)!.set(key, d.action);
    }

    const matrix: Array<{ seedA: number; seedB: number; agreement: number }> = [];
    for (let i = 0; i < variants.length; i++) {
      for (let j = 0; j < variants.length; j++) {
        const seedA = variants[i]!.seed;
        const seedB = variants[j]!.seed;
        const mapA = decisionsByVariant.get(variants[i]!.id);
        const mapB = decisionsByVariant.get(variants[j]!.id);

        if (!mapA || !mapB) {
          matrix.push({ seedA, seedB, agreement: 0 });
          continue;
        }

        const keysA = new Set(mapA.keys());
        const keysB = new Set(mapB.keys());
        const intersection = [...keysA].filter((k) => keysB.has(k));

        if (intersection.length === 0) {
          matrix.push({ seedA, seedB, agreement: 1 });
          continue;
        }

        let matches = 0;
        for (const k of intersection) {
          if (mapA.get(k) === mapB.get(k)) matches++;
        }
        const agreement = matches / intersection.length;
        matrix.push({ seedA, seedB, agreement });
      }
    }
    return matrix;
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
