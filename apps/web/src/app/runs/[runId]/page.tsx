import Link from "next/link";
import { formatDateTimeUTC, formatDurationMs, truncateMiddle } from "@/lib/format";
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
  runDurationMs?: number | null;
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
  durationMs?: number | null;
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
    durationMs: v.durationMs ?? null,
    label: v.label,
    corr: v.summary?.corr ?? null,
    directionalAccuracy: v.summary?.directionalAccuracy ?? null,
    pairsCount: v.summary?.pairsCount ?? null,
    decisionsHash: v.decisionsHash ?? null,
    returnsHash: v.returnsHash ?? null,
  }));

  // Performance & Throughput (persisted timing only)
  const runDurationMs = run?.runDurationMs ?? null;
  const sumVariantMs =
    variants.length > 0 && variants.every((v) => v.durationMs != null && Number.isFinite(v.durationMs))
      ? variants.reduce((s, v) => s + (v.durationMs ?? 0), 0)
      : null;
  const avgVariantMs =
    sumVariantMs != null && variants.length > 0 ? sumVariantMs / variants.length : null;
  const overheadMs =
    runDurationMs != null && sumVariantMs != null
      ? Math.max(0, runDurationMs - sumVariantMs)
      : null;
  const decisionsTotal =
    variants.length > 0 && agents != null && steps != null
      ? variants.length * agents * steps
      : null;
  const decisionsPerSec =
    decisionsTotal != null && sumVariantMs != null && sumVariantMs > 0
      ? decisionsTotal / (sumVariantMs / 1000)
      : null;

  // Signal Stability (from variant corr/accuracy)
  const spread = (arr: number[]) =>
    arr.length === 0 ? 0 : Math.max(...arr) - Math.min(...arr);
  const mean = (arr: number[]) =>
    arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = (arr: number[]) => {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
  };
  const sign = (x: number) => (x >= 0 ? 1 : -1);

  const corrs = variantRows
    .map((v) => v.corr)
    .filter((c): c is number => c != null && Number.isFinite(c));
  const accuracies = variantRows
    .map((v) => v.directionalAccuracy)
    .filter((a): a is number => a != null && Number.isFinite(a));

  const corrSpread = corrs.length >= 2 ? spread(corrs) : null;
  const corrStd = corrs.length >= 2 ? std(corrs) : null;
  const accuracySpread = accuracies.length >= 2 ? spread(accuracies) : null;
  const signs = corrs.map(sign);
  const signAgreementRate =
    signs.length >= 2
      ? (() => {
          const pos = signs.filter((s) => s === 1).length;
          const neg = signs.filter((s) => s === -1).length;
          const majority = pos >= neg ? 1 : -1;
          const match = signs.filter((s) => s === majority).length;
          return match / signs.length;
        })()
      : null;

  let stabilityBadge: "STRONG" | "STABLE" | "MIXED" | "UNSTABLE" = "UNSTABLE";
  if (corrs.length >= 2 && corrSpread != null) {
    const allSameSign = signs.every((s) => s === signs[0]);
    if (allSameSign && corrSpread < 0.05) stabilityBadge = "STRONG";
    else if (allSameSign && corrSpread < 0.15) stabilityBadge = "STABLE";
    else if (!allSameSign) stabilityBadge = "MIXED";
  }

  const stabilityBadgeCls =
    stabilityBadge === "STRONG"
      ? "badge badge-success"
      : stabilityBadge === "STABLE"
        ? "badge badge-success"
        : stabilityBadge === "MIXED"
          ? "badge badge-amber"
          : "badge";

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
              <span className="card-row-label">Run duration</span>
              <span className="card-row-value">{formatDurationMs(run.runDurationMs)}</span>
            </p>
            <p className="card-row">
              <span className="card-row-label">Timestamps</span>
              <span className="card-row-value">
                Created: {formatDateTimeUTC(createdAt)} · Started:{" "}
                {formatDateTimeUTC(run.startedAt)} · Completed:{" "}
                {formatDateTimeUTC(completedAt)}
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

      <section className="card" style={{ marginTop: 24 }}>
        <h2 className="card-title">Performance & Throughput</h2>
        <div className="run-detail-meta" style={{ marginTop: 8 }}>
          <p className="card-row">
            <span className="card-row-label">Run duration</span>
            <span className="card-row-value" style={{ textAlign: "right" }}>
              {formatDurationMs(runDurationMs)}
            </span>
          </p>
          <p className="card-row">
            <span className="card-row-label">Variants</span>
            <span className="card-row-value" style={{ textAlign: "right" }}>
              {variants.length}
            </span>
          </p>
          <p className="card-row">
            <span className="card-row-label">Total variant duration</span>
            <span className="card-row-value" style={{ textAlign: "right" }}>
              {formatDurationMs(sumVariantMs)}
            </span>
          </p>
          <p className="card-row">
            <span className="card-row-label">Avg variant duration</span>
            <span className="card-row-value" style={{ textAlign: "right" }}>
              {formatDurationMs(avgVariantMs)}
            </span>
          </p>
          <p className="card-row">
            <span className="card-row-label">Overhead</span>
            <span className="card-row-value" style={{ textAlign: "right" }}>
              {formatDurationMs(overheadMs)}
            </span>
          </p>
          <p className="card-row">
            <span className="card-row-label">Decisions total</span>
            <span className="card-row-value" style={{ textAlign: "right" }}>
              {decisionsTotal != null ? decisionsTotal.toLocaleString() : "—"}
            </span>
          </p>
          <p className="card-row">
            <span className="card-row-label">Decisions/sec</span>
            <span className="card-row-value" style={{ textAlign: "right" }}>
              {decisionsPerSec != null ? `${Math.round(decisionsPerSec).toLocaleString()}/s` : "—"}
            </span>
          </p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h2 className="card-title" style={{ margin: 0 }}>Signal Stability</h2>
          {variants.length >= 2 ? (
            <span className={stabilityBadgeCls}>{stabilityBadge}</span>
          ) : null}
        </div>
        {variants.length < 2 ? (
          <p className="card-empty" style={{ marginTop: 8 }}>Insufficient variants</p>
        ) : (
          <div className="run-detail-meta" style={{ marginTop: 8 }}>
            <p className="card-row">
              <span className="card-row-label">Correlation spread</span>
              <span className="card-row-value" style={{ textAlign: "right" }}>
                {corrSpread != null ? corrSpread.toFixed(4) : "—"}
              </span>
            </p>
            <p className="card-row">
              <span className="card-row-label">Correlation std dev</span>
              <span className="card-row-value" style={{ textAlign: "right" }}>
                {corrStd != null ? corrStd.toFixed(4) : "—"}
              </span>
            </p>
            <p className="card-row">
              <span className="card-row-label">Accuracy spread</span>
              <span className="card-row-value" style={{ textAlign: "right" }}>
                {accuracySpread != null ? accuracySpread.toFixed(4) : "—"}
              </span>
            </p>
            <p className="card-row">
              <span className="card-row-label">Sign agreement rate</span>
              <span className="card-row-value" style={{ textAlign: "right" }}>
                {signAgreementRate != null ? `${(signAgreementRate * 100).toFixed(0)}%` : "—"}
              </span>
            </p>
          </div>
        )}
      </section>

      <section className="variants-section card" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h2 className="card-title" style={{ margin: 0 }}>Variants</h2>
          {variants.length >= 2 && (
            <Link
              href={`/runs/${runId}/compare?assetSymbol=${assetSymbol}`}
              className="card-link"
            >
              Compare Seeds
            </Link>
          )}
        </div>
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
