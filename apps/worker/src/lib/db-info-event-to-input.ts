/**
 * Map persisted InfoEvent rows to InfoEventInput for decide.ts.
 * Rows created via POST /simulation/inject-event use source LIVE_JSON:{...} for live metadata.
 */

import { clamp11, type InfoEventInput } from "./exposure";
import { signalQualityFromSource } from "./agent-information-exposure";

export const LIVE_INFO_JSON_PREFIX = "LIVE_JSON:";

export type LiveInjectMeta = {
  sourceType?: string;
  sourceName?: string;
  title?: string;
  targetArchetypes?: string[];
  sensitivityOverrides?: Record<string, number>;
};

export function dbInfoEventRowToInfoEventInput(e: {
  id: string;
  sentiment: number;
  credibility: number;
  reach: number;
  topic: string;
  source: string | null;
  volatilityImpact: number | null;
}): InfoEventInput {
  const sentiment = clamp11(e.sentiment);
  const base: InfoEventInput = {
    id: e.id,
    sentiment,
    credibility: e.credibility,
    reach: e.reach,
    topic: e.topic,
    source: e.source,
    signalQuality: signalQualityFromSource(e.source),
    volatilityImpact: e.volatilityImpact,
  };

  const src = e.source ?? "";
  if (!src.startsWith(LIVE_INFO_JSON_PREFIX)) {
    return base;
  }
  try {
    const meta = JSON.parse(src.slice(LIVE_INFO_JSON_PREFIX.length)) as LiveInjectMeta;
    const st = String(meta.sourceType ?? "news").trim() || "news";
    const sn = String(meta.sourceName ?? "live").trim() || "live";
    const syntheticSource = `${st}:${sn}`;
    return {
      ...base,
      source: syntheticSource,
      signalQuality: signalQualityFromSource(syntheticSource),
      scenarioInjected: true,
      scenarioTargetArchetypes:
        meta.targetArchetypes
          ?.map((t) => String(t).trim().toLowerCase())
          .filter((t) => t.length > 0) ?? undefined,
      scenarioSensitivityOverrides: meta.sensitivityOverrides,
    };
  } catch {
    return base;
  }
}
