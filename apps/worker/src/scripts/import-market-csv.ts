/**
 * CLI: pnpm -C apps/worker run import-market-csv -- --runId <RUN_ID> --assetSymbol SPY --csv apps/worker/data/market/spy.us.daily.sample.csv --priceField close
 *
 * Reads a real-market CSV (date, close or other price column), sorts by date asc,
 * computes stepReturn[t] = (price[t] - price[t-1]) / price[t-1] (step 0 = 0),
 * upserts AssetStepReturn for (runId, assetSymbol, step). Prints summary: rows, min/max/mean stepReturn.
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

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

function parseArgv(): { runId: string; assetSymbol: string; csv: string; priceField: string } {
  const args = process.argv.slice(2);
  let runId = "";
  let assetSymbol = "SPY";
  let csv = "";
  let priceField = "close";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--runId" && args[i + 1]) runId = String(args[++i]).trim();
    else if (args[i] === "--assetSymbol" && args[i + 1]) assetSymbol = String(args[++i]).trim() || "SPY";
    else if (args[i] === "--csv" && args[i + 1]) csv = String(args[++i]).trim();
    else   if (args[i] === "--priceField" && args[i + 1]) priceField = String(args[++i]).trim() || "close";
  }
  if (!runId) throw new Error("--runId is required.");
  if (!csv) throw new Error("--csv is required.");
  return { runId, assetSymbol, csv, priceField };
}


function log(msg: string): void {
  console.log("[" + new Date().toISOString() + "] " + msg);
}

function parseCsv(filePath: string): { headers: string[]; rows: string[][] } {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error("CSV is empty.");
  const headers = lines[0]!.split(",").map((h) => h.trim());
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    rows.push(lines[i]!.split(",").map((c) => c.trim()));
  }
  return { headers, rows };
}

async function main(): Promise<void> {
  loadEnv();
  const argv = parseArgv();

  const csvArg = argv.csv;
  if (!csvArg) throw new Error("csv path is required");

  let csvPath: string;
  if (path.isAbsolute(csvArg)) {
    csvPath = csvArg;
  } else {
    const candidates: string[] = [
      path.resolve(process.cwd(), csvArg),
    ];
    if (csvArg.startsWith("apps/worker/")) {
      candidates.push(path.resolve(process.cwd(), csvArg.replace(/^apps\/worker\//, "")));
    }
    candidates.push(path.resolve(process.cwd(), "..", "..", csvArg));
    if (csvArg.startsWith("apps/worker/")) {
      candidates.push(path.resolve(process.cwd(), "..", "..", csvArg.replace(/^apps\/worker\//, "")));
    }
    const found = candidates.find((p) => fs.existsSync(p));
    if (!found) {
      throw new Error("CSV file not found. Tried:\n  " + candidates.join("\n  "));
    }
    csvPath = found;
  }

  if (!fs.existsSync(csvPath)) {
    throw new Error("CSV file not found at " + csvPath);
  }
  log("Importing market CSV from: " + csvPath);

  const { headers, rows: rawRows } = parseCsv(csvPath);
  const dateIdx = headers.indexOf("date");
  const priceIdx = headers.indexOf(argv.priceField);
  if (dateIdx === -1) throw new Error("CSV must have a 'date' column.");
  if (priceIdx === -1) throw new Error("CSV must have column: " + argv.priceField);

  const rows = rawRows
    .map((r) => ({ date: r[dateIdx]!, price: parseFloat(r[priceIdx] ?? "") }))
    .filter((r) => r.date && Number.isFinite(r.price))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (rows.length === 0) throw new Error("No valid date/price rows in CSV.");

  const stepReturns: number[] = [];
  stepReturns.push(0);
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]!.price;
    const curr = rows[i]!.price;
    if (prev === 0) {
      stepReturns.push(0);
    } else {
      stepReturns.push((curr - prev) / prev);
    }
  }

  const prisma = new PrismaClient();

  for (let step = 0; step < stepReturns.length; step++) {
    await prisma.assetStepReturn.upsert({
      where: {
        runId_assetSymbol_step: {
          runId: argv.runId,
          assetSymbol: argv.assetSymbol,
          step,
        },
      },
      create: {
        runId: argv.runId,
        assetSymbol: argv.assetSymbol,
        step,
        stepReturn: stepReturns[step]!,
      },
      update: { stepReturn: stepReturns[step]! },
    });
  }

  const vals = stepReturns.filter((_, i) => i > 0);
  const minR = vals.length ? Math.min(...vals) : 0;
  const maxR = vals.length ? Math.max(...vals) : 0;
  const meanR = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

  console.log("import-market-csv summary:");
  console.log("  rows:", rows.length);
  console.log("  steps (AssetStepReturn upserted):", stepReturns.length);
  console.log("  stepReturn min:", minR.toFixed(6));
  console.log("  stepReturn max:", maxR.toFixed(6));
  console.log("  stepReturn mean:", meanR.toFixed(6));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
