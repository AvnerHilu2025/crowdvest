/**
 * CV-DIAG-030: read-only audit of CV-VAL-029 collapse steps (crowd action + distortedSignal).
 * Usage: npx tsx src/scripts/cv-diag-030-cv029-audit.ts
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

const RUN_ID_DEFAULT = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";

const LABELS = [
  "cv_val029_baseline_100",
  "cv_val029_baseline_2000",
  "cv_val029_baseline_10000",
] as const;

const COLLAPSE_PCT = 85;
/** ARCH-029 scaled threshold: |signalI|*0.7 vs TH=0.02 → |signalI| ≈ 0.02857 */
const IMPLICIT_SIGNAL_I_ABS_NEAR = 0.0286;

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
  action: string;
  syntheticSignal: number | null;
  distortedSignal: number | null;
};

function aggregateStepRows(rows: Row[]): {
  buy: number;
  sell: number;
  hold: number;
  n: number;
  meanSyn: number;
  meanDist: number;
  stdDist: number;
  pctAbsLt002: number;
  pctAbsLt005: number;
  entropy: number;
  buyPct: number;
  sellPct: number;
  holdPct: number;
  majPct: number;
} {
  let buy = 0;
  let sell = 0;
  let hold = 0;
  let synC = 0;
  let synS = 0;
  let distC = 0;
  let distS = 0;
  let distMeanW = 0;
  let distM2 = 0;
  let absLt002 = 0;
  let absLt005 = 0;

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

    const d = r.distortedSignal;
    if (d != null && Number.isFinite(d)) {
      distC++;
      distS += d;
      const ad = Math.abs(d);
      if (ad < 0.02) absLt002++;
      if (ad < 0.05) absLt005++;
      const dn = distC;
      const delta = d - distMeanW;
      distMeanW += delta / dn;
      const delta2 = d - distMeanW;
      distM2 += delta * delta2;
    }
  }

  const maj = Math.max(buy, sell, hold);
  const stdDist = distC >= 2 ? Math.sqrt(distM2 / distC) : 0;
  return {
    buy,
    sell,
    hold,
    n,
    meanSyn: synC ? synS / synC : NaN,
    meanDist: distC ? distS / distC : NaN,
    stdDist,
    pctAbsLt002: distC ? (100 * absLt002) / distC : NaN,
    pctAbsLt005: distC ? (100 * absLt005) / distC : NaN,
    entropy: entropy3(buy, sell, hold),
    buyPct: n ? (100 * buy) / n : NaN,
    sellPct: n ? (100 * sell) / n : NaN,
    holdPct: n ? (100 * hold) / n : NaN,
    majPct: n ? (100 * maj) / n : NaN,
  };
}

function fmt(x: number): string {
  if (x == null || !Number.isFinite(x)) return "n/a";
  return x.toFixed(4);
}

function fmtPct(x: number): string {
  if (x == null || !Number.isFinite(x)) return "n/a";
  return `${x.toFixed(2)}%`;
}

async function main(): Promise<void> {
  loadEnv();
  const runId = process.env.CV_DIAG030_RUN_ID?.trim() || RUN_ID_DEFAULT;
  const prisma = new PrismaClient();

  console.log("=== FIELD AVAILABILITY (CV-DIAG-030) ===\n");
  console.log(
    [
      "Source: Prisma AgentDecision (read-only).",
      "",
      "Used for this audit:",
      "- step, action → per-step BUY/SELL/HOLD counts, percentages, entropy, majority %. Collapse = one side ≥ " +
        COLLAPSE_PCT +
        "%.",
      "- distortedSignal → per-step mean, population stddev (Welford), % with |x|<0.02, % with |x|<0.05.",
      "  For CV-VAL-029 this is signalI (coreFromModel, pre-scaled threshold), not scaledSignal.",
      "- syntheticSignal → per-step mean (market step scalar; duplicated per agent) to relate collapse to return direction scale.",
      "",
      "Not used here: rationale, confidence, info/event/regime breakdown as collapse drivers (read 028 for signal mix).",
      "CrowdMetrics/herding: not joined in this script; only AgentDecision-derived aggregates.",
    ].join("\n"),
  );

  const collapseStepsByLabel = new Map<string, number[]>();

  for (const label of LABELS) {
    console.log(`\n${"=".repeat(72)}`);
    console.log(`Label: ${label}`);
    console.log(`${"=".repeat(72)}\n`);

    const v = await prisma.runVariant.findFirst({
      where: { runId, label },
      select: { id: true },
    });
    if (!v) {
      console.log("RunVariant not found for this runId+label.\n");
      continue;
    }

    const rows = await prisma.agentDecision.findMany({
      where: { runVariantId: v.id },
      select: {
        step: true,
        action: true,
        syntheticSignal: true,
        distortedSignal: true,
      },
      orderBy: [{ step: "asc" }, { agentId: "asc" }],
    });

    const parsed: Row[] = rows.map((r) => ({
      step: r.step,
      action: String(r.action),
      syntheticSignal: r.syntheticSignal,
      distortedSignal: r.distortedSignal,
    }));

    const byStep = new Map<number, Row[]>();
    for (const r of parsed) {
      const list = byStep.get(r.step) ?? [];
      list.push(r);
      byStep.set(r.step, list);
    }

    let ob = 0;
    let os = 0;
    let oh = 0;
    for (const r of parsed) {
      if (r.action === "BUY") ob++;
      else if (r.action === "SELL") os++;
      else oh++;
    }
    const on = parsed.length;
    console.log("--- Overall action distribution ---");
    console.log("| metric | value |");
    console.log("|--------|-------|");
    console.log(`| BUY count | ${ob} |`);
    console.log(`| SELL count | ${os} |`);
    console.log(`| HOLD count | ${oh} |`);
    const opBuy = on ? (100 * ob) / on : NaN;
    const opSell = on ? (100 * os) / on : NaN;
    const opHold = on ? (100 * oh) / on : NaN;
    console.log(`| BUY % | ${fmtPct(opBuy)} |`);
    console.log(`| SELL % | ${fmtPct(opSell)} |`);
    console.log(`| HOLD % | ${fmtPct(opHold)} |`);
    console.log(`| decision entropy (bits) | ${fmt(entropy3(ob, os, oh))} |`);

    const steps = [...byStep.keys()].sort((a, b) => a - b);
    console.log("\n--- Per-step (sorted by step) ---");
    console.log(
      "| step | BUY% | SELL% | HOLD% | maj% | entropy | meanDist | stdDist | pct|dist|<0.02 | pct|dist|<0.05 | meanSyn | collapse≥85% |",
    );
    console.log(
      "|------|------|-------|-------|------|---------|----------|---------|---------------|---------------|---------|--------------|",
    );

    const collapseSteps: number[] = [];
    const meanSynAtCollapse: number[] = [];
    const meanSynNoCollapse: number[] = [];
    const runsCollapse: { start: number; len: number }[] = [];
    let prevCollapse = false;
    let runStart = -1;

    for (const st of steps) {
      const list = byStep.get(st)!;
      const a = aggregateStepRows(list);
      const collapsed = a.majPct >= COLLAPSE_PCT;
      const tag = collapsed ? "yes" : "no";
      if (collapsed) {
        collapseSteps.push(st);
        if (Number.isFinite(a.meanSyn)) meanSynAtCollapse.push(a.meanSyn);
      } else if (Number.isFinite(a.meanSyn)) {
        meanSynNoCollapse.push(a.meanSyn);
      }

      if (collapsed) {
        if (!prevCollapse) {
          runStart = st;
        }
        prevCollapse = true;
      } else {
        if (prevCollapse && runStart >= 0) {
          runsCollapse.push({ start: runStart, len: st - runStart });
        }
        prevCollapse = false;
        runStart = -1;
      }

      console.log(
        `| ${st} | ${fmtPct(a.buyPct)} | ${fmtPct(a.sellPct)} | ${fmtPct(a.holdPct)} | ${fmtPct(a.majPct)} | ${fmt(a.entropy)} | ${fmt(a.meanDist)} | ${fmt(a.stdDist)} | ${fmtPct(a.pctAbsLt002)} | ${fmtPct(a.pctAbsLt005)} | ${fmt(a.meanSyn)} | ${tag} |`,
      );
    }

    if (prevCollapse && runStart >= 0) {
      const lastSt = steps[steps.length - 1]!;
      runsCollapse.push({ start: runStart, len: lastSt - runStart + 1 });
    }

    const meanAbs = (xs: number[]): number =>
      xs.length === 0 ? NaN : xs.reduce((s, x) => s + Math.abs(x), 0) / xs.length;

    console.log("\n--- Collapse summary ---");
    console.log(`Steps with one side ≥ ${COLLAPSE_PCT}%: ${collapseSteps.length} / ${steps.length}`);
    console.log(`Collapse step indices: ${collapseSteps.length ? collapseSteps.join(", ") : "(none)"}`);
    console.log(`Longest consecutive collapse run (step count): ${runsCollapse.length ? Math.max(...runsCollapse.map((r) => r.len)) : 0}`);

    const mSynC = meanAbs(meanSynAtCollapse);
    const mSynN = meanAbs(meanSynNoCollapse);
    console.log(`Mean |meanSyn| on collapse steps: ${fmt(mSynC)}`);
    console.log(`Mean |meanSyn| on non-collapse steps: ${fmt(mSynN)}`);

    console.log("\n=== CONCLUSION (heuristic, AgentDecision only) ===");
    const holdShare = on ? (100 * oh) / on : 0;
    const collapseFrac = steps.length ? collapseSteps.length / steps.length : 0;
    console.log(
      `- HOLD share overall: ${fmtPct(holdShare)}. Threshold rule adds a middle bucket; collapse here means one of BUY/SELL/HOLD still dominates ≥${COLLAPSE_PCT}%.`,
    );
    console.log(
      `- Collapse steps (${collapseSteps.length}/${steps.length} ≈ ${fmtPct(100 * collapseFrac)} of steps): ${collapseSteps.length ? collapseSteps.join(", ") : "none"}.`,
    );
    if (Number.isFinite(mSynC) && Number.isFinite(mSynN)) {
      const localized = mSynC > mSynN * 1.15;
      const broad = mSynN > mSynC * 1.15;
      if (localized) {
        console.log(
          "- vs non-collapse steps, mean |syntheticSignal| is higher on collapse steps → skew often aligns with stronger step-level market signal.",
        );
      } else if (broad) {
        console.log(
          "- Collapse steps do not stand out as the strongest |syntheticSignal| steps; skew appears broader than “only huge return” steps.",
        );
      } else {
        console.log(
          "- Mean |syntheticSignal| is similar on collapse vs non-collapse steps; collapse is not cleanly “only strong-signal” from this coarse check.",
        );
      }
    }
    console.log(
      `- Rule shape: decisions use scaledSignal = signalI×0.7 vs TH=0.02 (|signalI|≈${IMPLICIT_SIGNAL_I_ABS_NEAR}). Inspect pct|dist|<0.02 in the table — high values imply many agents near the band where small shifts flip side or land HOLD.`,
    );
    console.log(
      "- Aggregator in eval still uses **plurality of agent actions** per step; changing edges (more HOLD) can shrink majority margin but a unanimous-ish BUY/SELL core still drives the crowd forecast if HOLD stays a minority at those steps.",
    );

    collapseStepsByLabel.set(label, [...collapseSteps]);
  }

  if (collapseStepsByLabel.size >= 2) {
    console.log(`\n${"=".repeat(72)}`);
    console.log("=== CROSS-LABEL: collapse step indices ===");
    const entries = [...collapseStepsByLabel.entries()];
    const sig0 = entries[0]![1].join(",");
    const same = entries.every(([, steps]) => steps.join(",") === sig0);
    for (const [lb, steps] of entries) {
      console.log(`${lb}: ${steps.length ? steps.join(", ") : "(none)"}`);
    }
    console.log(
      same
        ? "All listed labels share the same collapse-step set → step-level skew is deterministic in the pipeline; larger N mostly scales counts, not which steps dominate."
        : "Collapse-step sets differ across labels (compare runs / data).",
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
