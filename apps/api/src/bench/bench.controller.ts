import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
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

  /** POST /bench/windows — multi-regime windows benchmark. Query: symbols, windows, n, aggregationMode (use strategy defaults when missing). */
  @Post("windows")
  async windows(
    @Query("symbols") symbolsStr?: string,
    @Query("windows") windowsStr?: string,
    @Query("n") nStr?: string,
    @Query("overwrite") overwriteStr?: string,
    @Query("persist") persistStr?: string,
    @Query("aggregationMode") aggregationModeStr?: string,
  ) {
    const { symbols, windows, n, aggregationMode } =
      this.benchService.resolveBenchmarkQueryDefaults({ symbolsStr, windowsStr, nStr, aggregationModeStr });
    const overwrite = overwriteStr === "true";
    const persist = persistStr === "true";
    const result = await this.benchService.runWindowsBench({ symbols, windows, n, overwrite, persist, aggregationMode });
    return { ...result, aggregationMode, symbols, windows, n };
  }

  /** POST /bench/windows/run-and-compare — run bench with persist=true, then compare vs baseline by tag. Query: baselineTag (optional, uses default by aggregationMode when missing), symbols, windows, n, aggregationMode (use strategy defaults when missing). */
  @Post("windows/run-and-compare")
  async runAndCompareBenchWindows(
    @Query("baselineTag") baselineTag?: string,
    @Query("symbols") symbolsStr?: string,
    @Query("windows") windowsStr?: string,
    @Query("n") nStr?: string,
    @Query("overwrite") overwriteStr?: string,
    @Query("forceRun") forceRunStr?: string,
    @Query("aggregationMode") aggregationModeStr?: string,
  ) {
    const { symbols, windows, n, aggregationMode } =
      this.benchService.resolveBenchmarkQueryDefaults({ symbolsStr, windowsStr, nStr, aggregationModeStr });
    const baselineTagTrimmed = (baselineTag ?? "").trim();
    const resolvedBaselineTag =
      baselineTagTrimmed || this.benchService.defaultBaselineTagForAggregationMode(aggregationMode);
    const overwrite = overwriteStr === "true";
    const forceRun = forceRunStr === "true";

    const result = await this.benchService.runAndCompareBenchWindows({
      baselineTag: resolvedBaselineTag,
      symbols,
      windows,
      n,
      overwrite,
      forceRun,
      aggregationMode,
    });
    return { ...result, aggregationMode, symbols, windows, n, baselineTag: resolvedBaselineTag };
  }

  /** GET /bench/windows/gate — CI-friendly regression gate. Reuses snapshot when forceRun=false; runs only when forceRun=true if no match. Query: baselineTag (required), symbols, windows, n, overwrite (optional), forceRun (optional), failOnRegression (optional, default false), aggregationMode (optional: equal_weight|top_20pct_only). */
  @Get("windows/gate")
  async gate(
    @Query("baselineTag") baselineTag: string,
    @Query("symbols") symbolsStr?: string,
    @Query("windows") windowsStr?: string,
    @Query("n") nStr?: string,
    @Query("overwrite") overwriteStr?: string,
    @Query("forceRun") forceRunStr?: string,
    @Query("failOnRegression") failOnRegressionStr?: string,
    @Query("aggregationMode") aggregationModeStr?: string,
  ) {
    const baselineTagTrimmed = (baselineTag ?? "").trim();
    if (!baselineTagTrimmed) {
      throw new BadRequestException("baselineTag is required");
    }

    const symbols = (symbolsStr ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, 10);
    if (symbols.length === 0) {
      throw new BadRequestException("symbols is required (e.g. symbols=SPY,QQQ)");
    }

    const windowsRaw = (windowsStr ?? "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((v) => Number.isFinite(v) && v >= 2 && v <= 365);
    if (windowsRaw.length === 0) {
      throw new BadRequestException(
        "windows is required: comma-separated ints 2..365, max 5 (e.g. windows=29,60,120)",
      );
    }
    const windows = [...new Set(windowsRaw)].slice(0, 5);
    const n = Math.min(Math.max(1, parseInt(nStr ?? "10", 10) || 10), 50);
    const overwrite = overwriteStr === "true";
    const forceRun = forceRunStr === "true";
    const failOnRegression = failOnRegressionStr === "true";
    const aggRaw = (aggregationModeStr ?? "equal_weight").trim().toLowerCase();
    const aggregationMode =
      aggRaw === "top_20pct_only" ? ("top_20pct_only" as const) : ("equal_weight" as const);

    const body = await this.benchService.runGateCheck({
      baselineTag: baselineTagTrimmed,
      symbols,
      windows,
      n,
      overwrite,
      forceRun,
      aggregationMode,
    });

    if (failOnRegression && !body.ok) {
      throw new HttpException(body, HttpStatus.CONFLICT);
    }
    return body;
  }

  /** GET /bench/windows/weak-symbol-report — weak symbol diagnostics with benchmark delta + attribution. Query: baselineTag (required), symbols (required), windows (required), n (required). */
  @Get("windows/weak-symbol-report")
  async getWeakSymbolReport(
    @Query("baselineTag") baselineTag: string,
    @Query("symbols") symbolsStr?: string,
    @Query("windows") windowsStr?: string,
    @Query("n") nStr?: string,
  ) {
    const baselineTagTrimmed = (baselineTag ?? "").trim();
    if (!baselineTagTrimmed) {
      throw new BadRequestException("baselineTag is required");
    }
    const symbols = (symbolsStr ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, 10);
    if (symbols.length === 0) {
      throw new BadRequestException("symbols is required (e.g. symbols=SPY,QQQ,IWM)");
    }
    const windowsRaw = (windowsStr ?? "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((v) => Number.isFinite(v) && v >= 2 && v <= 365);
    if (windowsRaw.length === 0) {
      throw new BadRequestException(
        "windows is required (e.g. windows=29,60,120)",
      );
    }
    const windows = [...new Set(windowsRaw)].slice(0, 5);
    const n = Math.min(Math.max(1, parseInt(nStr ?? "10", 10) || 10), 50);

    return this.benchService.getWeakSymbolReport({
      baselineTag: baselineTagTrimmed,
      symbols,
      windows,
      n,
    });
  }

  /** GET /bench/windows/baseline-family — report baseline lineage per aggregationMode. Query: symbols, windows, n, aggregationMode (use strategy defaults when missing). */
  @Get("windows/baseline-family")
  async getBaselineFamily(
    @Query("symbols") symbolsStr?: string,
    @Query("windows") windowsStr?: string,
    @Query("n") nStr?: string,
    @Query("aggregationMode") aggregationModeStr?: string,
  ) {
    const { symbols, windows, n, aggregationMode } =
      this.benchService.resolveBenchmarkQueryDefaults({ symbolsStr, windowsStr, nStr, aggregationModeStr });
    const result = await this.benchService.getBaselineFamilyReport({ symbols, windows, n, aggregationMode });
    return { ...result, aggregationMode, symbols, windows, n };
  }

  /** GET /bench/windows/mode-leaderboard — compare aggregation modes side-by-side. Query: symbols, windows, n (use strategy defaults when missing). */
  @Get("windows/mode-leaderboard")
  async getModeLeaderboard(
    @Query("symbols") symbolsStr?: string,
    @Query("windows") windowsStr?: string,
    @Query("n") nStr?: string,
  ) {
    const { symbols, windows, n } =
      this.benchService.resolveBenchmarkQueryDefaults({ symbolsStr, windowsStr, nStr });
    const result = await this.benchService.getModeLeaderboard({ symbols, windows, n });
    return { ...result, symbols, windows, n };
  }

  /** GET /bench/windows/production-mode — currently promoted production aggregation mode (tag: production-aggregation-mode). Returns 404 if not set. */
  @Get("windows/production-mode")
  async getProductionMode() {
    return this.benchService.getProductionAggregationMode();
  }

  /** POST /bench/windows/promote-aggregation-mode — evaluate and promote aggregation mode as production. Query: symbols (required), windows (required), n (required), candidateMode (required: equal_weight|top_20pct_only), baselineMode (required: equal_weight|top_20pct_only). */
  @Post("windows/promote-aggregation-mode")
  async promoteAggregationMode(
    @Query("symbols") symbolsStr?: string,
    @Query("windows") windowsStr?: string,
    @Query("n") nStr?: string,
    @Query("candidateMode") candidateModeStr?: string,
    @Query("baselineMode") baselineModeStr?: string,
  ) {
    const symbols = (symbolsStr ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, 10);
    if (symbols.length === 0) {
      throw new BadRequestException("symbols is required (e.g. symbols=SPY,QQQ,IWM)");
    }
    const windowsRaw = (windowsStr ?? "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((v) => Number.isFinite(v) && v >= 2 && v <= 365);
    if (windowsRaw.length === 0) {
      throw new BadRequestException(
        "windows is required (e.g. windows=29,60,120)",
      );
    }
    const windows = [...new Set(windowsRaw)].slice(0, 5);
    const n = Math.min(Math.max(1, parseInt(nStr ?? "10", 10) || 10), 50);

    if (!candidateModeStr?.trim()) {
      throw new BadRequestException("candidateMode is required (equal_weight|top_20pct_only)");
    }
    if (!baselineModeStr?.trim()) {
      throw new BadRequestException("baselineMode is required (equal_weight|top_20pct_only)");
    }

    const candidateRaw = candidateModeStr.trim().toLowerCase();
    const baselineRaw = baselineModeStr.trim().toLowerCase();
    const candidateMode =
      candidateRaw === "top_20pct_only" ? ("top_20pct_only" as const) : ("equal_weight" as const);
    const baselineMode =
      baselineRaw === "top_20pct_only" ? ("top_20pct_only" as const) : ("equal_weight" as const);

    return this.benchService.promoteAggregationMode({
      symbols,
      windows,
      n,
      candidateMode,
      baselineMode,
    });
  }

  /** POST /bench/windows/promote-candidate — evaluate candidate vs baseline and optionally promote to newTag. Query: candidateId (required), baselineTag (required), newTag (required), overwrite (optional, default false). */
  @Post("windows/promote-candidate")
  async promoteCandidate(
    @Query("candidateId") candidateId: string,
    @Query("baselineTag") baselineTag: string,
    @Query("newTag") newTag: string,
    @Query("overwrite") overwriteStr?: string,
  ) {
    const candidateIdTrimmed = (candidateId ?? "").trim();
    const baselineTagTrimmed = (baselineTag ?? "").trim();
    const newTagTrimmed = (newTag ?? "").trim();
    if (!candidateIdTrimmed) {
      throw new BadRequestException("candidateId is required");
    }
    if (!baselineTagTrimmed) {
      throw new BadRequestException("baselineTag is required");
    }
    if (!newTagTrimmed) {
      throw new BadRequestException("newTag is required");
    }
    const overwrite = overwriteStr === "true";

    return this.benchService.promoteCandidateBenchWindow({
      candidateId: candidateIdTrimmed,
      baselineTag: baselineTagTrimmed,
      newTag: newTagTrimmed,
      overwrite,
    });
  }

  /** GET /bench/windows/compare — compare baseline (by tag) vs current (latest or snapshotId). Query: baselineTag (required), current (required: "latest" or snapshotId), symbols, windows, n (required when current=latest). */
  @Get("windows/compare")
  async compareBenchWindows(
    @Query("baselineTag") baselineTag: string,
    @Query("current") current: string,
    @Query("symbols") symbolsCsv?: string,
    @Query("windows") windowsCsv?: string,
    @Query("n") nStr?: string,
  ) {
    if (!baselineTag?.trim()) {
      throw new BadRequestException("baselineTag is required");
    }
    if (!current?.trim()) {
      throw new BadRequestException("current is required (use latest or snapshotId)");
    }

    const symbols = (symbolsCsv ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const windows = (windowsCsv ?? "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((v) => Number.isFinite(v) && v > 0);

    const n = nStr != null ? parseInt(nStr, 10) : undefined;
    if (nStr != null && (!Number.isFinite(n) || (n ?? 0) <= 0)) {
      throw new BadRequestException("n must be a positive number");
    }

    return this.benchService.compareBenchWindowsSnapshots({
      baselineTag: baselineTag.trim(),
      current: current.trim(),
      symbols: symbols.length ? symbols : undefined,
      windows: windows.length ? windows : undefined,
      n: n != null && Number.isFinite(n) ? n : undefined,
    });
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
