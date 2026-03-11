import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { SignalsService } from "./signals.service";

@Controller("signals")
export class SignalsController {
  constructor(private readonly signalsService: SignalsService) {}

  /** GET /signals/latest — rolling crowd signals (last 20 runs). Optional ?symbols=AAPL,NVDA,MSFT */
  @Get("latest")
  async getLatest(@Query("symbols") symbols?: string) {
    return this.signalsService.getLatestSignals(symbols ?? undefined);
  }

  /** POST /signals/snapshot — compute and persist signal history. Body: { symbols?: string[] } */
  @Post("snapshot")
  async createSnapshot(
    @Body() body?: { symbols?: string[] },
  ) {
    return this.signalsService.createSnapshot(body?.symbols);
  }

  /** POST /signals/backfill — backfill historical signal snapshots from market prices. Idempotent. */
  @Post("backfill")
  async backfill(
    @Body()
    body?: {
      symbols?: string[];
      window?: number;
      maxSnapshotsPerSymbol?: number;
    },
  ) {
    return this.signalsService.backfill(body);
  }

  /** GET /signals/history — signal history, newest first. ?symbols=AAPL,NVDA&limit=50 */
  @Get("history")
  async getHistory(
    @Query("symbols") symbols?: string,
    @Query("limit") limit?: string,
  ) {
    const limitNum = Math.min(
      Math.max(1, parseInt(limit ?? "50", 10) || 50),
      200,
    );
    return this.signalsService.getHistory(symbols ?? undefined, limitNum);
  }

  /** GET /signals/validation — validate signals vs realized market moves. ?symbols=SPY,QQQ&limit=50 */
  @Get("validation")
  async getValidation(
    @Query("symbols") symbols?: string,
    @Query("limit") limit?: string,
  ) {
    const limitNum = Math.min(
      Math.max(1, parseInt(limit ?? "50", 10) || 50),
      200,
    );
    return this.signalsService.getValidation(symbols ?? undefined, limitNum);
  }
}
