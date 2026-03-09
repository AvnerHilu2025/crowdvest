import { Body, Controller, Get, Inject, Post, forwardRef } from "@nestjs/common";
import { BenchService } from "../bench/bench.service";
import { StrategyProfilesService } from "./strategy-profiles.service";
import type { StrategyProfileKey } from "./strategy-profiles.constants";

function baselineTagForAggregationMode(mode: string): string {
  return mode === "top_20pct_only" ? "baseline-top20-v1" : "baseline-v2";
}

@Controller("strategy-profiles")
export class StrategyProfilesController {
  constructor(
    private readonly service: StrategyProfilesService,
    @Inject(forwardRef(() => BenchService))
    private readonly benchService: BenchService,
  ) {}

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

  /** GET /strategy-profiles/execution-preset — fully resolved execution preset for active strategy profile */
  @Get("execution-preset")
  async getExecutionPreset() {
    const profile = this.service.getActiveProfile();
    const defaults = this.service.getDefaults();
    const baselineTag = baselineTagForAggregationMode(profile.aggregationMode);

    let productionAggregationMode: {
      aggregationMode: string;
      snapshotId: string;
      datasetVersion: string | null;
      modelVersion: string | null;
    } | null = null;
    try {
      const r = await this.benchService.getProductionAggregationMode();
      if (r?.snapshot) {
        productionAggregationMode = {
          aggregationMode: r.snapshot.aggregationMode,
          snapshotId: r.snapshot.id,
          datasetVersion: r.snapshot.datasetVersion ?? null,
          modelVersion: r.snapshot.modelVersion ?? null,
        };
      }
    } catch {
      productionAggregationMode = null;
    }

    return {
      strategyProfile: {
        key: profile.key,
        name: profile.name,
        description: profile.description,
        aggregationMode: profile.aggregationMode,
        selectionPolicy: profile.selectionPolicy,
        intendedUse: profile.intendedUse,
      },
      runPreset: {
        assetSymbols: defaults.runDefaults.assetSymbols,
        points: defaults.runDefaults.points,
        aggregationMode: defaults.runDefaults.aggregationMode,
        selectionPolicy: defaults.runDefaults.selectionPolicy,
      },
      benchmarkPreset: {
        symbols: defaults.benchmarkDefaults.symbols,
        windows: defaults.benchmarkDefaults.windows,
        n: defaults.benchmarkDefaults.n,
        aggregationMode: defaults.benchmarkDefaults.aggregationMode,
        selectionPolicy: defaults.benchmarkDefaults.selectionPolicy,
        baselineTag,
      },
      governance: {
        productionAggregationMode,
        baselineFamilyTag: baselineTag,
        candidateMode: profile.aggregationMode,
      },
    };
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
