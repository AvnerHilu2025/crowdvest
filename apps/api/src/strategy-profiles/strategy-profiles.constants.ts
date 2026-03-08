export type StrategyProfileKey = "conservative" | "balanced" | "aggressive" | "research";

export interface StrategyProfile {
  key: StrategyProfileKey;
  name: string;
  description: string;
  aggregationMode: string;
  selectionPolicy: string;
  intendedUse: string;
}

export const STRATEGY_PROFILES: StrategyProfile[] = [
  {
    key: "conservative",
    name: "Conservative",
    description: "Stable production profile emphasizing proven crowd filtering.",
    aggregationMode: "top_20pct_only",
    selectionPolicy: "top_20pct_agents",
    intendedUse: "production",
  },
  {
    key: "balanced",
    name: "Balanced",
    description: "General-purpose profile balancing coverage and signal quality.",
    aggregationMode: "equal_weight",
    selectionPolicy: "all_agents",
    intendedUse: "general",
  },
  {
    key: "aggressive",
    name: "Aggressive",
    description: "Higher-variance profile intended for future experimental weighting modes.",
    aggregationMode: "top_20pct_only",
    selectionPolicy: "top_10pct_agents",
    intendedUse: "experimental",
  },
  {
    key: "research",
    name: "Research",
    description: "Open analysis profile for benchmark exploration and diagnostics.",
    aggregationMode: "equal_weight",
    selectionPolicy: "all_agents",
    intendedUse: "research",
  },
];

export const DEFAULT_ACTIVE_PROFILE_KEY: StrategyProfileKey = "conservative";
