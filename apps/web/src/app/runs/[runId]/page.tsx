import Link from "next/link";
import { getRunVariants } from "@/lib/api";

export const dynamic = "force-dynamic";

function formatDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export default async function RunVariantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ assetSymbol?: string }>;
}) {
  const { runId } = await params;
  const { assetSymbol = "SPY" } = await searchParams;

  let items: Awaited<ReturnType<typeof getRunVariants>>["items"] = [];
  let total = 0;
  let error: string | null = null;

  try {
    const data = await getRunVariants(runId, assetSymbol);
    items = data.items ?? [];
    total = data.total ?? 0;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error) {
    return (
      <main style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 1200 }}>
        <Link href="/runs" style={{ color: "#0066cc", textDecoration: "none", marginBottom: 16, display: "block" }}>
          ← Back to Runs
        </Link>
        <h1 style={{ marginBottom: 16 }}>Run {runId.slice(0, 8)}…</h1>
        <p style={{ color: "#c00" }}>Error: {error}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 1200 }}>
      <Link href="/runs" style={{ color: "#0066cc", textDecoration: "none", marginBottom: 16, display: "block" }}>
        ← Back to Runs
      </Link>
      <h1 style={{ marginBottom: 8 }}>Run Variants</h1>
      <p style={{ margin: 0, color: "#666", fontSize: 14, marginBottom: 16 }}>
        runId: {runId} · assetSymbol: {assetSymbol}
      </p>
      <p style={{ marginBottom: 16, fontSize: 14 }}>Total: {total} variant{total !== 1 ? "s" : ""}</p>
      <div style={{ overflowX: "auto" }}>
        <table
          border={1}
          cellPadding={8}
          cellSpacing={0}
          style={{ borderCollapse: "collapse", minWidth: 900 }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th>seed</th>
              <th>agents</th>
              <th>steps</th>
              <th>corr</th>
              <th>directionalAccuracy</th>
              <th>pairsCount</th>
              <th>decisionsHash</th>
              <th>returnsHash</th>
              <th>createdAt</th>
              <th>variantId</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", color: "#666", padding: 24 }}>
                  No variants found
                </td>
              </tr>
            ) : (
              items.map((v) => (
                <tr key={v.id}>
                  <td>{v.seed}</td>
                  <td>{v.agents}</td>
                  <td>{v.steps}</td>
                  <td style={{ fontFamily: "monospace" }}>
                    {v.summary?.corr != null ? Number(v.summary.corr).toFixed(6) : "—"}
                  </td>
                  <td style={{ fontFamily: "monospace" }}>
                    {v.summary?.directionalAccuracy != null
                      ? Number(v.summary.directionalAccuracy).toFixed(4)
                      : "—"}
                  </td>
                  <td>{v.summary?.pairsCount ?? "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>
                    {v.summary?.decisionsHash ?? "—"}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>
                    {v.summary?.returnsHash ?? "—"}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {v.summary?.createdAt ? formatDate(v.summary.createdAt) : formatDate(v.createdAt)}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{v.id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
