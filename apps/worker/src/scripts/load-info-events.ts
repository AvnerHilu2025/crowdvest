/**
 * CLI: pnpm -C apps/worker run load:info-events -- --input normalized.json
 *
 * Inserts InfoEvent rows from normalized JSON. Idempotent on (runId, assetSymbol, topic) where
 * topic encodes publishedAt + title (+ optional [EVENT] prefix).
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@crowdvest/db";
import type { NormalizeOutputEnvelope, NormalizedInfoEventRecord } from "../lib/news-ingest/types";

function parseArgs(argv: string[]): { input: string } {
  const rest = argv.slice(2);
  let input = "";
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--" || a === "") continue;
    if (a === "--input" && rest[i + 1]) input = rest[++i]!.trim();
  }
  return { input };
}

function topicForRecord(r: NormalizedInfoEventRecord): string {
  const prefix = r.eventType === "event" ? "[EVENT] " : "";
  const base = `${r.publishedAt}::${r.title}`;
  return (prefix + base).slice(0, 8000);
}

async function main(): Promise<void> {
  const { input } = parseArgs(process.argv);
  if (!input) {
    console.error("Usage: tsx src/scripts/load-info-events.ts --input normalized.json");
    process.exit(1);
  }

  const p = path.resolve(input);
  const text = fs.readFileSync(p, "utf-8");
  const env = JSON.parse(text) as NormalizeOutputEnvelope;
  if (!env.records || !Array.isArray(env.records)) {
    throw new Error("Invalid normalized file: expected { records: [...] }");
  }

  const prisma = new PrismaClient();
  try {
    const runId = env.runId;
    const assetSymbol = env.assetSymbol.toUpperCase();

    const run = await prisma.simulationRun.findUnique({ where: { id: runId } });
    if (!run) {
      throw new Error(
        `SimulationRun not found for runId=${runId}. Create the run before loading InfoEvents.`,
      );
    }

    const existing = await prisma.infoEvent.findMany({
      where: { runId, assetSymbol },
      select: { topic: true },
    });
    const seen = new Set(existing.map((e) => e.topic));

    let inserted = 0;
    let skipped = 0;

    for (const r of env.records) {
      const topic = topicForRecord(r);
      if (seen.has(topic)) {
        skipped++;
        continue;
      }
      await prisma.infoEvent.create({
        data: {
          runId,
          assetSymbol,
          step: r.step,
          topic,
          sentiment: r.sentiment,
          credibility: r.credibility,
          reach: Math.max(0, Math.min(1, r.salience)),
          volatilityImpact: r.eventType === "event" ? r.salience : null,
          source: r.source,
        },
      });
      seen.add(topic);
      inserted++;
    }

    console.log(`load-info-events: inserted=${inserted} skipped(duplicate)=${skipped} runId=${runId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
