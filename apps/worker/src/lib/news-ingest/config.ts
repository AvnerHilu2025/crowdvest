import type { NewsProviderId } from "./types";

export function getNewsProviderFromEnv(): NewsProviderId {
  const p = (process.env.NEWS_PROVIDER ?? "alphavantage").trim().toLowerCase();
  if (p === "alphavantage" || p === "alpha_vantage" || p === "av") return "alphavantage";
  if (p === "finnhub" || p === "finn_hub") return "finnhub";
  if (p === "yahoo" || p === "yahoo_finance" || p === "yfinance") return "yahoo";
  throw new Error(
    `NEWS_PROVIDER must be "alphavantage", "finnhub", or "yahoo" (got: ${process.env.NEWS_PROVIDER})`,
  );
}

export function getAlphaVantageApiKey(): string {
  const k = process.env.ALPHAVANTAGE_API_KEY ?? "";
  if (!k.trim()) throw new Error("ALPHAVANTAGE_API_KEY is required for provider alphavantage");
  return k.trim();
}

export function getFinnhubApiKey(): string {
  const k = process.env.FINNHUB_API_KEY ?? "";
  if (!k.trim()) throw new Error("FINNHUB_API_KEY is required for provider finnhub");
  return k.trim();
}
