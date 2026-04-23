import React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DecisionTimelineStep = {
  step: number;
  weightedSignal: number;
  signal: number;
};

type DecisionTimelineProps = {
  selectedLabel: string;
  selectedSeries: DecisionTimelineStep[];
  comparisonLabel: string | null;
  comparisonSeries: DecisionTimelineStep[];
  infoEvents?: Array<{ step: number; topic: string; sentiment: number }>;
};

export function DecisionTimeline({
  selectedLabel,
  selectedSeries,
  comparisonLabel,
  comparisonSeries,
  infoEvents = [],
}: DecisionTimelineProps) {
  if (selectedSeries.length === 0) return null;

  const byStep = new Map<number, { step: number; selected: number; comparison?: number }>();
  for (const row of selectedSeries) {
    byStep.set(row.step, { step: row.step, selected: row.weightedSignal });
  }
  for (const row of comparisonSeries) {
    const existing = byStep.get(row.step);
    if (existing) {
      existing.comparison = row.weightedSignal;
      continue;
    }
    byStep.set(row.step, { step: row.step, selected: NaN, comparison: row.weightedSignal });
  }
  const data = Array.from(byStep.values()).sort((a, b) => a.step - b.step);
  const steps = data.map((d) => d.step);
  const minStep = Math.min(...steps);
  const maxStep = Math.max(...steps);
  const eventLabelsByStep = new Map<number, { label: string; color: string; areaFill: string | null }>();
  for (const ev of infoEvents) {
    if (!Number.isFinite(ev.step) || !Number.isFinite(ev.sentiment)) continue;
    if (eventLabelsByStep.has(ev.step)) continue;
    const sent = ev.sentiment;
    const color = sent < 0 ? "#ef4444" : sent > 0 ? "#22c55e" : "#94a3b8";
    const areaFill = sent < 0 ? "rgba(255, 80, 80, 0.12)" : sent > 0 ? "rgba(80, 255, 160, 0.12)" : null;
    const sign = sent > 0 ? "+" : "";
    eventLabelsByStep.set(ev.step, {
      label: `${ev.topic} (${sign}${sent.toFixed(1)})`,
      color,
      areaFill,
    });
  }
  const eventMarkers = Array.from(eventLabelsByStep.entries())
    .map(([step, meta]) => ({ step, ...meta }))
    .sort((a, b) => a.step - b.step);

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-900/40 p-4 sm:p-5">
      <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">Decision timeline</div>
      <p className="mt-1 text-sm text-slate-500">Weighted crowd signal per step (negative = SELL bias, positive = BUY bias).</p>
      <div className="mt-3 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
            <XAxis dataKey="step" type="number" domain={[minStep, maxStep]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis
              domain={[-1.1, 1.1]}
              allowDataOverflow={true}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickFormatter={(v) => (typeof v === "number" ? v.toFixed(1) : String(v))}
            />
            {eventMarkers.map((m) =>
              m.areaFill ? (
                <ReferenceArea
                  key={`event-area-${m.step}`}
                  x1={m.step - 1.5}
                  x2={m.step + 1.5}
                  y1={-1.1}
                  y2={1.1}
                  fill={m.areaFill}
                  strokeOpacity={0}
                />
              ) : null,
            )}
            <Tooltip labelFormatter={(value) => `Step ${value}`} />
            <Legend />
            {eventMarkers.map((m) => (
              <ReferenceLine
                key={`event-${m.step}`}
                x={m.step}
                stroke={m.color}
                strokeDasharray="4 4"
                label={{ value: m.label, fill: m.color, position: "top" }}
              />
            ))}
            <Line type="monotone" dataKey="selected" name={selectedLabel} stroke="#38bdf8" strokeWidth={3} dot={false} />
            {comparisonLabel ? (
              <Line type="monotone" dataKey="comparison" name={comparisonLabel} stroke="#f472b6" strokeWidth={2} dot={false} />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
