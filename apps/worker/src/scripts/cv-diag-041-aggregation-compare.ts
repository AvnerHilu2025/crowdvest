/**
 * CV-DIAG-041: compare aggregation methods on stored AgentDecision rows (read-only).
 * Usage: npx tsx src/scripts/cv-diag-041-aggregation-compare.ts [--runId <uuid>] [--assetSymbol SPY]
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

type Action = "BUY" | "SELL" | "HOLD";

const RUN_ID_DEFAULT = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";

const LABEL_NONE =
  "cv_val034_none_syn0p4_info0p4_evt0p2_reg0p2_th0p02_ds0p7_n10000";
const LABEL_STRUCTURED =
  "cv_val040_structured_agents_syn0p4_info0p4_evt0p2_reg0p2_th0p02_ds0p7_n10000";

const BOOST = 0.05;

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
  let runId = process.env.CV_DIAG041_RUN_ID?.trim() || RUN_ID_DEFAULT;
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

function meanAbs(xs: number[]): number {
  if (xs.length === 0) return 0;
  return mean(xs.map((x) => Math.abs(x)));
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

type Side = "buy" | "sell" | "hold";

function splitBySign(signals: number[]): { buy: number[]; sell: number[]; hold: number[] } {
  const buy: number[] = [];
  const sell: number[] = [];
  const hold: number[] = [];
  for (const s of signals) {
    if (!Number.isFinite(s)) continue;
    if (s > 0) buy.push(s);
    else if (s < 0) sell.push(s);
    else hold.push(s);
  }
  return { buy, sell, hold };
}

function majoritySideFromCounts(nB: number, nS: number, nH: number): Side {
  if (nB > nS && nB > nH) return "buy";
  if (nS > nB && nS > nH) return "sell";
  return "hold";
}

function minorityBoostMean(signals: number[]): number {
  const finite = signals.filter((x) => Number.isFinite(x));
  const n = finite.length;
  if (n === 0) return 0;
  const base = mean(finite);
  const { buy, sell, hold } = splitBySign(finite);
  const nB = buy.length;
  const nS = sell.length;
  const nH = hold.length;
  const maj = majoritySideFromCounts(nB, nS, nH);
  const groups: { side: Side; vals: number[] }[] = [
    { side: "buy", vals: buy },
    { side: "sell", vals: sell },
    { side: "hold", vals: hold },
  ];
  const thr = 0.2 * n;
  const majVals = groups.find((g) => g.side === maj)!.vals;
  const majMeanAbs = meanAbs(majVals);

  let best: { side: Side; vals: number[]; meanAbs: number } | null = null;
  for (const g of groups) {
    if (g.side === maj) continue;
    if (g.vals.length < thr) continue;
    const ma = meanAbs(g.vals);
    if (best == null || ma > best.meanAbs) {
      best = { side: g.side, vals: g.vals, meanAbs: ma };
    }
  }
  if (best == null || best.meanAbs <= majMeanAbs) return base;
  const minorityMean = mean(best.vals);
  if (minorityMean === 0) return base;
  return base + BOOST * Math.sign(minorityMean);
}

type MethodName =
  | "plurality_action"
  | "mean_signal_sign"
  | "confidence_weighted_signal"
  | "trimmed_mean_signal"
  | "minority_boost_signal";

const METHODS: MethodName[] = [
  "plurality_action",
  "mean_signal_sign",
  "confidence_weighted_signal",
  "trimmed_mean_signal",
  "minority_boost_signal",
];

function forecastForMethod(m: MethodName, row: StepRow): Action {
  const { actions, signals, confidences } = row;
  switch (m) {
    case "plurality_action":
      return pluralityFromActions(actions);
    case "mean_signal_sign":
      return forecastFromMean(mean(signals.filter(Number.isFinite)));
    case "confidence_weighted_signal":
      return forecastFromMean(confidenceWeightedMean(signals, confidences));
    case "trimmed_mean_signal":
      return forecastFromMean(trimmedMean(signals));
    case "minority_boost_signal":
      return forecastFromMean(minorityBoostMean(signals));
    default:
      return "HOLD";
  }
}

async function main(): Promise<void> {
  loadEnv();
  const { runId, assetSymbol } = parseArgv();
  const prisma = new PrismaClient();

  const returns = await prisma.assetStepReturn.findMany({
    where: { runId, assetSymbol },
    select: { step: true, stepReturn: true },
    orderBy: { step: "asc" },
  });
  const retByKey = new Map<number, number>();
  for (const r of returns) retByKey.set(r.step, r.stepReturn);

  async function loadVariant(label: string): Promise<StepRow[] | null> {
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
        byStep.set(r.step, {
          step: r.step,
          actions: [a],
          signals: [sig],
          confidences: [conf],
        });
      } else {
        list.actions.push(a);
        list.signals.push(sig);
        list.confidences.push(conf);
      }
    }
    return [...byStep.values()].sort((x, y) => x.step - y.step);
  }

  const labels: { name: string; label: string }[] = [
    { name: "none (cv_val034)", label: LABEL_NONE },
    { name: "structured_agents (cv_val040)", label: LABEL_STRUCTURED },
  ];

  const bestByLabel: { name: string; best: MethodName | null; acc: number }[] = [];

  for (const { name, label } of labels) {
    console.log(`\n${"=".repeat(72)}`);
    console.log(`Label: ${label}`);
    console.log(`(${name})\n`);

    const stepRows = await loadVariant(label);
    if (!stepRows || stepRows.length === 0) {
      console.log("Variant not found or no decisions.");
      bestByLabel.push({ name, best: null, acc: 0 });
      continue;
    }

    const totals: Record<MethodName, { ok: number; tot: number }> = {
      plurality_action: { ok: 0, tot: 0 },
      mean_signal_sign: { ok: 0, tot: 0 },
      confidence_weighted_signal: { ok: 0, tot: 0 },
      trimmed_mean_signal: { ok: 0, tot: 0 },
      minority_boost_signal: { ok: 0, tot: 0 },
    };

    const stepDetails: {
      step: number;
      truth: Action;
      f: Record<MethodName, Action>;
    }[] = [];

    for (const row of stepRows) {
      const nextRet = retByKey.get(row.step + 1);
      if (nextRet == null || !Number.isFinite(nextRet)) continue;
      const truth = directionFromReturn(nextRet);
      const f = {} as Record<MethodName, Action>;
      for (const m of METHODS) {
        const fore = forecastForMethod(m, row);
        f[m] = fore;
        totals[m].tot++;
        if (fore === truth) totals[m].ok++;
      }
      stepDetails.push({ step: row.step, truth, f });
    }

    console.log("| method | accuracy |");
    console.log("|--------|----------|");
    let bestM: MethodName | null = null;
    let bestAcc = -1;
    for (const m of METHODS) {
      const t = totals[m];
      const acc = t.tot > 0 ? t.ok / t.tot : 0;
      const pct = t.tot > 0 ? `${(100 * acc).toFixed(2)}%` : "—";
      console.log(`| ${m} | ${pct} |`);
      if (t.tot > 0 && acc > bestAcc) {
        bestAcc = acc;
        bestM = m;
      }
    }
    bestByLabel.push({ name, best: bestM, acc: bestAcc });

    const first10 = stepDetails.filter((s) => s.step < 10).slice(0, 10);
    if (first10.length > 0) {
      console.log("\n| step | plurality | mean_sign | weighted | trimmed | minority_boost | actual |");
      console.log("|------|-----------|-----------|----------|---------|------------------|--------|");
      for (const s of first10) {
        console.log(
          `| ${s.step} | ${s.f.plurality_action} | ${s.f.mean_signal_sign} | ${s.f.confidence_weighted_signal} | ${s.f.trimmed_mean_signal} | ${s.f.minority_boost_signal} | ${s.truth} |`,
        );
      }
    }
  }

  await prisma.$disconnect();

  console.log(`\n${"=".repeat(72)}`);
  console.log("### Conclusion\n");
  const none = bestByLabel.find((x) => x.name.startsWith("none"));
  const str = bestByLabel.find((x) => x.name.startsWith("structured"));
  if (none?.best != null) {
    console.log(
      `- Best aggregation for **none (cv_val034)**: ${none.best} (${(100 * none.acc).toFixed(2)}% accuracy).`,
    );
  } else {
    console.log("- **none** variant missing or no scored steps.");
  }
  if (str?.best != null) {
    console.log(
      `- Best aggregation for **structured_agents (cv_val040)**: ${str.best} (${(100 * str.acc).toFixed(2)}% accuracy).`,
    );
  } else {
    console.log("- **structured_agents** variant missing or no scored steps.");
  }
  if (none?.best != null && str?.best != null) {
    const gap = str.acc - none.acc;
    const competitive =
      gap >= -0.02
        ? "Yes: best structured_agents accuracy is within ~2pp of best none accuracy (under these methods)."
        : "No: best structured_agents accuracy is still more than ~2pp below best none accuracy.";
    console.log(`- **Structured_agents competitive vs none (best method each)?** ${competitive}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
