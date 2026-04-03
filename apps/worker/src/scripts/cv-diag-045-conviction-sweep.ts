/**
 * CV-DIAG-045: sweep conviction thresholds for structured_agents n=10000 (read-only).
 * Usage: npx tsx src/scripts/cv-diag-045-conviction-sweep.ts [--runId <uuid>] [--assetSymbol SPY]
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

type Action = "BUY" | "SELL" | "HOLD";

const RUN_ID_DEFAULT = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";

const LABEL =
  "cv_val040_structured_agents_syn0p4_info0p4_evt0p2_reg0p2_th0p02_ds0p7_n10000";

const ABS_MEAN_THRESHOLDS = [0.002, 0.005, 0.01] as const;
const S2N_THRESHOLDS = [0.05, 0.1, 0.15, 0.2] as const;

const BASELINE_REF_PCT = 65;
const REASONABLE_COVERAGE_MIN = 0.3;

function loadEnv(): void {
  const repoRoot = path.resolve(__dirname, "../../../../.env");
  try {
    if (!fs.existsSync(repoRoot)) return;
    const content = fs.readFileSync(repoRoot, "utf8");
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

function parseArgv(): { runId: string; assetSymbol: string } {
  const a = process.argv.slice(2);
  let runId = process.env.CV_DIAG045_RUN_ID?.trim() || RUN_ID_DEFAULT;
  let assetSymbol = "SPY";
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--runId" && a[i + 1]) runId = a[++i]!.trim();
    else if (a[i] === "--assetSymbol" && a[i + 1]) assetSymbol = a[++i]!.trim() || "SPY";
  }
  return { runId, assetSymbol };
}

function directionFromReturn(stepReturn: number): Action {
  if (stepReturn > 0) return "BUY";
  if (stepReturn < 0) return "SELL";
  return "HOLD";
}

function forecastSign(mean: number): Action {
  if (mean > 0) return "BUY";
  if (mean < 0) return "SELL";
  return "HOLD";
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function stdPop(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

function signalToNoise(absMean: number, std: number): number {
  if (std > 1e-12) return absMean / std;
  return absMean > 0 ? Number.POSITIVE_INFINITY : 0;
}

type StepAgg = { mean: number; absMean: number; s2n: number; truth: Action };

type RowOut = { method: string; threshold: string; accuracy: number; coverage: number };

async function main(): Promise<void> {
  loadEnv();
  const { runId, assetSymbol } = parseArgv();
  const prisma = new PrismaClient();

  const v = await prisma.runVariant.findFirst({
    where: { runId, assetSymbol, label: LABEL },
    select: { id: true },
  });
  if (!v) {
    console.error(`Variant not found: runId=${runId} label=${LABEL}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const returns = await prisma.assetStepReturn.findMany({
    where: { runId, assetSymbol },
    select: { step: true, stepReturn: true },
    orderBy: { step: "asc" },
  });
  const retByKey = new Map<string, number>();
  for (const r of returns) retByKey.set(`${assetSymbol}:${r.step}`, r.stepReturn);

  const rows = await prisma.agentDecision.findMany({
    where: { runVariantId: v.id },
    select: { step: true, distortedSignal: true },
    orderBy: [{ step: "asc" }, { agentId: "asc" }],
  });

  const byStep = new Map<number, number[]>();
  for (const r of rows) {
    const sig =
      r.distortedSignal != null && Number.isFinite(r.distortedSignal) ? r.distortedSignal : NaN;
    const list = byStep.get(r.step) ?? [];
    list.push(sig);
    byStep.set(r.step, list);
  }

  const aggs: StepAgg[] = [];
  for (const [step, signals] of [...byStep.entries()].sort((a, b) => a[0] - b[0])) {
    const finite = signals.filter(Number.isFinite);
    const m = mean(finite);
    const sd = stdPop(finite);
    const absMean = Math.abs(m);
    const s2n = signalToNoise(absMean, sd);
    const nextRet = retByKey.get(`${assetSymbol}:${step + 1}`);
    if (nextRet == null || !Number.isFinite(nextRet)) continue;
    const truth = directionFromReturn(nextRet);
    aggs.push({ mean: m, absMean, s2n, truth });
  }

  const n = aggs.length;
  const outRows: RowOut[] = [];

  let okBase = 0;
  for (const a of aggs) {
    if (forecastSign(a.mean) === a.truth) okBase++;
  }
  const accBase = n > 0 ? okBase / n : 0;
  outRows.push({
    method: "baseline_mean_sign",
    threshold: "—",
    accuracy: accBase,
    coverage: 1,
  });

  for (const th of ABS_MEAN_THRESHOLDS) {
    let ok = 0;
    let inc = 0;
    for (const a of aggs) {
      if (a.absMean < th) continue;
      inc++;
      if (forecastSign(a.mean) === a.truth) ok++;
    }
    const cov = n > 0 ? inc / n : 0;
    const acc = inc > 0 ? ok / inc : 0;
    outRows.push({
      method: "abs_mean_threshold",
      threshold: String(th),
      accuracy: acc,
      coverage: cov,
    });
  }

  for (const th of S2N_THRESHOLDS) {
    let ok = 0;
    let inc = 0;
    for (const a of aggs) {
      const s2nForCmp = Number.isFinite(a.s2n)
        ? a.s2n
        : a.s2n === Number.POSITIVE_INFINITY
          ? Number.POSITIVE_INFINITY
          : -1;
      if (s2nForCmp <= th) continue;
      inc++;
      if (forecastSign(a.mean) === a.truth) ok++;
    }
    const cov = n > 0 ? inc / n : 0;
    const acc = inc > 0 ? ok / inc : 0;
    outRows.push({
      method: "s2n_threshold",
      threshold: String(th),
      accuracy: acc,
      coverage: cov,
    });
  }

  console.log("=== CV-DIAG-045 conviction sweep (structured_agents n=10000) ===\n");
  console.log(`runId=${runId} assetSymbol=${assetSymbol}`);
  console.log(`label=${LABEL}\n`);

  console.log("| method | threshold | accuracy | coverage |");
  console.log("|--------|-----------|----------|----------|");
  for (const r of outRows) {
    console.log(
      `| ${r.method} | ${r.threshold} | ${(100 * r.accuracy).toFixed(2)}% | ${(100 * r.coverage).toFixed(2)}% |`,
    );
  }

  const absRows = outRows.filter((r) => r.method === "abs_mean_threshold");
  const s2nRows = outRows.filter((r) => r.method === "s2n_threshold");

  const bestAbs = absRows.reduce(
    (b, r) => (r.accuracy > b.accuracy ? r : b),
    absRows[0]!,
  );
  const bestS2n = s2nRows.reduce(
    (b, r) => (r.accuracy > b.accuracy ? r : b),
    s2nRows[0]!,
  );

  const baselinePct = 100 * accBase;
  const refCut = BASELINE_REF_PCT / 100;
  const improves = outRows.filter(
    (r) =>
      r.method !== "baseline_mean_sign" &&
      r.coverage >= REASONABLE_COVERAGE_MIN &&
      r.accuracy > refCut,
  );

  console.log("\n### Conclusion\n");
  console.log(`- Best abs_mean_threshold sweep: ${bestAbs.threshold} (${(100 * bestAbs.accuracy).toFixed(2)}% acc, ${(100 * bestAbs.coverage).toFixed(2)}% coverage).`);
  console.log(`- Best s2n_threshold sweep: ${bestS2n.threshold} (${(100 * bestS2n.accuracy).toFixed(2)}% acc, ${(100 * bestS2n.coverage).toFixed(2)}% coverage).`);

  const beatsRef =
    improves.length > 0
      ? `Yes: ${improves.length} configuration(s) exceed ${BASELINE_REF_PCT}% with coverage≥${(100 * REASONABLE_COVERAGE_MIN).toFixed(0)}% (baseline here: ${baselinePct.toFixed(2)}%).`
      : `No sweep row exceeds ${BASELINE_REF_PCT}% with coverage≥${(100 * REASONABLE_COVERAGE_MIN).toFixed(0)}% (baseline this run: ${baselinePct.toFixed(2)}%).`;
  console.log(`- Beat ${BASELINE_REF_PCT}% with reasonable coverage? ${beatsRef}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
