"use client";

import { useCrossRunStats } from "./cross-run-provider";
import { SectionCard, MetricRows, MetricRow } from "@/components/ui/dashboard";

export function CrossRunContextCard() {
  const { stats, loading, error } = useCrossRunStats();

  if (loading) {
    return (
      <div style={{ marginTop: 24 }}>
        <SectionCard title="Cross-Run Context">
          <p className="card-empty">Loading…</p>
        </SectionCard>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ marginTop: 24 }}>
        <SectionCard title="Cross-Run Context">
          <p className="card-error">{error}</p>
        </SectionCard>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ marginTop: 24 }}>
        <SectionCard title="Cross-Run Context">
          <p className="card-empty">No data available.</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      <SectionCard title="Cross-Run Context">
        <MetricRows>
          <MetricRow
            label="Average Accuracy (last 20 runs)"
            value={`${(stats.avgAccuracy * 100).toFixed(2)}%`}
            mono
          />
          <MetricRow
            label="Average Correlation"
            value={stats.avgCorr.toFixed(4)}
            mono
          />
          <MetricRow
            label="Current Accuracy Percentile"
            value={`${stats.percentile.toFixed(1)}%`}
            mono
          />
          <MetricRow label="Interpretation" value={stats.interpretation} />
        </MetricRows>
      </SectionCard>
    </div>
  );
}
