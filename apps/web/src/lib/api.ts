/**
 * Runs API client. Uses NEXT_PUBLIC_API_BASE or http://localhost:4001.
 */

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ??
  "http://localhost:4001";

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
  debug?: {
    decisionHistogram?: { BUY: number; SELL: number; HOLD: number; OTHER: number };
    sampleDecisions?: { agentId: string; step: number; action: string }[];
  };
}

export async function getRuns(limit: number): Promise<{ items: RunsListItem[]; total: number }> {
  const res = await fetch(`${API_BASE}/runs?limit=${limit}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `runs: ${res.status}`);
  }
  const data = (await res.json()) as { items?: RunsListItem[]; total?: number };
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    total: typeof data?.total === "number" ? data.total : 0,
  };
}

export async function getRunById(
  id: string,
  opts?: { debug?: boolean },
): Promise<RunDetailResponse> {
  const url = `${API_BASE}/runs/${encodeURIComponent(id)}${opts?.debug ? "?debug=1" : ""}`;
  const res = await fetch(url);
  if (res.status === 404) throw new Error("Run not found");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `run: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Wallet API
// ---------------------------------------------------------------------------

export interface WalletResponse {
  userId: string;
  balance: number;
}

export async function getWallet(userId: string): Promise<WalletResponse> {
  const res = await fetch(`${API_BASE}/wallet?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `getWallet: ${res.status}`);
  }
  return res.json();
}

export async function resetWallet(userId: string, balance = 100): Promise<WalletResponse> {
  const res = await fetch(`${API_BASE}/wallet/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, balance }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `resetWallet: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Bets API
// ---------------------------------------------------------------------------

export interface BetItem {
  id: string;
  userId: string;
  runId: string;
  runName?: string;
  direction: "BUY" | "SELL" | "HOLD";
  confidence: number;
  stake: number;
  thesis: string | null;
  status?: string;
  evalVersion?: string | null;
  isCorrect?: boolean | null;
  pnl?: number | null;
  settledAt?: string | null;
  createdAt: string;
}

export interface CreateBetPayload {
  userId?: string;
  runId: string;
  direction: "BUY" | "SELL" | "HOLD";
  confidence: number;
  stake: number;
  thesis?: string;
}

export async function createBet(payload: CreateBetPayload): Promise<BetItem> {
  const res = await fetch(`${API_BASE}/bets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `createBet: ${res.status}`);
  }
  return res.json();
}

export async function getBets(opts?: {
  userId?: string;
  runId?: string;
  limit?: number;
}): Promise<{ items: BetItem[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.userId) params.set("userId", opts.userId);
  if (opts?.runId) params.set("runId", opts.runId);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  const url = `${API_BASE}/bets${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `getBets: ${res.status}`);
  }
  const data = (await res.json()) as { items?: BetItem[]; total?: number };
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    total: typeof data?.total === "number" ? data.total : 0,
  };
}

export function getBetsByUser(userId: string, limit = 50): Promise<{ items: BetItem[]; total: number }> {
  return getBets({ userId, limit });
}

export function getBetsByRun(runId: string, limit = 50): Promise<{ items: BetItem[]; total: number }> {
  return getBets({ runId, limit });
}

export interface SettleBetsResponse {
  runId: string;
  settledCount: number;
}

export async function settleBets(runId: string): Promise<SettleBetsResponse> {
  const res = await fetch(`${API_BASE}/bets/settle?runId=${encodeURIComponent(runId)}`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `settleBets: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Leaderboard API
// ---------------------------------------------------------------------------

export interface LeaderboardWalletRow {
  rank: number;
  userId: string;
  displayName?: string;
  wallet: number;
  betsCount: number;
}

export interface LeaderboardAccuracyRow {
  rank: number;
  userId: string;
  displayName?: string;
  accuracy: number;
  evaluatedBets: number;
  betsCount: number;
}

export async function getLeaderboard(opts?: {
  by?: "wallet" | "accuracy";
  limit?: number;
}): Promise<LeaderboardWalletRow[] | LeaderboardAccuracyRow[]> {
  const params = new URLSearchParams();
  params.set("by", opts?.by ?? "wallet");
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  const res = await fetch(`${API_BASE}/leaderboard?${params}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `getLeaderboard: ${res.status}`);
  }
  return res.json();
}
