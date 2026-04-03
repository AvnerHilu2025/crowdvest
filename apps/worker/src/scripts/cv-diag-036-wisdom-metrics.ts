/**
 * CV-DIAG-036: wisdom-style metrics — current vs none @ N=10000 (cv_val034_*).
 * Usage: npx tsx src/scripts/cv-diag-036-wisdom-metrics.ts [--runId <uuid>] [--assetSymbol SPY]
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

const RUN_ID_DEFAULT = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";
const LABEL_PREFIX = "cv_val034_";
const N_SUFFIX = "_n10000";
const HERD_MAJ_PCT = 70;
const HERD_STD_MAX = 0.05;

type Action = "BUY" | "SELL" | "HOLD";

type DecRow = {
  step: number;
  action: string;
  confidence: number;
  distortedSignal: number | null;
};

type StepAgg = {
  step: number;
  buyPct: number;
  sellPct: number;
  holdPct: number;
  majPct: number;
  pctAbsLt002: number;
  pctB0205: number;
  pctB051: number;
  pctAbsGt01: number;
  meanDist: number;
  stdDist: number;
  herd: boolean;
};

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
  let runId = process.env.CV_DIAG036_RUN_ID?.trim() || RUN_ID_DEFAULT;
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

function aggregateStep(rows: DecRow[]): Omit<StepAgg, "step"> & { n: number } {
  let buy = 0;
  let sell = 0;
  let hold = 0;
  let distN = 0;
  let distSum = 0;
  let distMeanW = 0;
  let distM2 = 0;
  let lt002 = 0;
  let b0205 = 0;
  let b051 = 0;
  let gt01 = 0;

  const n = rows.length;
  for (const r of rows) {
    if (r.action === "BUY") buy++;
    else if (r.action === "SELL") sell++;
    else hold++;
    const d = r.distortedSignal;
    if (d == null || !Number.isFinite(d)) continue;
    distN++;
    distSum += d;
    const ad = Math.abs(d);
    if (ad < 0.02) lt002++;
    else if (ad < 0.05) b0205++;
    else if (ad < 0.1) b051++;
    else gt01++;

    const dn = distN;
    const delta = d - distMeanW;
    distMeanW += delta / dn;
    const delta2 = d - distMeanW;
    distM2 += delta * delta2;
  }

  const maj = Math.max(buy, sell, hold);
  const stdDist = distN >= 2 ? Math.sqrt(distM2 / distN) : 0;
  const meanDist = distN ? distSum / distN : NaN;
  const majPct = n ? (100 * maj) / n : NaN;
  const herd = majPct > HERD_MAJ_PCT && stdDist < HERD_STD_MAX;

  return {
    n,
    buyPct: n ? (100 * buy) / n : NaN,
    sellPct: n ? (100 * sell) / n : NaN,
    holdPct: n ? (100 * hold) / n : NaN,
    majPct,
    pctAbsLt002: distN ? (100 * lt002) / distN : NaN,
    pctB0205: distN ? (100 * b0205) / distN : NaN,
    pctB051: distN ? (100 * b051) / distN : NaN,
    pctAbsGt01: distN ? (100 * gt01) / distN : NaN,
    meanDist,
    stdDist,
    herd,
  };
}

function confBucket(c: number): 0 | 1 | 2 | null {
  if (!Number.isFinite(c)) return null;
  if (c < 0.4) return 0;
  if (c < 0.7) return 1;
  return 2;
}

function fmt(x: number): string {
  if (x == null || !Number.isFinite(x)) return "n/a";
  return x.toFixed(4);
}

function fmtPct(x: number): string {
  if (x == null || !Number.isFinite(x)) return "n/a";
  return `${x.toFixed(2)}%`;
}

type Calib = { count: number; correct: number };

type ModeReport = {
  mode: string;
  label: string;
  stepRows: StepAgg[];
  meanStdSteps: number;
  meanMidBucket: number;
  herdStepCount: number;
  calib: [Calib, Calib, Calib];
};

async function buildReport(
  prisma: PrismaClient,
  runId: string,
  assetSymbol: string,
  mode: "current" | "none",
  retByKey: Map<string, number>,
): Promise<ModeReport | null> {
  const prefix = `${LABEL_PREFIX}${mode}_`;
  const v = await prisma.runVariant.findFirst({
    where: {
      runId,
      assetSymbol,
      label: { startsWith: prefix, endsWith: N_SUFFIX },
    },
    select: { id: true, label: true },
  });
  if (!v?.label) return null;

  const raw = await prisma.agentDecision.findMany({
    where: { runVariantId: v.id },
    select: { step: true, action: true, confidence: true, distortedSignal: true },
    orderBy: [{ step: "asc" }, { agentId: "asc" }],
  });

  const parsed: DecRow[] = raw.map((r) => ({
    step: r.step,
    action: String(r.action),
    confidence: r.confidence,
    distortedSignal: r.distortedSignal,
  }));

  const byStep = new Map<number, DecRow[]>();
  for (const r of parsed) {
    const list = byStep.get(r.step) ?? [];
    list.push(r);
    byStep.set(r.step, list);
  }
  const steps = [...byStep.keys()].sort((a, b) => a - b);

  const stepRows: StepAgg[] = [];
  let sumStd = 0;
  let sumMid = 0;
  let herdStepCount = 0;
  const calib: [Calib, Calib, Calib] = [
    { count: 0, correct: 0 },
    { count: 0, correct: 0 },
    { count: 0, correct: 0 },
  ];

  for (const st of steps) {
    const agg = aggregateStep(byStep.get(st)!);
    sumStd += agg.stdDist;
    sumMid += agg.pctB0205 + agg.pctB051;
    if (agg.herd) herdStepCount++;
    stepRows.push({
      step: st,
      buyPct: agg.buyPct,
      sellPct: agg.sellPct,
      holdPct: agg.holdPct,
      majPct: agg.majPct,
      pctAbsLt002: agg.pctAbsLt002,
      pctB0205: agg.pctB0205,
      pctB051: agg.pctB051,
      pctAbsGt01: agg.pctAbsGt01,
      meanDist: agg.meanDist,
      stdDist: agg.stdDist,
      herd: agg.herd,
    });
  }

  const stepCount = steps.length || 1;
  for (const r of parsed) {
    const nextRet = retByKey.get(`${assetSymbol}:${r.step + 1}`);
    if (nextRet == null || !Number.isFinite(nextRet)) continue;
    const b = confBucket(r.confidence);
    if (b === null) continue;
    const truth = directionFromReturn(nextRet);
    calib[b].count++;
    if (r.action === truth) calib[b].correct++;
  }

  return {
    mode,
    label: v.label,
    stepRows,
    meanStdSteps: sumStd / stepCount,
    meanMidBucket: sumMid / stepCount,
    herdStepCount,
    calib,
  };
}

function printModeTable(rep: ModeReport): void {
  console.log(`\n### Mode: ${rep.mode}`);
  console.log(`Label: ${rep.label}\n`);
  console.log(
    "| step | maj% | BUY% | SELL% | HOLD% | |d|<0.02 | 0.02–0.05 | 0.05–0.1 | >0.1 | mean(dist) | std(dist) | HERD |",
  );
  console.log(
    "|------|------|------|-------|-------|--------|-----------|----------|------|------------|-----------|------|",
  );
  for (const s of rep.stepRows) {
    console.log(
      `| ${s.step} | ${fmtPct(s.majPct)} | ${fmtPct(s.buyPct)} | ${fmtPct(s.sellPct)} | ${fmtPct(s.holdPct)} | ${fmtPct(s.pctAbsLt002)} | ${fmtPct(s.pctB0205)} | ${fmtPct(s.pctB051)} | ${fmtPct(s.pctAbsGt01)} | ${fmt(s.meanDist)} | ${fmt(s.stdDist)} | ${s.herd ? "yes" : "no"} |`,
    );
  }

  const bNames = ["[0,0.4)", "[0.4,0.7)", "[0.7,1.0]"] as const;
  console.log("\n**Confidence calibration** (next-step return direction vs action)\n");
  console.log("| bucket | n | accuracy |");
  console.log("|--------|---|----------|");
  for (let i = 0; i < 3; i++) {
    const c = rep.calib[i]!;
    const acc = c.count ? (100 * c.correct) / c.count : NaN;
    console.log(`| ${bNames[i]} | ${c.count} | ${fmtPct(acc)} |`);
  }
}

async function main(): Promise<void> {
  loadEnv();
  const { runId, assetSymbol } = parseArgv();
  const prisma = new PrismaClient();

  console.log("=== CV-DIAG-036 Wisdom metrics (read-only) ===\n");
  console.log(
    [
      "Fields: AgentDecision.step, action, confidence, distortedSignal.",
      "Ground truth: AssetStepReturn at step+1 vs action (BUY if return>0, SELL if <0, else HOLD).",
      `HERD step: majority > ${HERD_MAJ_PCT}% and std(|dist| population over agents with finite distortedSignal) < ${HERD_STD_MAX}.`,
      `Labels: ${LABEL_PREFIX}<current|none>_*${N_SUFFIX}`,
    ].join("\n"),
  );

  const returns = await prisma.assetStepReturn.findMany({
    where: { runId, assetSymbol },
    select: { step: true, stepReturn: true },
  });
  const retByKey = new Map<string, number>();
  for (const r of returns) retByKey.set(`${assetSymbol}:${r.step}`, r.stepReturn);

  const cur = await buildReport(prisma, runId, assetSymbol, "current", retByKey);
  const none = await buildReport(prisma, runId, assetSymbol, "none", retByKey);
  await prisma.$disconnect();

  if (!cur) console.log("\n**current**: no RunVariant found.\n");
  else printModeTable(cur);
  if (!none) console.log("\n**none**: no RunVariant found.\n");
  else printModeTable(none);

  if (cur && none) {
    console.log(`\n${"=".repeat(72)}`);
    console.log("### Summary (compare)\n");
    const varWinner =
      cur.meanStdSteps > none.meanStdSteps
        ? "current (higher mean per-step std of distortedSignal)"
        : none.meanStdSteps > cur.meanStdSteps
          ? "none"
          : "tie";
    const midWinner =
      cur.meanMidBucket > none.meanMidBucket
        ? "current (higher mean % in 0.02–0.05 + 0.05–0.1 |d| bins)"
        : none.meanMidBucket > cur.meanMidBucket
          ? "none"
          : "tie";
    const moreHerd =
      cur.herdStepCount > none.herdStepCount
        ? `current (${cur.herdStepCount} vs ${none.herdStepCount})`
        : none.herdStepCount > cur.herdStepCount
          ? `none (${none.herdStepCount} vs ${cur.herdStepCount})`
          : `tie (${cur.herdStepCount})`;
    const calAcc = (c: [Calib, Calib, Calib]) =>
      c.reduce((s, x) => s + x.correct, 0) / Math.max(1, c.reduce((s, x) => s + x.count, 0));
    const wCur = calAcc(cur.calib);
    const wNone = calAcc(none.calib);
    const calWinner =
      wCur > wNone
        ? "current (higher pooled accuracy over calibrated rows)"
        : wNone > wCur
          ? "none"
          : "tie";
    console.log(`- **Higher variance** (mean per-step std): ${varWinner}.`);
    console.log(`- **More mid-strength |signal|** (0.02–0.1 bucket %, mean over steps): ${midWinner}.`);
    console.log(
      `- **More HERD steps** (maj>${HERD_MAJ_PCT}% & std<${HERD_STD_MAX}): ${moreHerd}.`,
    );
    console.log(`- **Calibration** (pooled next-step direction match): ${calWinner}.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
