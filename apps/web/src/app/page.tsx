import Link from "next/link";
import { truncateMiddle } from "@/lib/ui";
import { formatDateUTC } from "@/lib/format";
import {
  SectionCard,
  MetricRows,
  MetricRow,
  Badge,
} from "@/components/ui/dashboard";

const WEB_BASE =
  process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:4000";

interface LatestResponse {
  run: {
    id: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    lastError: string | null;
  } | null;
  defaultVariant: {
    id: string;
    runId: string;
    assetSymbol: string;
    seed: number;
    agents: number;
    steps: number;
    label: string | null;
    createdAt: string;
  } | null;
  summary: {
    corr: number | null;
    directionalAccuracy: number | null;
    pairsCount: number | null;
    computedAt: string;
  } | null;
}

interface QueueResponse {
  queueLen: number;
  runningRunId: string | null;
  lastEvents: Array<{ ts: string; type: string; runId?: string; msg?: string }>;
}

interface RunDetailResponse {
  datasetVersion?: string;
  modelVersion?: string;
  name?: string;
  status?: string;
}

async function fetchLatest(): Promise<
  { ok: true; data: LatestResponse } | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${WEB_BASE}/api/results/latest?assetSymbol=SPY`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.error ?? data?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function fetchQueue(): Promise<
  { ok: true; data: QueueResponse } | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${WEB_BASE}/api/jobs/queue`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.error ?? data?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function fetchRunDetail(runId: string): Promise<RunDetailResponse | null> {
  try {
    const res = await fetch(`${WEB_BASE}/api/runs/${encodeURIComponent(runId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as RunDetailResponse;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const [latestResult, queueResult] = await Promise.all([
    fetchLatest(),
    fetchQueue(),
  ]);

  let runDetail: RunDetailResponse | null = null;
  if (latestResult.ok && latestResult.data.run) {
    runDetail = await fetchRunDetail(latestResult.data.run.id);
  }

  return (
    <div>
      <header className="dashboard-header">
        <h1 className="dashboard-title">CrowdVest</h1>
        <p className="dashboard-tagline">Virtual Crowd Intelligence</p>
        <div className="dashboard-controls">
          <span className="dashboard-controls-label">Asset:</span>
          <select className="dashboard-select" disabled aria-label="Asset symbol (SPY only)">
            <option value="SPY">SPY</option>
          </select>
        </div>
      </header>

      <div className="dashboard-grid">
        {/* Card 1: Latest Run */}
        <SectionCard title="Latest Run">
          {!latestResult.ok ? (
            <p className="card-error">{latestResult.error}</p>
          ) : !latestResult.data.run ? (
            <p className="card-empty">No completed runs yet</p>
          ) : (
            <>
              <MetricRows>
                <MetricRow
                  label="Run ID"
                  value={truncateMiddle(latestResult.data.run.id)}
                />
                <MetricRow
                  label="Status"
                  value={
                    <Badge
                      tone={
                        latestResult.data.run.status === "COMPLETED"
                          ? "success"
                          : latestResult.data.run.status === "FAILED"
                            ? "danger"
                            : latestResult.data.run.status === "RUNNING"
                              ? "warn"
                              : "neutral"
                      }
                    >
                      {latestResult.data.run.status}
                    </Badge>
                  }
                />
                <MetricRow
                  label="Completed"
                  value={formatDateUTC(latestResult.data.run.completedAt)}
                />
                <MetricRow
                  label="Dataset"
                  value={runDetail?.datasetVersion ?? "—"}
                />
                <MetricRow
                  label="Model"
                  value={runDetail?.modelVersion ?? "—"}
                />
              </MetricRows>
              {latestResult.data.run.id && (
                <Link
                  href={`/runs/${latestResult.data.run.id}`}
                  className="card-link"
                >
                  View run details →
                </Link>
              )}
            </>
          )}
        </SectionCard>

        {/* Card 2: Performance Summary */}
        <SectionCard title="Performance Summary">
          {!latestResult.ok ? (
            <p className="card-error">{latestResult.error}</p>
          ) : !latestResult.data.summary ? (
            <p className="card-empty">No completed runs yet</p>
          ) : (
            <MetricRows>
              <MetricRow
                label="Correlation"
                value={
                  latestResult.data.summary.corr != null
                    ? latestResult.data.summary.corr.toFixed(4)
                    : "—"
                }
              />
              <MetricRow
                label="Directional accuracy"
                value={
                  latestResult.data.summary.directionalAccuracy != null
                    ? (latestResult.data.summary.directionalAccuracy * 100).toFixed(2) + "%"
                    : "—"
                }
              />
              <MetricRow
                label="Pairs count"
                value={
                  latestResult.data.summary.pairsCount != null
                    ? String(latestResult.data.summary.pairsCount)
                    : "—"
                }
              />
            </MetricRows>
          )}
        </SectionCard>

        {/* Card 3: Worker / Queue */}
        <SectionCard title="Worker / Queue">
          {!queueResult.ok ? (
            <p className="card-error">{queueResult.error}</p>
          ) : (
            <>
              <MetricRows>
                <MetricRow
                  label="Queue length"
                  value={String(queueResult.data.queueLen)}
                />
                <MetricRow
                  label="Running"
                  value={
                    queueResult.data.runningRunId
                      ? truncateMiddle(queueResult.data.runningRunId)
                      : "Idle"
                  }
                />
              </MetricRows>
              {queueResult.data.lastEvents?.length > 0 && (
                <div className="card-meta">
                  Last event: {queueResult.data.lastEvents[queueResult.data.lastEvents.length - 1]?.type ?? "—"}
                </div>
              )}
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
