/**
 * CV-DIAG-028: read-only audit of persisted signals for CV-VAL-027 variants.
 * Usage: npx tsx src/scripts/cv-diag-028-signal-audit.ts
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

const RUN_ID_DEFAULT = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";

const LABELS = [
  "cv_val027_baseline_100",
  "cv_val027_baseline_5000",
  "cv_val027_low_regime_100",
  "cv_val027_low_regime_5000",
  "cv_val027_balanced_100",
  "cv_val027_balanced_5000",
  "cv_val027_info_heavy_100",
  "cv_val027_info_heavy_5000",
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

function entropy3(b: number, se: number, h: number): number {
  const t = b + se + h;
  if (t <= 0) return 0;
  let e = 0;
  for (const c of [b, se, h]) {
    if (c <= 0) continue;
    const p = c / t;
    e -= p * Math.log2(p);
  }
  return e;
}

type Row = {
  step: number;
  syntheticSignal: number | null;
  infoSignal: number | null;
  eventSignal: number | null;
  regimeSignal: number | null;
  distortedSignal: number | null;
  action: string;
};

function aggregateStep(rows: Row[]): {
  meanSyn: number;
  meanInfo: number;
  meanEvt: number;
  meanReg: number;
  meanDist: number;
  stdDist: number;
  minDist: number;
  maxDist: number;
  pctPos: number;
  pctNeg: number;
  pctNear0: number;
  buy: number;
  sell: number;
  hold: number;
  entropy: number;
  majPct: number;
} {
  let buy = 0;
  let sell = 0;
  let hold = 0;
  let synC = 0;
  let synS = 0;
  let infC = 0;
  let infS = 0;
  let evtC = 0;
  let evtS = 0;
  let regC = 0;
  let regS = 0;
  let distC = 0;
  let distS = 0;
  let distMin = Infinity;
  let distMax = -Infinity;
  let pos = 0;
  let neg = 0;
  let nz = 0;
  // Welford: population std, same divisor as prior array-based stddev (n)
  let distMeanW = 0;
  let distM2 = 0;

  const n = rows.length;
  for (const r of rows) {
    if (r.action === "BUY") buy++;
    else if (r.action === "SELL") sell++;
    else hold++;

    const sy = r.syntheticSignal;
    if (sy != null && Number.isFinite(sy)) {
      synC++;
      synS += sy;
    }
    const inf = r.infoSignal;
    if (inf != null && Number.isFinite(inf)) {
      infC++;
      infS += inf;
    }
    const ev = r.eventSignal;
    if (ev != null && Number.isFinite(ev)) {
      evtC++;
      evtS += ev;
    }
    const rg = r.regimeSignal;
    if (rg != null && Number.isFinite(rg)) {
      regC++;
      regS += rg;
    }
    const d = r.distortedSignal;
    if (d != null && Number.isFinite(d)) {
      distC++;
      distS += d;
      if (d < distMin) distMin = d;
      if (d > distMax) distMax = d;
      const dn = distC;
      const delta = d - distMeanW;
      distMeanW += delta / dn;
      const delta2 = d - distMeanW;
      distM2 += delta * delta2;
      if (d > 0) pos++;
      if (d < 0) neg++;
      if (Math.abs(d) < 0.05) nz++;
    }
  }

  const t = distC;
  const maj = Math.max(buy, sell, hold);
  const stdDist = distC >= 2 ? Math.sqrt(distM2 / distC) : 0;
  return {
    meanSyn: synC ? synS / synC : NaN,
    meanInfo: infC ? infS / infC : NaN,
    meanEvt: evtC ? evtS / evtC : NaN,
    meanReg: regC ? regS / regC : NaN,
    meanDist: t ? distS / t : NaN,
    stdDist,
    minDist: t ? distMin : NaN,
    maxDist: t ? distMax : NaN,
    pctPos: t ? (100 * pos) / t : NaN,
    pctNeg: t ? (100 * neg) / t : NaN,
    pctNear0: t ? (100 * nz) / t : NaN,
    buy,
    sell,
    hold,
    entropy: entropy3(buy, sell, hold),
    majPct: n ? (100 * maj) / n : NaN,
  };
}

function fmt(x: number): string {
  if (x == null || !Number.isFinite(x)) return "n/a";
  return x.toFixed(6);
}

async function main(): Promise<void> {
  loadEnv();
  const runId = process.env.CV_DIAG028_RUN_ID?.trim() || RUN_ID_DEFAULT;
  const prisma = new PrismaClient();

  console.log("=== FIELD AVAILABILITY (Prisma AgentDecision) ===\n");
  console.log(
    [
      "Queried columns: step, agentId, action, confidence, syntheticSignal, infoSignal, eventSignal, regimeSignal, distortedSignal, rationale (not used in metrics).",
      "",
      "Auditable directly from persisted rows:",
      "- Input-related (stored): mean syntheticSignal (market step scalar, duplicated per agent), mean infoSignal, mean eventSignal, mean regimeSignal (step regime, duplicated per agent).",
      "- Pre-decision continuous: distortedSignal is persisted as the worker’s `signalI` (post–constrained-diversity, pre–sign); for CV-VAL-027 this is clamp11(coreFromModel) with no extra draw.",
      "- Final decision: action (BUY|SELL|HOLD), confidence.",
      "",
      "NOT persisted (cannot audit from DB):",
      "- Preset-weighted baseNow (linear combo of channels before transform).",
      "- Per-agent synthetic_i / scaled synthetic (only market syntheticSignal is stored).",
      "- Constrained-diversity internals: scale/bias/smoothedMid, delayEff, pre-clamp transform output.",
      "- Any intermediate between base and distortedSignal.",
    ].join("\n"),
  );

  const byLabel = new Map<string, Row[]>();
  const summaries = new Map<
    string,
    { overall: ReturnType<typeof aggregateStep>; byStep: Map<number, ReturnType<typeof aggregateStep>> }
  >();

  for (const label of LABELS) {
    const v = await prisma.runVariant.findFirst({
      where: { runId, label },
      select: { id: true, agents: true, steps: true },
    });
    if (!v) {
      console.log(`\n*** Label ${label}: RunVariant not found ***\n`);
      continue;
    }
    const rows = await prisma.agentDecision.findMany({
      where: { runVariantId: v.id },
      select: {
        step: true,
        syntheticSignal: true,
        infoSignal: true,
        eventSignal: true,
        regimeSignal: true,
        distortedSignal: true,
        action: true,
      },
      orderBy: [{ step: "asc" }, { agentId: "asc" }],
    });
    const parsed: Row[] = rows.map((r) => ({
      step: r.step,
      syntheticSignal: r.syntheticSignal,
      infoSignal: r.infoSignal,
      eventSignal: r.eventSignal,
      regimeSignal: r.regimeSignal,
      distortedSignal: r.distortedSignal,
      action: String(r.action),
    }));
    byLabel.set(label, parsed);

    const byStep = new Map<number, Row[]>();
    for (const r of parsed) {
      const list = byStep.get(r.step) ?? [];
      list.push(r);
      byStep.set(r.step, list);
    }
    const stepAggs = new Map<number, ReturnType<typeof aggregateStep>>();
    for (const [st, list] of byStep) stepAggs.set(st, aggregateStep(list));
    summaries.set(label, { overall: aggregateStep(parsed), byStep: stepAggs });
  }

  await prisma.$disconnect();

  for (const label of LABELS) {
    const sum = summaries.get(label);
    console.log(`\nLabel: ${label}`);
    if (!sum) {
      console.log("| stage_metric | value |\n|--------------|-------|\n| (no data) | |");
      continue;
    }
    const { overall, byStep } = sum;
    const lines: string[] = [];
    lines.push("| stage_metric | value |");
    lines.push("|--------------|-------|");
    lines.push(`| overall_n_decisions | ${byLabel.get(label)?.length ?? 0} |`);
    lines.push(`| overall_mean_syntheticSignal | ${fmt(overall.meanSyn)} |`);
    lines.push(`| overall_mean_infoSignal | ${fmt(overall.meanInfo)} |`);
    lines.push(`| overall_mean_eventSignal | ${fmt(overall.meanEvt)} |`);
    lines.push(`| overall_mean_regimeSignal | ${fmt(overall.meanReg)} |`);
    lines.push(`| overall_mean_distortedSignal | ${fmt(overall.meanDist)} |`);
    lines.push(`| overall_stddev_distortedSignal | ${fmt(overall.stdDist)} |`);
    lines.push(`| overall_min_distortedSignal | ${fmt(overall.minDist)} |`);
    lines.push(`| overall_max_distortedSignal | ${fmt(overall.maxDist)} |`);
    lines.push(`| overall_pct_distorted_gt_0 | ${fmt(overall.pctPos)} |`);
    lines.push(`| overall_pct_distorted_lt_0 | ${fmt(overall.pctNeg)} |`);
    lines.push(`| overall_pct_distorted_abs_lt_0.05 | ${fmt(overall.pctNear0)} |`);
    lines.push(`| overall_BUY_count | ${overall.buy} |`);
    lines.push(`| overall_SELL_count | ${overall.sell} |`);
    lines.push(`| overall_HOLD_count | ${overall.hold} |`);
    lines.push(`| overall_BUY_pct | ${fmt((100 * overall.buy) / (overall.buy + overall.sell + overall.hold || 1))} |`);
    lines.push(`| overall_SELL_pct | ${fmt((100 * overall.sell) / (overall.buy + overall.sell + overall.hold || 1))} |`);
    lines.push(`| overall_HOLD_pct | ${fmt((100 * overall.hold) / (overall.buy + overall.sell + overall.hold || 1))} |`);
    lines.push(`| overall_decision_entropy_bits | ${fmt(overall.entropy)} |`);
    lines.push(`| overall_majority_side_pct | ${fmt(overall.majPct)} |`);

    const steps = [...byStep.keys()].sort((a, b) => a - b);
    for (const st of steps) {
      const s = byStep.get(st)!;
      lines.push(`| step_${st}_mean_synthetic | ${fmt(s.meanSyn)} |`);
      lines.push(`| step_${st}_mean_info | ${fmt(s.meanInfo)} |`);
      lines.push(`| step_${st}_mean_event | ${fmt(s.meanEvt)} |`);
      lines.push(`| step_${st}_mean_regime | ${fmt(s.meanReg)} |`);
      lines.push(`| step_${st}_mean_distorted | ${fmt(s.meanDist)} |`);
      lines.push(`| step_${st}_stddev_distorted | ${fmt(s.stdDist)} |`);
      lines.push(`| step_${st}_pct_pos_distorted | ${fmt(s.pctPos)} |`);
      lines.push(`| step_${st}_pct_NEAR0_distorted | ${fmt(s.pctNear0)} |`);
      lines.push(`| step_${st}_BUY_pct | ${fmt((100 * s.buy) / (s.buy + s.sell + s.hold || 1))} |`);
      lines.push(`| step_${st}_majority_pct | ${fmt(s.majPct)} |`);
    }
    console.log(lines.join("\n"));
  }

  console.log("\n=== Cross-preset comparison (overall_mean_distortedSignal, overall_mean_infoSignal) ===\n");
  const presets = ["baseline", "low_regime", "balanced", "info_heavy"] as const;
  const sizes = [100, 5000] as const;
  const EPS_DIST = 1e-4;
  const EPS_INF = 1e-6;
  for (const n of sizes) {
    console.log(`Crowd size ${n}:`);
    const keys = presets.map((p) => `cv_val027_${p}_${n}`);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = keys[i]!;
        const b = keys[j]!;
        const sa = summaries.get(a)?.overall;
        const sb = summaries.get(b)?.overall;
        if (!sa || !sb) {
          console.log(`  ${a} vs ${b}: skip (missing data)`);
          continue;
        }
        const dDist = Math.abs(sa.meanDist - sb.meanDist);
        const dInf = Math.abs(sa.meanInfo - sb.meanInfo);
        const sameD = dDist < EPS_DIST;
        const sameI = dInf < EPS_INF;
        console.log(
          `  ${a} vs ${b}: distorted_mean_diff=${dDist.toExponential(4)} -> ${sameD ? "NEARLY_IDENTICAL" : "DIFFERENT"}; info_mean_diff=${dInf.toExponential(4)} -> ${sameI ? "NEARLY_IDENTICAL" : "DIFFERENT"}`,
        );
      }
    }
  }

  console.log("\n=== CONCLUSION (heuristic from persisted fields only) ===\n");
  const b100 = summaries.get("cv_val027_baseline_100")?.overall;
  const b5000 = summaries.get("cv_val027_baseline_5000")?.overall;
  const ih100 = summaries.get("cv_val027_info_heavy_100")?.overall;
  const ih5000 = summaries.get("cv_val027_info_heavy_5000")?.overall;
  if (!b100 || !ih100) {
    console.log("Cannot determine: missing variant data for conclusion pair.");
  } else {
    const d100 = Math.abs(b100.meanDist - ih100.meanDist);
    if (d100 < EPS_DIST) {
      console.log(
        "Differences already collapsed by stage distortedSignal (persisted): baseline vs info_heavy at N=100 show nearly identical overall mean distortedSignal.",
      );
    } else {
      console.log(
        "Differences preserved until persisted distortedSignal at N=100 (baseline vs info_heavy mean differs materially).",
      );
    }
  }
  if (b5000 && ih5000) {
    const d5 = Math.abs(b5000.meanDist - ih5000.meanDist);
    console.log(
      `At N=5000 baseline vs info_heavy mean_distorted diff=${d5.toExponential(4)} (${d5 < EPS_DIST ? "nearly identical" : "different"}).`,
    );
  }
  console.log(
    "Preset-weighted base and transform internals are not persisted; collapse before distortedSignal cannot be ruled in/out from DB alone.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
