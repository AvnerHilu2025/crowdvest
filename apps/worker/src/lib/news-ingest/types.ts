/**
 * News ingestion types (fetch → normalize → load InfoEvent).
 */

export type NewsProviderId = "alphavantage" | "finnhub" | "yahoo";

export interface FetchEnvelope {
  provider: NewsProviderId;
  assetSymbol: string;
  dateFrom: string;
  dateTo: string;
  fetchedAt: string;
  /** Raw provider payload (Alpha Vantage JSON, Finnhub array, Yahoo RSS-derived JSON, …). */
  apiResponse: unknown;
}

/** Normalized shape written as `apiResponse` for provider `yahoo` (Yahoo Finance headline RSS). */
export interface YahooFinanceRssApiResponse {
  format: "yahoo_finance_rss_v1";
  feedUrl: string;
  /** Headlines whose pubDate falls in the requested [dateFrom, dateTo] window (UTC). */
  items: Array<{
    title: string;
    link?: string;
    pubDateIso: string;
    source?: string;
  }>;
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
