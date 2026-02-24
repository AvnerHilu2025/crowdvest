"use client";

import { useCrossRunStats } from "./cross-run-provider";
import { computeCis } from "@/lib/cis";

export function CrowdIntelligenceScoreCard({
  directionalAccuracy,
  corr,
  convictionIndex,
  accStd,
  corrStd,
  nSeeds,
  signInstability,
  weakSignal,
}: {
  directionalAccuracy: number | null;
  corr: number | null;
  convictionIndex: number;
  accStd: number;
  corrStd: number;
  nSeeds: number;
  signInstability: boolean;
  weakSignal: boolean;
}) {
  const { stats, loading, error } = useCrossRunStats();

  if (loading) {
    return (
      <div className="card variant-card cis-card" style={{ marginTop: 24 }}>
        <h2 className="card-title">Crowd Intelligence Score</h2>
        <p className="card-empty">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card variant-card cis-card" style={{ marginTop: 24 }}>
        <h2 className="card-title">Crowd Intelligence Score</h2>
        <p className="card-error">{error}</p>
      </div>
    );
  }

  const accuracyScore = directionalAccuracy ?? 0;
  const percentileScore = stats ? stats.percentile / 100 : 0.5;
  const convictionPenalty =
    convictionIndex > 0.25 && accuracyScore < 0.5 ? 0.1 : 0;

  const baseCis = computeCis({
    corr,
    directionalAccuracy,
    percentileScore,
    convictionPenalty,
  });
  const baseScore = baseCis * 100;

  let stabilityPenaltyFactor: number;
  if (nSeeds < 3) {
    stabilityPenaltyFactor = 0.85;
  } else {
    const accPenalty = Math.min(accStd / 5, 1);
    const corrPenalty = Math.min(corrStd / 0.25, 1);
    const instability = (accPenalty + corrPenalty) / 2;
    stabilityPenaltyFactor = 1 - instability * 0.25;
  }

  let finalScore = Math.round(baseScore * stabilityPenaltyFactor * 10) / 10;

  if (nSeeds >= 3 && signInstability) {
    finalScore = Math.round(finalScore * 0.8 * 10) / 10;
  }

  let rating = "Fragile";
  if (nSeeds >= 3 && weakSignal) {
    rating = "Inconclusive";
  } else if (baseCis >= 0.8) {
    rating = "Elite";
  } else if (baseCis >= 0.6) {
    rating = "Strong";
  } else if (baseCis >= 0.4) {
    rating = "Neutral";
  } else if (baseCis >= 0.2) {
    rating = "Weak";
  }

  const ratingClass =
    rating === "Elite" || rating === "Strong"
      ? "cis-rating-green"
      : rating === "Neutral"
        ? "cis-rating-amber"
        : rating === "Inconclusive"
          ? "cis-rating-gray"
          : "cis-rating-red";

  const showStabilityPenaltyBadge = stabilityPenaltyFactor < 0.9;

  return (
    <div className="card variant-card cis-card" style={{ marginTop: 24 }}>
      <h2 className="card-title">Crowd Intelligence Score</h2>
      <div className="cis-base-score" style={{ fontSize: 12, color: "var(--cv-muted)", marginBottom: 4 }}>
        Base Score: {baseScore.toFixed(1)}
      </div>
      <div className="cis-score">{finalScore.toFixed(1)}</div>
      <div className="cis-stability-adjusted" style={{ fontSize: 12, color: "var(--cv-muted)", marginTop: 4 }}>
        Stability-adjusted
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {showStabilityPenaltyBadge && (
          <span className="badge badge-amber">Stability penalty applied</span>
        )}
        {signInstability && (
          <span className="badge badge-error">Sign Instability Across Seeds</span>
        )}
        {weakSignal && (
          <span className="badge">Weak Mean Correlation</span>
        )}
      </div>
      <div className={`cis-rating ${ratingClass}`} style={{ marginTop: 12 }}>
        Rating: {rating}
      </div>
    </div>
  );
}
