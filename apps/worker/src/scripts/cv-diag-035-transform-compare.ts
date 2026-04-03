/**
 * CV-DIAG-035: compare cvVal034 current vs none (N=10000) — collapse + distortedSignal.
 * Usage: npx tsx src/scripts/cv-diag-035-transform-compare.ts
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

const RUN_ID_DEFAULT = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";

const LABELS = [
  "cv_val034_current_syn0p4_info0p4_evt0p2_reg0p2_th0p02_ds0p7_n10000",
  "cv_val034_none_syn0p4_info0p4_evt0p2_reg0p2_th0p02_ds0p7_n10000",
] as const;

const COLLAPSE_PCT = 85;

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

type Row = { step: number; action: string; distortedSignal: number | null };

function aggregateStepRows(rows: Row[]): {
  buy: number;
  sell: number;
  hold: number;
  n: number;
  meanDist: number;
  pctAbsLt002: number;
  pctAbsLt005: number;
  buyPct: number;
  sellPct: number;
  holdPct: number;
  majPct: number;
} {
  let buy = 0;
  let sell = 0;
  let hold = 0;
  let distC = 0;
  let distS = 0;
  let absLt002 = 0;
  let absLt005 = 0;

  const n = rows.length;
  for (const r of rows) {
    if (r.action === "BUY") buy++;
    else if (r.action === "SELL") sell++;
    else hold++;

    const d = r.distortedSignal;
    if (d != null && Number.isFinite(d)) {
      distC++;
      distS += d;
      const ad = Math.abs(d);
      if (ad < 0.02) absLt002++;
      if (ad < 0.05) absLt005++;
    }
  }

  const maj = Math.max(buy, sell, hold);
  return {
    buy,
    sell,
    hold,
    n,
    meanDist: distC ? distS / distC : NaN,
    pctAbsLt002: distC ? (100 * absLt002) / distC : NaN,
    pctAbsLt005: distC ? (100 * absLt005) / distC : NaN,
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

function modeFromLabel(label: string): string {
  const m = label.match(/^cv_val034_(current|none)_/);
  return m?.[1] ?? label;
}

type Summary = {
  label: string;
  mode: string;
  collapseSteps: number[];
  meanPctLt002: number;
  meanPctLt005: number;
  collapseCount: number;
  stepCount: number;
};

async function main(): Promise<void> {
  loadEnv();
  const runId = process.env.CV_DIAG035_RUN_ID?.trim() || RUN_ID_DEFAULT;
  const prisma = new PrismaClient();

  console.log("=== FIELD AVAILABILITY (CV-DIAG-035) ===\n");
  console.log(
    [
      "Source: Prisma AgentDecision (read-only).",
      "Fields: step, action, distortedSignal (signalI; scaledSignal used only at decision).",
      "Compare transform modes at N=10000 for fixed ARCH-034 label params.",
    ].join("\n"),
  );

  const summaries: Summary[] = [];

  for (const label of LABELS) {
    const mode = modeFromLabel(label);
    console.log(`\n${"=".repeat(72)}`);
    console.log(`Label: ${label}`);
    console.log(`Mode: ${mode}`);
    console.log(`${"=".repeat(72)}\n`);

    const v = await prisma.runVariant.findFirst({
      where: { runId, label },
      select: { id: true },
    });
    if (!v) {
      console.log("RunVariant not found.\n");
      summaries.push({
        label,
        mode,
        collapseSteps: [],
        meanPctLt002: NaN,
        meanPctLt005: NaN,
        collapseCount: 0,
        stepCount: 0,
      });
      continue;
    }

    const rows = await prisma.agentDecision.findMany({
      where: { runVariantId: v.id },
      select: { step: true, action: true, distortedSignal: true },
      orderBy: [{ step: "asc" }, { agentId: "asc" }],
    });

    const parsed: Row[] = rows.map((r) => ({
      step: r.step,
      action: String(r.action),
      distortedSignal: r.distortedSignal,
    }));

    let ob = 0;
    let os = 0;
    let oh = 0;
    for (const r of parsed) {
      if (r.action === "BUY") ob++;
      else if (r.action === "SELL") os++;
      else oh++;
    }
    const on = parsed.length;
    console.log("--- Overall action % ---");
    console.log(`BUY ${fmtPct(on ? (100 * ob) / on : NaN)} | SELL ${fmtPct(on ? (100 * os) / on : NaN)} | HOLD ${fmtPct(on ? (100 * oh) / on : NaN)}\n`);

    const byStep = new Map<number, Row[]>();
    for (const r of parsed) {
      const list = byStep.get(r.step) ?? [];
      list.push(r);
      byStep.set(r.step, list);
    }
    const steps = [...byStep.keys()].sort((a, b) => a - b);
    const collapseSteps: number[] = [];
    let sumLt002 = 0;
    let sumLt005 = 0;

    console.log("--- Per-step ---");
    console.log(
      "| step | maj% | meanDist | pct|d|<0.02 | pct|d|<0.05 | collapse≥85% |",
    );
    console.log("|------|------|----------|-----------|-----------|--------------|");

    for (const st of steps) {
      const a = aggregateStepRows(byStep.get(st)!);
      const collapsed = a.majPct >= COLLAPSE_PCT;
      if (collapsed) collapseSteps.push(st);
      if (Number.isFinite(a.pctAbsLt002)) sumLt002 += a.pctAbsLt002;
      if (Number.isFinite(a.pctAbsLt005)) sumLt005 += a.pctAbsLt005;
      console.log(
        `| ${st} | ${fmtPct(a.majPct)} | ${fmt(a.meanDist)} | ${fmtPct(a.pctAbsLt002)} | ${fmtPct(a.pctAbsLt005)} | ${collapsed ? "yes" : "no"} |`,
      );
    }

    console.log(`\n--- Collapse steps (>=${COLLAPSE_PCT}%) ---`);
    console.log(
      collapseSteps.length ? collapseSteps.join(", ") : "(none)",
      `— count ${collapseSteps.length} / ${steps.length}`,
    );

    summaries.push({
      label,
      mode,
      collapseSteps,
      meanPctLt002: steps.length ? sumLt002 / steps.length : NaN,
      meanPctLt005: steps.length ? sumLt005 / steps.length : NaN,
      collapseCount: collapseSteps.length,
      stepCount: steps.length,
    });
  }

  await prisma.$disconnect();

  console.log(`\n${"=".repeat(72)}`);
  console.log("=== CONCLUSION (AgentDecision-only) ===");
  const cur = summaries.find((s) => s.mode === "current");
  const none = summaries.find((s) => s.mode === "none");
  if (!cur || !none) {
    console.log("Missing one or both summaries.");
  } else if (cur.stepCount === 0 || none.stepCount === 0) {
    console.log("Incomplete data for comparison.");
  } else {
    const fewer =
      cur.collapseCount < none.collapseCount
        ? `current (${cur.collapseCount} vs ${none.collapseCount})`
        : none.collapseCount < cur.collapseCount
          ? `none (${none.collapseCount} vs ${cur.collapseCount})`
          : `tie (${cur.collapseCount} each)`;
    const nearZero =
      none.meanPctLt002 > cur.meanPctLt002 && none.meanPctLt005 > cur.meanPctLt005
        ? "none (higher mean per-step % below 0.02 and 0.05)"
        : cur.meanPctLt002 > none.meanPctLt002 && cur.meanPctLt005 > none.meanPctLt005
          ? "current"
          : "mixed or tie (compare table)";
    const cSet = new Set(cur.collapseSteps);
    const nSet = new Set(none.collapseSteps);
    let onlyCur = 0;
    let onlyNone = 0;
    let both = 0;
    for (const s of cSet) {
      if (nSet.has(s)) both++;
      else onlyCur++;
    }
    for (const s of nSet) {
      if (!cSet.has(s)) onlyNone++;
    }
    const skew =
      none.collapseCount < cur.collapseCount
        ? "none shows fewer extreme-majority steps vs current."
        : none.collapseCount > cur.collapseCount
          ? "current shows fewer collapse steps than none."
          : "same collapse step count; compare overlap.";

    console.log(`- Fewer collapse steps (>=${COLLAPSE_PCT}%): ${fewer}.`);
    console.log(`- More near-zero |distortedSignal| mass (mean per-step % <0.02 / <0.05): ${nearZero}.`);
    console.log(
      `- Collapse step overlap: both=${both}, current-only=${onlyCur}, none-only=${onlyNone}. ${skew}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
