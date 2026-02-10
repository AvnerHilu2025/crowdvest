import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  HttpException,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { randomUUID } from "crypto";
import { ResultsService } from "../results/results.service";
import { TimeseriesService } from "../timeseries/timeseries.service";
import { RunsService } from "./runs.service";
import { parseLimit, parseOffset } from "../common/parse-query";
import { errorBody, isDbSchemaError } from "../common/error-response";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
export class RunsController {
  constructor(
    private readonly runsService: RunsService,
    private readonly resultsService: ResultsService,
    private readonly timeseriesService: TimeseriesService,
  ) {}

  /** POST /runs — create a new run. Body: { name?: string }. Returns { id }. */
  @Post("runs")
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: { name?: string }) {
    return this.runsService.createRun(body?.name);
  }

  @Get("runs")
  async findAll(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.runsService.findAll(parseLimit(limit), parseOffset(offset));
  }

  /** GET /runs/latest — latest run with normalized payload. Add ?debug=1 for debug fields. */
  @Get("runs/latest")
  async getLatest(@Query("debug") debug?: string) {
    const { items } = await this.resultsService.getRuns(1, 0);
    const runId = items[0]?.id;
    if (!runId) throw new NotFoundException("Run not found");
    return this.resultsService.getRunPayload(runId, debug === "1");
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
