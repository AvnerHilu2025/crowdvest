import { Controller, Get, Query } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** GET /dashboard/drift — temporal drift metrics (asset or global). */
  @Get("drift")
  async getDrift(
    @Query("assetSymbol") assetSymbol?: string,
    @Query("window") window: string = "30",
  ) {
    return this.dashboard.getDrift({
      assetSymbol,
      window: parseInt(window, 10) || 30,
    });
  }

  /** GET /dashboard/summary — ready-to-render payload for /dashboard page. */
  @Get("summary")
  getSummary(
    @Query("limit") limit?: string,
    @Query("assetSymbol") assetSymbol?: string,
  ) {
    const limitNum = Math.min(
      Math.max(1, parseInt(limit ?? "10", 10) || 10),
      200,
    );
    return this.dashboard.getSummary(limitNum, assetSymbol?.trim() || "SPY");
  }
}
