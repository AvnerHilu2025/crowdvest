/**
 * CrowdVest Results Data Model
 *
 * Minimal, explicit model for simulation pipeline outputs.
 * All metrics are numeric; no derived text.
 *
 * Separation:
 * - Raw: per-run metadata and per-agent rolled-up results (SimulationRunResult, AgentResult).
 * - Aggregated: rollups by archetype, by run, and global (ArchetypeAggregate, RunAggregate, GlobalAggregate).
 */

// ---------------------------------------------------------------------------
// Raw results
// ---------------------------------------------------------------------------

/**
 * Run-level raw result (minimal identity and config).
 * Maps to a single SimulationRun in the pipeline.
 */
export interface SimulationRunResult {
  /** Run UUID. */
  id: string;
  /** Run creation timestamp (ISO string or ms since epoch). */
  timestamp: number;
  /** Hash of run config (seed, steps, modelVersion, datasetVersion, etc.) for reproducibility. */
  configHash: string;
  /** Optional display name. */
  name?: string;
  /** Status code: 0=PENDING, 1=RUNNING, 2=COMPLETED, 3=FAILED. */
  status: number;
  /** Number of simulation steps executed. */
  steps: number;
}

/**
 * Action counts per agent (explicit numeric counts).
 */
export interface ActionCounts {
  buy: number;
  sell: number;
  hold: number;
}

/**
 * Per-agent rolled-up result for a single run.
 * One record per (run, agent); metrics are numeric only.
 */
export interface AgentResult {
  /** Agent UUID. */
  agentId: string;
  /** Archetype UUID (or key) the agent belongs to. */
  archetypeId: string;
  /** Run UUID. */
  runId: string;
  /** Total number of steps this agent participated in. */
  steps: number;
  /** Wall-clock or simulated duration in milliseconds (optional). */
  durationMs: number;
  /** Total PnL over the run (sum of step deltas). */
  pnl: number;
  /** Risk metric: max fractional drawdown 0..1 over the run. */
  risk: number;
  /** Total reward over the run (sum of step rewards). */
  totalReward: number;
  /** Action counts (buy, sell, hold) over the run. */
  actionCounts: ActionCounts;
}

// ---------------------------------------------------------------------------
// Aggregated results (all numeric)
// ---------------------------------------------------------------------------

/**
 * Aggregation key: scope of the aggregate.
 * 0 = global, 1 = run, 2 = archetype (within run or global).
 */
export type AggregateScope = 0 | 1 | 2;

/**
 * Numeric metrics shared by all aggregate types.
 * No derived text; all values are numbers.
 */
export interface AggregateMetrics {
  /** Number of agents in this aggregate. */
  agentCount: number;
  /** Sum of agent PnLs. */
  totalPnl: number;
  /** Mean PnL per agent. */
  avgPnl: number;
  /** Mean risk (avg of agent max drawdowns) 0..1. */
  avgRisk: number;
  /** Total steps across all agents. */
  totalSteps: number;
  /** Mean steps per agent. */
  avgStepsPerAgent: number;
  /** Sum of buy actions. */
  totalBuy: number;
  /** Sum of sell actions. */
  totalSell: number;
  /** Sum of hold actions. */
  totalHold: number;
  /** Total reward across agents. */
  totalReward: number;
  /** Mean reward per agent. */
  avgReward: number;
}

/**
 * Aggregation by archetype (within a run or across runs).
 */
export interface ArchetypeAggregate {
  scope: 2;
  /** Archetype UUID. */
  archetypeId: string;
  /** Run UUID if scoped to a run; absent if global. */
  runId?: string;
  metrics: AggregateMetrics;
}

/**
 * Aggregation for a single run (all agents in that run).
 */
export interface RunAggregate {
  scope: 1;
  /** Run UUID. */
  runId: string;
  metrics: AggregateMetrics;
  /** Run wall-clock duration in ms (optional). */
  durationMs?: number;
}

/**
 * Global aggregation (all runs / all agents).
 */
export interface GlobalAggregate {
  scope: 0;
  /** Number of runs included. */
  runCount: number;
  metrics: AggregateMetrics;
}

/**
 * Union of all aggregate result types.
 */
export type AggregatedResult = GlobalAggregate | RunAggregate | ArchetypeAggregate;

// ---------------------------------------------------------------------------
// Top-level result payloads (for export/API)
// ---------------------------------------------------------------------------

/**
 * Raw results payload: one run + its agent results.
 */
export interface RawResultsPayload {
  run: SimulationRunResult;
  agents: AgentResult[];
}

/**
 * Aggregated results payload: by run, by archetype, and global.
 */
export interface AggregatedResultsPayload {
  global?: GlobalAggregate;
  byRun: RunAggregate[];
  byArchetype: ArchetypeAggregate[];
}
