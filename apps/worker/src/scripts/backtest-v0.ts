/**
 * CLI: pnpm -C apps/worker run backtest-v0 -- --symbol SPY --from 2018-01-01 --to 2019-12-31 --window 60 --stride 5 --agents 500 --seed 123
 * Backtesting v0: loads PriceSeriesPoint, computes returns, runs windows; decide, metrics, rewards; corr/hitRate -> BacktestWindowResult.
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

function parseArgv(): { symbol: string; from: string; to: string; window: number; stride: number; agents: number; seed: number } {
  const args = process.argv.slice(2);
  let symbol = "SPY", from = "2018-01-01", to = "2019-12-31";
  let window = 60, stride = 5, agents = 500, seed = 123;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--symbol" && args[i + 1]) {
      symbol = String(args[++i]).trim().toUpperCase() || "SPY";
    } else if (args[i] === "--from" && args[i + 1]) from = String(args[++i]).trim();
    else if (args[i] === "--to" && args[i + 1]) to = String(args[++i]).trim();
    else if (args[i] === "--window" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n) && n >= 2) window = n;
    } else if (args[i] === "--stride" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n) && n >= 1) stride = n;
    } else if (args[i] === "--agents" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n) && n >= 1) agents = n;
    } else if (args[i] === "--seed" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n)) seed = n;
    }
  }
  return { symbol, from, to, window, stride, agents, seed };
}

async function resolveDatasetVersion(prisma: PrismaClient): Promise<string> {
  const r = await prisma.simulationRun.findFirst({
    orderBy: { createdAt: "desc" },
    select: { datasetVersion: true },
  });
  if (r) return r.datasetVersion;
  const imp = await prisma.importRun.findFirst({
    where: { type: "archetypes" },
    orderBy: { startedAt: "desc" },
    select: { sourceHash: true },
  });
  if (imp?.sourceHash) return imp.sourceHash;
  throw new Error("No datasetVersion. Run seed first.");
}

function correlation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  const n = x.length;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i]!; sy += y[i]!;
    sxy += x[i]! * y[i]!; sx2 += x[i]! * x[i]!; sy2 += y[i]! * y[i]!;
  }
  const num = n * sxy - sx * sy;
  const den = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy));
  return den === 0 ? 0 : num / den;
}

function runWorker(
  script: "decide" | "compute-crowd-metrics" | "compute-rewards",
  extra: string[],
  root: string,
): boolean {
  const r = spawnSync("pnpm", ["--filter", "worker", "run", script, "--", ...extra], { stdio: "inherit", cwd: root });
  return r.status === 0;
}

async function main(): Promise<void> {
  loadEnv();
  const argv = parseArgv();
  const root = path.resolve(process.cwd(), "..");
  const prisma = new PrismaClient();

  const points = await prisma.priceSeriesPoint.findMany({
    where: { symbol: argv.symbol, date: { gte: argv.from, lte: argv.to } },
    orderBy: { date: "asc" },
    select: { date: true, close: true },
  });
  if (points.length < 2) {
    throw new Error("Not enough PriceSeriesPoint. Upload via POST /datasets/price-series.");
  }

  const returns: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1]!.close;
    const c = points[i]!.close;
    if (p !== 0) returns.push((c - p) / p);
  }
  if (returns.length < argv.window) {
    throw new Error("Returns length " + returns.length + " < window " + argv.window);
  }

  const datasetVersion = await resolveDatasetVersion(prisma);
  const apiBase = (process.env.API_BASE ?? "http://localhost:4001").replace(/\/$/, "");
  const MODEL_VERSION = "stage1";
  const SCHEMA_VERSION = "v1";
  let ok = 0, fail = 0;

  for (let start = 0; start + argv.window <= returns.length; start += argv.stride) {
    const windowReturns = returns.slice(start, start + argv.window);
    const fromDate = points[start]!.date;
    const toDate = points[Math.min(start + argv.window, points.length - 1)]!.date;
    const runName = "backtest-v0-" + argv.symbol + "-" + fromDate + "-w" + argv.window + "-" + start;

    const run = await prisma.simulationRun.create({
      data: {
        name: runName,
        status: "PENDING",
        seed: argv.seed,
        modelVersion: MODEL_VERSION,
        datasetVersion,
        schemaVersion: SCHEMA_VERSION,
        startedAt: new Date(),
      },
    });
    const runId = run.id;

    const genRes = await fetch(
      apiBase + "/agents/generate?runId=" + encodeURIComponent(runId) + "&overwrite=true",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: argv.agents, seed: argv.seed }) },
    );
    if (!genRes.ok) {
      await prisma.simulationRun.delete({ where: { id: runId } }).catch(() => {});
      fail++;
      continue;
    }

    await prisma.assetStepReturn.createMany({
      data: windowReturns.map((stepReturn, step) => ({ runId, assetSymbol: argv.symbol, step, stepReturn })),
      skipDuplicates: true,
    });

    if (!runWorker("decide", ["--runId", runId, "--steps", String(argv.window), "--assetSymbol", argv.symbol, "--seed", String(argv.seed), "--overwrite", "--allowSmallCrowd"], root)) {
      fail++; continue;
    }
    if (!runWorker("compute-crowd-metrics", ["--runId", runId, "--assetSymbol", argv.symbol], root)) {
      fail++; continue;
    }
    if (!runWorker("compute-rewards", ["--runId", runId, "--assetSymbol", argv.symbol, "--steps", String(argv.window), "--seed", String(argv.seed), "--overwrite", "true"], root)) {
      fail++; continue;
    }

    const [metrics, stepReturns] = await Promise.all([
      prisma.crowdMetrics.findMany({
        where: { runId, assetSymbol: argv.symbol },
        orderBy: { step: "asc" },
        select: { step: true, weightedSignal: true },
      }),
      prisma.assetStepReturn.findMany({
        where: { runId, assetSymbol: argv.symbol },
        orderBy: { step: "asc" },
        select: { step: true, stepReturn: true },
      }),
    ]);
    const byStep = new Map(stepReturns.map((r) => [r.step, r.stepReturn]));
    const sig: number[] = [];
    const fwd: number[] = [];
    for (const m of metrics) {
      const next = byStep.get(m.step + 1);
      if (next === undefined) continue;
      sig.push(m.weightedSignal);
      fwd.push(next);
    }
    const corr = sig.length >= 2 ? correlation(sig, fwd) : 0;
    let hits = 0;
    for (let i = 0; i < sig.length; i++) {
      if (Math.sign(sig[i]!) === Math.sign(fwd[i]!)) hits++;
    }
    const hitRate = sig.length > 0 ? hits / sig.length : 0;

    await prisma.backtestWindowResult.create({
      data: { symbol: argv.symbol, runId, fromDate, toDate, window: argv.window, stride: argv.stride, agents: argv.agents, seed: argv.seed, corr, hitRate },
    });
    console.log("Window start=" + start + " corr=" + corr.toFixed(4) + " hitRate=" + hitRate.toFixed(4));
    ok++;
  }
  console.log("backtest-v0 done. success=" + ok + " fail=" + fail);
}

main().catch((e) => { console.error(e); process.exit(1); });
