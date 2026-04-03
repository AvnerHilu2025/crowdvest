/**
 * CV-SWEEP-032: aggregate accuracy across sweep labels.
 * Usage: npx tsx src/scripts/cv-sweep-032-eval.ts --runId <uuid> [--csv /tmp/cv_sweep_032_results.csv] [--no-csv]
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

type Action = "BUY" | "SELL" | "HOLD";

const RUN_ID_DEFAULT = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";
const LABEL_RE =
  /^cv_sweep032_syn(.+)_info(.+)_evt(.+)_reg(.+)_th(.+)_ds(.+)_n(\d+)$/;

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

function tokToNum(s: string): number {
  return parseFloat(s.replace(/p/g, "."));
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

type ComboKey = string;

function comboKeyFromParts(syn: string, info: string, evt: string, reg: string, th: string, ds: string): ComboKey {
  return `syn${syn}_info${info}_evt${evt}_reg${reg}_th${th}_ds${ds}`;
}

function parseLabel(label: string): {
  syn: string;
  info: string;
  evt: string;
  reg: string;
  th: string;
  ds: string;
  n: number;
  comboKey: ComboKey;
} | null {
  const m = label.match(LABEL_RE);
  if (!m) return null;
  const [, tsyn, tinfo, tevt, treg, tth, tds, tn] = m;
  const n = parseInt(tn!, 10);
  if (!Number.isFinite(n)) return null;
  return {
    syn: tsyn!,
    info: tinfo!,
    evt: tevt!,
    reg: treg!,
    th: tth!,
    ds: tds!,
    n,
    comboKey: comboKeyFromParts(tsyn!, tinfo!, tevt!, treg!, tth!, tds!),
  };
}

async function accuracyForVariant(
  prisma: PrismaClient,
  variantId: string,
  assetSymbol: string,
  retByKey: Map<string, number>,
): Promise<number | null> {
  const decisions = await prisma.agentDecision.findMany({
    where: { runVariantId: variantId },
    select: { step: true, action: true },
  });
  const byStep = new Map<number, Action[]>();
  for (const d of decisions) {
    const arr = byStep.get(d.step) ?? [];
    arr.push(d.action as Action);
    byStep.set(d.step, arr);
  }
  let ok = 0;
  let tot = 0;
  for (const [step, acts] of byStep) {
    const nextRet = retByKey.get(`${assetSymbol}:${step + 1}`);
    if (nextRet == null || !Number.isFinite(nextRet)) continue;
    const c = { BUY: 0, SELL: 0, HOLD: 0 };
    for (const a of acts) c[a]++;
    const fore = majorityDirection(c.BUY, c.SELL, c.HOLD);
    const truth = directionFromReturn(nextRet);
    tot++;
    if (fore === truth) ok++;
  }
  return tot > 0 ? ok / tot : null;
}

function parseEvalArgv(): { runId: string; csvPath: string | undefined } {
  const a = process.argv.slice(2);
  let runId = process.env.CV_SWEEP032_RUN_ID?.trim() || RUN_ID_DEFAULT;
  let csvPath: string | undefined = "/tmp/cv_sweep_032_results.csv";
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--runId" && a[i + 1]) runId = a[++i]!.trim();
    else if (a[i] === "--csv" && a[i + 1]) csvPath = a[++i]!.trim() || undefined;
    else if (a[i] === "--no-csv") csvPath = undefined;
  }
  return { runId, csvPath };
}

type RowOut = {
  syn: number;
  info: number;
  evt: number;
  reg: number;
  th: number;
  decisionScale: number;
  acc100: number | null;
  acc2000: number | null;
  acc10000: number | null;
  delta2000vs100: number | null;
  delta10000vs2000: number | null;
};

async function main(): Promise<void> {
  loadEnv();
  const { runId, csvPath } = parseEvalArgv();
  const prisma = new PrismaClient();

  const allReturns = await prisma.assetStepReturn.findMany({
    where: { runId },
    select: { assetSymbol: true, step: true, stepReturn: true },
  });
  const retByKey = new Map<string, number>();
  for (const r of allReturns) retByKey.set(`${r.assetSymbol}:${r.step}`, r.stepReturn);

  const variants = await prisma.runVariant.findMany({
    where: { runId, label: { startsWith: "cv_sweep032_" } },
    select: { id: true, label: true, assetSymbol: true },
  });

  const byCombo = new Map<ComboKey, Map<number, number | null>>();

  for (const v of variants) {
    if (v.label == null) continue;
    const p = parseLabel(v.label);
    if (!p) continue;
    const acc = await accuracyForVariant(prisma, v.id, v.assetSymbol, retByKey);
    if (!byCombo.has(p.comboKey)) byCombo.set(p.comboKey, new Map());
    byCombo.get(p.comboKey)!.set(p.n, acc);
  }

  await prisma.$disconnect();

  const rows: RowOut[] = [];
  for (const [ck, nmap] of byCombo) {
    const sampleLabel = variants.find(
      (v) => v.label != null && parseLabel(v.label)?.comboKey === ck,
    )?.label;
    const p = sampleLabel != null ? parseLabel(sampleLabel) : null;
    if (!p) continue;
    const acc100 = nmap.get(100) ?? null;
    const acc2000 = nmap.get(2000) ?? null;
    const acc10000 = nmap.get(10000) ?? null;
    const delta2000vs100 =
      acc100 != null && acc2000 != null ? acc2000 - acc100 : null;
    const delta10000vs2000 =
      acc2000 != null && acc10000 != null ? acc10000 - acc2000 : null;
    rows.push({
      syn: tokToNum(p.syn),
      info: tokToNum(p.info),
      evt: tokToNum(p.evt),
      reg: tokToNum(p.reg),
      th: tokToNum(p.th),
      decisionScale: tokToNum(p.ds),
      acc100,
      acc2000,
      acc10000,
      delta2000vs100,
      delta10000vs2000,
    });
  }

  rows.sort((a, b) => {
    const a10 = a.acc10000 ?? -1;
    const b10 = b.acc10000 ?? -1;
    if (b10 !== a10) return b10 - a10;
    const d102 = a.delta10000vs2000 ?? -1e9;
    const d102b = b.delta10000vs2000 ?? -1e9;
    if (d102b !== d102) return d102b - d102;
    const a2 = a.acc2000 ?? -1;
    const b2 = b.acc2000 ?? -1;
    return b2 - a2;
  });

  const pct = (x: number | null) => (x == null ? "" : `${(100 * x).toFixed(2)}%`);
  const delpp = (x: number | null) => (x == null ? "" : `${(100 * x).toFixed(2)}`);

  const head =
    "| syn | info | evt | reg | th | ds | acc100 | acc2000 | acc10000 | Δ2000−100 (pp) | Δ10000−2000 (pp) |\n|-----|------|-----|-----|----|----|--------|---------|----------|----------------|-------------------|";
  const lines = [head];
  const csvLines: string[] = [
    "syn,info,evt,reg,th,decisionScale,acc100,acc2000,acc10000,delta2000vs100,delta10000vs2000",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.syn} | ${r.info} | ${r.evt} | ${r.reg} | ${r.th} | ${r.decisionScale} | ${pct(r.acc100)} | ${pct(r.acc2000)} | ${pct(r.acc10000)} | ${delpp(r.delta2000vs100)} | ${delpp(r.delta10000vs2000)} |`,
    );
    csvLines.push(
      [
        r.syn,
        r.info,
        r.evt,
        r.reg,
        r.th,
        r.decisionScale,
        r.acc100 ?? "",
        r.acc2000 ?? "",
        r.acc10000 ?? "",
        r.delta2000vs100 ?? "",
        r.delta10000vs2000 ?? "",
      ].join(","),
    );
  }
  console.log(lines.join("\n"));
  if (csvPath) {
    fs.writeFileSync(csvPath, csvLines.join("\n"), "utf8");
    console.log(`\nWrote ${csvPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
