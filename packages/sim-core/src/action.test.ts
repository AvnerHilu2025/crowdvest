import { describe, it, expect } from "vitest";
import {
  runSimulation,
  buildTraitValues,
  type AgentInSim,
  type SimConfig,
} from "./index";

function mkAgent(id: string, arch: string, risk: number, trading: number): AgentInSim {
  const traits = buildTraitValues({
    risk_appetite: risk,
    trading_frequency: trading,
    patience: 0.3,
    news_sensitivity: 0.6,
  });
  const wallet = 10_000;
    return {
      agentId: id,
      archetypeId: arch,
      wallet,
      peakWallet: wallet,
      traitValues: traits,
      positionOpen: false,
      entryWallet: 0,
      entryStep: 0,
      holdingSteps: 0,
      hasBought: false,
      hasSoldAfterBuy: false,
    };
}

describe("sell actions", () => {
  it("produces totalSell > 0 for standard CI run (seeded, takeProfit/stopLoss/maxHoldSteps)", () => {
    const agents: AgentInSim[] = [];
    for (let i = 0; i < 50; i++) {
      agents.push(
        mkAgent(
          `agent-${i}`,
          `arch-${i % 5}`,
          0.7 + (i % 3) * 0.1,
          0.5 + (i % 2) * 0.2,
        ),
      );
    }
    const config: SimConfig = {
      seed: 12345,
      steps: 20,
      startingCash: 10_000,
      takeProfit: 0.001,
      stopLoss: 0.001,
      maxHoldSteps: 2,
    };
    const results = runSimulation({ config, agents });
    let totalBuy = 0;
    let totalSell = 0;
    let totalHold = 0;
    for (const r of results) {
      totalBuy += r.snapshot.actionCounts.buy;
      totalSell += r.snapshot.actionCounts.sell;
      totalHold += r.snapshot.actionCounts.hold;
    }
    expect(totalBuy).toBeGreaterThan(0);
    expect(totalSell).toBeGreaterThan(0);
    expect(totalBuy + totalSell + totalHold).toBe(agents.length * config.steps);

    const pnlByAgent = new Map<string, number>();
    for (const r of results) {
      for (const e of r.experiences) {
        const prev = pnlByAgent.get(e.agentId) ?? 0;
        pnlByAgent.set(e.agentId, prev + e.pnl);
      }
    }
    const profitableCount = [...pnlByAgent.values()].filter((pnl) => pnl > 0).length;
    const pctProfitableAgents = (100 * profitableCount) / agents.length;
    expect(pctProfitableAgents).toBeGreaterThan(0);
  });

  it("produces totalSell > 0 in standard CI run (50 agents, 10 steps, deterministic seed)", () => {
    const agents: AgentInSim[] = [];
    for (let i = 0; i < 50; i++) {
      agents.push(
        mkAgent(
          `agent-${i}`,
          `arch-${i % 5}`,
          0.5 + (i % 5) * 0.1,
          0.4 + (i % 3) * 0.2,
        ),
      );
    }
    const config: SimConfig = {
      seed: 42,
      steps: 10,
      startingCash: 10_000,
      takeProfit: 0.001,
      stopLoss: 0.001,
      maxHoldSteps: 2,
    };
    const results = runSimulation({ config, agents });
    let totalSell = 0;
    let totalBuy = 0;
    for (const r of results) {
      totalSell += r.snapshot.actionCounts.sell;
      totalBuy += r.snapshot.actionCounts.buy;
    }
    expect(totalBuy).toBeGreaterThan(0);
    expect(totalSell).toBeGreaterThan(0);
    expect(totalBuy + totalSell).toBeLessThanOrEqual(agents.length * config.steps);
  });

  it("produces totalSell > 0 with risk_appetite=0.5 (BUY threshold) and maxHoldSteps=2", () => {
    const agents: AgentInSim[] = [];
    for (let i = 0; i < 30; i++) {
      agents.push(mkAgent(`agent-${i}`, `arch-${i % 3}`, 0.5, 0.6));
    }
    const config: SimConfig = {
      seed: 99999,
      steps: 10,
      startingCash: 10_000,
      maxHoldSteps: 2,
    };
    const results = runSimulation({ config, agents });
    let totalSell = 0;
    for (const r of results) totalSell += r.snapshot.actionCounts.sell;
    expect(totalSell).toBeGreaterThan(0);
  });
});
