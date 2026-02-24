import Link from "next/link";
import { formatDate, truncateMiddle } from "@/lib/format";
import { VariantsTable } from "./variants-table";

export const dynamic = "force-dynamic";

const WEB_BASE =
  process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:4000";

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "COMPLETED"
      ? "badge badge-success"
      : status === "FAILED"
        ? "badge badge-error"
        : status === "RUNNING"
          ? "badge badge-running"
          : "badge";
  return <span className={cls}>{status}</span>;
}

interface RunDetailResponse {
  id?: string;
  runId?: string;
  name?: string;
  status?: string;
  createdAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  lastError?: string | null;
  modelVersion?: string;
  datasetVersion?: string;
  metrics?: { agentCount?: number; steps?: number; [k: string]: unknown };
}

interface VariantItem {
  id: string;
  runId: string;
  assetSymbol: string;
  seed: number;
  agents: number;
  steps: number;
  label: string | null;
  createdAt: string;
  decisionsHash: string | null;
  returnsHash: string | null;
  summary?: {
    corr: number | null;
    directionalAccuracy: number | null;
    pairsCount: number | null;
  } | null;
}

interface VariantsResponse {
  items: VariantItem[];
  total: number;
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

async function fetchVariants(
  runId: string,
  assetSymbol: string,
): Promise<VariantsResponse | null> {
  try {
    const res = await fetch(
      `${WEB_BASE}/api/runs/${encodeURIComponent(runId)}/variants?assetSymbol=${encodeURIComponent(assetSymbol)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as VariantsResponse;
  } catch {
    return null;
  }
}

export default async function RunDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ assetSymbol?: string }>;
}) {
  const { runId } = await params;
  const { assetSymbol = "SPY" } = await searchParams;

  const [run, variantsData] = await Promise.all([
    fetchRunDetail(runId),
    fetchVariants(runId, assetSymbol),
  ]);

  const variants = variantsData?.items ?? [];
  const variantsTotal = variantsData?.total ?? 0;

  // Timestamp fallbacks: createdAt := createdAt ?? startedAt ?? null, completedAt := completedAt ?? finishedAt ?? null
  const createdAt =
    run?.createdAt ?? run?.startedAt ?? null;
  const completedAt =
    run?.completedAt ?? run?.finishedAt ?? null;

  // Steps, Agents: from metrics.agentCount or from variants summary if needed
  const stepsFromRun =
    run?.metrics && typeof run.metrics.steps === "number"
      ? run.metrics.steps
      : run?.metrics && typeof run.metrics.stepCount === "number"
        ? run.metrics.stepCount
        : null;
  const agentsFromRun =
    run?.metrics && typeof run.metrics.agentCount === "number"
      ? run.metrics.agentCount
      : null;
  const steps = stepsFromRun ?? variants[0]?.steps ?? null;
  const agents = agentsFromRun ?? variants[0]?.agents ?? null;

  const variantRows = variants.map((v) => ({
    id: v.id,
    seed: v.seed,
    agents: v.agents,
    steps: v.steps,
    label: v.label,
    corr: v.summary?.corr ?? null,
    directionalAccuracy: v.summary?.directionalAccuracy ?? null,
    pairsCount: v.summary?.pairsCount ?? null,
    decisionsHash: v.decisionsHash ?? null,
    returnsHash: v.returnsHash ?? null,
  }));

  return (
    <div>
      <Link href="/runs" className="run-detail-back">
        ← Back to Runs
      </Link>

      <div className="card run-detail-header-card">
        <h1 className="run-detail-title">
          Run {truncateMiddle(runId)}
          {run?.status && (
            <>
              {" "}
              <StatusBadge status={run.status} />
            </>
          )}
        </h1>

        {run && (
          <div className="run-detail-meta" style={{ marginTop: 8 }}>
            {run.name && (
              <p className="card-row">
                <span className="card-row-label">Name</span>
                <span className="card-row-value">{run.name}</span>
              </p>
            )}
            {(run.datasetVersion || run.modelVersion) && (
              <p className="card-row">
                <span className="card-row-label">Dataset / Model</span>
                <span className="card-row-value">
                  {[run.datasetVersion, run.modelVersion]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </p>
            )}
            {(steps != null || agents != null) && (
              <p className="card-row">
                <span className="card-row-label">Steps / Agents</span>
                <span className="card-row-value">
                  {steps ?? "—"} / {agents ?? "—"}
                </span>
              </p>
            )}
            <p className="card-row">
              <span className="card-row-label">Timestamps</span>
              <span className="card-row-value">
                Created: {formatDate(createdAt)} · Started:{" "}
                {formatDate(run.startedAt)} · Completed:{" "}
                {formatDate(completedAt)}
              </span>
            </p>
          </div>
        )}

        {run?.lastError && (
          <div className="callout-error" role="alert">
            {run.lastError}
          </div>
        )}
      </div>

      <section className="variants-section card">
        <h2 className="card-title">Variants</h2>
        {variantsData === null ? (
          <p className="card-error">Failed to load variants.</p>
        ) : variants.length === 0 ? (
          <p className="card-empty">No variants found.</p>
        ) : (
          <>
            <p className="run-detail-meta" style={{ marginBottom: 12 }}>
              {variantsTotal} variant{variantsTotal !== 1 ? "s" : ""} · Asset:{" "}
              {assetSymbol}
            </p>
            <VariantsTable runId={runId} items={variantRows} />
          </>
        )}
      </section>
    </div>
  );
}
