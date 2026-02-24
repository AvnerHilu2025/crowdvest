"use client";

import { useRouter } from "next/navigation";
import { truncateMiddle, truncate } from "@/lib/ui";
import { formatDateUTC } from "@/lib/format";

interface RunItem {
  id: string;
  name: string;
  createdAt: string;
  status: string;
  assetSymbol: string | null;
  steps: number | null;
  agents: number | null;
  variantsCount: number;
}

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

export function RunsTable({ items }: { items: RunItem[] }) {
  const router = useRouter();

  return (
    <div className="runs-table-wrap">
      <table className="runs-table">
        <thead>
          <tr>
            <th>Created</th>
            <th>Name</th>
            <th>Status</th>
            <th>Asset</th>
            <th>Steps</th>
            <th>Agents</th>
            <th>Variants</th>
            <th>Run ID</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr
              key={r.id}
              className="runs-table-row"
              onClick={() => router.push(`/runs/${r.id}?assetSymbol=SPY`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/runs/${r.id}?assetSymbol=SPY`);
                }
              }}
            >
              <td>{formatDateUTC(r.createdAt)}</td>
              <td title={r.name || r.id}>{truncate(r.name || r.id, 40)}</td>
              <td>
                <StatusBadge status={r.status} />
              </td>
              <td>{r.assetSymbol ?? "—"}</td>
              <td>{r.steps ?? "—"}</td>
              <td>{r.agents ?? "—"}</td>
              <td>{r.variantsCount}</td>
              <td className="runs-table-id" title={r.id}>
                {truncateMiddle(r.id)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
