import { BadRequestException, Controller, Post, Query } from "@nestjs/common";
import { BenchService } from "./bench.service";

@Controller("bench")
export class BenchController {
  constructor(private readonly benchService: BenchService) {}

  /** POST /bench/spy29 — run n spy29 imports + backtests, compute accuracy vs alwaysBuy baseline. Query: n (default 10, max 50), overwrite (default false). */
  @Post("spy29")
  async spy29(
    @Query("n") nStr?: string,
    @Query("overwrite") overwriteStr?: string,
  ) {
    const n = Math.min(
      Math.max(1, parseInt(nStr ?? "10", 10) || 10),
      50,
    );
    const overwrite = overwriteStr === "true";
    return this.benchService.runSpy29Bench({ n, overwrite });
  }

  /** POST /bench/prices — multi-asset benchmark from PriceSeriesPoint. Query: symbols=SPY,QQQ (1..10), points=29 (default, max 365), n (default 10, max 50), overwrite (default false). */
  @Post("prices")
  async prices(
    @Query("symbols") symbolsStr?: string,
    @Query("points") pointsStr?: string,
    @Query("n") nStr?: string,
    @Query("overwrite") overwriteStr?: string,
  ) {
    const symbols = (symbolsStr ?? "SPY")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 10);
    if (symbols.length === 0) {
      throw new BadRequestException("symbols is required (1..10)");
    }
    const points = Math.min(
      Math.max(2, parseInt(pointsStr ?? "29", 10) || 29),
      365,
    );
    const n = Math.min(
      Math.max(1, parseInt(nStr ?? "10", 10) || 10),
      50,
    );
    const overwrite = overwriteStr === "true";
    return this.benchService.runPricesBench({ symbols, points, n, overwrite });
  }

  /** POST /bench/assets — multi-asset benchmark. Query: symbols=SPY,QQQ,IWM,TLT (required, 1..10), n (default 10, max 50), overwrite (default false). */
  @Post("assets")
  async assets(
    @Query("symbols") symbolsStr?: string,
    @Query("n") nStr?: string,
    @Query("overwrite") overwriteStr?: string,
  ) {
    const symbols = (symbolsStr ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (symbols.length === 0) {
      throw new BadRequestException("symbols is required (e.g. symbols=SPY,QQQ,IWM)");
    }
    if (symbols.length > 10) {
      throw new BadRequestException("symbols max 10");
    }
    const n = Math.min(
      Math.max(1, parseInt(nStr ?? "10", 10) || 10),
      50,
    );
    const overwrite = overwriteStr === "true";
    return this.benchService.runAssetsBench({ symbols, n, overwrite });
  }
}
