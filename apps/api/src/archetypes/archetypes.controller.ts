import { Controller, Get, Query } from "@nestjs/common";
import { ArchetypesService } from "./archetypes.service";
import { parseLimit, parseOffset } from "../common/parse-query";

@Controller()
export class ArchetypesController {
  constructor(private readonly archetypesService: ArchetypesService) {}

  @Get("archetypes")
  async findAll(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("datasetVersion") datasetVersion?: string,
  ) {
    return this.archetypesService.findAll(
      parseLimit(limit),
      parseOffset(offset),
      datasetVersion,
    );
  }
}
