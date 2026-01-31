/**
 * Simulation types. All numeric trait values are 0..1 unless noted.
 */

export interface SimConfig {
  seed: number;
  steps: number;
  startingCash: number;
}

/** Trait keys used by the sim for action/reward. Values 0..1. */
export const TRAIT_KEYS = [
  "risk_appetite",
  "patience",
  "trading_frequency",
  "news_sensitivity",
] as const;

export type TraitKey = (typeof TRAIT_KEYS)[number];

export interface TraitValues {
  risk_appetite: number;
  patience: number;
  trading_frequency: number;
  news_sensitivity: number;
}

export interface AgentInSim {
  agentId: string;
  archetypeId: string;
  /** Current wallet balance. */
  wallet: number;
  /** Maximum wallet observed so far (for drawdown). Set to wallet at creation. */
  peakWallet: number;
  traitValues: TraitValues;
}

export type Action = "buy" | "sell" | "hold";

export interface StepExperience {
  agentId: string;
  action: Action;
  reward: number;
  walletAfter: number;
  /** PnL this step: walletAfter - walletBefore (equals reward in current model). */
  pnl: number;
  /** Fractional drawdown 0..1: (peakWalletAfter - walletAfter) / peakWalletAfter when peak > 0. */
  drawdown: number;
  /** Peak wallet after this step (max of previous peak and walletAfter). */
  peakWalletAfter: number;
  meta: { traits: TraitValues; riskFactor: number };
}

export interface StepSnapshot {
  stepIndex: number;
  ts: Date;
  marketReturn: number;
  avgReward: number;
  actionCounts: { buy: number; sell: number; hold: number };
  avgWallet: number;
}

export interface StepResult {
  experiences: StepExperience[];
  snapshot: StepSnapshot;
}

/** Default trait value when missing (0..1). */
export const DEFAULT_TRAIT = 0.5;

export function getTraitValue(traits: Partial<Record<string, number>>, key: TraitKey): number {
  const v = traits[key as string];
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.min(1, v));
  return DEFAULT_TRAIT;
}

export function buildTraitValues(traits: Partial<Record<string, number>>): TraitValues {
  return {
    risk_appetite: getTraitValue(traits, "risk_appetite"),
    patience: getTraitValue(traits, "patience"),
    trading_frequency: getTraitValue(traits, "trading_frequency"),
    news_sensitivity: getTraitValue(traits, "news_sensitivity"),
  };
}
