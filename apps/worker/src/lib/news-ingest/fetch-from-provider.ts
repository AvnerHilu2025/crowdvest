/**
 * Raw HTTP fetch for news providers (no DB).
 */
import { getAlphaVantageApiKey, getFinnhubApiKey } from "./config";
import type { NewsProviderId } from "./types";
import { fetchYahooFinanceHeadlines } from "./yahoo-finance-rss";

/** Set to 1 to log Finnhub URL (token redacted), HTTP status, and first 500 chars of body. */
const FINNHUB_DEBUG = process.env.NEWS_INGEST_DEBUG === "1";

/** Finnhub company-news often returns [] if the requested window exceeds ~1 year on free tiers. */
const FINNHUB_MAX_RANGE_DAYS = 365;

function ymdToAlphaTime(ymd: string, endOfDay: boolean): string {
  const parts = ymd.trim().split("-");
  if (parts.length !== 3) throw new Error(`Invalid date (expected YYYY-MM-DD): ${ymd}`);
  const yy = parts[0]!.padStart(4, "0");
  const mm = parts[1]!.padStart(2, "0");
  const dd = parts[2]!.padStart(2, "0");
  return endOfDay ? `${yy}${mm}${dd}T2359` : `${yy}${mm}${dd}T0000`;
}

export async function fetchAlphaVantageNewsSentiment(input: {
  assetSymbol: string;
  dateFrom: string;
  dateTo: string;
}): Promise<unknown> {
  const key = getAlphaVantageApiKey();
  const { assetSymbol, dateFrom, dateTo } = input;
  const timeFrom = ymdToAlphaTime(dateFrom, false);
  const timeTo = ymdToAlphaTime(dateTo, true);
  const limit = 1000;
  const sort = "LATEST";
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "NEWS_SENTIMENT");
  url.searchParams.set("tickers", assetSymbol.trim().toUpperCase());
  url.searchParams.set("time_from", timeFrom);
  url.searchParams.set("time_to", timeTo);
  url.searchParams.set("sort", sort);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("apikey", key);

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    throw new Error(`Alpha Vantage HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<unknown>;
}

function redactFinnhubUrl(url: URL): string {
  const u = new URL(url.toString());
  if (u.searchParams.has("token")) u.searchParams.set("token", "REDACTED");
  return u.toString();
}

function parseYmdUtc(ymd: string): Date {
  const [y, m, d] = ymd.trim().split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return new Date(NaN);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatYmdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inclusive UTC day span between two YYYY-MM-DD strings. */
function inclusiveUtcDaySpan(dateFrom: string, dateTo: string): number {
  const a = parseYmdUtc(dateFrom);
  const b = parseYmdUtc(dateTo);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86400000) + 1;
}

function* finnhubDateChunks(
  dateFrom: string,
  dateTo: string,
  maxInclusiveDays: number,
): Generator<{ from: string; to: string }> {
  let curMs = parseYmdUtc(dateFrom).getTime();
  const lastMs = parseYmdUtc(dateTo).getTime();
  if (Number.isNaN(curMs) || Number.isNaN(lastMs) || curMs > lastMs) return;

  const maxSpanMs = (maxInclusiveDays - 1) * 86400000;
  while (curMs <= lastMs) {
    const chunkEndMs = Math.min(curMs + maxSpanMs, lastMs);
    yield {
      from: formatYmdUtc(new Date(curMs)),
      to: formatYmdUtc(new Date(chunkEndMs)),
    };
    curMs = chunkEndMs + 86400000;
  }
}

function logFinnhubDiagnostics(
  status: number,
  url: URL,
  text: string,
  parsed: unknown,
): void {
  const redacted = redactFinnhubUrl(url);
  const kind =
    parsed === null || parsed === undefined
      ? String(parsed)
      : Array.isArray(parsed)
        ? `array(len=${parsed.length})`
        : typeof parsed;
  const keys =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.keys(parsed as object).join(", ")
      : "";
  console.warn("[news-ingest] Finnhub diagnostics");
  console.warn(`  HTTP status: ${status}`);
  console.warn(`  URL: ${redacted}`);
  console.warn(`  response kind: ${kind}${keys ? `; object keys: ${keys}` : ""}`);
  console.warn(`  body (first 500 chars): ${text.slice(0, 500)}`);
}

function normalizeFinnhubJsonBody(parsed: unknown): unknown {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (typeof o.error === "string") {
      throw new Error(`Finnhub: ${JSON.stringify(parsed)}`);
    }
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.news)) return o.news;
  }
  return parsed;
}

function dedupeFinnhubArticles(rows: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const id = r.id;
    const key =
      typeof id === "number" && Number.isFinite(id)
        ? `id:${id}`
        : typeof id === "string"
          ? `id:${id}`
          : `h:${String(r.headline ?? r.title ?? "")}|t:${String(r.datetime ?? "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/**
 * Single GET to Finnhub company-news. Parses JSON from text (never drops body).
 * When NEWS_INGEST_DEBUG=1, logs status, redacted URL, response shape, first 500 chars.
 */
async function fetchFinnhubCompanyNewsOnce(input: {
  assetSymbol: string;
  dateFrom: string;
  dateTo: string;
}): Promise<unknown> {
  const token = getFinnhubApiKey();
  const { assetSymbol, dateFrom, dateTo } = input;
  const url = new URL("https://finnhub.io/api/v1/company-news");
  url.searchParams.set("symbol", assetSymbol.trim().toUpperCase());
  url.searchParams.set("from", dateFrom.trim());
  url.searchParams.set("to", dateTo.trim());
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), { method: "GET" });
  const status = res.status;
  const text = await res.text();

  let parsed: unknown;
  try {
    parsed = text.length ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Finnhub: invalid JSON (HTTP ${status}): ${text.slice(0, 400)}`);
  }

  if (FINNHUB_DEBUG) {
    logFinnhubDiagnostics(status, url, text, parsed);
  }

  if (!res.ok) {
    throw new Error(`Finnhub HTTP ${status}: ${text.slice(0, 600)}`);
  }

  const normalized = normalizeFinnhubJsonBody(parsed);
  if (!Array.isArray(normalized)) {
    throw new Error(
      `Finnhub: expected JSON array of articles (HTTP ${status}). Set NEWS_INGEST_DEBUG=1 for URL and body. First 300 chars: ${text.slice(0, 300)}`,
    );
  }

  if (normalized.length === 0) {
    console.warn(
      `[news-ingest] Finnhub: empty array for ${redactFinnhubUrl(url)} (symbol=${assetSymbol.trim().toUpperCase()} from=${dateFrom} to=${dateTo}). Set NEWS_INGEST_DEBUG=1 for full body.`,
    );
  }

  return normalized;
}

export async function fetchFinnhubCompanyNews(input: {
  assetSymbol: string;
  dateFrom: string;
  dateTo: string;
}): Promise<unknown> {
  let { dateFrom, dateTo } = input;
  if (dateFrom.trim() > dateTo.trim()) {
    console.warn(`[news-ingest] Finnhub: dateFrom > dateTo; swapping (${dateFrom} ↔ ${dateTo})`);
    const t = dateFrom;
    dateFrom = dateTo;
    dateTo = t;
  }

  const span = inclusiveUtcDaySpan(dateFrom, dateTo);
  if (span > FINNHUB_MAX_RANGE_DAYS) {
    console.warn(
      `[news-ingest] Finnhub: date range spans ${span} days (>${FINNHUB_MAX_RANGE_DAYS}); fetching in chunks to avoid empty results on limited plans.`,
    );
    const merged: unknown[] = [];
    for (const chunk of finnhubDateChunks(dateFrom, dateTo, FINNHUB_MAX_RANGE_DAYS)) {
      const part = await fetchFinnhubCompanyNewsOnce({
        assetSymbol: input.assetSymbol,
        dateFrom: chunk.from,
        dateTo: chunk.to,
      });
      if (Array.isArray(part)) merged.push(...part);
    }
    return dedupeFinnhubArticles(merged);
  }

  return fetchFinnhubCompanyNewsOnce({ ...input, dateFrom, dateTo });
}

export async function fetchNewsForProvider(
  provider: NewsProviderId,
  input: { assetSymbol: string; dateFrom: string; dateTo: string },
): Promise<unknown> {
  if (provider === "alphavantage") {
    return fetchAlphaVantageNewsSentiment(input);
  }
  if (provider === "yahoo") {
    return fetchYahooFinanceHeadlines(input);
  }
  return fetchFinnhubCompanyNews(input);
}
