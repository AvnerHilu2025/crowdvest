import Link from "next/link";
import { listRuns } from "@/lib/api";

export const dynamic = "force-dynamic";

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export default async function RunsPage() {
  let items: { runId: string; startedAt?: string | null }[] = [];
  let total = 0;
  let error: string | null = null;

  try {
    const data = await listRuns(30);
    items = data.items ?? [];
    total = data.total ?? 0;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error) {
    return (
      <main style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 800 }}>
        <h1 style={{ marginBottom: 16 }}>Runs</h1>
        <p style={{ color: "#c00", marginBottom: 12 }}>
          Failed to load runs: {error}
        </p>
        <p style={{ color: "#666", marginBottom: 12, fontSize: 14 }}>
          If GET /runs?limit=30 is not available, you can navigate directly to a run using the URL:
        </p>
        <p style={{ fontFamily: "monospace", fontSize: 13, backgroundColor: "#f5f5f5", padding: 12, borderRadius: 4 }}>
          /runs/&lt;runId&gt;?assetSymbol=SPY
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 800 }}>
      <h1 style={{ marginBottom: 16 }}>Runs</h1>
      {items.length === 0 ? (
        <p style={{ color: "#666" }}>No runs found.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((r) => (
            <li key={r.runId} style={{ marginBottom: 8, padding: 8, border: "1px solid #ddd", borderRadius: 4 }}>
              <Link href={`/runs/${r.runId}?assetSymbol=SPY`} style={{ color: "#0066cc", textDecoration: "none" }}>
                {r.runId}
              </Link>
              {r.startedAt != null && (
                <span style={{ marginLeft: 12, color: "#666", fontSize: 14 }}>
                  {formatDate(r.startedAt)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p style={{ marginTop: 16, color: "#666", fontSize: 14 }}>
        {total} run{total !== 1 ? "s" : ""}
      </p>
    </main>
  );
}
