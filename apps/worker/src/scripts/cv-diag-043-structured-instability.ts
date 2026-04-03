/**
 * CV-DIAG-043: mean_signal_sign instability across structured_agents crowd sizes (read-only).
 * Usage: npx tsx src/scripts/cv-diag-043-structured-instability.ts [--runId <uuid>] [--assetSymbol SPY]
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

type Action = "BUY" | "SELL" | "HOLD";

const RUN_ID_DEFAULT = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";

const LABELS: { n: number; label: string }[] = [
  {
    n: 100,
    label: "cv_val040_structured_agents_syn0p4_info0p4_evt0p2_reg0p2_th0p02_ds0p7_n100",
  },
  {
    n: 2000,
    label: "cv_val040_structured_agents_syn0p4_info0p4_evt0p2_reg0p2_th0p02_ds0p7_n2000",
  },
  {
    n: 10000,
    label: "cv_val040_structured_agents_syn0p4_info0p4_evt0p2_reg0p2_th0p02_ds0p7_n10000",
  },
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
  let runId = process.env.CV_DIAG043_RUN_ID?.trim() || RUN_ID_DEFAULT;
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

function forecastFromMean(m: number): Action {
  if (m > 0) return "BUY";
  if (m < 0) return "SELL";
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

function actionPct(actions: Action[]): { buy: number; sell: number; hold: number } {
  const c = { BUY: 0, SELL: 0, HOLD: 0 };
  for (const a of actions) c[a]++;
  const n = actions.length || 1;
  return { buy: (100 * c.BUY) / n, sell: (100 * c.SELL) / n, hold: (100 * c.HOLD) / n };
}

function archetypeMixLine(
  rationales: (string | null)[],
  archetypes: (string | null)[],
): string {
  const bucket: Record<string, number> = {};
  for (let i = 0; i < rationales.length; i++) {
    const r = rationales[i];
    const m = r?.match(/cv040=(trend|contrarian|noise|fundamental)/);
    let key: string;
    if (m) key = `cv040:${m[1]}`;
    else {
      const a = archetypes[i];
      key = a && a.length > 0 ? `archetype:${a}` : "unknown";
    }
    bucket[key] = (bucket[key] ?? 0) + 1;
  }
  const n = rationales.length || 1;
  return Object.entries(bucket)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}=${((100 * v) / n).toFixed(1)}%`)
    .join(" ");
}

type StepPack = {
  meanSig: number;
  stdSig: number;
  fore: Action;
  truth: Action | null;
  buyPct: number;
  sellPct: number;
  holdPct: number;
  mix: string;
};

async function buildStepMap(
  prisma: PrismaClient,
  runId: string,
  assetSymbol: string,
  label: string,
  retByKey: Map<string, number>,
): Promise<Map<number, StepPack> | null> {
  const v = await prisma.runVariant.findFirst({
    where: { runId, assetSymbol, label },
    select: { id: true },
  });
  if (!v) return null;

  const rows = await prisma.agentDecision.findMany({
    where: { runVariantId: v.id },
    select: {
      step: true,
      distortedSignal: true,
      action: true,
      rationale: true,
      agent: { select: { archetype: true } },
    },
    orderBy: [{ step: "asc" }, { agentId: "asc" }],
  });

  const byStep = new Map<
    number,
    {
      signals: number[];
      actions: Action[];
      rationales: (string | null)[];
      arch: (string | null)[];
    }
  >();

  for (const r of rows) {
    const a = r.action as Action;
    const sig =
      r.distortedSignal != null && Number.isFinite(r.distortedSignal) ? r.distortedSignal : NaN;
    const list = byStep.get(r.step);
    const rat = r.rationale ?? null;
    const ar = r.agent?.archetype ?? null;
    if (!list) {
      byStep.set(r.step, {
        signals: [sig],
        actions: [a],
        rationales: [rat],
        arch: [ar],
      });
    } else {
      list.signals.push(sig);
      list.actions.push(a);
      list.rationales.push(rat);
      list.arch.push(ar);
    }
  }

  const out = new Map<number, StepPack>();
  for (const [step, pack] of byStep) {
    const finite = pack.signals.filter(Number.isFinite);
    const m = mean(finite);
    const sd = stdPop(finite);
    const fore = forecastFromMean(m);
    const nextRet = retByKey.get(`${assetSymbol}:${step + 1}`);
    const truth =
      nextRet != null && Number.isFinite(nextRet) ? directionFromReturn(nextRet) : null;
    const pct = actionPct(pack.actions);
    const mix = archetypeMixLine(pack.rationales, pack.arch);
    out.set(step, {
      meanSig: m,
      stdSig: sd,
      fore,
      truth,
      buyPct: pct.buy,
      sellPct: pct.sell,
      holdPct: pct.hold,
      mix,
    });
  }
  return out;
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
  const retByKey = new Map<string, number>();
  for (const r of returns) retByKey.set(`${assetSymbol}:${r.step}`, r.stepReturn);

  const maps: { n: number; label: string; m: Map<number, StepPack> | null }[] = [];
  for (const { n, label } of LABELS) {
    maps.push({ n, label, m: await buildStepMap(prisma, runId, assetSymbol, label, retByKey) });
  }

  console.log("=== CV-DIAG-043 structured_agents + mean_signal_sign ===\n");
  console.log(`runId=${runId} assetSymbol=${assetSymbol}\n`);

  // 1. Summary table
  console.log("### 1. Summary\n");
  console.log("| n | overall_accuracy | steps_scored |");
  console.log("|---|------------------|--------------|");
  const accByN: Record<number, number | null> = {};
  let totalScored = 0;
  for (const { n, label, m } of maps) {
    if (!m || m.size === 0) {
      console.log(`| ${n} | — | 0 |`);
      accByN[n] = null;
      continue;
    }
    let ok = 0;
    let tot = 0;
    for (const [, p] of m) {
      if (p.truth == null) continue;
      tot++;
      if (p.fore === p.truth) ok++;
    }
    if (tot > 0) totalScored = tot;
    const acc = tot > 0 ? ok / tot : null;
    accByN[n] = acc;
    console.log(`| ${n} | ${acc == null ? "—" : `${(100 * acc).toFixed(2)}%`} | ${tot} |`);
  }

  const m100 = maps.find((x) => x.n === 100)?.m;
  const m2000 = maps.find((x) => x.n === 2000)?.m;
  const m10k = maps.find((x) => x.n === 10000)?.m;

  const allSteps = new Set<number>();
  for (const mm of [m100, m2000, m10k]) {
    if (!mm) continue;
    for (const s of mm.keys()) allSteps.add(s);
  }
  const sortedSteps = [...allSteps].sort((a, b) => a - b);

  // 2. Per-step (forecast + actual from n=100 truth column — same ground truth for all)
  console.log("\n### 2. Per-step (mean_signal_sign forecast; actual = next-step return direction)\n");
  console.log("| step | actual | fore_n100 | fore_n2000 | fore_n10000 |");
  console.log("|------|--------|-----------|------------|-------------|");
  for (const step of sortedSteps) {
    const p100 = m100?.get(step);
    const p2k = m2000?.get(step);
    const p10 = m10k?.get(step);
    const truth = p100?.truth ?? p2k?.truth ?? p10?.truth;
    if (truth == null) continue;
    console.log(
      `| ${step} | ${truth} | ${p100?.fore ?? "—"} | ${p2k?.fore ?? "—"} | ${p10?.fore ?? "—"} |`,
    );
  }

  // 3. Disagreement: 2000 differs from both 100 and 10000
  const disagree: number[] = [];
  for (const step of sortedSteps) {
    const a = m100?.get(step)?.fore;
    const b = m2000?.get(step)?.fore;
    const c = m10k?.get(step)?.fore;
    if (a == null || b == null || c == null) continue;
    if (b !== a && b !== c) disagree.push(step);
  }

  console.log("\n### 3. Steps where n=2000 forecast differs from both n=100 and n=10000\n");
  console.log(`count=${disagree.length} (of ${totalScored} scored steps)\n`);

  if (disagree.length > 0) {
    console.log(
      "| step | mean_100 | std_100 | B/S/H%_100 | mean_2000 | std_2000 | B/S/H%_2000 | mean_10k | std_10k | B/S/H%_10k |",
    );
    console.log(
      "|------|----------|---------|------------|-----------|----------|-------------|----------|---------|------------|",
    );
    for (const step of disagree) {
      const a = m100!.get(step)!;
      const b = m2000!.get(step)!;
      const c = m10k!.get(step)!;
      const pct = (x: StepPack) =>
        `${x.buyPct.toFixed(0)}/${x.sellPct.toFixed(0)}/${x.holdPct.toFixed(0)}`;
      console.log(
        `| ${step} | ${a.meanSig.toFixed(4)} | ${a.stdSig.toFixed(4)} | ${pct(a)} | ${b.meanSig.toFixed(4)} | ${b.stdSig.toFixed(4)} | ${pct(b)} | ${c.meanSig.toFixed(4)} | ${c.stdSig.toFixed(4)} | ${pct(c)} |`,
      );
      console.log(`  mix_n100:   ${a.mix}`);
      console.log(`  mix_n2000:  ${b.mix}`);
      console.log(`  mix_n10000: ${c.mix}`);
    }
  }

  // 4. Conclusion
  console.log("\n### 4. Conclusion\n");
  const frac = totalScored > 0 ? disagree.length / totalScored : 0;
  const a100 = accByN[100];
  const a2000 = accByN[2000];
  const a10k = accByN[10000];
  let why = "";
  if (a2000 != null && a100 != null && a10k != null) {
    if (a2000 < a100 && a2000 < a10k) {
      why =
        "n=2000 shows lower accuracy than both n=100 and n=10000 under mean_signal_sign; ";
    } else {
      why = "Accuracy ordering is not strictly U-shaped; ";
    }
  }
  const sampling =
    frac < 0.08
      ? "Disagreement steps are a small fraction of scored steps; the n=2000 dip is plausibly sampling variance (finite-step noise)."
      : frac >= 0.15
        ? "Many steps where n=2000 disagrees with both endpoints; this suggests structural instability of the aggregate mean at mid-scale (not pure sampling noise)."
        : "Moderate disagreement rate; mixed evidence—could be partly sampling and partly scale-dependent aggregation effects.";

  console.log(`- ${why}${sampling}`);
  console.log(
    `- If archetype mix differs materially at disagreement steps between cohorts, cohort composition (not just scale) may drive the gap.`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
