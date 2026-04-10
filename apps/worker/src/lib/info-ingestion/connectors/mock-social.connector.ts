import type { IngestionWindow, RawSourceItem, SourceConnector } from "../types";

function hashToUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const TOPICS = [
  "earnings chatter",
  "macro fear pulse",
  "momentum crowd wave",
  "valuation debate",
  "institutional rotation rumors",
  "risk-on narrative",
];

/**
 * Deterministic social-style connector for demos where a paid API is unavailable.
 * Produces repeatable pseudo-live posts from window inputs.
 */
export const mockSocialConnector: SourceConnector = {
  connectorId: "mock_social",
  sourceType: "social",
  async fetch(window: IngestionWindow): Promise<RawSourceItem[]> {
    const days = Math.max(
      1,
      Math.round(
        (new Date(`${window.dateTo}T00:00:00.000Z`).getTime() -
          new Date(`${window.dateFrom}T00:00:00.000Z`).getTime()) /
          86400000,
      ) + 1,
    );
    const count = Math.min(12, Math.max(4, days * 2));
    const items: RawSourceItem[] = [];
    for (let i = 0; i < count; i++) {
      const u = hashToUnit(`${window.symbol}:${window.dateFrom}:${window.dateTo}:social:${i}`);
      const sentiment = (u - 0.5) * 1.6; // ~[-0.8, 0.8]
      const topic = TOPICS[Math.floor(u * TOPICS.length)] ?? "market narrative";
      const dayOffset = i % days;
      const publishedAt = new Date(`${window.dateFrom}T00:00:00.000Z`);
      publishedAt.setUTCDate(publishedAt.getUTCDate() + dayOffset);
      publishedAt.setUTCHours(13 + (i % 6), (i * 7) % 60, 0, 0);
      items.push({
        sourceType: "social",
        provider: "mock_social_stream_v1",
        sourceId: `mock_social:${window.symbol}:${dayOffset}:${i}`,
        symbol: window.symbol,
        title: `${window.symbol} ${topic}`,
        summary: `Crowd conversation intensity=${(0.4 + u * 0.6).toFixed(2)} around ${topic}.`,
        url: undefined,
        publishedAt: publishedAt.toISOString(),
        authorHandle: `@crowd_${Math.floor(u * 1000)}`,
        rawSentiment: Math.max(-1, Math.min(1, sentiment)),
        engagement: {
          likes: Math.round(20 + u * 230),
          reposts: Math.round(5 + u * 60),
          replies: Math.round(3 + u * 30),
        },
      });
    }
    return items;
  },
};
