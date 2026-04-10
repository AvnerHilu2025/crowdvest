export type SourceType = "news" | "social" | "macro";

export type RawSourceItem = {
  sourceType: SourceType;
  provider: string;
  sourceId: string;
  symbol: string;
  title: string;
  summary?: string;
  url?: string;
  publishedAt: string;
  authorHandle?: string;
  rawSentiment?: number | null; // -1..1 when present
  engagement?: {
    likes?: number;
    reposts?: number;
    replies?: number;
  };
  metadata?: Record<string, unknown>;
};

export type NormalizedInfoEvent = {
  eventId: string;
  sourceType: SourceType;
  provider: string;
  symbol: string;
  headline: string;
  body: string;
  publishedAt: string;
  sentiment: number; // -1..1 canonical
  relevance: number; // 0..1
  credibility: number; // 0..1
  urgency: number; // 0..1
  tags: string[];
  canonicalUrl: string | null;
  provenance: {
    sourceId: string;
    ingestedAt: string;
  };
};

export type PersonaSourcePreference = {
  archetypeId: string;
  sourceAffinity: {
    news: number; // 0..1
    social: number; // 0..1
    macro: number; // 0..1
  };
  sentimentSensitivity: number; // 0..2
  contrarianBias: number; // -1..1
};

export type PersonaEventImpact = {
  archetypeId: string;
  eventId: string;
  symbol: string;
  impactScore: number; // -1..1 signed directional impact
  confidence: number; // 0..1
  rationale: string[];
};

export type IngestionWindow = {
  symbol: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
};

export type SourceConnector = {
  connectorId: string;
  sourceType: SourceType;
  fetch(window: IngestionWindow): Promise<RawSourceItem[]>;
};
