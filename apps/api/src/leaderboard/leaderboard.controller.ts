import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { LeaderboardService } from "./leaderboard.service";

@Controller("leaderboard")
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  async getLeaderboard(
    @Query("by") by?: string,
    @Query("limit") limitStr?: string,
  ) {
    const mode = (by ?? "wallet").toLowerCase();
    if (mode !== "wallet" && mode !== "accuracy") {
      throw new BadRequestException("by must be wallet or accuracy");
    }

    let limit = 20;
    if (limitStr != null && limitStr !== "") {
      const n = parseInt(limitStr, 10);
      if (!Number.isFinite(n) || n < 1) {
        throw new BadRequestException("limit must be a positive integer");
      }
      limit = Math.min(n, 100);
    }

    if (mode === "wallet") {
      return this.leaderboardService.getWalletLeaderboard(limit);
    }
    return this.leaderboardService.getAccuracyLeaderboard(limit);
  }
}
