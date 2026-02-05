/**
 * Simulation types. All numeric trait values are 0..1 unless noted.
 */

export interface SimConfig {
  seed: number;
  steps: number;
  startingCash: number;
  /** Take-profit threshold (fraction). SELL when pnlPct >= this. Default 0.001. */
  takeProfit?: number;
  /** Stop-loss threshold (fraction). SELL when pnlPct <= -this. Default 0.001. */
  stopLoss?: number;
  /** Max steps to hold position. SELL when (currentStep - entryStep) >= this. Default 2. */
  maxHoldSteps?: number;
}

export interface SellConfig {
  takeProfit: number;
  stopLoss: number;
  maxHoldSteps: number;
}

export const DEFAULT_TAKE_PROFIT = 0.001;
export const DEFAULT_STOP_LOSS = 0.001;
export const DEFAULT_MAX_HOLD_STEPS = 2;

export function getSellConfig(config: SimConfig): SellConfig {
  const env = typeof process !== "undefined" ? process.env : undefined;
  const takeEnv = env?.TAKE_PROFIT != null ? parseFloat(env.TAKE_PROFIT) : NaN;
  const stopEnv = env?.STOP_LOSS != null ? parseFloat(env.STOP_LOSS) : NaN;
  const maxEnv = env?.MAX_HOLD_STEPS != null ? parseInt(env.MAX_HOLD_STEPS, 10) : NaN;
  return {
    takeProfit: config.takeProfit ?? (Number.isFinite(takeEnv) ? takeEnv : DEFAULT_TAKE_PROFIT),
    stopLoss: config.stopLoss ?? (Number.isFinite(stopEnv) ? stopEnv : DEFAULT_STOP_LOSS),
    maxHoldSteps: config.maxHoldSteps ?? (Number.isFinite(maxEnv) ? maxEnv : DEFAULT_MAX_HOLD_STEPS),
  };
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
  /** True if agent has an open position (bought, not yet sold). */
  positionOpen: boolean;
  /** Wallet when position was opened (for profit/loss calc). */
  entryWallet: number;
  /** Step index when position was opened. Used for (currentStep - entryStep) >= MAX_HOLD_STEPS. */
  entryStep: number;
  /** Steps since opening position (kept for backward compat; derived from entryStep when using stepIndex). */
  holdingSteps: number;
  /** True if agent has ever executed BUY. Used for deterministic "SELL after BUY" rule. */
  hasBought: boolean;
  /** True after agent has executed SELL following a buy. Ensures one sell after first buy. */
  hasSoldAfterBuy: boolean;
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
