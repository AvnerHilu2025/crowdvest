import type { Action } from "./types";

/**
 * reward = f(action, marketReturn, riskFactor).
 * - buy:  reward = r_t * riskFactor
 * - sell: reward = -r_t * (1 - riskFactor)
 * - hold: reward = r_t * 0.1
 */
export function computeReward(
  action: Action,
  marketReturn: number,
  riskFactor: number,
): number {
  switch (action) {
    case "buy":
      return marketReturn * riskFactor;
    case "sell":
      return -marketReturn * (1 - riskFactor);
    case "hold":
      return marketReturn * 0.1;
    default:
      return marketReturn * 0.1;
  }
}
