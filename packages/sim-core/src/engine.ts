import { createSeededRng, sampleMarketReturn } from "./rng";
import { decideAction } from "./action";
import { computeReward } from "./reward";
import type {
  SimConfig,
  AgentInSim,
  StepResult,
  StepExperience,
  StepSnapshot,
} from "./types";

const MARKET_MEAN = 0.0005;
const MARKET_STDEV = 0.01;

/**
 * Run one step: sample market return, compute per-agent action/reward/walletAfter, pnl, drawdown; aggregate snapshot.
 * PnL = delta wallet (walletAfter - walletBefore). Drawdown = fractional (peak - current) / peak, clamped 0..1.
 */
export function runStep(
  agents: AgentInSim[],
  marketReturn: number,
  stepIndex: number,
  ts: Date,
): StepResult {
  const experiences: StepExperience[] = [];
  let sumReward = 0;
  let sumWallet = 0;
  const actionCounts = { buy: 0, sell: 0, hold: 0 };

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const walletBefore = agent.wallet;
    const action = decideAction(agent.traitValues, marketReturn);
    const riskFactor = agent.traitValues.risk_appetite;
    const reward = computeReward(action, marketReturn, riskFactor);
    const walletAfter = walletBefore + reward;

    // PnL this step (delta wallet; equals reward in current model)
    const pnl = walletAfter - walletBefore;

    // Peak so far; initial peak is wallet at creation
    const peakWalletBefore = agent.peakWallet;
    const peakWalletAfter = Math.max(peakWalletBefore, walletAfter);

    // Fractional drawdown 0..1; avoid NaN/Infinity when peak <= 0
    let drawdown = 0;
    if (peakWalletAfter > 0 && Number.isFinite(peakWalletAfter)) {
      const raw = (peakWalletAfter - walletAfter) / peakWalletAfter;
      drawdown = Math.max(0, Math.min(1, Number.isFinite(raw) ? raw : 0));
    }

    experiences.push({
      agentId: agent.agentId,
      action,
      reward,
      walletAfter,
      pnl,
      drawdown,
      peakWalletAfter,
      meta: { traits: agent.traitValues, riskFactor },
    });

    agent.wallet = walletAfter;
    agent.peakWallet = peakWalletAfter;

    sumReward += reward;
    sumWallet += walletAfter;
    actionCounts[action]++;
  }

  const n = agents.length;
  const snapshot: StepSnapshot = {
    stepIndex,
    ts,
    marketReturn,
    avgReward: n > 0 ? sumReward / n : 0,
    actionCounts,
    avgWallet: n > 0 ? sumWallet / n : 0,
  };

  return { experiences, snapshot };
}

export interface RunSimulationOptions {
  config: SimConfig;
  agents: AgentInSim[];
  onStep?: (result: StepResult, stepIndex: number) => void;
}

/**
 * Run full simulation: for each step sample market return, run step, yield result.
 * Caller is responsible for persisting (batch insert experiences + snapshot).
 * Agents array is mutated in-place (wallet updated) so next step sees new wallets.
 */
export function runSimulation(options: RunSimulationOptions): StepResult[] {
  const { config, agents, onStep } = options;
  const uniform = createSeededRng(config.seed);
  const results: StepResult[] = [];

  for (let stepIndex = 0; stepIndex < config.steps; stepIndex++) {
    const marketReturn = sampleMarketReturn(MARKET_MEAN, MARKET_STDEV, uniform);
    const ts = new Date();

    const result = runStep(agents, marketReturn, stepIndex, ts);
    results.push(result);
    // runStep mutates agents (wallet, peakWallet) in-place

    onStep?.(result, stepIndex);
  }

  return results;
}
