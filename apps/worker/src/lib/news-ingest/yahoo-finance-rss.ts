/**
 * Yahoo Finance headline RSS (public feed, no API key).
 * Feed is typically a limited set of recent headlines — long historical windows may yield 0 rows after date filter.
 */
import type { YahooFinanceRssApiResponse } from "./types";

const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function decodeXmlText(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

/** Extract inner text of a simple tag (handles CDATA and strips nested tags crudely). */
function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  let inner = m[1]!.trim();
  if (inner.startsWith("<![CDATA[")) {
    inner = inner.slice(9).replace(/\]\]>\s*$/i, "");
  }
  inner = inner.replace(/<[^>]+>/g, " ");
  return decodeXmlText(inner).replace(/\s+/g, " ").trim();
}

export interface YahooRssRawItem {
  title: string;
  link?: string;
  /** RFC 2822 string from <pubDate> */
  pubDate: string;
  source?: string;
}

export function parseYahooRssXml(xml: string): YahooRssRawItem[] {
  const out: YahooRssRawItem[] = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1]!;
    const title = extractTag(block, "title");
    if (!title) continue;
    const link = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");
    const source = extractTag(block, "source") || undefined;
    out.push({
      title,
      link: link || undefined,
      pubDate,
      source,
    });
  }
  return out;
}

function inUtcWindow(d: Date, dateFrom: string, dateTo: string): boolean {
  const t0 = new Date(`${dateFrom}T00:00:00.000Z`).getTime();
  const t1 = new Date(`${dateTo}T23:59:59.999Z`).getTime();
  const t = d.getTime();
  return Number.isFinite(t) && t >= t0 && t <= t1;
}

export async function fetchYahooFinanceHeadlines(input: {
  assetSymbol: string;
  dateFrom: string;
  dateTo: string;
}): Promise<YahooFinanceRssApiResponse> {
  const symbol = input.assetSymbol.trim().toUpperCase();
  const feedUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;

  const res = await fetch(feedUrl, {
    method: "GET",
    headers: {
      "User-Agent": YAHOO_UA,
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Yahoo Finance RSS HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  const rawItems = parseYahooRssXml(text);
  const items: YahooFinanceRssApiResponse["items"] = [];

  for (const r of rawItems) {
    const publishedAt = new Date(r.pubDate);
    if (Number.isNaN(publishedAt.getTime())) continue;
    if (!inUtcWindow(publishedAt, input.dateFrom, input.dateTo)) continue;
    items.push({
      title: r.title,
      link: r.link,
      pubDateIso: publishedAt.toISOString(),
      source: r.source ?? "Yahoo Finance",
    });
  }

  if (rawItems.length > 0 && items.length === 0) {
    console.warn(
      "[news-ingest] Yahoo: RSS returned items but none fall in the requested [dateFrom, dateTo] window. " +
        "Yahoo headline feeds are typically recent-only — use a recent date range or widen the window.",
    );
  }

  return {
    format: "yahoo_finance_rss_v1",
    feedUrl,
    items,
  };
}
