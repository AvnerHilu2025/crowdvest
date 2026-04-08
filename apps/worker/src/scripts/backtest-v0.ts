/**
 * Backtest v0 for SPY using local market CSV and decision/metrics pipeline.
 *
 * CLI: pnpm -C apps/worker run backtest-v0 --runId <id> [--seeds <count>] [--seedStart 1] [--csv path] [--priceField close] [--steps 29] [--agents 200]
 * --seeds <count>: optional, default 1. Run <count> different seeds (e.g. --seeds 3 runs seeds 1,2,3 with default seedStart). Must be an integer >= 1 if provided.
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
import { PrismaClient, setRunStatus } from "@crowdvest/db";
import { assertRunExists } from "../lib/assert-run-exists";

/** Per-step decision counts for runVariantId (step -> { BUY, SELL, HOLD }). Used for predictedSign from crowd. */
async function getPerStepDecisionCounts(
  prisma: PrismaClient,
  runVariantId: string,
): Promise<Map<number, { BUY: number; SELL: number; HOLD: number }>> {
  const rows = await prisma.agentDecision.groupBy({
    by: ["step", "action"],
    where: { runVariantId },
    _count: { id: true },
  });
  const stepCounts = new Map<number, { BUY: number; SELL: number; HOLD: number }>();
  for (const r of rows) {
    let row = stepCounts.get(r.step);
    if (!row) {
      row = { BUY: 0, SELL: 0, HOLD: 0 };
      stepCounts.set(r.step, row);
    }
    if (r.action in row) (row as Record<string, number>)[r.action] = r._count.id;
  }
  return stepCounts;
}

/** Majority direction per step: net = BUY - SELL => +1, -1, or 0. */
function predictedSignFromCounts(counts: { BUY: number; SELL: number; HOLD: number }): number {
  const net = counts.BUY - counts.SELL;
  if (net > 0) return 1;
  if (net < 0) return -1;
  return 0;
}

/** Round to fixed decimal digits for stable persistence (avoids float drift in A/B diffs). */
const round = (n: number, digits = 12) => Number(n.toFixed(digits));

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

type PersistMode = "lite" | "full";

function parseArgv(): {
  runId: string;
  assetSymbol: string;
  symbols: string[];
  csv: string;
  priceField: string;
  steps: number;
  agents: number;
  seeds: number[];
  label: string;
  persistMode: PersistMode;
  overwrite: boolean;
} {
  const args = process.argv.slice(2);
  let runId = "";
  let assetSymbol = "SPY";
  let symbolsStr = "";
  let csv = "";
  let priceField = "close";
  let steps = 29;
  let agents = 200;
  let seedsCount = 1;
  let seedStart = 1;
  let label = "";
  let persistMode: PersistMode = "lite";
  let overwrite = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--runId" && args[i + 1]) {
      runId = String(args[++i]).trim();
    } else if (args[i] === "--assetSymbol" && args[i + 1]) {
      assetSymbol = String(args[++i]).trim().toUpperCase() || "SPY";
    } else if (args[i] === "--symbols" && args[i + 1]) {
      symbolsStr = String(args[++i]).trim();
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
    } else if (args[i] === "--seeds") {
      const next = args[i + 1];
      if (!next) {
        throw new Error("--seeds requires an integer >= 1. Example: --seeds 5");
      }
      const n = parseInt(String(args[++i]).trim(), 10);
      if (!Number.isFinite(n) || n < 1) {
        throw new Error("--seeds must be an integer >= 1. Example: --seeds 5");
      }
      seedsCount = n;
    } else if (args[i] === "--seedStart" && args[i + 1]) {
      const n = parseInt(String(args[++i]).trim(), 10);
      if (Number.isFinite(n)) seedStart = n;
    } else if (args[i] === "--label" && args[i + 1]) {
      label = String(args[++i]).trim();
    } else if (args[i] === "--persist" && args[i + 1]) {
      const v = String(args[++i]).trim().toLowerCase();
      if (v !== "lite" && v !== "full") {
        throw new Error(`--persist must be lite or full, got: ${v}`);
      }
      persistMode = v as PersistMode;
    } else if (args[i] === "--overwrite") {
      overwrite = true;
    }
  }
  const seeds = Array.from({ length: seedsCount }, (_, i) => seedStart + i);
  const symbols: string[] =
    symbolsStr.length > 0
      ? symbolsStr.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
      : [assetSymbol];
  return { runId, assetSymbol, symbols, csv, priceField, steps, agents, seeds, label, persistMode, overwrite };
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

const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";
function ok(msg: string) {
  console.log(`${GREEN}${msg}${RESET}`);
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
  const t0 = Date.now();
  function mark(label: string) {
    console.log(`[Perf] ${label} +${Date.now() - t0}ms`);
  }

  mark("start");
  const repoRoot = path.resolve(process.cwd(), "..");
  const prisma = new PrismaClient();

  let runId = "";
  const csvPath = argv.csv ? resolveCsvPath(argv.csv) : "";

  try {
    // 1) Resolve runId: use --runId or create a new run once
    runId = argv.runId.trim();
    if (!runId) {
      const apiBase = (process.env.API_BASE ?? "http://localhost:4001").replace(/\/$/, "");
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
      await assertRunExists(prisma, runId);
      console.log("runId=" + runId + " (from --runId)");
    }
    mark("assertRunExists done");

    // 2) Set RUNNING before dataset validation (clear stale audit fields)
    await setRunStatus(prisma, runId, "RUNNING");
    const runT0 = Date.now();

    console.log(
      "backtest-v0 symbols=" +
        argv.symbols.join(",") +
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

    // 3) Ensure AssetStepReturn exists for each symbol. Never compute corr without it.
    for (const symbol of argv.symbols) {
      const n = await prisma.assetStepReturn.count({
        where: { runId, assetSymbol: symbol },
      });
      if (n === 0) {
        if (argv.symbols.length === 1 && argv.csv && csvPath) {
          console.log("AssetStepReturn count=0 for runId=" + runId + " -> importing from CSV");
          await ensureAssetStepReturns(
            prisma,
            runId,
            symbol,
            csvPath,
            argv.priceField,
            argv.steps,
          );
          console.log("imported AssetStepReturn rows=" + argv.steps);
        } else {
          const apiBase = (process.env.API_BASE ?? "http://localhost:4001").replace(/\/$/, "");
          console.error(
            `No AssetStepReturn for runId=${runId} assetSymbol=${symbol}. ` +
              `Run: curl -X POST ${apiBase}/runs/import/prices?symbols=${argv.symbols.join(",")}&points=${argv.steps}`,
          );
          process.exit(1);
        }
      }
      const assetStepReturnRows = await prisma.assetStepReturn.count({
        where: { runId, assetSymbol: symbol },
      });
      if (assetStepReturnRows !== argv.steps) {
        console.error(
          `AssetStepReturn count=${assetStepReturnRows} for ${symbol} (need ${argv.steps}). Re-run with --steps ${assetStepReturnRows} or create a new run.`,
        );
        process.exit(1);
      }
    }
    mark("dataset loaded");

    const variantIds: string[] = [];

    for (const assetSymbol of argv.symbols) {
  for (const seed of argv.seeds) {
    try {
    // 3) Find or create RunVariant for this seed (and optional label); upsert for idempotency
    const label = argv.label ?? "";
    console.log(
      JSON.stringify({
        tag: "BEFORE_RUN_VARIANT_UPSERT",
        runId,
        assetSymbol,
        seed,
        label,
      }),
    );
    const runVariantUnique = {
      runId_assetSymbol_seed_label: {
        runId,
        assetSymbol,
        seed,
        label,
      },
    } as const;
    let variantId: string;
    try {
      const variant = await prisma.runVariant.upsert({
        where: runVariantUnique,
        update: {
          agents: argv.agents,
          steps: argv.steps,
        },
        create: {
          runId,
          assetSymbol,
          seed,
          label,
          agents: argv.agents,
          steps: argv.steps,
        },
        select: { id: true },
      });
      variantId = variant.id;
    } catch (e) {
      if ((e as { code?: string })?.code !== "P2002") throw e;
      const existing = await prisma.runVariant.findUnique({
        where: runVariantUnique,
        select: { id: true },
      });
      if (!existing) throw e;
      console.log(
        "REUSING_EXISTING_VARIANT",
        JSON.stringify({
          runId,
          assetSymbol,
          seed,
          label,
          variantId: existing.id,
        }),
      );
      await prisma.runVariant.update({
        where: { id: existing.id },
        data: { agents: argv.agents, steps: argv.steps },
      });
      variantId = existing.id;
    }
    console.log(
      JSON.stringify({
        tag: "AFTER_RUN_VARIANT_UPSERT",
        runId,
        assetSymbol,
        seed,
        variantId,
      }),
    );
    variantIds.push(variantId);

    // Skip entire variant if already computed (unless --overwrite)
    let variantT0: number | null = null;
    if (!argv.overwrite) {
      const summary = await prisma.runVariantSummary.findUnique({
        where: { runVariantId: variantId },
        select: { debugDecisionsHash: true, debugReturnsHash: true },
      });
      if (summary?.debugDecisionsHash && summary?.debugReturnsHash) {
        ok(`✅ SKIP variant seed=${seed} (already computed)`);
        console.log(
          JSON.stringify({
            tag: "SKIP_DECIDE_AND_METRICS_PATH",
            seed,
            variantId,
            reason: "RunVariantSummary has debugDecisionsHash and debugReturnsHash",
          }),
        );
        // Still need to load CrowdMetrics for corr computation below; data exists from prior run
      } else {
        // Run decide and compute-crowd-metrics
        variantT0 = Date.now();
        await prisma.runVariant.update({
          where: { id: variantId },
          data: { startedAt: new Date(), completedAt: null, durationMs: null },
        });
        if (
          !runWorker(
            "decide",
            [
              "--runVariantId", variantId,
              "--steps", String(argv.steps),
              "--agents", String(argv.agents),
              "--overwrite", "false",
              "--allowSmallCrowd",
              "--persist", argv.persistMode,
            ],
            repoRoot,
          )
        ) {
          throw new Error("decide failed for runId=" + runId + " variantId=" + variantId);
        }
        if (argv.persistMode === "full") {
          mark("AgentInfoState persisted");
          mark("AgentState persisted");
          mark("AgentExperience persisted");
        } else {
          mark("AgentInfoState skipped (lite)");
          mark("AgentState skipped (lite)");
          mark("AgentExperience skipped (lite)");
        }

        if (
          !runWorker(
            "compute-crowd-metrics",
            ["--runVariantId", variantId, "--overwrite", "false"],
            repoRoot,
          )
        ) {
          throw new Error("compute-crowd-metrics failed for runId=" + runId + " variantId=" + variantId);
        }
        mark("CrowdMetrics persisted");
      }
    } else {
      // --overwrite: run decide and compute-crowd-metrics with overwrite
      variantT0 = Date.now();
      await prisma.runVariant.update({
        where: { id: variantId },
        data: { startedAt: new Date(), completedAt: null, durationMs: null },
      });
      if (
        !runWorker(
          "decide",
          [
            "--runVariantId", variantId,
            "--steps", String(argv.steps),
            "--agents", String(argv.agents),
            "--overwrite", "true",
            "--allowSmallCrowd",
            "--persist", argv.persistMode,
          ],
          repoRoot,
        )
      ) {
        throw new Error("decide failed for runId=" + runId + " variantId=" + variantId);
      }
      if (argv.persistMode === "full") {
        mark("AgentInfoState persisted");
        mark("AgentState persisted");
        mark("AgentExperience persisted");
      } else {
        mark("AgentInfoState skipped (lite)");
        mark("AgentState skipped (lite)");
        mark("AgentExperience skipped (lite)");
      }

      if (
        !runWorker(
          "compute-crowd-metrics",
          ["--runVariantId", variantId, "--overwrite", "true"],
          repoRoot,
        )
      ) {
        throw new Error("compute-crowd-metrics failed for runId=" + runId + " variantId=" + variantId);
      }
      mark("CrowdMetrics persisted");
    }

    // 7) Load AssetStepReturn; build pred/return pairs for t=0..steps-2 from crowd plurality (BUY/SELL/HOLD)
    const stepReturns = await prisma.assetStepReturn.findMany({
      where: { runId, assetSymbol },
      orderBy: { step: "asc" },
      select: { step: true, stepReturn: true },
    });

    const assetStepReturnCount = stepReturns.length;
    if (assetStepReturnCount === 0) {
      throw new Error("Cannot compute corr: AssetStepReturn count is 0 for runId=" + runId + ". Import CSV first.");
    }
    const returnByStep = new Map(stepReturns.map((r) => [r.step, r.stepReturn]));

    // Per-step predictedSign from actual decision distribution (BUY/SELL/HOLD plurality)
    const perStepCounts = await getPerStepDecisionCounts(prisma, variantId);
    const predictedSignByStep = new Map<number, number>();
    for (const [step, counts] of perStepCounts) {
      predictedSignByStep.set(step, predictedSignFromCounts(counts));
    }

    const pred: number[] = [];
    const ret1: number[] = [];
    const stepsForPairs: number[] = [];
    for (let t = 0; t <= argv.steps - 2; t++) {
      const nextRet = returnByStep.get(t + 1);
      if (nextRet == null || !Number.isFinite(nextRet)) continue;

      const counts = perStepCounts.get(t);
      const buyCount = counts?.BUY ?? 0;
      const sellCount = counts?.SELL ?? 0;
      const holdCount = counts?.HOLD ?? 0;
      let direction: "LONG" | "SHORT" | "NONE";
      if (buyCount > sellCount) {
        direction = "LONG";
      } else if (sellCount > buyCount) {
        direction = "SHORT";
      } else {
        direction = "NONE";
      }
      console.log("DEBUG TRADE MAP:", { step: t, buyCount, sellCount, holdCount, direction });

      if (direction === "NONE") continue;

      pred.push(direction === "LONG" ? 1 : -1);
      ret1.push(nextRet);
      stepsForPairs.push(t);
    }
    const pairsCount = pred.length;

    const corr: number | null = pearson(pred, ret1);
    // directionalAccuracy: correct when predictedSign == actualSign and both non-zero (predictedSign from crowd decisions)
    let directionalAccuracy: number | null = null;
    if (pairsCount > 0) {
      let correct = 0;
      for (let i = 0; i < pairsCount; i++) {
        const step = stepsForPairs[i]!;
        const r = ret1[i]!;
        const predictedSign = predictedSignByStep.get(step) ?? 0;
        const actualSign = r > 0 ? 1 : r < 0 ? -1 : 0;
        if (predictedSign !== 0 && actualSign !== 0 && predictedSign === actualSign) correct++;
      }
      directionalAccuracy = correct / pairsCount;
    }

    const corrRounded = corr != null ? round(corr, 12) : null;

    mark("simulation compute done");

    // One line per seed: runId, variantId, seed, corr, directionalAccuracy, pairsCount (corr rounded so logs and DB match)
    console.log(
      "runId=" + runId + " variantId=" + variantId + " seed=" + seed +
        " corr=" + (corrRounded != null ? String(corrRounded) : "null") +
        " directionalAccuracy=" + (directionalAccuracy != null ? directionalAccuracy.toFixed(4) : "null") +
        " pairsCount=" + pairsCount,
    );

    // Debug: decision counts + hashes and pairs sample (deterministic, seed-sensitive)
    const decisions = await prisma.agentDecision.findMany({
      where: { runVariantId: variantId },
      orderBy: [{ step: "asc" }, { agentId: "asc" }],
      select: { step: true, agentId: true, action: true },
    });
    const decisionCounts: Record<string, number> = { BUY: 0, HOLD: 0, SELL: 0 };
    for (const d of decisions) {
      if (d.action in decisionCounts) decisionCounts[d.action]++;
    }
    // Deterministic payload order: step asc, then agentId asc (pool agents; no run-scoped RunAgents)
    const decisionsPayload = decisions
      .map((d) => ({ step: d.step, agentId: d.agentId, action: d.action }))
      .sort((a, b) => a.step - b.step || a.agentId.localeCompare(b.agentId));
    const decisionsHash = createHash("sha256").update(JSON.stringify(decisionsPayload)).digest("hex");
    const returnsPayload = stepReturns.map((r) => r.stepReturn);
    const returnsHash = createHash("sha256").update(JSON.stringify(returnsPayload)).digest("hex");
    const pairsSample = stepsForPairs.slice(0, 10).map((step, i) => {
      const r = ret1[i]!;
      const predictedSign = predictedSignByStep.get(step) ?? 0;
      const actualSign = r > 0 ? 1 : r < 0 ? -1 : 0;
      return { step, r, predictedSign, actualSign };
    });

    // 8) Upsert RunVariantSummary (and BacktestResult for backward compat)
    const corrVal = corrRounded ?? 0;
    const dirAccVal = directionalAccuracy ?? 0;
    const debugPayload = {
      debugDecisionCounts: decisionCounts,
      debugPairsSample: pairsSample,
      debugDecisionsHash: decisionsHash,
      debugReturnsHash: returnsHash,
    };
    console.log(
      JSON.stringify({
        tag: "BEFORE_RUN_VARIANT_SUMMARY_UPSERT",
        seed,
        variantId,
        corrRounded,
        corrVal,
        directionalAccuracy,
        dirAccVal,
        pairsCount,
        corrIsNull: corrRounded == null,
        directionalAccuracyIsNull: directionalAccuracy == null,
        corrValIsNaN: Number.isNaN(corrVal),
        dirAccValIsNaN: Number.isNaN(dirAccVal),
        pairsCountIsNaN: Number.isNaN(pairsCount),
      }),
    );
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
    console.log(
      JSON.stringify({
        tag: "AFTER_RUN_VARIANT_SUMMARY_UPSERT",
        seed,
        variantId,
      }),
    );
    await prisma.backtestResult.deleteMany({ where: { runVariantId: variantId } });
    await prisma.backtestResult.create({
      data: {
        runId,
        runVariantId: variantId,
        assetSymbol,
        seed,
        steps: argv.steps,
        agents: argv.agents,
        pairsCount,
        corr: corrVal,
        directionalAccuracy,
      },
    });
    if (variantT0 != null) {
      const t1 = Date.now();
      await prisma.runVariant.update({
        where: { id: variantId },
        data: { completedAt: new Date(), durationMs: t1 - variantT0 },
      });
    }
    mark("RunVariant + metrics persisted");
  } catch (e) {
      const code = (e as { code?: string })?.code;
      const isP2002 = code === "P2002";
      console.error(
        JSON.stringify(
          {
            tag: "VARIANT_ITERATION_CATCH",
            seed,
            assetSymbol,
            code,
            isP2002,
            message: e instanceof Error ? e.message : String(e),
            stack: e instanceof Error ? e.stack : undefined,
          },
          null,
          2,
        ),
      );
      console.error("[backtest-v0 DIAG] full error object:", e);
      throw e;
    }
  }
  }

  const completedVariants = await prisma.runVariant.count({
    where: { runId },
  });
  const run = await prisma.simulationRun.findUnique({
    where: { id: runId },
    select: { configJson: true },
  });
  const config = (run?.configJson as { expectedVariants?: number } | null) ?? {};
  const expectedVariants =
    typeof config.expectedVariants === "number" && config.expectedVariants > 0
      ? config.expectedVariants
      : argv.symbols.length * argv.seeds.length;
  if (completedVariants >= expectedVariants) {
    // === RUN FINALIZATION VALIDATION BLOCK ===
    const runFull = await prisma.simulationRun.findUnique({
      where: { id: runId },
    });

    if (!runFull) {
      throw new Error(`Run ${runId} not found during finalization`);
    }

    const label = argv.label ?? "";
    const expectedCount = argv.symbols.length * argv.seeds.length;
    const invocationVariantWhere = {
      runId,
      label,
      assetSymbol: { in: argv.symbols },
      seed: { in: argv.seeds },
    };
    const totalRunVariantCount = await prisma.runVariant.count({
      where: { runId },
    });
    const actualMatchingSeedCount = await prisma.runVariant.count({
      where: invocationVariantWhere,
    });
    const summaryCount = await prisma.runVariantSummary.count({
      where: {
        runVariant: invocationVariantWhere,
      },
    });

    console.log(
      JSON.stringify({
        tag: "BACKTEST_V0_FINAL_VALIDATION",
        runId,
        requestedSeeds: argv.seeds,
        expectedCount,
        actualMatchingSeedCount,
        totalRunVariantCount,
      }),
    );

    if (actualMatchingSeedCount !== expectedCount) {
      throw new Error(
        `Variant count mismatch (this invocation): expected=${expectedCount} actual=${actualMatchingSeedCount}`,
      );
    }

    if (summaryCount !== expectedCount) {
      throw new Error(
        `Summary count mismatch (this invocation): expected=${expectedCount} actual=${summaryCount}`,
      );
    }

    if (actualMatchingSeedCount !== summaryCount) {
      throw new Error(
        `Variant/Summary mismatch (this invocation): variants=${actualMatchingSeedCount} summaries=${summaryCount}`,
      );
    }
    // === END VALIDATION BLOCK ===

    const runT1 = Date.now();
    await prisma.simulationRun.update({
      where: { id: runId },
      data: { runDurationMs: runT1 - (runT0 ?? 0) },
    });
    const result = await setRunStatus(prisma, runId, "COMPLETED");
    if (result.count > 0) {
      console.log(
        `Run ${runId} finalized COMPLETED (completedVariants=${completedVariants} expectedVariants=${expectedVariants})`,
      );
    }
  }
  mark("finalized COMPLETED");

  console.log("backtest-v0 done. variants=" + variantIds.length);
  } catch (e) {
    if (runId) {
      try {
        const errMsg =
          e instanceof Error ? e.message : String(e);
        const sanitized = errMsg.replace(/\s+/g, " ").trim();
        const result = await setRunStatus(prisma, runId, "FAILED", sanitized || undefined);
        if (result.count > 0) {
          console.error("Run " + runId + " status set to FAILED");
        }
      } catch (fe) {
        console.error("Failed to update run status to FAILED:", fe);
      }
    }
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
