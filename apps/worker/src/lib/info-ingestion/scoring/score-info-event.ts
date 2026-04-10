import type { NormalizedInfoEvent } from "../types";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export type ScoredInfoEvent = NormalizedInfoEvent & {
  score: number; // 0..1 importance score for ranking event feed
};

export function scoreNormalizedInfoEvent(event: NormalizedInfoEvent): ScoredInfoEvent {
  const score = clamp01(
    event.relevance * 0.4 +
      event.credibility * 0.2 +
      event.urgency * 0.25 +
      Math.abs(event.sentiment) * 0.15,
  );
  return { ...event, score };
}
