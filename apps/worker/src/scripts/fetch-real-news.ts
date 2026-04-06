/**
 * CLI: pnpm -C apps/worker run fetch:real-news -- --assetSymbol SPY --dateFrom 2024-01-01 --dateTo 2024-01-31 --output ./raw-news.json
 *
 * Fetches raw provider JSON only (no DB). Provider from NEWS_PROVIDER (alphavantage | finnhub).
 */
import fs from "fs";
import path from "path";
import { getNewsProviderFromEnv } from "../lib/news-ingest/config";
import { fetchNewsForProvider } from "../lib/news-ingest/fetch-from-provider";
import type { FetchEnvelope, NewsProviderId } from "../lib/news-ingest/types";

function parseArgs(argv: string[]): {
  assetSymbol: string;
  dateFrom: string;
  dateTo: string;
  output: string;
  provider: NewsProviderId | null;
} {
  const rest = argv.slice(2);
  let assetSymbol = "";
  let dateFrom = "";
  let dateTo = "";
  let output = "";
  let provider: NewsProviderId | null = null;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--" || a === "") continue;
    if (a === "--assetSymbol" && rest[i + 1]) assetSymbol = rest[++i]!.trim();
    else if (a === "--dateFrom" && rest[i + 1]) dateFrom = rest[++i]!.trim();
    else if (a === "--dateTo" && rest[i + 1]) dateTo = rest[++i]!.trim();
    else if (a === "--output" && rest[i + 1]) output = rest[++i]!.trim();
    else if (a === "--provider" && rest[i + 1]) {
      const p = rest[++i]!.trim().toLowerCase();
      if (p === "alphavantage" || p === "finnhub") provider = p;
    }
  }
  return { assetSymbol, dateFrom, dateTo, output, provider };
}

async function main(): Promise<void> {
  const { assetSymbol, dateFrom, dateTo, output, provider: providerArg } = parseArgs(process.argv);
  if (!assetSymbol || !dateFrom || !dateTo || !output) {
    console.error(
      "Usage: tsx src/scripts/fetch-real-news.ts --assetSymbol SPY --dateFrom YYYY-MM-DD --dateTo YYYY-MM-DD --output path.json [--provider alphavantage|finnhub]",
    );
    process.exit(1);
  }

  const provider = providerArg ?? getNewsProviderFromEnv();
  console.log(`Fetching news provider=${provider} symbol=${assetSymbol} ${dateFrom}..${dateTo}`);

  const apiResponse = await fetchNewsForProvider(provider, { assetSymbol, dateFrom, dateTo });

  const envelope: FetchEnvelope = {
    provider,
    assetSymbol: assetSymbol.toUpperCase(),
    dateFrom,
    dateTo,
    fetchedAt: new Date().toISOString(),
    apiResponse,
  };

  const outPath = path.resolve(output);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(envelope, null, 2), "utf-8");
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
