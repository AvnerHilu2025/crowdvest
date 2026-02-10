import { BadRequestException, Body, Controller, Get, Post, Query } from "@nestjs/common";
import { MeService } from "./me.service";

@Controller("me")
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  async getProfile(
    @Query("userId") userId?: string,
    @Query("cv_displayName") cvDisplayName?: string,
  ) {
    const uid = userId?.trim();
    if (!uid) {
      throw new BadRequestException("userId is required");
    }
    return this.meService.getOrCreateProfile(uid, cvDisplayName?.trim());
  }

  @Post()
  async upsertProfile(
    @Body("userId") userId?: string,
    @Body("displayName") displayName?: string,
  ) {
    const uid = userId?.trim();
    const name = displayName?.trim();
    if (!uid || !name) {
      throw new BadRequestException("userId and displayName are required");
    }
    return this.meService.upsertProfile(uid, name);
  }
}
