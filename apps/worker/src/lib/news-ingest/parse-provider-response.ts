/**
 * Map raw provider JSON to ParsedArticle[].
 */
import type { NewsProviderId, ParsedArticle } from "./types";

function parseAlphaTimePublished(s: string): Date {
  const clean = s.trim();
  if (clean.length < 8) return new Date(0);
  const y = clean.slice(0, 4);
  const mo = clean.slice(4, 6);
  const d = clean.slice(6, 8);
  const rest = clean.slice(9);
  const hh = (rest.slice(0, 2) || "00").padStart(2, "0");
  const mm = (rest.slice(2, 4) || "00").padStart(2, "0");
  const ss = (rest.slice(4, 6) || "00").padStart(2, "0");
  return new Date(`${y}-${mo}-${d}T${hh}:${mm}:${ss}Z`);
}

export function parseAlphaVantageResponse(apiResponse: unknown): ParsedArticle[] {
  const o = apiResponse as Record<string, unknown>;
  if (typeof o["Error Message"] === "string") {
    throw new Error(`Alpha Vantage: ${o["Error Message"]}`);
  }
  if (typeof o.Information === "string") {
    throw new Error(`Alpha Vantage: ${o.Information}`);
  }
  if (typeof o.Note === "string" && o.Note.includes("API call frequency")) {
    throw new Error(`Alpha Vantage rate limit or note: ${o.Note}`);
  }
  const feed = o.feed;
  if (!Array.isArray(feed)) {
    return [];
  }
  const out: ParsedArticle[] = [];
  for (const row of feed) {
    const r = row as Record<string, unknown>;
    const title = String(r.title ?? "").trim();
    if (!title) continue;
    const timePublished = String(r.time_published ?? "");
    const publishedAt = parseAlphaTimePublished(timePublished);
    const source = String(r.source ?? "unknown");
    const score = r.overall_sentiment_score;
    const sentimentScore =
      typeof score === "number" && Number.isFinite(score) ? clamp11(score) : undefined;
    out.push({
      title,
      summary: typeof r.summary === "string" ? r.summary : undefined,
      url: typeof r.url === "string" ? r.url : undefined,
      publishedAt,
      source,
      sentimentScore,
      raw: row,
    });
  }
  return out;
}

function clamp11(x: number): number {
  return Math.max(-1, Math.min(1, x));
}

export function parseFinnhubResponse(apiResponse: unknown): ParsedArticle[] {
  if (!Array.isArray(apiResponse)) {
    if (apiResponse && typeof apiResponse === "object" && "error" in (apiResponse as object)) {
      throw new Error(`Finnhub: ${JSON.stringify(apiResponse)}`);
    }
    return [];
  }
  const out: ParsedArticle[] = [];
  for (const row of apiResponse) {
    const r = row as Record<string, unknown>;
    const title = String(r.headline ?? r.title ?? "").trim();
    if (!title) continue;
    const dt = r.datetime;
    const ms =
      typeof dt === "number" && Number.isFinite(dt)
        ? dt > 1e12
          ? dt
          : dt * 1000
        : Date.now();
    const publishedAt = new Date(ms);
    const source = String(r.source ?? "unknown");
    out.push({
      title,
      summary: typeof r.summary === "string" ? r.summary : undefined,
      url: typeof r.url === "string" ? r.url : undefined,
      publishedAt,
      source,
      sentimentScore: undefined,
      raw: row,
    });
  }
  return out;
}

export function parseProviderResponse(
  provider: NewsProviderId,
  apiResponse: unknown,
): ParsedArticle[] {
  if (provider === "alphavantage") return parseAlphaVantageResponse(apiResponse);
  return parseFinnhubResponse(apiResponse);
}
