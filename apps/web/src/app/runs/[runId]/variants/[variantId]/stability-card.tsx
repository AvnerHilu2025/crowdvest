"use client";

import { useEffect, useState } from "react";
import { computeCis, mean, stdDev } from "@/lib/cis";

interface RunsV2Item {
  id: string;
  status: string;
  assetSymbol: string | null;
  steps: number | null;
  agents: number | null;
}

interface VariantSummary {
  corr: number | null;
  directionalAccuracy: number | null;
}

interface VariantsItem {
  summary?: VariantSummary | null;
}

interface ComparableStats {
  n: number;
  accuracyStdDev: number;
  corrStdDev: number;
  cisMin: number;
  cisMax: number;
  rating: "Stable" | "Moderate" | "Unstable" | "Insufficient data";
}

export function StabilityCard({
  runId,
  assetSymbol,
  steps,
  agents,
}: {
  runId: string;
  assetSymbol: string;
  steps: number;
  agents: number;
}) {
  const [stats, setStats] = useState<ComparableStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const runsRes = await fetch(
          "/api/results/runs-v2?limit=200&offset=0",
          { cache: "no-store" },
        );
        if (!runsRes.ok) throw new Error("Failed to fetch runs");
        const runsData = (await runsRes.json()) as { items: RunsV2Item[] };
        const runs = runsData.items ?? [];

        const comparable = runs.filter(
          (r) =>
            r.status === "COMPLETED" &&
            r.assetSymbol === assetSymbol &&
            r.steps === steps &&
            r.agents === agents &&
            r.id !== runId,
        );

        const top15 = comparable.slice(0, 15);

        const samples: { runId: string; corr: number; acc: number; cis: number }[] =
          [];

        await Promise.all(
          top15.map(async (r) => {
            try {
              const res = await fetch(
                `/api/runs/${encodeURIComponent(r.id)}/variants?assetSymbol=${encodeURIComponent(assetSymbol)}`,
                { cache: "no-store" },
              );
              if (!res.ok) return;
              const data = (await res.json()) as { items: VariantsItem[] };
              const items = data.items ?? [];
              const v = items[0];
              if (!v?.summary) return;
              const acc = v.summary.directionalAccuracy;
              const cor = v.summary.corr;
              if (
                acc == null ||
                !Number.isFinite(acc) ||
                cor == null ||
                !Number.isFinite(cor)
              )
                return;

              const cis = computeCis({
                corr: cor,
                directionalAccuracy: acc,
                percentileScore: 0.5,
                convictionPenalty: 0,
              });

              samples.push({
                runId: r.id,
                corr: cor,
                acc,
                cis,
              });
            } catch {
              // skip failed variant fetch
            }
          }),
        );

        if (cancelled) return;

        const n = samples.length;

        let rating: ComparableStats["rating"] = "Insufficient data";
        let accuracyStdDev = 0;
        let corrStdDev = 0;
        let cisMin = 0;
        let cisMax = 0;

        if (n >= 3) {
          const accs = samples.map((s) => s.acc);
          const corrs = samples.map((s) => s.corr);
          const cisValues = samples.map((s) => s.cis);

          accuracyStdDev = stdDev(accs);
          corrStdDev = stdDev(corrs);
          cisMin = Math.min(...cisValues);
          cisMax = Math.max(...cisValues);

          if (accuracyStdDev <= 0.05 && corrStdDev <= 0.1) {
            rating = "Stable";
          } else if (accuracyStdDev <= 0.1 && corrStdDev <= 0.2) {
            rating = "Moderate";
          } else {
            rating = "Unstable";
          }
        } else if (n > 0) {
          const cisValues = samples.map((s) => s.cis);
          cisMin = Math.min(...cisValues);
          cisMax = Math.max(...cisValues);
        }

        setStats({
          n,
          accuracyStdDev,
          corrStdDev,
          cisMin,
          cisMax,
          rating,
        });
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [runId, assetSymbol, steps, agents]);

  if (loading) {
    return (
      <div className="card variant-card" style={{ marginTop: 24 }}>
        <h2 className="card-title">Stability (Comparable Runs)</h2>
        <p className="card-empty">Computing…</p>
      </div>
    );
  }

  const ratingClass =
    stats?.rating === "Stable"
      ? "badge badge-success"
      : stats?.rating === "Moderate"
        ? "badge badge-amber"
        : stats?.rating === "Unstable"
          ? "badge badge-error"
          : "badge";

  return (
    <div className="card variant-card" style={{ marginTop: 24 }}>
      <h2 className="card-title">Stability (Comparable Runs)</h2>
      {error && (
        <p className="card-error" style={{ fontSize: 12, marginBottom: 8 }}>
          {error}
        </p>
      )}
      {stats && (
        <>
          <div className="card-row">
            <span className="card-row-label">Comparable sample size</span>
            <span className="card-row-value">{stats.n}</span>
          </div>
          <div className="card-row">
            <span className="card-row-label">Accuracy Std Dev</span>
            <span className="card-row-value mono">
              {(stats.accuracyStdDev * 100).toFixed(2)}%
            </span>
          </div>
          <div className="card-row">
            <span className="card-row-label">Corr Std Dev</span>
            <span className="card-row-value mono">
              {stats.corrStdDev.toFixed(4)}
            </span>
          </div>
          <div className="card-row">
            <span className="card-row-label">CIS Range</span>
            <span className="card-row-value mono">
              {(stats.cisMin * 100).toFixed(1)} – {(stats.cisMax * 100).toFixed(1)}
            </span>
          </div>
          <div className="card-row" style={{ marginTop: 12 }}>
            <span className="card-row-label">Stability</span>
            <span className={ratingClass}>{stats.rating}</span>
          </div>
        </>
      )}
      {!stats && !loading && !error && (
        <p className="card-empty">No comparable runs found.</p>
      )}
    </div>
  );
}
