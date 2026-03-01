"use client";

import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export type ScalingRowForCurve = {
  agents: number;
  decisionsPerSec: number | null;
  overheadPct: number | null;
  isLegacyTiming?: boolean;
  engineInitMs?: number | null;
  orchestrationMs?: number | null;
  dbCommitMs?: number | null;
  computeMs?: number | null;
  totalMs?: number | null;
};

type ScalingCurveProps = {
  scalingRows: ScalingRowForCurve[];
};

function prepareChartData(rows: ScalingRowForCurve[]) {
  const filtered = rows.filter(
    (r) => !r.isLegacyTiming && (r.decisionsPerSec != null || r.overheadPct != null)
  );
  if (filtered.length < 2) return null;

  const byAgents = new Map<
    number,
    {
      decisionsPerSec: number[];
      overheadPct: number[];
      engineInitMs: number[];
      orchestrationMs: number[];
      dbCommitMs: number[];
      computeMs: number[];
    }
  >();
  for (const r of filtered) {
    const agents = r.agents;
    if (!byAgents.has(agents)) {
      byAgents.set(agents, {
        decisionsPerSec: [],
        overheadPct: [],
        engineInitMs: [],
        orchestrationMs: [],
        dbCommitMs: [],
        computeMs: [],
      });
    }
    const entry = byAgents.get(agents)!;
    if (r.decisionsPerSec != null) entry.decisionsPerSec.push(r.decisionsPerSec);
    if (r.overheadPct != null) {
      entry.overheadPct.push(Math.min(100, r.overheadPct));
    }
    if (r.engineInitMs != null) entry.engineInitMs.push(r.engineInitMs);
    if (r.orchestrationMs != null) entry.orchestrationMs.push(r.orchestrationMs);
    if (r.dbCommitMs != null) entry.dbCommitMs.push(r.dbCommitMs);
    if (r.computeMs != null) entry.computeMs.push(r.computeMs);
  }

  const data = Array.from(byAgents.entries())
    .map(([agents, v]) => {
      const avg = (arr: number[]) =>
        arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      return {
        agents,
        decisionsPerSec: avg(v.decisionsPerSec),
        overheadPct: avg(v.overheadPct),
        engineInitMs: avg(v.engineInitMs),
        orchestrationMs: avg(v.orchestrationMs),
        dbCommitMs: avg(v.dbCommitMs),
        computeMs: avg(v.computeMs),
      };
    })
    .sort((a, b) => a.agents - b.agents);

  return data.length >= 2 ? data : null;
}

export function ScalingCurve({ scalingRows }: ScalingCurveProps) {
  const [showOverheadBreakdown, setShowOverheadBreakdown] = useState(false);
  const data = useMemo(() => prepareChartData(scalingRows), [scalingRows]);

  if (!data) {
    return (
      <div
        style={{
          border: "1px solid rgba(15, 23, 42, 0.10)",
          borderRadius: 10,
          padding: 24,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 120,
          color: "rgba(15, 23, 42, 0.55)",
          fontSize: 14,
        }}
      >
        Not enough scaling data
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid rgba(15, 23, 42, 0.10)",
        borderRadius: 10,
        padding: 16,
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Scaling Curve</div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showOverheadBreakdown}
            onChange={(e) => setShowOverheadBreakdown(e.target.checked)}
          />
          Show Overhead Breakdown
        </label>
      </div>
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer width="100%" height={300}>
          {showOverheadBreakdown ? (
            <AreaChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
              <XAxis
                dataKey="agents"
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => String(v)}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => String(Math.round(v))}
              />
              <Tooltip
                formatter={(value: number, name: string) => [value.toFixed(0) + " ms", name]}
                labelFormatter={(label) => `Agents: ${label}`}
              />
              <Legend />
              <Area
                type="linear"
                dataKey="engineInitMs"
                stackId="1"
                name="Engine Init"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.7}
              />
              <Area
                type="linear"
                dataKey="orchestrationMs"
                stackId="1"
                name="Orchestration"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.7}
              />
              <Area
                type="linear"
                dataKey="dbCommitMs"
                stackId="1"
                name="DB Commit"
                stroke="#ec4899"
                fill="#ec4899"
                fillOpacity={0.7}
              />
              <Area
                type="linear"
                dataKey="computeMs"
                stackId="1"
                name="Compute"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.7}
              />
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
              <XAxis
                dataKey="agents"
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => String(v)}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => String(Math.round(v))}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === "Decisions/sec" ? [value.toFixed(1), name] : [`${value.toFixed(1)}%`, name]
                }
                labelFormatter={(label) => `Agents: ${label}`}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="decisionsPerSec"
                name="Decisions/sec"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="overheadPct"
                name="Overhead %"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
