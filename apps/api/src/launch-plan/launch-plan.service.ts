import { Injectable } from "@nestjs/common";
import { BenchService } from "../bench/bench.service";
import { MarketDataService } from "../market-data/market-data.service";
import { StrategyProfilesService } from "../strategy-profiles/strategy-profiles.service";

function baselineTagForAggregationMode(mode: string): string {
  return mode === "top_20pct_only" ? "baseline-top20-v1" : "baseline-v2";
}

export interface LaunchPlan {
  strategyProfile: {
    key: string;
    name: string;
    description: string;
    aggregationMode: string;
    selectionPolicy: string;
    intendedUse: string;
  };
  productionAggregationMode: {
    aggregationMode: string;
    snapshotId: string;
    datasetVersion: string | null;
    modelVersion: string | null;
  } | null;
  runPlan: {
    endpoint: string;
    method: string;
    params: { symbols: string[]; points: number };
    resolved: { aggregationMode: string; selectionPolicy: string };
    metadataPreview: { datasetVersion: string; strategyProfile: string; aggregationMode: string };
  };
  benchmarkPlan: {
    endpoint: string;
    method: string;
    params: {
      symbols: string[];
      windows: number[];
      n: number;
      aggregationMode: string;
      baselineTag: string;
    };
    resolved: {
      aggregationMode: string;
      selectionPolicy: string;
      baselineTag: string;
    };
  };
  governance: {
    baselineFamilyTag: string;
    candidateMode: string;
    recommendedMode: string;
    notes: string[];
  };
  dataSource: {
    type: "synthetic" | "market-data";
    datasetVersion: string | null;
  };
}

const FALLBACK_PROFILE = {
  key: "conservative",
  name: "Conservative",
  description: "Stable production profile emphasizing proven crowd filtering.",
  aggregationMode: "top_20pct_only",
  selectionPolicy: "top_20pct_agents",
  intendedUse: "production",
};

@Injectable()
export class LaunchPlanService {
  constructor(
    private readonly strategyProfilesService: StrategyProfilesService,
    private readonly benchService: BenchService,
    private readonly marketDataService: MarketDataService,
  ) {}

  async getLaunchPlan(): Promise<LaunchPlan> {
    let profile = FALLBACK_PROFILE;
    let defaults: {
      runDefaults: { assetSymbols: string[]; points: number };
      benchmarkDefaults: {
        symbols: string[];
        windows: number[];
        n: number;
        aggregationMode: string;
        selectionPolicy: string;
      };
    } = {
      runDefaults: { assetSymbols: ["SPY", "QQQ", "IWM"], points: 29 },
      benchmarkDefaults: {
        symbols: ["SPY", "QQQ", "IWM"],
        windows: [29, 60, 120],
        n: 20,
        aggregationMode: "top_20pct_only",
        selectionPolicy: "top_20pct_agents",
      },
    };

    try {
      const p = this.strategyProfilesService.getActiveProfile();
      profile = {
        key: p.key,
        name: p.name,
        description: p.description,
        aggregationMode: p.aggregationMode,
        selectionPolicy: p.selectionPolicy,
        intendedUse: p.intendedUse,
      };
      const d = this.strategyProfilesService.getDefaults();
      defaults = { runDefaults: d.runDefaults, benchmarkDefaults: d.benchmarkDefaults };
    } catch {
      // use fallbacks
    }

    let productionAggregationMode: LaunchPlan["productionAggregationMode"] = null;
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

    const baselineTag = baselineTagForAggregationMode(profile.aggregationMode);
    const recommendedMode = productionAggregationMode?.aggregationMode ?? profile.aggregationMode;

    const notes: string[] = [
      "Launch plan derived from active strategy profile.",
      "Benchmark baseline family resolved by aggregation mode.",
    ];
    if (productionAggregationMode && productionAggregationMode.aggregationMode !== profile.aggregationMode) {
      notes.push("Production aggregation mode currently differs from active strategy profile.");
    }

    let dataSource: LaunchPlan["dataSource"] = { type: "synthetic", datasetVersion: null };
    try {
      const ds = await this.marketDataService.getDataSourceInfo();
      dataSource = { type: ds.type, datasetVersion: ds.datasetVersion };
    } catch {
      // keep synthetic fallback
    }

    return {
      strategyProfile: profile,
      productionAggregationMode,
      runPlan: {
        endpoint: "/runs/import/prices",
        method: "POST",
        params: {
          symbols: defaults.runDefaults.assetSymbols,
          points: defaults.runDefaults.points,
        },
        resolved: {
          aggregationMode: profile.aggregationMode,
          selectionPolicy: profile.selectionPolicy,
        },
        metadataPreview: {
          datasetVersion: dataSource.datasetVersion ?? "synthetic",
          strategyProfile: profile.key,
          aggregationMode: profile.aggregationMode,
        },
      },
      benchmarkPlan: {
        endpoint: "/bench/windows/run-and-compare",
        method: "POST",
        params: {
          symbols: defaults.benchmarkDefaults.symbols,
          windows: defaults.benchmarkDefaults.windows,
          n: defaults.benchmarkDefaults.n,
          aggregationMode: profile.aggregationMode,
          baselineTag,
        },
        resolved: {
          aggregationMode: profile.aggregationMode,
          selectionPolicy: profile.selectionPolicy,
          baselineTag,
        },
      },
      governance: {
        baselineFamilyTag: baselineTag,
        candidateMode: profile.aggregationMode,
        recommendedMode,
        notes,
      },
      dataSource,
    };
  }
}
