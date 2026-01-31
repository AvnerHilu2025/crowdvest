import { Controller, Get, Query } from "@nestjs/common";
import { RunsService } from "./runs.service";
import { parseLimit, parseOffset } from "../common/parse-query";

@Controller()
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Get("runs")
  async findAll(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.runsService.findAll(parseLimit(limit), parseOffset(offset));
  }
}
