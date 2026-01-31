import type { Action } from "./types";
import type { TraitValues } from "./types";

/**
 * Decide action (buy/sell/hold) from trait values.
 * Simple rule: high risk_appetite + high trading_frequency -> more buy/sell; low patience + news_sensitivity -> react to "signal" (we use market return sign as proxy).
 */
export function decideAction(
  traits: TraitValues,
  _marketReturn: number,
): Action {
  const { risk_appetite, patience, trading_frequency, news_sensitivity } = traits;
  const active = risk_appetite * trading_frequency;
  if (active < 0.25) return "hold";
  const react = (1 - patience) * news_sensitivity;
  if (react < 0.3) return "hold";
  if (risk_appetite > 0.6) return "buy";
  if (risk_appetite < 0.4) return "sell";
  return "hold";
}
