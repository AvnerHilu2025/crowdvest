/**
 * API client. Uses NEXT_PUBLIC_API_URL (default http://localhost:4001).
 */

const API_BASE_RAW =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ?? "http://localhost:4001";
export const API_BASE = String(API_BASE_RAW).replace(/\/$/, "") || "http://localhost:4001";

/** Join API base URL + path safely (handles leading slash). */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

/** Fetch JSON from API path. Throws Error with status + response text on non-2xx. */
export async function apiFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface RunsListResponse {
  items: Array<{ runId: string; startedAt?: string | null }>;
  total: number;
}

export interface RunVariantsResponse {
  items: Array<{
    id: string;
    runId: string;
    assetSymbol: string;
    seed: number;
    agents: number;
    steps: number;
    createdAt: string;
    summary: {
      corr: number | null;
      directionalAccuracy: number | null;
      pairsCount: number | null;
      decisionsHash?: string;
      returnsHash?: string;
      createdAt: string;
    } | null;
  }>;
  total: number;
}

/** Web base URL for server-side fetch of our own API routes (proxy). */
function getWebBase(): string {
  if (typeof window !== "undefined") return "";
  const raw = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:4000";
  return String(raw).replace(/\/$/, "") || "http://localhost:4000";
}

export async function listRuns(limit = 20): Promise<RunsListResponse> {
  const base = getWebBase();
  const url = base ? `${base}/api/runs?limit=${limit}` : `/api/runs?limit=${limit}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<RunsListResponse>;
}

export async function getRunVariants(runId: string, assetSymbol: string): Promise<RunVariantsResponse> {
  const params = new URLSearchParams({ assetSymbol });
  return apiFetchJson<RunVariantsResponse>(`/runs/${encodeURIComponent(runId)}/variants?${params.toString()}`);
}

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

export interface TimeseriesResponse {
  runId: string;
  steps: number;
  points: { step: number; value: number }[];
}

export async function getRunTimeseries(runId: string): Promise<TimeseriesResponse> {
  const res = await fetch(`${API_BASE}/runs/${encodeURIComponent(runId)}/timeseries`);
  if (res.status === 404) throw new Error("Timeseries not generated");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `timeseries: ${res.status}`);
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

export interface WalletSummaryResponse {
  available: number;
  locked: number;
  total: number;
}

export async function getWalletSummary(userId: string): Promise<WalletSummaryResponse> {
  const res = await fetch(`${API_BASE}/wallet/summary?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `getWalletSummary: ${res.status}`);
  }
  return res.json();
}

export async function getWallet(userId: string): Promise<WalletResponse> {
  const res = await fetch(`${API_BASE}/wallet?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `getWallet: ${res.status}`);
  }
  return res.json();
}

export interface WalletTransactionItem {
  id: string;
  userId: string;
  type: string;
  amount: number;
  betId: string | null;
  runId: string | null;
  note: string | null;
  createdAt: string;
}

export async function getWalletTransactions(
  userId: string,
  limit = 50,
): Promise<{ items: WalletTransactionItem[]; total: number }> {
  const params = new URLSearchParams({ userId });
  params.set("limit", String(limit));
  const res = await fetch(`${API_BASE}/wallet/transactions?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `getWalletTransactions: ${res.status}`);
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
  entryStep?: number | null;
  exitStep?: number | null;
  metadataJson?: { start?: number; end?: number; delta?: number } | null;
  createdAt: string;
}

export interface CreateBetPayload {
  userId?: string;
  runId: string;
  direction: "BUY" | "SELL" | "HOLD";
  confidence: number;
  stake: number;
  thesis?: string;
  settleVersion?: "v1" | "v2";
  entryStep?: number;
  exitStep?: number;
}

/** New POST /bets body: creates bet with status OPEN. openPrice optional (API derives from run timeseries when omitted). */
export interface CreateOpenBetPayload {
  userId: string;
  runId: string;
  agentId?: string;
  assetSymbol: string;
  direction: "BUY" | "SELL";
  amount: number;
  openStep: number;
  openPrice?: number;
}

export async function createOpenBet(payload: CreateOpenBetPayload): Promise<{
  id: string;
  userId: string;
  runId: string;
  agentId: string | null;
  assetSymbol: string | null;
  direction: string;
  amount: number;
  status: string;
  openStep: number | null;
  closeStep: number | null;
  openPrice: number | null;
  pnl: number | null;
  createdAt: string;
}> {
  const res = await fetch(`${API_BASE}/bets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `createOpenBet: ${res.status}`);
  }
  return res.json();
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
  const qs = params.toString();
  const url = qs ? `${API_BASE}/bets?${qs}` : `${API_BASE}/bets`;
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

// ---------------------------------------------------------------------------
// Results / Decisions API (Decision Engine v1)
// ---------------------------------------------------------------------------

export interface DecisionsResponse {
  runId: string;
  step: number;
  assetSymbol: string;
  histogram: { BUY: number; SELL: number; HOLD: number };
  avgConfidence: number;
  sample: { agentId: string; action: string; confidence: number; rationale: string | null }[];
}

export async function getDecisions(
  runId: string,
  step: number,
  assetSymbol = "RUN",
): Promise<DecisionsResponse> {
  const params = new URLSearchParams({
    run_id: runId,
    step: String(step),
    assetSymbol,
  });
  const res = await fetch(`${API_BASE}/results/decisions?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `decisions: ${res.status}`);
  }
  return res.json();
}

export interface CrowdSummaryDecisionsResponse {
  runId: string;
  overall: { BUY: number; SELL: number; HOLD: number };
  perStep: { step: number; BUY: number; SELL: number; HOLD: number }[];
  recommendation: { action: "BUY" | "SELL" | "HOLD"; strength: number; weighted: number };
}

export async function getCrowdSummaryDecisions(
  runId: string,
  assetSymbol = "RUN",
): Promise<CrowdSummaryDecisionsResponse> {
  const params = new URLSearchParams({ run_id: runId, assetSymbol });
  const res = await fetch(`${API_BASE}/results/crowd-summary?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `crowd-summary: ${res.status}`);
  }
  return res.json();
}

export interface SettleBetsResponse {
  runId: string;
  settledCount: number;
}

export async function settleBets(runId: string, version?: string): Promise<SettleBetsResponse> {
  const params = new URLSearchParams({ runId });
  if (version) params.set("version", version);
  const res = await fetch(`${API_BASE}/bets/settle?${params.toString()}`, {
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
  const res = await fetch(`${API_BASE}/leaderboard?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `getLeaderboard: ${res.status}`);
  }
  return res.json();
}
