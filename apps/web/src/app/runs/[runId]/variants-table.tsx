"use client";

import { useRouter } from "next/navigation";
import { truncateMiddle } from "@/lib/format";

export interface VariantRow {
  id: string;
  seed: number;
  agents: number;
  steps: number;
  label: string | null;
  corr: number | null;
  directionalAccuracy: number | null;
  pairsCount: number | null;
  decisionsHash: string | null;
  returnsHash: string | null;
}

export function VariantsTable({
  runId,
  items,
}: {
  runId: string;
  items: VariantRow[];
}) {
  const router = useRouter();

  return (
    <div className="variants-table-wrap">
      <table className="variants-table">
        <thead>
          <tr>
            <th>seed</th>
            <th>agents</th>
            <th>steps</th>
            <th>label</th>
            <th>corr</th>
            <th>directionalAccuracy</th>
            <th>pairsCount</th>
            <th>decisionsHash</th>
            <th>returnsHash</th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr
              key={v.id}
              className="variants-table-row"
              onClick={() => router.push(`/runs/${runId}/variants/${v.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/runs/${runId}/variants/${v.id}`);
                }
              }}
            >
              <td>{v.seed}</td>
              <td>{v.agents}</td>
              <td>{v.steps}</td>
              <td>{v.label ?? "—"}</td>
              <td>{v.corr != null ? v.corr.toFixed(4) : "—"}</td>
              <td>
                {v.directionalAccuracy != null
                  ? v.directionalAccuracy.toFixed(4)
                  : "—"}
              </td>
              <td>{v.pairsCount != null ? v.pairsCount : "—"}</td>
              <td className="mono" title={v.decisionsHash ?? undefined}>
                {v.decisionsHash
                  ? truncateMiddle(v.decisionsHash, 8, 6)
                  : "—"}
              </td>
              <td className="mono" title={v.returnsHash ?? undefined}>
                {v.returnsHash ? truncateMiddle(v.returnsHash, 8, 6) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
