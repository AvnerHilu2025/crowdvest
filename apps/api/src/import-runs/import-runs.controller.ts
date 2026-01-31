import { Controller, Get, Query } from "@nestjs/common";
import { ImportRunsService } from "./import-runs.service";
import { parseLimit, parseOffset } from "../common/parse-query";

@Controller()
export class ImportRunsController {
  constructor(private readonly importRunsService: ImportRunsService) {}

  @Get("import-runs")
  async findAll(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.importRunsService.findAll(parseLimit(limit), parseOffset(offset));
  }
}
