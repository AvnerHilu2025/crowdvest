/**
 * CV-DIAG-044: conviction-aware evaluation (structured_agents n=10000, mean_signal_sign variants).
 * Usage: npx tsx src/scripts/cv-diag-044-conviction.ts [--runId <uuid>] [--assetSymbol SPY]
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

type Action = "BUY" | "SELL" | "HOLD";

const RUN_ID_DEFAULT = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";

const LABEL =
  "cv_val040_structured_agents_syn0p4_info0p4_evt0p2_reg0p2_th0p02_ds0p7_n10000";

const ABS_MEAN_THRESHOLD = 0.01;
const S2N_THRESHOLD = 0.5;

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
  let runId = process.env.CV_DIAG044_RUN_ID?.trim() || RUN_ID_DEFAULT;
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

function forecastBaseline(mean: number): Action {
  if (mean > 0) return "BUY";
  if (mean < 0) return "SELL";
  return "HOLD";
}

function forecastThresholded(mean: number): Action {
  if (Math.abs(mean) < ABS_MEAN_THRESHOLD) return "HOLD";
  return forecastBaseline(mean);
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

type StepAgg = {
  step: number;
  mean: number;
  std: number;
  absMean: number;
  s2n: number;
  truth: Action;
};

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
    aggs.push({ step, mean: m, std: sd, absMean, s2n, truth });
  }

  const n = aggs.length;
  let okBase = 0;
  let okThresh = 0;
  let okHigh = 0;
  let nHigh = 0;

  for (const a of aggs) {
    const fb = forecastBaseline(a.mean);
    if (fb === a.truth) okBase++;

    const ft = forecastThresholded(a.mean);
    if (ft === a.truth) okThresh++;

    const high = a.s2n > S2N_THRESHOLD;
    if (high) {
      nHigh++;
      if (fb === a.truth) okHigh++;
    }
  }

  const accBase = n > 0 ? okBase / n : 0;
  const accThresh = n > 0 ? okThresh / n : 0;
  const accHigh = nHigh > 0 ? okHigh / nHigh : 0;
  const coverageHigh = n > 0 ? nHigh / n : 0;

  console.log("=== CV-DIAG-044 conviction (structured_agents n=10000) ===\n");
  console.log(`runId=${runId} assetSymbol=${assetSymbol}`);
  console.log(`label=${LABEL}`);
  console.log(`|mean|<${ABS_MEAN_THRESHOLD} → HOLD (thresholded); s2n>${S2N_THRESHOLD} = high conviction\n`);

  console.log("### 1. Summary table\n");
  console.log("| mode | accuracy | coverage |");
  console.log("|------|----------|----------|");
  console.log(
    `| baseline_mean_sign | ${(100 * accBase).toFixed(2)}% | 100.00% |`,
  );
  console.log(
    `| thresholded_mean_sign | ${(100 * accThresh).toFixed(2)}% | 100.00% |`,
  );
  console.log(
    `| high_conviction_only | ${nHigh > 0 ? `${(100 * accHigh).toFixed(2)}%` : "—"} | ${(100 * coverageHigh).toFixed(2)}% |`,
  );

  console.log("\n### 2. Per-step (decision = baseline_mean_sign)\n");
  console.log("| step | mean | std | s2n | decision | actual |");
  console.log("|------|------|-----|-----|----------|--------|");
  for (const a of aggs) {
    const db = forecastBaseline(a.mean);
    const s2nStr =
      Number.isFinite(a.s2n) && a.s2n !== Number.POSITIVE_INFINITY
        ? a.s2n.toFixed(4)
        : a.s2n === Number.POSITIVE_INFINITY
          ? "inf"
          : String(a.s2n);
    console.log(
      `| ${a.step} | ${a.mean.toFixed(6)} | ${a.std.toFixed(6)} | ${s2nStr} | ${db} | ${a.truth} |`,
    );
  }

  const pctHigh = 100 * coverageHigh;

  console.log("\n### 3. Summary\n");
  console.log(
    `- Does filtering low-conviction (thresholded |mean|) improve accuracy vs baseline? ${accThresh > accBase ? "Yes" : accThresh < accBase ? "No" : "Same"} (${(100 * accThresh).toFixed(2)}% vs ${(100 * accBase).toFixed(2)}%).`,
  );
  console.log(
    `- High-conviction steps (s2n > ${S2N_THRESHOLD}): ${pctHigh.toFixed(2)}% of scored steps (${nHigh}/${n}).`,
  );
  if (nHigh > 0) {
    console.log(
      `- High-conviction-only accuracy vs baseline: ${(100 * accHigh).toFixed(2)}% on ${nHigh} steps vs ${(100 * accBase).toFixed(2)}% on ${n} steps — ${accHigh > accBase ? "improves on filtered subset" : accHigh < accBase ? "worse on filtered subset" : "unchanged"}.`,
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
