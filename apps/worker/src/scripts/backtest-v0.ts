/**
 * Backtest v0 for SPY using local market CSV and decision/metrics pipeline.
 *
 * CLI: pnpm -C apps/worker run backtest-v0 --runId <id> [--csv path] [--priceField close] [--steps 29] [--agents 200] [--seeds "1,2,3,4,5"]
 * --runId: required OR omit to create a new run once (script prints it). Same runId is used for all seeds; seeds only affect agent randomness.
 * --csv: required when AssetStepReturn count for (runId, assetSymbol) is 0; script imports into this runId.
 *
 * Flow: Resolve runId (use --runId or POST /runs once). Ensure AssetStepReturn for (runId, assetSymbol): if count==0, --csv import or throw.
 * For each seed: agents/generate overwrite -> decide -> compute-crowd-metrics -> read CrowdMetrics + AssetStepReturn from SAME runId -> corr/directionalAccuracy -> persist BacktestResult.
 * Backtest must never compute corr on a run without AssetStepReturn (same runId for metrics and returns).
 */
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
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

function parseArgv(): {
  runId: string;
  assetSymbol: string;
  csv: string;
  priceField: string;
  steps: number;
  agents: number;
  seeds: number[];
} {
  const args = process.argv.slice(2);
  let runId = "";
  let assetSymbol = "SPY";
  let csv = "";
  let priceField = "close";
  let steps = 29;
  let agents = 200;
  let seedsStr = "1,2,3,4,5";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--runId" && args[i + 1]) {
      runId = String(args[++i]).trim();
    } else if (args[i] === "--assetSymbol" && args[i + 1]) {
      assetSymbol = String(args[++i]).trim().toUpperCase() || "SPY";
    } else if (args[i] === "--csv" && args[i + 1]) {
      csv = String(args[++i]).trim();
    } else if (args[i] === "--priceField" && args[i + 1]) {
      priceField = String(args[++i]).trim() || "close";
    } else if (args[i] === "--steps" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n) && n >= 2) steps = n;
    } else if (args[i] === "--agents" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n) && n >= 1) agents = n;
    } else if (args[i] === "--seeds" && args[i + 1]) {
      seedsStr = String(args[++i]).trim();
    }
  }
  const seeds = seedsStr
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
  return { runId, assetSymbol, csv, priceField, steps, agents, seeds: seeds.length ? seeds : [1, 2, 3, 4, 5] };
}

function resolveCsvPath(csvArg: string): string {
  if (path.isAbsolute(csvArg)) return csvArg;
  const cwd = process.cwd();
  const repoRoot = path.resolve(cwd, "..");
  const candidates: string[] = [
    path.resolve(cwd, csvArg),
  ];
  if (csvArg.startsWith("apps/worker/")) {
    candidates.push(path.resolve(cwd, csvArg.replace(/^apps\/worker\//, "")));
  }
  candidates.push(path.resolve(repoRoot, csvArg));
  candidates.push(path.resolve(cwd, "..", csvArg));
  if (csvArg.startsWith("apps/worker/")) {
    candidates.push(path.resolve(repoRoot, csvArg.replace(/^apps\/worker\//, "")));
  }
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error("CSV file not found. Tried: " + candidates.join(", "));
  return found;
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

/** In-process import: read CSV, compute step returns, upsert AssetStepReturn for runId+assetSymbol. Returns number of steps. */
async function ensureAssetStepReturns(
  prisma: PrismaClient,
  runId: string,
  assetSymbol: string,
  csvPath: string,
  priceField: string,
  expectedSteps: number,
): Promise<number> {
  const { headers, rows: rawRows } = parseCsv(csvPath);
  const dateIdx = headers.indexOf("date");
  const priceIdx = headers.indexOf(priceField);
  if (dateIdx === -1) throw new Error("CSV must have a 'date' column.");
  if (priceIdx === -1) throw new Error("CSV must have column: " + priceField);
  const rows = rawRows
    .map((r) => ({ date: r[dateIdx]!, price: parseFloat(r[priceIdx] ?? "") }))
    .filter((r) => r.date && Number.isFinite(r.price))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length === 0) throw new Error("No valid date/price rows in CSV.");
  const stepReturns: number[] = [0];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]!.price;
    const curr = rows[i]!.price;
    stepReturns.push(prev === 0 ? 0 : (curr - prev) / prev);
  }
  if (stepReturns.length < expectedSteps) {
    throw new Error(
      "CSV has " +
        stepReturns.length +
        " step returns (need " +
        expectedSteps +
        "). Add more rows or use --steps " +
        stepReturns.length,
    );
  }
  const stepsToUpsert = Math.min(stepReturns.length, expectedSteps);
  for (let step = 0; step < stepsToUpsert; step++) {
    await prisma.assetStepReturn.upsert({
      where: {
        runId_assetSymbol_step: { runId, assetSymbol, step },
      },
      create: { runId, assetSymbol, step, stepReturn: stepReturns[step]! },
      update: { stepReturn: stepReturns[step]! },
    });
  }
  return stepsToUpsert;
}

function variance(x: number[]): number {
  if (x.length < 2) return 0;
  const n = x.length;
  const mean = x.reduce((a, b) => a + b, 0) / n;
  return x.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
}

/** Pearson correlation. Returns null if pairs < 3 or either variance is 0. */
function pearson(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 3) return null;
  const n = x.length;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i]!; sy += y[i]!;
    sxy += x[i]! * y[i]!; sx2 += x[i]! * x[i]!; sy2 += y[i]! * y[i]!;
  }
  const varX = n * sx2 - sx * sx;
  const varY = n * sy2 - sy * sy;
  if (varX <= 0 || varY <= 0) return null;
  const num = n * sxy - sx * sy;
  const den = Math.sqrt(varX * varY);
  return den === 0 ? null : num / den;
}

function runWorker(
  script: "import-market-csv" | "decide" | "compute-crowd-metrics",
  extra: string[],
  root: string,
): boolean {
  const r = spawnSync("pnpm", ["--filter", "worker", "run", script, "--", ...extra], {
    stdio: "inherit",
    cwd: root,
  });
  return r.status === 0;
}

async function main(): Promise<void> {
  loadEnv();
  const argv = parseArgv();
  const repoRoot = path.resolve(process.cwd(), "..");
  const apiBase = (process.env.API_BASE ?? "http://localhost:4001").replace(/\/$/, "");
  const prisma = new PrismaClient();

  const csvPath = argv.csv ? resolveCsvPath(argv.csv) : "";

  // 1) Resolve runId: use --runId or create a new run once
  let runId = argv.runId.trim();
  if (!runId) {
    const runRes = await fetch(apiBase + "/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!runRes.ok) {
      const t = await runRes.text();
      throw new Error("POST /runs failed: " + runRes.status + " " + t);
    }
    const runJson = (await runRes.json()) as { id?: string };
    runId = runJson.id ?? "";
    if (!runId) throw new Error("POST /runs did not return id");
    console.log("runId=" + runId + " (created; use --runId " + runId + " to reuse)");
  } else {
    console.log("runId=" + runId + " (from --runId)");
  }

  console.log(
    "backtest-v0 assetSymbol=" +
      argv.assetSymbol +
      (csvPath ? " csv=" + csvPath : "") +
      " priceField=" +
      argv.priceField +
      " steps=" +
      argv.steps +
      " agents=" +
      argv.agents +
      " seeds=" +
      argv.seeds.join(","),
  );

  // 2) Ensure AssetStepReturn exists for this runId (once). Never compute corr without it.
  const n = await prisma.assetStepReturn.count({
    where: { runId, assetSymbol: argv.assetSymbol },
  });
  if (n === 0) {
    if (!argv.csv || !csvPath) {
      throw new Error(
        "AssetStepReturn missing for runId=" + runId + " assetSymbol=" + argv.assetSymbol + ". Provide --csv and --priceField or import data first.",
      );
    }
    console.log("AssetStepReturn count=0 for runId=" + runId + " -> importing from CSV");
    await ensureAssetStepReturns(
      prisma,
      runId,
      argv.assetSymbol,
      csvPath,
      argv.priceField,
      argv.steps,
    );
    console.log("imported AssetStepReturn rows=" + argv.steps);
  }
  const assetStepReturnRows = await prisma.assetStepReturn.count({
    where: { runId, assetSymbol: argv.assetSymbol },
  });
  if (assetStepReturnRows !== argv.steps) {
    throw new Error(
      "AssetStepReturn count (" + assetStepReturnRows + ") != steps (" + argv.steps + ") for runId=" + runId + ". Import failed or wrong run.",
    );
  }

  for (const seed of argv.seeds) {
    // 3) POST /agents/generate (same runId; seed only affects randomness)
    const genRes = await fetch(
      apiBase + "/agents/generate?runId=" + encodeURIComponent(runId) + "&overwrite=true",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: argv.agents, seed, preset: "default" }),
      },
    );
    if (!genRes.ok) {
      const t = await genRes.text();
      throw new Error("POST /agents/generate failed: " + genRes.status + " " + t);
    }

    // 4) decide overwrite=true steps=steps seed=seed
    if (
      !runWorker(
        "decide",
        [
          "--runId", runId,
          "--assetSymbol", argv.assetSymbol,
          "--steps", String(argv.steps),
          "--seed", String(seed),
          "--overwrite", "true",
          "--allowSmallCrowd",
        ],
        repoRoot,
      )
    ) {
      throw new Error("decide failed for runId=" + runId);
    }

    // 5) compute-crowd-metrics
    if (
      !runWorker(
        "compute-crowd-metrics",
        ["--runId", runId, "--assetSymbol", argv.assetSymbol],
        repoRoot,
      )
    ) {
      throw new Error("compute-crowd-metrics failed for runId=" + runId);
    }

    // 6) Load CrowdMetrics (weightedSignal) and AssetStepReturn; build pairs for t=0..steps-2
    const [metrics, stepReturns] = await Promise.all([
      prisma.crowdMetrics.findMany({
        where: { runId, assetSymbol: argv.assetSymbol },
        orderBy: { step: "asc" },
        select: { step: true, weightedSignal: true },
      }),
      prisma.assetStepReturn.findMany({
        where: { runId, assetSymbol: argv.assetSymbol },
        orderBy: { step: "asc" },
        select: { step: true, stepReturn: true },
      }),
    ]);

    const perStepEntries = metrics.length;
    const assetStepReturnCount = stepReturns.length;
    if (assetStepReturnCount === 0) {
      throw new Error("Cannot compute corr: AssetStepReturn count is 0 for runId=" + runId + ". Import CSV first.");
    }
    const signalByStep = new Map(metrics.map((m) => [m.step, m.weightedSignal]));
    const returnByStep = new Map(stepReturns.map((r) => [r.step, r.stepReturn]));

    const pred: number[] = [];
    const ret1: number[] = [];
    const pairSamples: { t: number; pred: number; nextReturn: number }[] = [];
    for (let t = 0; t <= argv.steps - 2; t++) {
      const sig = signalByStep.get(t);
      const nextRet = returnByStep.get(t + 1);
      if (
        sig != null &&
        nextRet != null &&
        Number.isFinite(sig) &&
        Number.isFinite(nextRet)
      ) {
        pred.push(sig);
        ret1.push(nextRet);
        if (pairSamples.length < 5) {
          pairSamples.push({ t, pred: sig, nextReturn: nextRet });
        }
      }
    }
    const pairsCount = pred.length;

    console.log(
      "runId=" + runId + " assetStepReturnRows=" + assetStepReturnRows + " perStepEntries=" + perStepEntries + " pairsCount=" + pairsCount + " (expected steps-1=" + (argv.steps - 1) + ") seed=" + seed,
    );
    if (pairSamples.length > 0) {
      console.log("[debug] sample first 5 pairs: " + JSON.stringify(pairSamples));
    }

    const predVar = variance(pred);
    const retVar = variance(ret1);
    const corr: number | null = pearson(pred, ret1);
    let directionalAccuracy: number | null = null;
    if (pairsCount > 0) {
      let correct = 0;
      for (let i = 0; i < pred.length; i++) {
        if ((pred[i]! >= 0) === (ret1[i]! >= 0)) correct++;
      }
      directionalAccuracy = correct / pairsCount;
    }

    console.log(
      "seed=" +
        seed +
        " pairs=" +
        pairsCount +
        " predVar=" +
        predVar.toExponential(4) +
        " retVar=" +
        retVar.toExponential(4) +
        " corr=" +
        (corr != null ? corr.toFixed(4) : "null") +
        " directionalAccuracy=" +
        (directionalAccuracy != null ? directionalAccuracy.toFixed(4) : "null"),
    );

    // 7) Persist BacktestResult (nullable corr / directionalAccuracy)
    await prisma.backtestResult.create({
      data: {
        runId,
        assetSymbol: argv.assetSymbol,
        seed,
        steps: argv.steps,
        agents: argv.agents,
        corr,
        directionalAccuracy,
      },
    });
  }

  console.log("backtest-v0 done. seeds=" + argv.seeds.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
