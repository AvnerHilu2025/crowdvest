/**
 * CLI:
 * pnpm -C apps/worker run react:info-events -- --input apps/worker/tmp/normalized-info-events.json
 *
 * Reads normalized info events, computes deterministic persona reactions, prints table,
 * and writes JSON to apps/worker/tmp/info-reactions.json (or --output path).
 */
import fs from "fs";
import path from "path";
import { buildPersonaSourcePreferences, computePersonaEventImpact } from "../lib/info-ingestion/persona-reaction/persona-reaction";
import type { NormalizedInfoEvent } from "../lib/info-ingestion/types";
import type { NormalizeOutputEnvelope, NormalizedInfoEventRecord } from "../lib/news-ingest/types";

type Args = {
  input: string;
  output: string;
  minAbsImpact: number;
};

type ReactionRow = {
  eventId: string;
  archetypeId: string;
  influence: number;
  direction: "BUY" | "SELL" | "HOLD";
  confidence: number;
};

type ReactionOutput = {
  generatedAt: string;
  sourceInput: string;
  normalizedEventCount: number;
  archetypeCount: number;
  rows: ReactionRow[];
  byEvent: Array<{
    eventId: string;
    headline: string;
    symbol: string;
    reactions: ReactionRow[];
  }>;
};

function resolveReadablePath(p: string): string {
  const direct = path.resolve(p);
  if (fs.existsSync(direct)) return direct;
  const cwdJoined = path.resolve(process.cwd(), p);
  if (fs.existsSync(cwdJoined)) return cwdJoined;
  const workerRelative = path.resolve(process.cwd(), "apps/worker", p);
  if (fs.existsSync(workerRelative)) return workerRelative;
  return direct;
}

function resolveWritablePath(p: string): string {
  const direct = path.resolve(p);
  if (path.isAbsolute(p)) return direct;
  if (p.startsWith("apps/worker/")) {
    const fromRepoRoot = path.resolve(process.cwd(), p);
    if (fromRepoRoot.includes("/apps/worker/apps/worker/")) {
      return path.resolve(process.cwd(), p.replace(/^apps\/worker\//, ""));
    }
  }
  return direct;
}

function parseArgs(argv: string[]): Args {
  const rest = argv.slice(2);
  let input = "apps/worker/tmp/normalized-info-events.json";
  let output = "apps/worker/tmp/info-reactions.json";
  let minAbsImpact = 0;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--" || a === "") continue;
    if (a === "--input" && rest[i + 1]) input = rest[++i]!.trim();
    else if (a === "--output" && rest[i + 1]) output = rest[++i]!.trim();
    else if (a === "--minAbsImpact" && rest[i + 1]) minAbsImpact = Number(rest[++i]!.trim());
  }
  return { input, output, minAbsImpact: Number.isFinite(minAbsImpact) ? Math.max(0, minAbsImpact) : 0 };
}

function inferSourceType(record: NormalizedInfoEventRecord): "news" | "social" | "macro" {
  const s = (record.source ?? "").toLowerCase();
  if (s.includes("twitter") || s.includes("x.com") || s.includes("reddit") || s.includes("social")) return "social";
  if (s.includes("macro") || s.includes("fed") || s.includes("cpi") || s.includes("rates")) return "macro";
  return "news";
}

function toCanonicalEvent(envelope: NormalizeOutputEnvelope, record: NormalizedInfoEventRecord): NormalizedInfoEvent {
  const sourceType = inferSourceType(record);
  const relevance = Math.max(0, Math.min(1, record.salience));
  const urgency = Math.max(0, Math.min(1, record.salience * 0.9 + Math.abs(record.sentiment) * 0.1));
  const credibility = Math.max(0, Math.min(1, record.credibility));
  const eventId = `evt:${envelope.runId}:${record.step}:${record.publishedAt}:${record.title}`;
  return {
    eventId,
    sourceType,
    provider: "normalized_info_events",
    symbol: envelope.assetSymbol.toUpperCase(),
    headline: record.title,
    body: record.title,
    publishedAt: new Date(record.publishedAt).toISOString(),
    sentiment: Math.max(-1, Math.min(1, record.sentiment)),
    relevance,
    credibility,
    urgency,
    tags: [record.eventType, sourceType],
    canonicalUrl: null,
    provenance: {
      sourceId: `${record.source}:${record.step}`,
      ingestedAt: new Date().toISOString(),
    },
  };
}

function toDirection(influence: number): "BUY" | "SELL" | "HOLD" {
  if (influence >= 0.03) return "BUY";
  if (influence <= -0.03) return "SELL";
  return "HOLD";
}

function printReactionTable(rows: ReactionRow[]): void {
  const table = rows.map((r) => ({
    event: r.eventId.slice(0, 48),
    archetype: r.archetypeId,
    influence: Number(r.influence.toFixed(4)),
    direction: r.direction,
    confidence: Number(r.confidence.toFixed(3)),
  }));
  console.table(table);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const inPath = resolveReadablePath(args.input);
  if (!fs.existsSync(inPath)) {
    throw new Error(`Input file not found: ${inPath}`);
  }
  const raw = fs.readFileSync(inPath, "utf8");
  const normalized = JSON.parse(raw) as NormalizeOutputEnvelope;
  if (!Array.isArray(normalized.records)) {
    throw new Error("Input does not look like NormalizeOutputEnvelope: missing records[]");
  }

  const prefs = buildPersonaSourcePreferences();
  const canonicalEvents = normalized.records.map((r) => toCanonicalEvent(normalized, r));

  const rows: ReactionRow[] = [];
  const byEvent: ReactionOutput["byEvent"] = [];
  for (const event of canonicalEvents) {
    const impacts = computePersonaEventImpact(event, prefs)
      .map((x) => ({
        eventId: x.eventId,
        archetypeId: x.archetypeId,
        influence: x.impactScore,
        direction: toDirection(x.impactScore),
        confidence: x.confidence,
      }))
      .filter((x) => Math.abs(x.influence) >= args.minAbsImpact)
      .sort((a, b) => Math.abs(b.influence) - Math.abs(a.influence));
    rows.push(...impacts);
    byEvent.push({
      eventId: event.eventId,
      headline: event.headline,
      symbol: event.symbol,
      reactions: impacts,
    });
  }

  printReactionTable(rows);

  const output: ReactionOutput = {
    generatedAt: new Date().toISOString(),
    sourceInput: inPath,
    normalizedEventCount: canonicalEvents.length,
    archetypeCount: prefs.length,
    rows,
    byEvent,
  };

  const outPath = resolveWritablePath(args.output);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote persona reactions -> ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
