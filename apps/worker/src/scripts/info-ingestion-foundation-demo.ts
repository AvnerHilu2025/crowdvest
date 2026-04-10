/**
 * Demo runner for info-ingestion foundation.
 *
 * Example:
 * pnpm -C apps/worker exec tsx src/scripts/info-ingestion-foundation-demo.ts --symbol SPY --dateFrom 2026-04-01 --dateTo 2026-04-10
 */
import fs from "fs";
import path from "path";
import { runInfoIngestionPipeline } from "../lib/info-ingestion";
import type { NormalizeOutputEnvelope } from "../lib/news-ingest/types";

function parseArgs(argv: string[]): { symbol: string; dateFrom: string; dateTo: string } {
  const rest = argv.slice(2);
  let symbol = "SPY";
  let dateFrom = "";
  let dateTo = "";
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--symbol" && rest[i + 1]) symbol = rest[++i]!.trim().toUpperCase();
    else if (a === "--dateFrom" && rest[i + 1]) dateFrom = rest[++i]!.trim();
    else if (a === "--dateTo" && rest[i + 1]) dateTo = rest[++i]!.trim();
  }
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const today = `${yyyy}-${mm}-${dd}`;
  const fallbackFrom = `${yyyy}-${mm}-${String(Math.max(1, Number(dd) - 6)).padStart(2, "0")}`;
  return {
    symbol,
    dateFrom: dateFrom || fallbackFrom,
    dateTo: dateTo || today,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const runId = `info-ingestion-demo-${args.symbol}-${args.dateFrom}-${args.dateTo}`.replace(/[^a-zA-Z0-9_-]+/g, "_");
  const output = await runInfoIngestionPipeline({
    symbol: args.symbol,
    dateFrom: args.dateFrom,
    dateTo: args.dateTo,
  });

  const normalizedOut: NormalizeOutputEnvelope = {
    runId,
    assetSymbol: args.symbol,
    steps: 1,
    dateFrom: args.dateFrom,
    dateTo: args.dateTo,
    records: output.normalizedEvents.map((e) => ({
      runId,
      assetSymbol: args.symbol,
      step: 0,
      title: e.headline,
      source: e.provider,
      publishedAt: e.publishedAt,
      sentiment: e.sentiment,
      credibility: e.credibility,
      salience: e.relevance,
      eventType: e.sourceType === "macro" ? "event" : "info",
      rawPayload: {
        eventId: e.eventId,
        sourceType: e.sourceType,
        urgency: e.urgency,
        tags: e.tags,
        canonicalUrl: e.canonicalUrl,
      },
    })),
  };
  const outPath = path.resolve("apps/worker/tmp/normalized-info-events.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(normalizedOut, null, 2), "utf8");
  console.log(`Wrote normalized events -> ${outPath}`);

  console.log(
    JSON.stringify(
      {
        window: output.window,
        rawCount: output.rawCount,
        normalizedCount: output.normalizedEvents.length,
        sampleEvents: output.normalizedEvents.slice(0, 5).map((e) => ({
          eventId: e.eventId,
          sourceType: e.sourceType,
          provider: e.provider,
          headline: e.headline,
          sentiment: Number(e.sentiment.toFixed(3)),
          score: Number(("score" in e ? (e as { score: number }).score : 0).toFixed(3)),
        })),
        topPersonaImpacts: output.impactsByEvent.slice(0, 3),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
