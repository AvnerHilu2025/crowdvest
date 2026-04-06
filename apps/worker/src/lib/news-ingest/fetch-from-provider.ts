/**
 * Raw HTTP fetch for news providers (no DB).
 */
import { getAlphaVantageApiKey, getFinnhubApiKey } from "./config";
import type { NewsProviderId } from "./types";

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

export async function fetchFinnhubCompanyNews(input: {
  assetSymbol: string;
  dateFrom: string;
  dateTo: string;
}): Promise<unknown> {
  const token = getFinnhubApiKey();
  const { assetSymbol, dateFrom, dateTo } = input;
  const url = new URL("https://finnhub.io/api/v1/company-news");
  url.searchParams.set("symbol", assetSymbol.trim().toUpperCase());
  url.searchParams.set("from", dateFrom);
  url.searchParams.set("to", dateTo);
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    throw new Error(`Finnhub HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<unknown>;
}

export async function fetchNewsForProvider(
  provider: NewsProviderId,
  input: { assetSymbol: string; dateFrom: string; dateTo: string },
): Promise<unknown> {
  if (provider === "alphavantage") {
    return fetchAlphaVantageNewsSentiment(input);
  }
  return fetchFinnhubCompanyNews(input);
}
