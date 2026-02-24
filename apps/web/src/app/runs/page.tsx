import Link from "next/link";
import { RunsTable } from "./runs-table";

export const dynamic = "force-dynamic";

const LIMIT = 20;
const WEB_BASE =
  process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:4000";

interface RunsV2Item {
  id: string;
  name: string;
  createdAt: string;
  status: string;
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

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const { offset: offsetParam } = await searchParams;
  const offset = Math.max(0, parseInt(offsetParam ?? "0", 10) || 0);

  const data = await fetchRunsV2(offset);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

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
