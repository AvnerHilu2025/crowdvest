import type { NormalizedInfoEvent, RawSourceItem } from "../types";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clamp11(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

function hashToUnit(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ((h >>> 0) % 10000) / 10000;
}

function normalizeSentiment(raw: number | null | undefined, title: string): number {
  if (raw != null && Number.isFinite(raw)) return clamp11(raw);
  const t = title.toLowerCase();
  const posHits = ["beat", "upside", "surge", "bull", "upgrade", "rally"].filter((k) => t.includes(k)).length;
  const negHits = ["miss", "downside", "selloff", "bear", "downgrade", "risk"].filter((k) => t.includes(k)).length;
  return clamp11((posHits - negHits) * 0.2);
}

export function normalizeRawSourceItem(raw: RawSourceItem): NormalizedInfoEvent {
  const sentiment = normalizeSentiment(raw.rawSentiment, raw.title);
  const u = hashToUnit(`${raw.sourceId}:${raw.title}:${raw.publishedAt}`);
  const engagementStrength = raw.engagement
    ? clamp01(
        ((raw.engagement.likes ?? 0) * 0.005 +
          (raw.engagement.reposts ?? 0) * 0.01 +
          (raw.engagement.replies ?? 0) * 0.008) /
          4,
      )
    : 0;
  const sourceBoost = raw.sourceType === "news" ? 0.65 : raw.sourceType === "social" ? 0.45 : 0.7;
  const relevance = clamp01(sourceBoost * 0.7 + Math.abs(sentiment) * 0.2 + engagementStrength * 0.1);
  const credibility =
    raw.sourceType === "news"
      ? clamp01(0.72 + u * 0.18)
      : raw.sourceType === "social"
        ? clamp01(0.42 + u * 0.22)
        : clamp01(0.78 + u * 0.14);
  const urgency = clamp01(Math.abs(sentiment) * 0.55 + engagementStrength * 0.35 + u * 0.1);

  return {
    eventId: `evt:${raw.provider}:${raw.sourceId}`,
    sourceType: raw.sourceType,
    provider: raw.provider,
    symbol: raw.symbol.toUpperCase(),
    headline: raw.title.trim(),
    body: (raw.summary ?? raw.title).trim(),
    publishedAt: new Date(raw.publishedAt).toISOString(),
    sentiment,
    relevance,
    credibility,
    urgency,
    tags: [raw.sourceType, raw.provider],
    canonicalUrl: raw.url ?? null,
    provenance: {
      sourceId: raw.sourceId,
      ingestedAt: new Date().toISOString(),
    },
  };
}
