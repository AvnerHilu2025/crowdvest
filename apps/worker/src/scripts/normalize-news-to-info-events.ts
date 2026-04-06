/**
 * CLI: pnpm -C apps/worker run normalize:info-events -- --runId <uuid> --assetSymbol SPY --steps 29 --dateFrom ... --dateTo ... --input raw.json --output normalized.json
 *
 * Maps raw fetch JSON into normalized records (no DB).
 */
import fs from "fs";
import path from "path";
import { buildNormalizedRecord } from "../lib/news-ingest/normalize-heuristics";
import { parseProviderResponse } from "../lib/news-ingest/parse-provider-response";
import type { FetchEnvelope, NormalizeOutputEnvelope, NewsProviderId } from "../lib/news-ingest/types";

function parseArgs(argv: string[]): {
  runId: string;
  assetSymbol: string;
  steps: number;
  dateFrom: string;
  dateTo: string;
  input: string;
  output: string;
} {
  const rest = argv.slice(2);
  let runId = "";
  let assetSymbol = "";
  let steps = 0;
  let dateFrom = "";
  let dateTo = "";
  let input = "";
  let output = "";
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--" || a === "") continue;
    if (a === "--runId" && rest[i + 1]) runId = rest[++i]!.trim();
    else if (a === "--assetSymbol" && rest[i + 1]) assetSymbol = rest[++i]!.trim();
    else if (a === "--steps" && rest[i + 1]) steps = parseInt(rest[++i]!, 10);
    else if (a === "--dateFrom" && rest[i + 1]) dateFrom = rest[++i]!.trim();
    else if (a === "--dateTo" && rest[i + 1]) dateTo = rest[++i]!.trim();
    else if (a === "--input" && rest[i + 1]) input = rest[++i]!.trim();
    else if (a === "--output" && rest[i + 1]) output = rest[++i]!.trim();
  }
  return { runId, assetSymbol, steps, dateFrom, dateTo, input, output };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (
    !args.runId ||
    !args.assetSymbol ||
    !Number.isFinite(args.steps) ||
    args.steps <= 0 ||
    !args.dateFrom ||
    !args.dateTo ||
    !args.input ||
    !args.output
  ) {
    console.error(
      "Usage: tsx src/scripts/normalize-news-to-info-events.ts --runId <uuid> --assetSymbol SPY --steps N " +
        "--dateFrom YYYY-MM-DD --dateTo YYYY-MM-DD --input raw.json --output normalized.json",
    );
    process.exit(1);
  }

  const rawPath = path.resolve(args.input);
  const text = fs.readFileSync(rawPath, "utf-8");
  const envelope = JSON.parse(text) as FetchEnvelope;
  const provider = envelope.provider as NewsProviderId;
  if (provider !== "alphavantage" && provider !== "finnhub") {
    throw new Error(`Unknown provider in input: ${envelope.provider}`);
  }

  const articles = parseProviderResponse(provider, envelope.apiResponse);
  const records = articles.map((a) =>
    buildNormalizedRecord(
      args.runId,
      args.assetSymbol,
      args.steps,
      args.dateFrom,
      args.dateTo,
      a,
    ),
  );

  const out: NormalizeOutputEnvelope = {
    runId: args.runId,
    assetSymbol: args.assetSymbol.toUpperCase(),
    steps: args.steps,
    dateFrom: args.dateFrom,
    dateTo: args.dateTo,
    records,
  };

  const outPath = path.resolve(args.output);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
  console.log(`Normalized ${records.length} records → ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
