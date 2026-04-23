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
  simulationPlatform?: string;
  archetypeSentimentScale?: Record<string, number>;
  defaultArchetypeSentimentScale?: number;
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
    const simPlat = meta.simulationPlatform != null ? String(meta.simulationPlatform).trim().toLowerCase() : "";
    const plat = ["x", "facebook", "reddit", "sec", "newswire"].includes(simPlat) ? simPlat : undefined;
    const scaleMap: Record<string, number> | undefined =
      meta.archetypeSentimentScale != null && typeof meta.archetypeSentimentScale === "object"
        ? Object.fromEntries(
            Object.entries(meta.archetypeSentimentScale).map(([k, v]) => [
              String(k).trim().toLowerCase(),
              typeof v === "number" && Number.isFinite(v) ? v : 1,
            ]),
          )
        : undefined;
    const defScale =
      typeof meta.defaultArchetypeSentimentScale === "number" && Number.isFinite(meta.defaultArchetypeSentimentScale)
        ? meta.defaultArchetypeSentimentScale
        : undefined;
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
      simulationPlatform: plat,
      archetypeSentimentScale: scaleMap && Object.keys(scaleMap).length > 0 ? scaleMap : undefined,
      defaultArchetypeSentimentScale: defScale,
    };
  } catch {
    return base;
  }
}
