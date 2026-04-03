/**
 * CV-DIAG-040: independence-style proxies (none vs cv_val040 structured_agents @ n=10000).
 * Usage: npx tsx src/scripts/cv-diag-040-independence.ts [--runId <uuid>] [--assetSymbol SPY]
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

const RUN_ID_DEFAULT = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";

const LABEL_NONE = "cv_val034_none_syn0p4_info0p4_evt0p2_reg0p2_th0p02_ds0p7_n10000";
const LABEL_040 = "cv_val040_structured_agents_syn0p4_info0p4_evt0p2_reg0p2_th0p02_ds0p7_n10000";

const BIN_LABELS = [
  "[-1,-0.1)",
  "[-0.1,-0.02)",
  "[-0.02,0.02]",
  "(0.02,0.1]",
  "(0.1,1]",
  "other",
] as const;

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
  let runId = process.env.CV_DIAG040_RUN_ID?.trim() || RUN_ID_DEFAULT;
  let assetSymbol = "SPY";
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--runId" && a[i + 1]) runId = a[++i]!.trim();
    else if (a[i] === "--assetSymbol" && a[i + 1]) assetSymbol = a[++i]!.trim() || "SPY";
  }
  return { runId, assetSymbol };
}

/** Welford population variance (divide by n). */
function welfordVariance(xs: number[]): { mean: number; variance: number; n: number } {
  if (xs.length === 0) return { mean: NaN, variance: NaN, n: 0 };
  let mean = 0;
  let m2 = 0;
  let n = 0;
  for (const x of xs) {
    n++;
    const d = x - mean;
    mean += d / n;
    const d2 = x - mean;
    m2 += d * d2;
  }
  return { mean, variance: n >= 1 ? m2 / n : NaN, n };
}

function varianceOfArray(vals: number[]): number {
  if (vals.length < 2) return NaN;
  let mean = 0;
  let m2 = 0;
  let n = 0;
  for (const x of vals) {
    n++;
    const d = x - mean;
    mean += d / n;
    const d2 = x - mean;
    m2 += d * d2;
  }
  return m2 / n;
}

function binIndex(x: number): number {
  if (x >= -1 && x < -0.1) return 0;
  if (x >= -0.1 && x < -0.02) return 1;
  if (x >= -0.02 && x <= 0.02) return 2;
  if (x > 0.02 && x <= 0.1) return 3;
  if (x > 0.1 && x <= 1) return 4;
  return 5;
}

function entropyFromCounts(counts: number[], total: number): number {
  if (total <= 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c <= 0) continue;
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return h;
}

type StepStats = {
  step: number;
  n: number;
  meanDist: number;
  varDist: number;
  binPct: number[];
  entropy: number;
  activeBinsGt5: number;
};

type ModeStats = {
  mode: string;
  label: string;
  steps: StepStats[];
  corrProxy: number;
  meanVarWithin: number;
  meanEntropy: number;
  meanActiveBins: number;
};

function fmt(x: number): string {
  if (x == null || !Number.isFinite(x)) return "n/a";
  return x.toFixed(6);
}

function fmtPct(x: number): string {
  if (x == null || !Number.isFinite(x)) return "n/a";
  return `${x.toFixed(2)}%`;
}

function aggregateVariant(rows: { step: number; distortedSignal: number | null }[]): StepStats[] {
  const byStep = new Map<number, number[]>();
  for (const r of rows) {
    if (r.distortedSignal == null || !Number.isFinite(r.distortedSignal)) continue;
    const list = byStep.get(r.step) ?? [];
    list.push(r.distortedSignal);
    byStep.set(r.step, list);
  }
  const stepNums = [...byStep.keys()].sort((a, b) => a - b);
  const out: StepStats[] = [];
  for (const st of stepNums) {
    const xs = byStep.get(st)!;
    const { mean, variance, n } = welfordVariance(xs);
    const counts = [0, 0, 0, 0, 0, 0];
    for (const x of xs) {
      counts[binIndex(x)]++;
    }
    const total = n;
    const binPct = counts.map((c) => (total ? (100 * c) / total : 0));
    const ent = entropyFromCounts(counts, total);
    let active = 0;
    for (const c of counts) {
      if (total && c / total > 0.05) active++;
    }
    out.push({
      step: st,
      n,
      meanDist: mean,
      varDist: variance,
      binPct,
      entropy: ent,
      activeBinsGt5: active,
    });
  }
  return out;
}

function finalizeMode(mode: string, label: string, steps: StepStats[]): ModeStats {
  const means = steps.map((s) => s.meanDist).filter((x) => Number.isFinite(x));
  const vars = steps.map((s) => s.varDist).filter((x) => Number.isFinite(x));
  const varOfMeans = varianceOfArray(means);
  const meanOfVars =
    vars.length > 0 ? vars.reduce((a, b) => a + b, 0) / vars.length : NaN;
  const corrProxy =
    Number.isFinite(varOfMeans) && Number.isFinite(meanOfVars) && meanOfVars > 0
      ? varOfMeans / meanOfVars
      : NaN;
  const meanEntropy =
    steps.length > 0
      ? steps.reduce((s, x) => s + x.entropy, 0) / steps.length
      : NaN;
  const meanActiveBins =
    steps.length > 0
      ? steps.reduce((s, x) => s + x.activeBinsGt5, 0) / steps.length
      : NaN;

  return {
    mode,
    label,
    steps,
    corrProxy,
    meanVarWithin: meanOfVars,
    meanEntropy,
    meanActiveBins,
  };
}

function printModeSection(rep: ModeStats): void {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`Mode: ${rep.mode}`);
  console.log(`Label: ${rep.label}`);
  console.log(
    `Correlation proxy Var(means)/mean(var within step): ${fmt(rep.corrProxy)}`,
  );
  console.log(`Avg variance within step: ${fmt(rep.meanVarWithin)}`);
  console.log(`Avg entropy (bits, 6 bins): ${fmt(rep.meanEntropy)}`);
  console.log(`Avg active bins (>5%): ${fmt(rep.meanActiveBins)}`);
  console.log("\n--- Per step ---");
  console.log(
    `Bins: ${BIN_LABELS.map((b, i) => `b${i}=${b}`).join("; ")}`,
  );
  console.log(
    "| step | n | mean | var | entropy | >5%bins | b0 | b1 | b2 | b3 | b4 | oth |",
  );
  console.log(
    "|------|---|------|-----|---------|--------|----|----|----|----|----|-----|",
  );
  for (const s of rep.steps) {
    const bp = s.binPct;
    console.log(
      `| ${s.step} | ${s.n} | ${fmt(s.meanDist)} | ${fmt(s.varDist)} | ${fmt(s.entropy)} | ${s.activeBinsGt5} | ${fmtPct(bp[0]!)} | ${fmtPct(bp[1]!)} | ${fmtPct(bp[2]!)} | ${fmtPct(bp[3]!)} | ${fmtPct(bp[4]!)} | ${fmtPct(bp[5]!)} |`,
    );
  }
}

async function main(): Promise<void> {
  loadEnv();
  const { runId, assetSymbol } = parseArgv();
  const prisma = new PrismaClient();

  console.log("=== CV-DIAG-040 Independence proxies (read-only) ===\n");
  console.log(
    [
      "AgentDecision.distortedSignal per agent per step.",
      `Labels: ${LABEL_NONE} vs ${LABEL_040}`,
      "correlation proxy: Var_t(mean_i x_{i,t}) / mean_t(var_i x_{i,t}).",
    ].join("\n"),
  );

  async function load(label: string, mode: string): Promise<ModeStats | null> {
    const v = await prisma.runVariant.findFirst({
      where: { runId, assetSymbol, label },
      select: { id: true },
    });
    if (!v) return null;
    const rows = await prisma.agentDecision.findMany({
      where: { runVariantId: v.id },
      select: { step: true, distortedSignal: true },
      orderBy: [{ step: "asc" }, { agentId: "asc" }],
    });
    return finalizeMode(mode, label, aggregateVariant(rows));
  }

  const baseline = await load(LABEL_NONE, "none");
  const structured = await load(LABEL_040, "structured_agents");
  await prisma.$disconnect();

  if (!baseline) console.log("\n**none**: variant not found.\n");
  else printModeSection(baseline);
  if (!structured) console.log("\n**structured_agents**: variant not found.\n");
  else printModeSection(structured);

  if (baseline && structured) {
    console.log(`\n${"=".repeat(72)}`);
    console.log("### Summary\n");
    const cmp = (a: number, b: number) =>
      Number.isFinite(a) && Number.isFinite(b) ? a - b : NaN;
    const d = cmp(baseline.corrProxy, structured.corrProxy);
    const loCorr =
      !Number.isFinite(d) ? "n/a" : d < 0 ? "none" : d > 0 ? "structured_agents" : "tie";
    const de = cmp(baseline.meanEntropy, structured.meanEntropy);
    const hiEnt =
      !Number.isFinite(de) ? "n/a" : de > 0 ? "none" : de < 0 ? "structured_agents" : "tie";
    const dv = cmp(baseline.meanVarWithin, structured.meanVarWithin);
    const wide =
      !Number.isFinite(dv)
        ? "n/a"
        : dv > 0
          ? "none"
          : dv < 0
            ? "structured_agents"
            : "tie";
    console.log(
      `- **Lower correlation proxy** (Var(means)/mean(var within step)): ${loCorr}.`,
    );
    console.log(`- **Higher mean entropy** (bin distribution): ${hiEnt}.`);
    console.log(`- **Wider distribution** (mean within-step variance): ${wide}.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
