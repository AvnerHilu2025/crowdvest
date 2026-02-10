/**
 * Backtest v0 for SPY using local market CSV and decision/metrics pipeline.
 *
 * CLI: pnpm -C apps/worker run backtest-v0 --runId <id> --seeds <count> [--seedStart 1] [--csv path] [--priceField close] [--steps 29] [--agents 200]
 * --seeds <count>: required. Run <count> different seeds (e.g. --seeds 3 runs seeds 1,2,3 with default seedStart).
 * --seedStart <number>: optional, default 1. Seed list = [seedStart, seedStart+1, ..., seedStart+count-1].
 * --runId: required OR omit to create a new run once. Same runId for all seeds; seeds only affect agent randomness.
 * --csv: required when AssetStepReturn count for (runId, assetSymbol) is 0.
 *
 * Flow: Resolve runId, ensure AssetStepReturn. For each seed: agents/generate overwrite -> decide overwrite=true -> compute-crowd-metrics -> corr/directionalAccuracy -> persist BacktestResult.
 */
import path from "path";
import fs from "fs";
import { createHash } from "crypto";
import { spawnSync } from "child_process";
import { PrismaClient } from "@crowdvest/db";
import { assertRunExists } from "../lib/assert-run-exists";

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
  label: string;
} {
  const args = process.argv.slice(2);
  let runId = "";
  let assetSymbol = "SPY";
  let csv = "";
  let priceField = "close";
  let steps = 29;
  let agents = 200;
  let seedsCount = 0; // required
  let seedStart = 1;
  let label = "";
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
      const n = parseInt(String(args[++i]).trim(), 10);
      if (Number.isFinite(n) && n >= 1) seedsCount = n;
    } else if (args[i] === "--seedStart" && args[i + 1]) {
      const n = parseInt(String(args[++i]).trim(), 10);
      if (Number.isFinite(n)) seedStart = n;
    } else if (args[i] === "--label" && args[i + 1]) {
      label = String(args[++i]).trim();
    }
  }
  if (seedsCount < 1) throw new Error("--seeds <count> is required (count >= 1). Example: --seeds 5");
  const seeds = Array.from({ length: seedsCount }, (_, i) => seedStart + i);
  return { runId, assetSymbol, csv, priceField, steps, agents, seeds, label };
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
    await assertRunExists(apiBase, runId);
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

  const variantIds: string[] = [];

  for (const seed of argv.seeds) {
    // 3) Find or create RunVariant for this seed (and optional label)
    const label = argv.label;
    let variant = await prisma.runVariant.findUnique({
      where: {
        runId_assetSymbol_seed_label: {
          runId,
          assetSymbol: argv.assetSymbol,
          seed,
          label,
        },
      },
      select: { id: true },
    });
    if (!variant) {
      variant = await prisma.runVariant.create({
        data: {
          runId,
          assetSymbol: argv.assetSymbol,
          seed,
          label,
          agents: argv.agents,
          steps: argv.steps,
        },
        select: { id: true },
      });
    }
    const variantId = variant.id;
    variantIds.push(variantId);

    // 4) POST /agents/generate (same runId; seed only affects randomness)
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

    // 5) decide with runVariantId, overwrite=true (only this variant)
    if (
      !runWorker(
        "decide",
        [
          "--runVariantId", variantId,
          "--steps", String(argv.steps),
          "--overwrite", "true",
          "--allowSmallCrowd",
        ],
        repoRoot,
      )
    ) {
      throw new Error("decide failed for runId=" + runId + " variantId=" + variantId);
    }

    // 6) compute-crowd-metrics with runVariantId
    if (
      !runWorker(
        "compute-crowd-metrics",
        ["--runVariantId", variantId],
        repoRoot,
      )
    ) {
      throw new Error("compute-crowd-metrics failed for runId=" + runId + " variantId=" + variantId);
    }

    // 7) Load CrowdMetrics for this variant and AssetStepReturn; build pairs for t=0..steps-2
    const [metrics, stepReturns] = await Promise.all([
      prisma.crowdMetrics.findMany({
        where: { runVariantId: variantId },
        orderBy: { step: "asc" },
        select: { step: true, weightedSignal: true },
      }),
      prisma.assetStepReturn.findMany({
        where: { runId, assetSymbol: argv.assetSymbol },
        orderBy: { step: "asc" },
        select: { step: true, stepReturn: true },
      }),
    ]);

    const assetStepReturnCount = stepReturns.length;
    if (assetStepReturnCount === 0) {
      throw new Error("Cannot compute corr: AssetStepReturn count is 0 for runId=" + runId + ". Import CSV first.");
    }
    const signalByStep = new Map(metrics.map((m) => [m.step, m.weightedSignal]));
    const returnByStep = new Map(stepReturns.map((r) => [r.step, r.stepReturn]));

    const pred: number[] = [];
    const ret1: number[] = [];
    const stepsForPairs: number[] = [];
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
        stepsForPairs.push(t);
      }
    }
    const pairsCount = pred.length;

    const corr: number | null = pearson(pred, ret1);
    let directionalAccuracy: number | null = null;
    if (pairsCount > 0) {
      let correct = 0;
      for (let i = 0; i < pred.length; i++) {
        if ((pred[i]! >= 0) === (ret1[i]! >= 0)) correct++;
      }
      directionalAccuracy = correct / pairsCount;
    }

    // One line per seed: runId, variantId, seed, corr, directionalAccuracy, pairsCount
    console.log(
      "runId=" + runId + " variantId=" + variantId + " seed=" + seed +
        " corr=" + (corr != null ? corr.toFixed(4) : "null") +
        " directionalAccuracy=" + (directionalAccuracy != null ? directionalAccuracy.toFixed(4) : "null") +
        " pairsCount=" + pairsCount,
    );

    // Debug: decision counts + hashes and pairs sample (deterministic, seed-sensitive)
    const decisions = await prisma.agentDecision.findMany({
      where: { runVariantId: variantId },
      orderBy: [{ step: "asc" }, { agentId: "asc" }],
      select: { step: true, agentId: true, action: true },
    });
    const decisionCounts = { BUY: 0, SELL: 0, HOLD: 0 };
    for (const d of decisions) {
      if (d.action in decisionCounts) (decisionCounts as Record<string, number>)[d.action]++;
    }
    const decisionsPayload = decisions.map((d) => ({ step: d.step, agentId: d.agentId, action: d.action }));
    const decisionsHash = createHash("sha256").update(JSON.stringify(decisionsPayload)).digest("hex");
    const returnsPayload = stepReturns.map((r) => r.stepReturn);
    const returnsHash = createHash("sha256").update(JSON.stringify(returnsPayload)).digest("hex");
    const pairsSample = stepsForPairs.slice(0, 10).map((step, i) => ({
      step,
      r: ret1[i],
      predictedSign: (pred[i]! >= 0) ? 1 : -1,
      actualSign: (ret1[i]! >= 0) ? 1 : -1,
    }));

    // 8) Upsert RunVariantSummary (and BacktestResult for backward compat)
    const corrVal = corr ?? 0;
    const dirAccVal = directionalAccuracy ?? 0;
    const debugPayload = {
      debugDecisionCounts: decisionCounts,
      debugPairsSample: pairsSample,
      debugDecisionsHash: decisionsHash,
      debugReturnsHash: returnsHash,
    };
    await prisma.runVariantSummary.upsert({
      where: { runVariantId: variantId },
      create: {
        runVariantId: variantId,
        corr: corrVal,
        directionalAccuracy: dirAccVal,
        pairsCount,
        ...debugPayload,
      },
      update: {
        corr: corrVal,
        directionalAccuracy: dirAccVal,
        pairsCount,
        computedAt: new Date(),
        ...debugPayload,
      },
    });
    await prisma.backtestResult.deleteMany({ where: { runVariantId: variantId } });
    await prisma.backtestResult.create({
      data: {
        runId,
        runVariantId: variantId,
        assetSymbol: argv.assetSymbol,
        seed,
        steps: argv.steps,
        agents: argv.agents,
        pairsCount,
        corr,
        directionalAccuracy,
      },
    });
  }

  console.log("backtest-v0 done. variants=" + variantIds.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
