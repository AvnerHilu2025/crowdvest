import { fetchYahooFinanceHeadlines } from "../../news-ingest/yahoo-finance-rss";
import type { IngestionWindow, RawSourceItem, SourceConnector } from "../types";

export const yahooNewsConnector: SourceConnector = {
  connectorId: "yahoo_news",
  sourceType: "news",
  async fetch(window: IngestionWindow): Promise<RawSourceItem[]> {
    const payload = await fetchYahooFinanceHeadlines({
      assetSymbol: window.symbol,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
    });
    return payload.items.map((item) => ({
      sourceType: "news",
      provider: "yahoo_finance_rss",
      sourceId: `yahoo:${window.symbol}:${item.pubDateIso}:${item.title}`,
      symbol: window.symbol,
      title: item.title,
      summary: undefined,
      url: item.link,
      publishedAt: item.pubDateIso,
      rawSentiment: null,
      metadata: { source: item.source ?? "Yahoo Finance" },
    }));
  },
};
