import React from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Label,
  Legend,
  Line,
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
  buyPct?: number;
  sellPct?: number;
};

type DecisionTimelineProps = {
  selectedLabel: string;
  selectedSeries: DecisionTimelineStep[];
  comparisonLabel: string | null;
  comparisonSeries: DecisionTimelineStep[];
  infoEvents?: Array<{
    step: number;
    topic: string;
    sentiment: number;
    simulationPlatform?: string;
    sourceType?: string;
    sourceName?: string;
  }>;
};

function truncateTitleOnly(title: string, max = 42): string {
  const t = title.trim();
  if (!t) return "(event)";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function DecisionTimeline({
  selectedSeries,
  comparisonSeries,
  infoEvents = [],
}: DecisionTimelineProps) {
  if (selectedSeries.length === 0) return null;

  const byStep = new Map<
    number,
    {
      step: number;
      selectedSellPct?: number;
      comparisonSellPct?: number;
      deltaSellPct?: number;
      positiveDeltaSellPct?: number;
      negativeDeltaSellPct?: number;
    }
  >();
  for (const row of selectedSeries) {
    byStep.set(row.step, { step: row.step, selectedSellPct: row.sellPct });
  }
  for (const row of comparisonSeries) {
    const existing = byStep.get(row.step);
    if (existing) {
      existing.comparisonSellPct = row.sellPct;
    } else {
      byStep.set(row.step, {
        step: row.step,
        selectedSellPct: undefined,
        comparisonSellPct: row.sellPct,
      });
    }
  }

  const data = Array.from(byStep.values())
    .map((d) => ({
      ...d,
      deltaSellPct:
        typeof d.selectedSellPct === "number" &&
        Number.isFinite(d.selectedSellPct) &&
        typeof d.comparisonSellPct === "number" &&
        Number.isFinite(d.comparisonSellPct)
          ? d.selectedSellPct - d.comparisonSellPct
          : undefined,
      positiveDeltaSellPct:
        typeof d.selectedSellPct === "number" &&
        Number.isFinite(d.selectedSellPct) &&
        typeof d.comparisonSellPct === "number" &&
        Number.isFinite(d.comparisonSellPct) &&
        d.selectedSellPct - d.comparisonSellPct >= 0
          ? d.selectedSellPct - d.comparisonSellPct
          : undefined,
      negativeDeltaSellPct:
        typeof d.selectedSellPct === "number" &&
        Number.isFinite(d.selectedSellPct) &&
        typeof d.comparisonSellPct === "number" &&
        Number.isFinite(d.comparisonSellPct) &&
        d.selectedSellPct - d.comparisonSellPct < 0
          ? d.selectedSellPct - d.comparisonSellPct
          : undefined,
    }))
    .sort((a, b) => a.step - b.step);

  const steps = data.map((d) => d.step);
  const minStep = Math.min(...steps);
  const maxStep = Math.max(...steps);

  const eventLabelsByStep = new Map<
    number,
    { label: string; color: string; areaFill: string | null; sentiment: number }
  >();
  for (const ev of infoEvents) {
    if (!Number.isFinite(ev.step) || !Number.isFinite(ev.sentiment)) continue;
    if (eventLabelsByStep.has(ev.step)) continue;
    const sent = ev.sentiment;
    const color = sent < 0 ? "#EF4444" : sent > 0 ? "#22c55e" : "#94a3b8";
    const areaFill =
      sent < 0 ? "rgba(255, 80, 80, 0.3)" : sent > 0 ? "rgba(80, 255, 160, 0.3)" : null;
    const sign = sent > 0 ? "+" : "";
    const title = truncateTitleOnly(ev.topic);
    const simPlatform = ev.simulationPlatform?.trim();
    const sourceType = ev.sourceType?.trim();
    const sourceName = ev.sourceName?.trim();
    const sourcePrefix = simPlatform
      ? simPlatform
      : sourceType && sourceName
        ? `${sourceType}/${sourceName}`
        : null;
    eventLabelsByStep.set(ev.step, {
      label: sourcePrefix
        ? `${sourcePrefix} · ${title} (${sign}${sent.toFixed(1)})`
        : `${title} (${sign}${sent.toFixed(1)})`,
      color,
      areaFill,
      sentiment: sent,
    });
  }
  const eventMarkers = Array.from(eventLabelsByStep.entries())
    .map(([step, meta]) => ({ step, ...meta }))
    .sort((a, b) => a.step - b.step);
  const primaryEvent =
    eventMarkers.length > 0 ? eventMarkers[eventMarkers.length - 1] : null;

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-900/40 p-4 sm:p-5">
      <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Decision timeline
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Impact-first: top panel shows delta impact, bottom panel shows sell context.
      </p>

      <div className="mt-3 h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            syncId="decision-timeline-sync"
            data={data}
            margin={{ top: 10, right: 24, left: 0, bottom: 6 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.2)"
            />
            <XAxis
              dataKey="step"
              type="number"
              domain={[minStep, maxStep]}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
            />
            <YAxis
              yAxisId="pct"
              domain={[-0.4, 0.4]}
              allowDataOverflow={true}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickFormatter={(v) =>
                typeof v === "number" ? `${Math.round(v * 100)}%` : String(v)
              }
            />
            <ReferenceLine yAxisId="pct" y={0} stroke="#fff" strokeOpacity={0.3} />
            {eventMarkers.map((m) =>
              m.areaFill ? (
                <ReferenceArea
                  key={`event-area-impact-${m.step}`}
                  x1={m.step - 1.5}
                  x2={m.step + 1.5}
                  yAxisId="pct"
                  y1={-0.4}
                  y2={0.4}
                  fill={m.areaFill}
                  fillOpacity={0.3}
                  strokeOpacity={0}
                />
              ) : null,
            )}
            <Area
              yAxisId="pct"
              type="monotone"
              dataKey="positiveDeltaSellPct"
              name="Impact (Δ SELL%)"
              stroke="none"
              fill="#EF4444"
              fillOpacity={0.7}
              isAnimationActive={false}
            />
            <Area
              yAxisId="pct"
              type="monotone"
              dataKey="negativeDeltaSellPct"
              name="Impact (Δ SELL%)"
              stroke="none"
              fill="#22C55E"
              fillOpacity={0.7}
              isAnimationActive={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const row = payload[0]?.payload as {
                  deltaSellPct?: number;
                  selectedSellPct?: number;
                  comparisonSellPct?: number;
                };
                const fmt = (v: number | undefined) =>
                  typeof v === "number" && Number.isFinite(v)
                    ? `${(v * 100).toFixed(1)}%`
                    : "—";
                return (
                  <div
                    style={{
                      background: "rgba(2,6,23,0.95)",
                      border: "1px solid rgba(148,163,184,0.4)",
                      borderRadius: 8,
                      padding: 10,
                      color: "#e2e8f0",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >{`Step ${label}`}</div>
                    <div style={{ fontSize: 12 }}>{`Δ SELL %: ${fmt(
                      row.deltaSellPct,
                    )}`}</div>
                    <div style={{ fontSize: 12 }}>{`Event SELL %: ${fmt(
                      row.selectedSellPct,
                    )}`}</div>
                    <div style={{ fontSize: 12 }}>{`Baseline SELL %: ${fmt(
                      row.comparisonSellPct,
                    )}`}</div>
                  </div>
                );
              }}
            />
            <Legend />
            {eventMarkers.map((m) => (
              <ReferenceLine
                key={`event-line-impact-${m.step}`}
                x={m.step}
                stroke={m.color}
                strokeWidth={2}
                strokeOpacity={0.95}
              >
                <Label
                  value={m.label}
                  position="top"
                  fill={m.sentiment < 0 ? "#EF4444" : "#22C55E"}
                  fontSize={14}
                  fontWeight={700 as unknown as string}
                />
              </ReferenceLine>
            ))}
            {primaryEvent ? (
              <ReferenceLine
                x={primaryEvent.step}
                stroke="#EF4444"
                strokeWidth={3}
                strokeOpacity={0.98}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 h-[120px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            syncId="decision-timeline-sync"
            data={data}
            margin={{ top: 4, right: 24, left: 0, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.18)"
            />
            <XAxis
              dataKey="step"
              type="number"
              domain={[minStep, maxStep]}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
            />
            <YAxis
              yAxisId="context"
              domain={[0, 1]}
              allowDataOverflow={true}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickFormatter={(v) =>
                typeof v === "number" ? `${Math.round(v * 100)}%` : String(v)
              }
            />
            {eventMarkers.map((m) =>
              m.areaFill ? (
                <ReferenceArea
                  key={`event-area-context-${m.step}`}
                  x1={m.step - 1.5}
                  x2={m.step + 1.5}
                  yAxisId="context"
                  y1={0}
                  y2={1}
                  fill={m.areaFill}
                  fillOpacity={0.3}
                  strokeOpacity={0}
                />
              ) : null,
            )}
            <Line
              yAxisId="context"
              type="monotone"
              dataKey="comparisonSellPct"
              name="Baseline SELL %"
              stroke="#9CA3AF"
              strokeWidth={1}
              strokeOpacity={0.3}
              dot={false}
            />
            <Line
              yAxisId="context"
              type="monotone"
              dataKey="selectedSellPct"
              name="Event SELL %"
              stroke="#EF4444"
              strokeWidth={2}
              strokeOpacity={0.7}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
