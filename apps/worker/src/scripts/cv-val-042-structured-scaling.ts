/**
 * CV-VAL-042: structured_agents accuracy vs crowd size (read-only; DIAG-041 aggregations).
 * Usage: npx tsx src/scripts/cv-val-042-structured-scaling.ts [--runId <uuid>] [--assetSymbol SPY]
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

type Action = "BUY" | "SELL" | "HOLD";

const RUN_ID_DEFAULT = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";

const LABEL_BY_N: Record<100 | 2000 | 10000, string> = {
  100: "cv_val040_structured_agents_syn0p4_info0p4_evt0p2_reg0p2_th0p02_ds0p7_n100",
  2000: "cv_val040_structured_agents_syn0p4_info0p4_evt0p2_reg0p2_th0p02_ds0p7_n2000",
  10000: "cv_val040_structured_agents_syn0p4_info0p4_evt0p2_reg0p2_th0p02_ds0p7_n10000",
};

const NS = [100, 2000, 10_000] as const;

type AggName =
  | "plurality_action"
  | "mean_signal_sign"
  | "confidence_weighted_signal"
  | "trimmed_mean_signal";

const AGGREGATIONS: AggName[] = [
  "plurality_action",
  "mean_signal_sign",
  "confidence_weighted_signal",
  "trimmed_mean_signal",
];

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
  let runId = process.env.CV_VAL042_RUN_ID?.trim() || RUN_ID_DEFAULT;
  let assetSymbol = "SPY";
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--runId" && a[i + 1]) runId = a[++i]!.trim();
    else if (a[i] === "--assetSymbol" && a[i + 1]) assetSymbol = a[++i]!.trim() || "SPY";
  }
  return { runId, assetSymbol };
}

function majorityDirection(buy: number, sell: number, hold: number): Action {
  const m = Math.max(buy, sell, hold);
  if (buy === m && buy > sell && buy > hold) return "BUY";
  if (sell === m && sell > buy && sell > hold) return "SELL";
  return "HOLD";
}

function directionFromReturn(stepReturn: number): Action {
  if (stepReturn > 0) return "BUY";
  if (stepReturn < 0) return "SELL";
  return "HOLD";
}

function forecastFromMean(m: number): Action {
  if (m > 0) return "BUY";
  if (m < 0) return "SELL";
  return "HOLD";
}

type StepRow = {
  step: number;
  actions: Action[];
  signals: number[];
  confidences: number[];
};

function pluralityFromActions(actions: Action[]): Action {
  const c = { BUY: 0, SELL: 0, HOLD: 0 };
  for (const a of actions) c[a]++;
  return majorityDirection(c.BUY, c.SELL, c.HOLD);
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function confidenceWeightedMean(signals: number[], confidences: number[]): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < signals.length; i++) {
    const s = signals[i]!;
    const c = confidences[i]!;
    if (!Number.isFinite(s) || !Number.isFinite(c) || c <= 0) continue;
    num += s * c;
    den += c;
  }
  if (den <= 0) return 0;
  return num / den;
}

function trimmedMean(signals: number[]): number {
  const xs = signals.filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
  const n = xs.length;
  if (n === 0) return 0;
  const k = Math.floor(n * 0.1);
  if (k <= 0) return mean(xs);
  const slice = xs.slice(k, n - k);
  return slice.length === 0 ? mean(xs) : mean(slice);
}

function forecastAgg(agg: AggName, row: StepRow): Action {
  const { actions, signals, confidences } = row;
  switch (agg) {
    case "plurality_action":
      return pluralityFromActions(actions);
    case "mean_signal_sign":
      return forecastFromMean(mean(signals.filter(Number.isFinite)));
    case "confidence_weighted_signal":
      return forecastFromMean(confidenceWeightedMean(signals, confidences));
    case "trimmed_mean_signal":
      return forecastFromMean(trimmedMean(signals));
    default:
      return "HOLD";
  }
}

async function accuracyForLabel(
  prisma: PrismaClient,
  runId: string,
  assetSymbol: string,
  label: string,
  agg: AggName,
  retByKey: Map<string, number>,
): Promise<number | null> {
  const v = await prisma.runVariant.findFirst({
    where: { runId, assetSymbol, label },
    select: { id: true },
  });
  if (!v) return null;

  const rows = await prisma.agentDecision.findMany({
    where: { runVariantId: v.id },
    select: { step: true, action: true, distortedSignal: true, confidence: true },
    orderBy: [{ step: "asc" }, { agentId: "asc" }],
  });

  const byStep = new Map<number, StepRow>();
  for (const r of rows) {
    const a = r.action as Action;
    const sig =
      r.distortedSignal != null && Number.isFinite(r.distortedSignal) ? r.distortedSignal : NaN;
    const conf = typeof r.confidence === "number" && Number.isFinite(r.confidence) ? r.confidence : 0.5;
    const list = byStep.get(r.step);
    if (!list) {
      byStep.set(r.step, { step: r.step, actions: [a], signals: [sig], confidences: [conf] });
    } else {
      list.actions.push(a);
      list.signals.push(sig);
      list.confidences.push(conf);
    }
  }

  let ok = 0;
  let tot = 0;
  for (const row of byStep.values()) {
    const nextRet = retByKey.get(`${assetSymbol}:${row.step + 1}`);
    if (nextRet == null || !Number.isFinite(nextRet)) continue;
    const truth = directionFromReturn(nextRet);
    const fore = forecastAgg(agg, row);
    tot++;
    if (fore === truth) ok++;
  }
  return tot > 0 ? ok / tot : null;
}

async function main(): Promise<void> {
  loadEnv();
  const { runId, assetSymbol } = parseArgv();
  const prisma = new PrismaClient();

  const returns = await prisma.assetStepReturn.findMany({
    where: { runId, assetSymbol },
    select: { step: true, stepReturn: true },
  });
  const retByKey = new Map<string, number>();
  for (const r of returns) retByKey.set(`${assetSymbol}:${r.step}`, r.stepReturn);

  const lines: string[] = [];
  lines.push("| aggregation | 100 | 2000 | 10000 |");
  lines.push("|-------------|-----|------|-------|");

  for (const agg of AGGREGATIONS) {
    const cells: string[] = [];
    for (const n of NS) {
      const label = LABEL_BY_N[n];
      const acc = await accuracyForLabel(prisma, runId, assetSymbol, label, agg, retByKey);
      cells.push(acc == null ? "—" : `${(100 * acc).toFixed(2)}%`);
    }
    lines.push(`| ${agg} | ${cells.join(" | ")} |`);
  }

  await prisma.$disconnect();
  console.log(lines.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
