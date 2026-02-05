/**
 * Minimal client for Results API. Read-only.
 */

const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_BASE ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001")
    : "http://localhost:4001";

export interface RunResult {
  id: string;
  timestamp: number;
  configHash: string;
  name?: string;
  status: number;
  steps: number;
}

export interface AgentResult {
  agentId: string;
  archetypeId: string;
  runId: string;
  steps: number;
  durationMs: number;
  pnl: number;
  risk: number;
  totalReward: number;
  actionCounts: { buy: number; sell: number; hold: number };
}

export interface AggregateMetrics {
  agentCount: number;
  totalPnl: number;
  avgPnl: number;
  avgRisk: number;
  totalSteps: number;
  avgStepsPerAgent: number;
  totalBuy: number;
  totalSell: number;
  totalHold: number;
  totalReward: number;
  avgReward: number;
}

export interface RunAggregate {
  scope: number;
  runId: string;
  metrics: AggregateMetrics;
}

export interface ArchetypeAggregate {
  scope: number;
  archetypeId: string;
  runId?: string;
  metrics: AggregateMetrics;
}

export interface SummaryResponse {
  run: RunAggregate | null;
  byArchetype: ArchetypeAggregate[];
}

export async function fetchRuns(limit = 50, offset = 0): Promise<{ items: RunResult[]; total: number }> {
  const res = await fetch(`${API_BASE}/results/runs?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`runs: ${res.status}`);
  const data: unknown = await res.json();
  // Handle both { items, total } and raw array for backward compatibility
  if (Array.isArray(data)) {
    return { items: data as RunResult[], total: data.length };
  }
  const obj = data as { items?: RunResult[]; total?: number };
  return {
    items: Array.isArray(obj?.items) ? obj.items : [],
    total: typeof obj?.total === "number" ? obj.total : (obj?.items?.length ?? 0),
  };
}

export async function fetchResultsRunById(id: string): Promise<RunResult> {
  const res = await fetch(`${API_BASE}/results/runs/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`run: ${res.status}`);
  return res.json();
}

export interface AgentsResponse {
  items: AgentResult[];
  total: number;
}

export async function fetchAgents(runId: string): Promise<AgentsResponse> {
  const res = await fetch(`${API_BASE}/results/agents?run_id=${encodeURIComponent(runId)}`);
  if (!res.ok) throw new Error(`agents: ${res.status}`);
  return res.json();
}

export async function fetchSummary(runId: string): Promise<SummaryResponse> {
  const res = await fetch(`${API_BASE}/results/summary?run_id=${encodeURIComponent(runId)}`);
  if (!res.ok) throw new Error(`summary: ${res.status}`);
  return res.json();
}

export interface SummaryCompactResponse {
  runId: string;
  metrics: {
    agentCount: number;
    totalPnl: number;
    avgPnl: number;
    avgRisk: number;
    totalSteps: number;
    avgStepsPerAgent: number;
    totalBuy: number;
    totalSell: number;
    totalHold: number;
    totalReward?: number;
    avgReward?: number;
    tradeRate: number;
    holdRate: number;
    buyRate: number;
    sellRate: number;
  };
  validation: {
    totalPnlSum: number;
    pctProfitableAgents: number;
    archetypeDispersion: number;
  };
  archetypeTotals: { agentCountSum: number; totalPnlSum: number };
  debug?: {
    decisionHistogram?: { BUY: number; SELL: number; HOLD: number; OTHER: number };
    sampleDecisions?: { agentId: string; step: number; action: string }[];
    prePersistHistogram?: { BUY: number; SELL: number; HOLD: number; OTHER: number };
    persistedHistogram?: { BUY: number; SELL: number; HOLD: number; OTHER: number };
    actionHistogram?: { BUY: number; SELL: number; HOLD: number; OTHER: number };
    samplePrePersistActions?: { agentId: string; step: number; action: string }[];
    sampleActions?: { agentId: string; step: number; action: string }[];
    mappingNotes?: string;
  };
  warnings: string[];
}

export async function fetchSummaryCompact(runId: string): Promise<SummaryCompactResponse> {
  const res = await fetch(`${API_BASE}/results/summary-compact?run_id=${encodeURIComponent(runId)}`);
  if (res.status === 404) throw new Error("Run not found");
  if (!res.ok) throw new Error(`summary-compact: ${res.status}`);
  const data = await res.json();
  if (data.runId == null || data.metrics == null) throw new Error("Run not found");
  return data;
}

export function statusLabel(status: number): string {
  const map: Record<number, string> = { 0: "PENDING", 1: "RUNNING", 2: "COMPLETED", 3: "FAILED" };
  return map[status] ?? String(status);
}

// --- Runs API (GET /runs, GET /runs/:id) ---

export interface RunsListItem {
  runId: string;
  name: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  seed: number;
  modelVersion: string;
  datasetVersion: string;
  schemaVersion: string;
  metrics: { totalPnl: number; agentCount: number; totalSteps: number; tradeRate?: number };
  warningsCount: number;
}

export interface RunDetailResponse {
  runId: string;
  name: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  seed: number;
  modelVersion: string;
  datasetVersion: string;
  schemaVersion: string;
  metrics: {
    totalPnl: number;
    avgPnl: number;
    totalSteps: number;
    tradeRate?: number;
    buyRate?: number;
    sellRate?: number;
    holdRate?: number;
    agentCount: number;
  };
  validation: { pctProfitableAgents: number; archetypeDispersion: number };
  warnings: string[];
  prePersistHistogram: { BUY: number; SELL: number; HOLD: number; OTHER: number };
  persistedHistogram: { BUY: number; SELL: number; HOLD: number; OTHER: number };
  debug?: { decisionHistogram?: unknown; sampleDecisions?: { agentId: string; step: number; action: string }[] };
}

export async function fetchRunsList(limit = 20): Promise<{ items: RunsListItem[]; total: number }> {
  const res = await fetch(`${API_BASE}/runs?limit=${limit}`);
  if (!res.ok) throw new Error(`runs: ${res.status}`);
  const data = (await res.json()) as { items?: RunsListItem[]; total?: number };
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    total: typeof data?.total === "number" ? data.total : 0,
  };
}

export async function fetchRunById(id: string, debug = false): Promise<RunDetailResponse> {
  const url = `${API_BASE}/runs/${encodeURIComponent(id)}${debug ? "?debug=1" : ""}`;
  const res = await fetch(url);
  if (res.status === 404) throw new Error("Run not found");
  if (!res.ok) throw new Error(`run: ${res.status}`);
  return res.json();
}
