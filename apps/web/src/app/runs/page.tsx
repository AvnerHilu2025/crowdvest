import Link from "next/link";
import { deriveRunDurationMs } from "@/lib/duration";
import { ScalingTable, type ScalingRow } from "@/components/scaling-table";
import { RunsTable } from "./runs-table";

export const dynamic = "force-dynamic";

const LIMIT = 20;
const SCALING_LIMIT = 10;
const WEB_BASE =
  process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:4000";

interface RunsListItem {
  id: string;
  runId: string;
  name: string;
  status: string;
  runDurationMs: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  completedAt?: string | null;
  [k: string]: unknown;
}

interface VariantItem {
  id: string;
  agents: number;
  steps: number;
  durationMs?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  [k: string]: unknown;
}

interface RunsV2Item {
  id: string;
  name: string;
  createdAt: string;
  status: string;
  runDurationMs: number | null;
  assetSymbol: string | null;
  steps: number | null;
  agents: number | null;
  variantsCount: number;
}

interface RunsV2Response {
  items: RunsV2Item[];
  total: number;
}

async function fetchRunsV2(offset: number): Promise<RunsV2Response | null> {
  try {
    const res = await fetch(
      `${WEB_BASE}/api/results/runs-v2?limit=${LIMIT}&offset=${offset}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as RunsV2Response;
  } catch {
    return null;
  }
}

async function fetchRunsList(limit: number, offset: number): Promise<{ items: RunsListItem[] } | null> {
  try {
    const res = await fetch(
      `${WEB_BASE}/api/runs?limit=${limit}&offset=${offset}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as { items: RunsListItem[] };
  } catch {
    return null;
  }
}

async function fetchVariants(runId: string): Promise<{ items: VariantItem[] } | null> {
  try {
    const res = await fetch(
      `${WEB_BASE}/api/runs/${encodeURIComponent(runId)}/variants?assetSymbol=SPY`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as { items: VariantItem[] };
  } catch {
    return null;
  }
}

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const { offset: offsetParam } = await searchParams;
  const offset = Math.max(0, parseInt(offsetParam ?? "0", 10) || 0);

  const [data, runsListData] = await Promise.all([
    fetchRunsV2(offset),
    fetchRunsList(SCALING_LIMIT, 0),
  ]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  // Cross-Run Performance Scaling: fetch variants for each COMPLETED run
  const runsForScaling = (runsListData?.items ?? []).filter((r) => r.status === "COMPLETED");
  const variantResults = await Promise.allSettled(
    runsForScaling.map((r) => fetchVariants(r.id)),
  );

  const scalingRows: ScalingRow[] = [];
  for (let i = 0; i < runsForScaling.length; i++) {
    const run = runsForScaling[i]!;
    const result = variantResults[i];
    if (result?.status !== "fulfilled" || !result.value?.items?.length) continue;

    const variants = result.value.items;
    const agents = variants[0]?.agents;
    const steps = variants[0]?.steps;
    if (agents == null || steps == null || !Number.isFinite(agents) || !Number.isFinite(steps)) continue;

    const variantsCount = variants.length;
    const sumVariantDurationMs = variants.reduce(
      (s, v) => s + (v.durationMs != null && Number.isFinite(v.durationMs) ? v.durationMs : 0),
      0,
    );
    const isLegacyTiming = variantsCount > 0 && sumVariantDurationMs === 0;
    const effectiveRunDurationMs =
      run.runDurationMs != null && run.runDurationMs > 0
        ? run.runDurationMs
        : deriveRunDurationMs({
            runDurationMs: run.runDurationMs,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
            completedAt: run.completedAt,
          });

    const decisionsTotal = agents * steps * variantsCount;
    const canComputeOverhead =
      !isLegacyTiming &&
      sumVariantDurationMs > 0 &&
      effectiveRunDurationMs != null &&
      effectiveRunDurationMs > 0;
    const canComputeRates =
      effectiveRunDurationMs != null &&
      effectiveRunDurationMs > 0 &&
      decisionsTotal > 0;

    const decisionsPerSec =
      !isLegacyTiming && canComputeRates
        ? decisionsTotal / (effectiveRunDurationMs / 1000)
        : null;
    const overheadMs = canComputeOverhead
      ? Math.max(0, effectiveRunDurationMs - sumVariantDurationMs)
      : null;
    const overheadPct = canComputeOverhead && overheadMs != null
      ? (overheadMs / effectiveRunDurationMs) * 100
      : null;
    const efficiencyMsPerDecision =
      !isLegacyTiming && canComputeRates
        ? effectiveRunDurationMs / decisionsTotal
        : null;

    scalingRows.push({
      runId: run.id,
      agents,
      variants: variantsCount,
      steps,
      runDurationMs:
        effectiveRunDurationMs != null && effectiveRunDurationMs > 0
          ? effectiveRunDurationMs
          : null,
      decisionsTotal,
      decisionsPerSec,
      overheadMs,
      overheadPct,
      efficiencyMsPerDecision,
      isLegacyTiming,
    });
  }

  scalingRows.sort((a, b) => a.agents - b.agents);

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + LIMIT, total);
  const prevOffset = Math.max(0, offset - LIMIT);
  const nextOffset = offset + LIMIT;
  const hasPrev = offset > 0;
  const hasNext = nextOffset < total;

  return (
    <div>
      <h1 className="dashboard-title" style={{ marginBottom: 24 }}>
        Runs
      </h1>

      <ScalingTable rows={scalingRows} assetSymbol="SPY" />

      {data === null ? (
        <div className="card">
          <p className="card-error">Failed to load runs. Check that the API is running.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <p className="card-empty">No runs found.</p>
        </div>
      ) : (
        <>
          <RunsTable items={items} />

          <div className="pagination">
            <span className="pagination-info">
              Showing {from}–{to} of {total}
            </span>
            <div className="pagination-buttons">
              <Link
                href={hasPrev ? `/runs?offset=${prevOffset}` : "#"}
                className={`pagination-btn ${!hasPrev ? "pagination-btn-disabled" : ""}`}
                aria-disabled={!hasPrev}
              >
                Prev
              </Link>
              <Link
                href={hasNext ? `/runs?offset=${nextOffset}` : "#"}
                className={`pagination-btn ${!hasNext ? "pagination-btn-disabled" : ""}`}
                aria-disabled={!hasNext}
              >
                Next
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
