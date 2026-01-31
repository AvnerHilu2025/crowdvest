import { Controller, Get, Query } from "@nestjs/common";
import { ProfilesService } from "./profiles.service";
import { parseLimit, parseOffset } from "../common/parse-query";

@Controller()
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get("archetype-profiles")
  async findAll(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("datasetVersion") datasetVersion?: string,
  ) {
    return this.profilesService.findAll(
      parseLimit(limit),
      parseOffset(offset),
      datasetVersion,
    );
  }
}
