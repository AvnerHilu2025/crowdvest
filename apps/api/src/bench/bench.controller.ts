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

  /** POST /bench/windows — multi-regime windows benchmark. Query: symbols=SPY,QQQ (required), windows=29,60,120 (required, max 5), n (default 10, max 50), overwrite (default false), persist (default false). */
  @Post("windows")
  async windows(
    @Query("symbols") symbolsStr?: string,
    @Query("windows") windowsStr?: string,
    @Query("n") nStr?: string,
    @Query("overwrite") overwriteStr?: string,
    @Query("persist") persistStr?: string,
  ) {
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
    const persist = persistStr === "true";
    return this.benchService.runWindowsBench({ symbols, windows, n, overwrite, persist });
  }

  /** POST /bench/windows/run-and-compare — run bench with persist=true, then compare vs baseline by tag. Reuses equivalent snapshot when forceRun=false. Query: baselineTag (required), symbols, windows, n, overwrite (optional), forceRun (optional, default false). */
  @Post("windows/run-and-compare")
  async runAndCompareBenchWindows(
    @Query("baselineTag") baselineTag: string,
    @Query("symbols") symbolsStr?: string,
    @Query("windows") windowsStr?: string,
    @Query("n") nStr?: string,
    @Query("overwrite") overwriteStr?: string,
    @Query("forceRun") forceRunStr?: string,
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

    return this.benchService.runAndCompareBenchWindows({
      baselineTag: baselineTagTrimmed,
      symbols,
      windows,
      n,
      overwrite,
      forceRun,
    });
  }

  /** GET /bench/windows/gate — CI-friendly regression gate. Reuses snapshot when forceRun=false; runs only when forceRun=true if no match. Query: baselineTag (required), symbols, windows, n, overwrite (optional), forceRun (optional), failOnRegression (optional, default false). Returns 409 when failOnRegression=true and ok=false. */
  @Get("windows/gate")
  async gate(
    @Query("baselineTag") baselineTag: string,
    @Query("symbols") symbolsStr?: string,
    @Query("windows") windowsStr?: string,
    @Query("n") nStr?: string,
    @Query("overwrite") overwriteStr?: string,
    @Query("forceRun") forceRunStr?: string,
    @Query("failOnRegression") failOnRegressionStr?: string,
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

    const body = await this.benchService.runGateCheck({
      baselineTag: baselineTagTrimmed,
      symbols,
      windows,
      n,
      overwrite,
      forceRun,
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

  /** GET /bench/windows/baseline-family — report baseline lineage (v1, v2, latest) and comparisons. Query: symbols (required), windows (required), n (required). */
  @Get("windows/baseline-family")
  async getBaselineFamily(
    @Query("symbols") symbolsStr?: string,
    @Query("windows") windowsStr?: string,
    @Query("n") nStr?: string,
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

    return this.benchService.getBaselineFamilyReport({ symbols, windows, n });
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
