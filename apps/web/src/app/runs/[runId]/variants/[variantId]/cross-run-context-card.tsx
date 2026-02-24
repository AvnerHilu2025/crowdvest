"use client";

import { useCrossRunStats } from "./cross-run-provider";

export function CrossRunContextCard() {
  const { stats, loading, error } = useCrossRunStats();

  if (loading) {
    return (
      <div className="card variant-card" style={{ marginTop: 24 }}>
        <h2 className="card-title">Cross-Run Context</h2>
        <p className="card-empty">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card variant-card" style={{ marginTop: 24 }}>
        <h2 className="card-title">Cross-Run Context</h2>
        <p className="card-error">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="card variant-card" style={{ marginTop: 24 }}>
        <h2 className="card-title">Cross-Run Context</h2>
        <p className="card-empty">No data available.</p>
      </div>
    );
  }

  return (
    <div className="card variant-card" style={{ marginTop: 24 }}>
      <h2 className="card-title">Cross-Run Context</h2>
      <div className="card-row">
        <span className="card-row-label">
          Average Accuracy (last 20 runs)
        </span>
        <span className="card-row-value mono">
          {(stats.avgAccuracy * 100).toFixed(2)}%
        </span>
      </div>
      <div className="card-row">
        <span className="card-row-label">Average Correlation</span>
        <span className="card-row-value mono">
          {stats.avgCorr.toFixed(4)}
        </span>
      </div>
      <div className="card-row">
        <span className="card-row-label">Current Accuracy Percentile</span>
        <span className="card-row-value mono">
          {stats.percentile.toFixed(1)}%
        </span>
      </div>
      <div className="card-row" style={{ marginTop: 12 }}>
        <span className="card-row-label">Interpretation</span>
        <span className="card-row-value" style={{ maxWidth: 320 }}>
          {stats.interpretation}
        </span>
      </div>
    </div>
  );
}
