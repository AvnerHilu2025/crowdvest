import Link from "next/link";

function truncateMiddle(id: string, head = 6, tail = 4): string {
  if (!id || id.length <= head + tail) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export interface StabilityRow {
  runId: string;
  agents: number;
  variants: number;
  steps: number;
  corrSpread: number | null;
  corrStdDev: number | null;
  accStdDev: number | null;
  signAgreementRate: number | null;
  label: "multi-seed" | "single-seed" | "missing-variants";
}

interface StabilityTableProps {
  rows: StabilityRow[];
  assetSymbol?: string;
  emptyMessage?: string;
  title?: string;
}

function getStabilityBadge(row: StabilityRow): "STRONG" | "OK" | "WEAK" | null {
  if (row.label !== "multi-seed") return null;
  const signInstability =
    row.signAgreementRate != null && row.signAgreementRate < 1;
  const accHigh = row.accStdDev != null && row.accStdDev > 0.05;
  const corrWide = row.corrSpread != null && row.corrSpread > 0.1;

  if (signInstability || accHigh || corrWide) return "WEAK";
  if (row.corrSpread != null && row.corrSpread > 0.05) return "OK";
  return "STRONG";
}

export function StabilityTable({
  rows,
  assetSymbol = "SPY",
  emptyMessage = "No completed runs with variants.",
  title = "Stability Watchlist",
}: StabilityTableProps) {
  return (
    <section className="card" style={{ marginBottom: 24 }}>
      <h2 className="card-title">{title}</h2>
      {rows.length === 0 ? (
        <p className="card-empty" style={{ marginTop: 8 }}>
          {emptyMessage}
        </p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="variants-table" style={{ width: "100%", minWidth: 500 }}>
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Seeds</th>
                <th>Corr spread</th>
                <th>Sign instability</th>
                <th>Acc std dev</th>
                <th>Badge</th>
                <th>Compare</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const signInstability =
                  row.label === "multi-seed" &&
                  row.signAgreementRate != null &&
                  row.signAgreementRate < 1;
                const badge = getStabilityBadge(row);
                return (
                  <tr key={row.runId}>
                    <td>
                      <Link href={`/runs/${row.runId}`} className="card-link">
                        {truncateMiddle(row.runId, 8, 4)}
                      </Link>
                    </td>
                    <td>{row.variants < 2 ? "single-seed" : row.variants}</td>
                    <td>
                      {row.corrSpread != null ? row.corrSpread.toFixed(4) : "—"}
                    </td>
                    <td>{row.label === "multi-seed" ? (signInstability ? "YES" : "NO") : "—"}</td>
                    <td>
                      {row.accStdDev != null
                        ? (row.accStdDev * 100).toFixed(2) + "%"
                        : "—"}
                    </td>
                    <td>
                      {badge ? (
                        <span
                          className="badge"
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            fontWeight: 600,
                            ...(badge === "STRONG"
                              ? { background: "rgba(16, 185, 129, 0.12)", color: "rgba(16, 185, 129, 0.95)" }
                              : badge === "OK"
                                ? { background: "rgba(245, 158, 11, 0.14)", color: "rgba(180, 83, 9, 0.95)" }
                                : { background: "rgba(239, 68, 68, 0.12)", color: "rgba(239, 68, 68, 0.95)" }),
                          }}
                        >
                          {badge}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {row.variants >= 2 ? (
                        <Link
                          href={`/runs/${row.runId}/compare?assetSymbol=${encodeURIComponent(assetSymbol)}`}
                          className="card-link"
                        >
                          Compare seeds
                        </Link>
                      ) : (
                        <span style={{ color: "var(--cv-muted)", fontSize: 12 }}>
                          single-seed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
