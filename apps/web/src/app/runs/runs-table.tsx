"use client";

import { useRouter } from "next/navigation";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { ui } from "@/components/ui/ui-styles";
import { formatDateTimeUTC, formatDurationMs, truncateMiddle } from "@/lib/format";
import { truncate } from "@/lib/ui";

const cellStyle: React.CSSProperties = ui.td;

interface RunItem {
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

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "COMPLETED"
      ? "green"
      : status === "FAILED"
        ? "red"
        : status === "RUNNING"
          ? "amber"
          : "gray";
  return <Badge tone={tone}>{status}</Badge>;
}

export function RunsTable({ items }: { items: RunItem[] }) {
  const router = useRouter();

  return (
    <div style={{ overflowX: "auto", border: "1px solid #E6EEF7", borderRadius: 8 }}>
      <Table
        headers={["Created", "Name", "Status", "Duration", "Asset", "Steps", "Agents", "Variants", "Run ID"]}
      >
        {items.map((r) => (
          <tr
            key={r.id}
            onClick={() => router.push(`/runs/${r.id}?assetSymbol=SPY`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(`/runs/${r.id}?assetSymbol=SPY`);
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <td style={cellStyle}>{formatDateTimeUTC(r.createdAt)}</td>
            <td style={cellStyle} title={r.name || r.id}>
              {truncate(r.name || r.id, 40)}
            </td>
            <td style={cellStyle}>
              <StatusBadge status={r.status} />
            </td>
            <td style={cellStyle}>{formatDurationMs(r.runDurationMs)}</td>
            <td style={cellStyle}>{r.assetSymbol ?? "—"}</td>
            <td style={cellStyle}>{r.steps ?? "—"}</td>
            <td style={cellStyle}>{r.agents ?? "—"}</td>
            <td style={cellStyle}>{r.variantsCount}</td>
            <td style={cellStyle} title={r.id}>
              {truncateMiddle(r.id)}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
