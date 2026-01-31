import { Controller, Get, Query } from "@nestjs/common";
import { TraitsService } from "./traits.service";
import { parseLimit, parseOffset } from "../common/parse-query";

@Controller()
export class TraitsController {
  constructor(private readonly traitsService: TraitsService) {}

  @Get("traits")
  async findAll(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("datasetVersion") datasetVersion?: string,
  ) {
    return this.traitsService.findAll(
      parseLimit(limit),
      parseOffset(offset),
      datasetVersion,
    );
  }
}
