/**
 * CLI: Import full historical daily prices from Stooq CSV into MarketPrice.
 *
 * Usage:
 *   pnpm exec tsx apps/api/scripts/importFullHistory.ts SPY
 *   pnpm exec tsx apps/api/scripts/importFullHistory.ts QQQ
 *   pnpm exec tsx apps/api/scripts/importFullHistory.ts IWM
 *
 * Or from apps/api: pnpm exec tsx scripts/importFullHistory.ts SPY
 *
 * Requires DATABASE_URL in .env
 * Skips duplicates; idempotent.
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

const DATASET_VERSION = "stooq-full-v1";
const BATCH_SIZE = 500;
const STOOQ_BASE = "https://stooq.com/q/d/l/";

function loadEnv(): void {
  const cwd = process.cwd();
  for (const p of [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, "..", ".env"),
    path.resolve(cwd, "..", "..", ".env"),
  ]) {
    try {
      if (!fs.existsSync(p)) continue;
      const content = fs.readFileSync(p, "utf8");
      for (const line of content.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq <= 0) continue;
        const key = t.slice(0, eq).trim();
        const val = t.slice(eq + 1).trim();
        if (key && !(key in process.env)) process.env[key] = val;
      }
    } catch {
      // ignore
    }
  }
  if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is not set.");
}

function parseArgv(): string {
  const symbol = process.argv[2]?.trim().toUpperCase();
  if (!symbol) {
    throw new Error("Usage: pnpm exec tsx apps/api/scripts/importFullHistory.ts SPY|QQQ|IWM");
  }
  return symbol;
}

function log(msg: string): void {
  console.log("[" + new Date().toISOString() + "] " + msg);
}

function stooqSymbol(symbol: string): string {
  return `${symbol.toLowerCase()}.us`;
}

async function fetchStooqCsv(symbol: string): Promise<Array<{ date: string; open: number; high: number; low: number; close: number; volume: number | null }>> {
  const stooqSym = stooqSymbol(symbol);
  const url = `${STOOQ_BASE}?s=${stooqSym}&i=d`;

  log(`Downloading ${symbol} from Stooq...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Stooq fetch error: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error(`Stooq: no data for ${symbol}`);
  }

  const header = lines[0]!.toLowerCase();
  if (!header.includes("date") || !header.includes("open") || !header.includes("close")) {
    throw new Error(`Stooq: unexpected CSV format. Expected Date,Open,High,Low,Close,Volume`);
  }

  const cols = lines[0]!.split(",").map((c) => c.trim().toLowerCase());
  const dateIdx = cols.indexOf("date");
  const openIdx = cols.indexOf("open");
  const highIdx = cols.indexOf("high");
  const lowIdx = cols.indexOf("low");
  const closeIdx = cols.indexOf("close");
  const volIdx = cols.indexOf("volume");

  if (dateIdx < 0 || openIdx < 0 || closeIdx < 0) {
    throw new Error(`Stooq: missing required columns (Date, Open, Close)`);
  }

  const rows: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number | null }> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim()) continue;

    const parts = line.split(",").map((p) => p.trim());
    const dateStr = parts[dateIdx];
    if (!dateStr) continue;

    const open = parseFloat(parts[openIdx] ?? "");
    const high = parseFloat(parts[highIdx] ?? parts[openIdx] ?? "");
    const low = parseFloat(parts[lowIdx] ?? parts[openIdx] ?? "");
    const close = parseFloat(parts[closeIdx] ?? "");
    const volRaw = volIdx >= 0 ? parts[volIdx] : "";
    const volume = volRaw ? parseInt(volRaw, 10) : null;

    if (!Number.isFinite(open) || !Number.isFinite(close)) continue;

    rows.push({
      date: dateStr,
      open,
      high: Number.isFinite(high) ? high : open,
      low: Number.isFinite(low) ? low : open,
      close,
      volume: Number.isFinite(volume) ? volume : null,
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

async function main(): Promise<void> {
  loadEnv();
  const symbol = parseArgv();

  const prisma = new PrismaClient();

  const rawRows = await fetchStooqCsv(symbol);
  log(`rows downloaded: ${rawRows.length}`);

  const toInsert = rawRows.map((r) => ({
    datasetVersion: DATASET_VERSION,
    symbol,
    timestamp: new Date(r.date),
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
  }));

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const result = await prisma.marketPrice.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += result.count;
    skipped += batch.length - result.count;
  }

  const totalAfter = await prisma.marketPrice.count({
    where: { symbol, datasetVersion: DATASET_VERSION },
  });

  log(`symbol: ${symbol}`);
  log(`rows downloaded: ${rawRows.length}`);
  log(`rows inserted: ${inserted}`);
  log(`rows skipped: ${skipped}`);
  log(`total rows after import: ${totalAfter}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
