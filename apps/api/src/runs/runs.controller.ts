import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from "@nestjs/common";
import { ResultsService } from "../results/results.service";
import { RunsService } from "./runs.service";
import { parseLimit, parseOffset } from "../common/parse-query";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
export class RunsController {
  constructor(
    private readonly runsService: RunsService,
    private readonly resultsService: ResultsService,
  ) {}

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
}
