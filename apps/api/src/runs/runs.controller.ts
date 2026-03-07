import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  HttpException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { randomUUID } from "crypto";
import { ForecastService } from "../forecast/forecast.service";
import { ResultsService } from "../results/results.service";
import { TimeseriesService } from "../timeseries/timeseries.service";
import { RunsService } from "./runs.service";
import { RunQueueService } from "../jobs/run-queue.service";
import { parseLimit, parseOffset } from "../common/parse-query";
import { errorBody, isDbSchemaError } from "../common/error-response";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
export class RunsController {
  constructor(
    private readonly runsService: RunsService,
    private readonly resultsService: ResultsService,
    private readonly timeseriesService: TimeseriesService,
    private readonly runQueue: RunQueueService,
    private readonly forecastService: ForecastService,
  ) {}

  /** POST /runs — create a new run. Body: { name?: string; autoImport?: boolean; assetSymbol?: string; steps?: number; source?: string }. Returns { id }. If autoImport=true, imports default SPY price data. */
  @Post("runs")
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body()
    body: {
      name?: string;
      autoImport?: boolean;
      assetSymbol?: string;
      steps?: number;
      source?: string;
    },
    @Req() req?: Request & { requestId?: string },
  ) {
    const requestId = (req?.requestId ?? req?.headers?.["x-request-id"]) as string | undefined;
    if (body != null && typeof body !== "object") {
      throw new BadRequestException("Body must be a JSON object");
    }
    try {
      const b = body ?? {};
      const result = await this.runsService.createRun(b.name);
      if (b.autoImport && result.id) {
        await this.runsService.importRunPriceData(
          result.id,
          b.assetSymbol ?? "SPY",
          b.steps ?? 29,
          b.source ?? "default",
        );
      }
      return result;
    } catch (e) {
      if (e instanceof BadRequestException || e instanceof NotFoundException || e instanceof ConflictException) throw e;
      if (isDbSchemaError(e)) {
        throw new HttpException(
          { statusCode: 503, message: "Database schema not migrated", requestId },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw e;
    }
  }

  /** POST /runs/import/prices — import from PriceSeriesPoint. Query: symbols=SPY,QQQ (required, 1..10), points=29 (default, 2..365), nameSuffix optional. Creates one run, imports all symbols, enqueues backtest per symbol. */
  @Post("runs/import/prices")
  @HttpCode(HttpStatus.OK)
  async importPrices(
    @Query("symbols") symbolsStr?: string,
    @Query("points") pointsStr?: string,
    @Query("nameSuffix") nameSuffix?: string,
  ) {
    const symbols = (symbolsStr ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, 10);
    if (symbols.length === 0) throw new BadRequestException("symbols is required (e.g. SPY,QQQ)");
    const points = Math.min(Math.max(2, parseInt(pointsStr ?? "29", 10) || 29), 365);
    const seeds = [1, 2];
    const result = await this.runsService.importFromPrices({
      symbols,
      points,
      nameSuffix: nameSuffix?.trim() || undefined,
      seeds,
    });
    const er = await this.runQueue.enqueueBacktest(result.runId, {
      assetSymbol: result.symbols.length === 1 ? result.symbols[0]! : "",
      symbols: result.symbols,
      steps: result.points,
      agents: 50,
      seedStart: 1,
      seeds,
    });
    return { runId: result.runId, ok: true, symbols: result.symbols, points: result.points, enqueued: er.enqueued ?? false };
  }

  /** POST /runs/import/spy29 — create 29 AssetStepReturn rows for SPY. Body: { runId? } (optional). Idempotent. If runId omitted, creates a new run with spy29 dataset and imports. Auto-enqueues backtest when dataset ready (count=29). */
  @Post("runs/import/spy29")
  @HttpCode(HttpStatus.OK)
  async importSpy29(@Body() body: { runId?: string } | undefined) {
    const runId = (body?.runId ?? "").trim();
    if (runId && !UUID_REGEX.test(runId)) throw new BadRequestException("runId must be a UUID");
    const result = await this.runsService.importSpy29OrCreate(runId || undefined);
    if (result.count >= 29) {
      const enqueueResult = await this.runQueue.enqueueBacktest(result.runId, {
        assetSymbol: "SPY",
        steps: 29,
        agents: 50,
        seedStart: 1,
        seeds: [1, 2],
      });
      return { ...result, enqueued: enqueueResult.enqueued ?? false };
    }
    return result;
  }

  /** POST /runs/create-unique — create run with unique name for lifecycle tests. Body: { baseName?, seed?, modelVersion?, datasetVersion?, schemaVersion? }. */
  @Post("runs/create-unique")
  @HttpCode(HttpStatus.CREATED)
  async createUnique(
    @Body()
    body: {
      baseName?: string;
      seed?: number;
      modelVersion?: string;
      datasetVersion?: string;
      schemaVersion?: string;
    },
  ) {
    if (body != null && typeof body !== "object") {
      throw new BadRequestException("Body must be a JSON object");
    }
    return this.runsService.createRunUnique(body ?? {});
  }

  /** POST /runs/:runId/import — import price data into AssetStepReturn. Body: { assetSymbol, steps, source }. */
  @Post("runs/:runId/import")
  @HttpCode(HttpStatus.OK)
  async importPriceData(
    @Param("runId") runId: string,
    @Body() body: { assetSymbol?: string; steps?: number; source?: string },
  ) {
    const id = runId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) throw new BadRequestException("runId must be a UUID");
    const assetSymbol = (body?.assetSymbol ?? "SPY").trim().toUpperCase() || "SPY";
    const steps = Math.max(2, Math.min(500, body?.steps ?? 29));
    const source = (body?.source ?? "default").trim() || "default";
    return this.runsService.importRunPriceData(id, assetSymbol, steps, source);
  }

  /** POST /runs/:id/retry — reset FAILED run to PENDING and enqueue. Only allowed when status == FAILED. Returns 400 for COMPLETED/PENDING/RUNNING. */
  @Post("runs/:id/retry")
  @HttpCode(HttpStatus.OK)
  async retry(@Param("id") id: string) {
    const runId = id?.trim() ?? "";
    if (runId === "" || !UUID_REGEX.test(runId)) throw new BadRequestException("run id must be a UUID");
    const result = await this.runsService.retryRun(runId);
    const enqueueResult = await this.runQueue.enqueueBacktest(runId, {
      assetSymbol: "SPY",
      steps: 29,
      agents: 50,
      seedStart: 1,
      seeds: [1, 2],
    });
    if (!enqueueResult.enqueued) {
      console.warn(`[retry] enqueue returned ok=${enqueueResult.ok} reason=${enqueueResult.reason} runId=${runId}`);
    }
    return result;
  }

  /** PATCH /runs/:runId/status — update run status. Body: { status: "COMPLETED"|"FAILED"|"FINISHED", lastError?: string }. FINISHED maps to COMPLETED. */
  @Patch("runs/:runId/status")
  async updateStatus(
    @Param("runId") runId: string,
    @Body() body: { status?: string; lastError?: string },
  ) {
    const id = runId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) throw new BadRequestException("runId must be a UUID");
    const status = (body?.status ?? "").trim().toUpperCase();
    if (status !== "COMPLETED" && status !== "FAILED" && status !== "FINISHED") {
      throw new BadRequestException('status must be "COMPLETED", "FAILED", or "FINISHED"');
    }
    const lastError = body?.lastError != null ? String(body.lastError).trim() || undefined : undefined;
    return this.runsService.updateRunStatus(id, status === "FINISHED" ? "COMPLETED" : status, lastError);
  }

  @Get("runs")
  async findAll(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    try {
      const lim = parseLimit(limit, 30);
      return await this.runsService.findAll(lim, parseOffset(offset));
    } catch (e) {
      console.error(
        "[GET /runs] Error:",
        e instanceof Error ? e.message : String(e),
        "\nquery: limit=",
        limit,
        "offset=",
        offset,
        "\nstack:",
        e instanceof Error ? e.stack : "",
      );
      throw new HttpException(
        { error: { code: "RUNS_LIST_FAILED", message: "Failed to list runs" } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** GET /runs/latest — latest run id. Returns 404 when no runs exist. */
  @Get("runs/latest")
  async getLatest() {
    try {
      const { items } = await this.resultsService.getRuns(1, 0);
      const runId = items[0]?.id;
      if (!runId) {
        throw new NotFoundException("No runs found. Create a run with POST /runs first.");
      }
      return { runId };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      console.error(
        "[GET /runs/latest] Error:",
        e instanceof Error ? e.message : String(e),
        "\nstack:",
        e instanceof Error ? e.stack : "",
      );
      throw new HttpException(
        { error: { code: "RUNS_LATEST_FAILED", message: "Failed to get latest run" } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** GET /runs/:id/accuracy?overwrite=true|false — Forecast Accuracy + Signal Diagnostics. Returns { items: RunAccuracy[], diagnostics: RunSignalDiagnostics[] }. */
  @Get("runs/:id/accuracy")
  async getAccuracy(
    @Param("id") runId: string,
    @Query("overwrite") overwrite?: string,
  ) {
    const id = runId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) throw new BadRequestException("run id must be a UUID");
    const overwriteFlag = overwrite === "true";
    return this.forecastService.computeRunAccuracy(id, { overwrite: overwriteFlag });
  }

  /** GET /runs/:id/summary?assetSymbol=SPY — read-only snapshot for run+asset (counts, latest crowd, backtest, health). */
  @Get("runs/:id/summary")
  async getSummary(
    @Param("id") runId: string,
    @Query("assetSymbol") assetSymbol: string | undefined,
  ) {
    const id = runId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) throw new BadRequestException("run id must be a UUID");
    const sym = (assetSymbol ?? "").trim();
    if (!sym) throw new BadRequestException("assetSymbol is required");
    return this.runsService.getRunSummary(id, sym);
  }

  /** GET /runs/:id/return-audit — per-asset step returns from AssetStepReturn (lineage audit). */
  @Get("runs/:id/return-audit")
  async getReturnAudit(@Param("id") runId: string) {
    const id = runId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) throw new BadRequestException("run id must be a UUID");
    return this.runsService.getReturnAudit(id);
  }

  /** GET /runs/:id/attribution-summary — averages of attribution fields per assetSymbol. */
  @Get("runs/:id/attribution-summary")
  async getAttributionSummary(@Param("id") runId: string) {
    const id = runId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) throw new BadRequestException("run id must be a UUID");
    return this.runsService.getAttributionSummary(id);
  }

  /** GET /runs/:id/agent-alpha — agent/archetype/trait alpha analytics (completed runs only). */
  @Get("runs/:id/agent-alpha")
  async getAgentAlpha(@Param("id") runId: string) {
    const id = runId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) throw new BadRequestException("run id must be a UUID");
    return this.runsService.getRunAgentAlpha(id);
  }

  /** GET /runs/:id/selection-simulation — selection policy simulation (completed runs only). */
  @Get("runs/:id/selection-simulation")
  async getSelectionSimulation(@Param("id") runId: string) {
    const id = runId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) throw new BadRequestException("run id must be a UUID");
    return this.runsService.getRunSelectionSimulation(id);
  }

  /** GET /runs/:id/weighted-crowd-simulation — weighted crowd voting simulation (completed runs only). */
  @Get("runs/:id/weighted-crowd-simulation")
  async getWeightedCrowdSimulation(@Param("id") runId: string) {
    const id = runId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) throw new BadRequestException("run id must be a UUID");
    return this.runsService.getRunWeightedCrowdSimulation(id);
  }

  /** GET /runs/:id/attribution-sample?assetSymbol=SPY&limit=20 — sample of AgentDecision rows with attribution fields. */
  @Get("runs/:id/attribution-sample")
  async getAttributionSample(
    @Param("id") runId: string,
    @Query("assetSymbol") assetSymbol?: string,
    @Query("limit") limitStr?: string,
  ) {
    const id = runId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) throw new BadRequestException("run id must be a UUID");
    const sym = (assetSymbol ?? "").trim() || undefined;
    const limit = Math.min(
      Math.max(1, parseInt(limitStr ?? "20", 10) || 20),
      200,
    );
    return this.runsService.getAttributionSample(id, { assetSymbol: sym, limit });
  }

  /** GET /runs/:id — run by id with normalized payload. Add ?debug=1 for debug fields. */
  @Get("runs/:id")
  async getById(@Param("id") id: string, @Query("debug") debug?: string) {
    const s = id?.trim() ?? "";
    if (s === "" || !UUID_REGEX.test(s)) throw new BadRequestException("run id must be a UUID");
    return this.resultsService.getRunPayload(s, debug === "1");
  }

  /** GET /runs/:id/timeseries — run timeline curve. Auto-generates if missing. */
  @Get("runs/:id/timeseries")
  async getTimeseries(@Param("id") id: string) {
    const s = id?.trim() ?? "";
    if (s === "" || !UUID_REGEX.test(s)) throw new BadRequestException("run id must be a UUID");
    return this.timeseriesService.getTimeseries(s);
  }

  /** GET /runs/:runId/variants — list RunVariants with summary. Never 500 for user errors. */
  @Get("runs/:runId/variants")
  async getVariants(
    @Param("runId") runId: string,
    @Query("assetSymbol") assetSymbol?: string,
    @Query("label") label?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Req() req?: Request,
  ) {
    const requestId =
      (req?.headers?.["x-request-id"] as string)?.trim() || randomUUID();
    const id = runId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) {
      throw new HttpException(
        errorBody("BAD_REQUEST", "Invalid runId"),
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const result = await this.runsService.getVariantsForRun(id, {
        assetSymbol: assetSymbol?.trim(),
        label: label?.trim(),
        limit: parseLimit(limit),
        offset: parseOffset(offset),
      });
      return result;
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw new HttpException(
          {
            error: {
              code: "RUN_NOT_FOUND",
              message: "Run not found",
              hint: "This usually happens after db:reset. Create a new run (POST /runs) and retry with the new RUN_ID.",
            },
          },
          HttpStatus.NOT_FOUND,
        );
      }
      if (isDbSchemaError(e)) {
        throw new HttpException(
          errorBody("DB_NOT_READY", "Database schema not migrated"),
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      console.error(
        JSON.stringify({
          requestId,
          route: "GET /runs/:runId/variants",
          params: { runId: id },
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        }),
      );
      throw new HttpException(
        errorBody("INTERNAL", "Internal error", requestId),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** GET /variants/:variantId/summary — single variant summary (BacktestResult + RunVariant). */
  @Get("variants/:variantId/summary")
  async getVariantSummary(@Param("variantId") variantId: string) {
    const id = variantId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) throw new BadRequestException("variant id must be a UUID");
    return this.runsService.getVariantSummary(id);
  }
}
