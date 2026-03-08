import { Body, Controller, Get, Post } from "@nestjs/common";
import { StrategyProfilesService } from "./strategy-profiles.service";
import type { StrategyProfileKey } from "./strategy-profiles.constants";

@Controller("strategy-profiles")
export class StrategyProfilesController {
  constructor(private readonly service: StrategyProfilesService) {}

  /** GET /strategy-profiles — all profiles with active flag */
  @Get()
  getAll() {
    return this.service.getAllWithActive();
  }

  /** GET /strategy-profiles/active — current active profile only */
  @Get("active")
  getActive() {
    return this.service.getActiveProfile();
  }

  /** GET /strategy-profiles/defaults — strategy-aware benchmark/run defaults */
  @Get("defaults")
  getDefaults() {
    return this.service.getDefaults();
  }

  /** POST /strategy-profiles/active — set active profile */
  @Post("active")
  setActive(@Body() body: { key?: string }) {
    const key = body?.key;
    if (
      key !== "conservative" &&
      key !== "balanced" &&
      key !== "aggressive" &&
      key !== "research"
    ) {
      return {
        ok: false,
        error: "Invalid key",
        message: "key must be one of: conservative, balanced, aggressive, research",
      };
    }
    const activeProfile = this.service.setActiveProfile(key as StrategyProfileKey);
    return { ok: true, activeProfile };
  }
}
