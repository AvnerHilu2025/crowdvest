/**
 * Sanity checks and validation metrics for simulation results.
 * Pure functions; input is per-agent pnl, risk, archetypeId.
 */

export interface AgentForValidation {
  pnl: number;
  risk: number;
  archetypeId: string;
}

/** Max drawdown per archetype (max agent risk in that archetype). */
export interface MaxDrawdownByArchetype {
  archetypeId: string;
  maxDrawdown: number;
}

export interface ValidationMetrics {
  /** Sum of all agent PnLs (sanity: should match run total reward in zero-fee model). */
  totalPnlSum: number;
  /** Percentage of agents with pnl > 0 (0..100). */
  pctProfitableAgents: number;
  /** Std dev of mean PnL per archetype (dispersion across archetypes). */
  archetypeDispersion: number;
  /** Max drawdown (risk) per archetype. */
  maxDrawdownByArchetype: MaxDrawdownByArchetype[];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const sqDiffs = values.map((v) => (v - m) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Compute validation metrics from per-agent results.
 * Used by sim-summary and Results API.
 */
export function computeValidationMetrics(agents: AgentForValidation[]): ValidationMetrics {
  if (agents.length === 0) {
    return {
      totalPnlSum: 0,
      pctProfitableAgents: 0,
      archetypeDispersion: 0,
      maxDrawdownByArchetype: [],
    };
  }

  const totalPnlSum = agents.reduce((s, a) => s + a.pnl, 0);
  const profitableCount = agents.filter((a) => a.pnl > 0).length;
  const pctProfitableAgents = (100 * profitableCount) / agents.length;

  const byArchetype = new Map<string, AgentForValidation[]>();
  for (const a of agents) {
    if (!byArchetype.has(a.archetypeId)) byArchetype.set(a.archetypeId, []);
    byArchetype.get(a.archetypeId)!.push(a);
  }

  const meanPnlPerArchetype: number[] = [];
  const maxDrawdownByArchetype: MaxDrawdownByArchetype[] = [];
  for (const [archetypeId, list] of byArchetype) {
    const avgPnl = mean(list.map((a) => a.pnl));
    meanPnlPerArchetype.push(avgPnl);
    const maxRisk = Math.max(...list.map((a) => a.risk));
    maxDrawdownByArchetype.push({ archetypeId, maxDrawdown: maxRisk });
  }
  maxDrawdownByArchetype.sort((a, b) => a.archetypeId.localeCompare(b.archetypeId));

  const archetypeDispersion = stdDev(meanPnlPerArchetype);

  return {
    totalPnlSum,
    pctProfitableAgents,
    archetypeDispersion,
    maxDrawdownByArchetype,
  };
}
