"use client";

import React, { useMemo } from "react";

export type AgreementCell = {
  seedA: number;
  seedB: number;
  agreement: number;
};

type SeedHeatmapProps = {
  agreementMatrix: AgreementCell[];
};

function agreementColor(agreement: number): string {
  if (agreement >= 0.9) return "bg-green-700 text-white";
  if (agreement >= 0.75) return "bg-green-400 text-slate-900";
  if (agreement >= 0.6) return "bg-yellow-400 text-slate-900";
  if (agreement >= 0.4) return "bg-orange-500 text-white";
  return "bg-red-600 text-white";
}

export function SeedHeatmap({ agreementMatrix }: SeedHeatmapProps) {
  const { seeds, lookup } = useMemo(() => {
    const seedsSet = new Set<number>();
    for (const c of agreementMatrix) {
      seedsSet.add(c.seedA);
      seedsSet.add(c.seedB);
    }
    const seeds = [...seedsSet].sort((a, b) => a - b);
    const lookup = new Map<string, number>();
    for (const c of agreementMatrix) {
      lookup.set(`${c.seedA}_${c.seedB}`, c.agreement);
    }
    return { seeds, lookup };
  }, [agreementMatrix]);

  if (seeds.length < 2) return null;

  return (
    <div data-testid="seed-agreement-section" style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12 }}>
        Seed agreement
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            borderCollapse: "collapse",
            fontSize: 11,
            minWidth: "min-content",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  padding: "4px 6px",
                  border: "1px solid rgba(15, 23, 42, 0.15)",
                  background: "rgba(15, 23, 42, 0.04)",
                  fontWeight: 600,
                }}
              >
                —
              </th>
              {seeds.map((s) => (
                <th
                  key={s}
                  style={{
                    padding: "4px 6px",
                    border: "1px solid rgba(15, 23, 42, 0.15)",
                    background: "rgba(15, 23, 42, 0.04)",
                    fontWeight: 600,
                    minWidth: 36,
                  }}
                >
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seeds.map((seedA) => (
              <tr key={seedA}>
                <td
                  style={{
                    padding: "4px 6px",
                    border: "1px solid rgba(15, 23, 42, 0.15)",
                    background: "rgba(15, 23, 42, 0.04)",
                    fontWeight: 600,
                  }}
                >
                  {seedA}
                </td>
                {seeds.map((seedB) => {
                  const agreement =
                    seedA === seedB ? 1 : lookup.get(`${seedA}_${seedB}`) ?? 0;
                  const pct = Math.round(agreement * 100);
                  return (
                    <td
                      key={`${seedA}-${seedB}`}
                      style={{
                        padding: "4px 6px",
                        border: "1px solid rgba(15, 23, 42, 0.15)",
                        textAlign: "center",
                        minWidth: 36,
                      }}
                      className={agreementColor(agreement)}
                      title={`Seed ${seedA} vs ${seedB}: ${pct}%`}
                    >
                      {pct}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
