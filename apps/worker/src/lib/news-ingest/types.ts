/**
 * News ingestion types (fetch → normalize → load InfoEvent).
 */

export type NewsProviderId = "alphavantage" | "finnhub";

export interface FetchEnvelope {
  provider: NewsProviderId;
  assetSymbol: string;
  dateFrom: string;
  dateTo: string;
  fetchedAt: string;
  /** Raw provider JSON (Alpha Vantage object or Finnhub array). */
  apiResponse: unknown;
}

/** Provider-neutral article before CrowdVest normalization. */
export interface ParsedArticle {
  title: string;
  summary?: string;
  url?: string;
  publishedAt: Date;
  source: string;
  /** -1..1 when known */
  sentimentScore?: number;
  raw: unknown;
}

export interface NormalizedInfoEventRecord {
  runId: string;
  assetSymbol: string;
  step: number;
  title: string;
  source: string;
  publishedAt: string;
  sentiment: number;
  credibility: number;
  salience: number;
  eventType: "info" | "event";
  rawPayload: unknown;
}

export interface NormalizeOutputEnvelope {
  runId: string;
  assetSymbol: string;
  steps: number;
  dateFrom: string;
  dateTo: string;
  records: NormalizedInfoEventRecord[];
}
