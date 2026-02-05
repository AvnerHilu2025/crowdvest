import type { Action, AgentInSim, SellConfig } from "./types";

/**
 * Decide action (buy/sell/hold) from agent state and traits.
 * Deterministic rule first: if hasBought && !hasSoldAfterBuy => SELL (guarantees sells after buys).
 * Else if position open: SELL when (currentStep - entryStep) >= MAX_HOLD_STEPS or profit/loss thresholds.
 * Else: BUY when traits favor it (risk_appetite >= 0.5), else HOLD.
 */
export function decideAction(
  agent: AgentInSim,
  _marketReturn: number,
  sellConfig: SellConfig,
  currentStep: number,
): Action {
  if (agent.hasBought && !agent.hasSoldAfterBuy) return "sell";

  const { traitValues: traits, positionOpen, entryWallet, entryStep, wallet } = agent;
  const { takeProfit, stopLoss, maxHoldSteps } = sellConfig;

  if (positionOpen && entryWallet > 0) {
    const holdingDuration = currentStep - entryStep;
    if (holdingDuration >= maxHoldSteps) return "sell";
    const profitFraction = (wallet - entryWallet) / entryWallet;
    if (profitFraction >= takeProfit) return "sell";
    if (profitFraction <= -stopLoss) return "sell";
    return "hold";
  }

  const { risk_appetite, patience, trading_frequency, news_sensitivity } = traits;
  const active = risk_appetite * trading_frequency;
  if (active < 0.2) return "hold";
  const react = (1 - patience) * news_sensitivity;
  if (react < 0.2) return "hold";
  if (risk_appetite >= 0.45) return "buy";
  return "hold";
}
