"use client";

import { useCrossRunStats } from "./cross-run-provider";
import { computeCis } from "@/lib/cis";
import { KpiCard, Badge } from "@/components/ui/dashboard";

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
      <div style={{ marginTop: 24 }}>
        <KpiCard
          title="Crowd Intelligence Score"
          value="—"
          label="Loading…"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ marginTop: 24 }}>
        <KpiCard
          title="Crowd Intelligence Score"
          value="—"
          label={error}
        />
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

  const ratingTone: "success" | "warn" | "danger" | "neutral" =
    rating === "Elite" || rating === "Strong"
      ? "success"
      : rating === "Neutral"
        ? "warn"
        : rating === "Inconclusive"
          ? "neutral"
          : "danger";

  const showStabilityPenaltyBadge = stabilityPenaltyFactor < 0.9;

  const badgeFooter =
    showStabilityPenaltyBadge || signInstability || weakSignal ? (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {showStabilityPenaltyBadge && (
          <Badge tone="warn">Stability penalty applied</Badge>
        )}
        {signInstability && (
          <Badge tone="danger">Sign instability across seeds</Badge>
        )}
        {weakSignal && (
          <Badge tone="neutral">Weak Mean Correlation</Badge>
        )}
      </div>
    ) : undefined;

  return (
    <div style={{ marginTop: 24 }}>
      <KpiCard
        title="Crowd Intelligence Score"
        value={finalScore.toFixed(1)}
        label="Stability-adjusted"
        subtle={`Base Score: ${baseScore.toFixed(1)}`}
        badge={<Badge tone={ratingTone}>{rating}</Badge>}
        footer={badgeFooter}
      />
    </div>
  );
}
