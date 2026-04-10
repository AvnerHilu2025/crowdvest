import { mockSocialConnector, yahooNewsConnector } from "./connectors";
import { normalizeRawSourceItem } from "./normalization/normalize-info-event";
import { computePersonaEventImpact, buildPersonaSourcePreferences } from "./persona-reaction/persona-reaction";
import { scoreNormalizedInfoEvent } from "./scoring/score-info-event";
import type { IngestionWindow, PersonaEventImpact, SourceConnector } from "./types";
import type { ScoredInfoEvent } from "./scoring/score-info-event";

export type IngestionPipelineOutput = {
  window: IngestionWindow;
  rawCount: number;
  normalizedEvents: ScoredInfoEvent[];
  impactsByEvent: Array<{
    eventId: string;
    topImpacts: PersonaEventImpact[];
  }>;
};

export const defaultConnectors: SourceConnector[] = [yahooNewsConnector, mockSocialConnector];

export async function runInfoIngestionPipeline(
  window: IngestionWindow,
  connectors: SourceConnector[] = defaultConnectors,
): Promise<IngestionPipelineOutput> {
  const rawNested = await Promise.all(connectors.map((c) => c.fetch(window)));
  const raw = rawNested.flat();
  const normalized: ScoredInfoEvent[] = raw.map(normalizeRawSourceItem).map(scoreNormalizedInfoEvent);
  normalized.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  const prefs = buildPersonaSourcePreferences();
  const impactsByEvent = normalized.map((event) => {
    const impacts = computePersonaEventImpact(event, prefs)
      .sort((a, b) => Math.abs(b.impactScore) - Math.abs(a.impactScore))
      .slice(0, 6);
    return { eventId: event.eventId, topImpacts: impacts };
  });

  return {
    window,
    rawCount: raw.length,
    normalizedEvents: normalized,
    impactsByEvent,
  };
}
