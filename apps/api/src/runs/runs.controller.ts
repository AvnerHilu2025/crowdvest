import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ResultsService } from "../results/results.service";
import { TimeseriesService } from "../timeseries/timeseries.service";
import { RunsService } from "./runs.service";
import { parseLimit, parseOffset } from "../common/parse-query";

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
}
