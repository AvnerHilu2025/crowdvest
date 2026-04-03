/**
 * CV-VAL-038: accuracy table — none (cv_val034) vs diverse_agents (cv_val038).
 * Usage: npx tsx src/scripts/cv-val-038-eval.ts
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

type Action = "BUY" | "SELL" | "HOLD";

const RUN_ID_DEFAULT = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";

const SYN = 0.4;
const INFO = 0.4;
const EVT = 0.2;
const REG = 0.2;
const TH = 0.02;
const DS = 0.7;
const NS = [100, 2000, 10_000] as const;
const MODES = ["none", "diverse_agents"] as const;

function numTok(x: number): string {
  const r = Math.round(x * 10000) / 10000;
  let s = r.toFixed(4);
  s = s.replace(/(\.\d*?[1-9])0+$/, "$1");
  s = s.replace(/\.0+$/, "");
  return s.replace(".", "p");
}

function labelFor(mode: (typeof MODES)[number], n: number): string {
  const tail = `syn${numTok(SYN)}_info${numTok(INFO)}_evt${numTok(EVT)}_reg${numTok(REG)}_th${numTok(TH)}_ds${numTok(DS)}_n${n}`;
  return mode === "diverse_agents"
    ? `cv_val038_diverse_agents_${tail}`
    : `cv_val034_none_${tail}`;
}

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

async function main(): Promise<void> {
  loadEnv();
  const prisma = new PrismaClient();
  const runId = process.env.CV_VAL038_RUN_ID?.trim() || RUN_ID_DEFAULT;

  const allReturns = await prisma.assetStepReturn.findMany({
    where: { runId },
    select: { assetSymbol: true, step: true, stepReturn: true },
  });
  const retByKey = new Map<string, number>();
  for (const r of allReturns) retByKey.set(`${r.assetSymbol}:${r.step}`, r.stepReturn);

  const lines: string[] = [];
  lines.push("| mode | 100 | 2000 | 10000 |");
  lines.push("|------|-----|------|-------|");

  for (const mode of MODES) {
    const cells: string[] = [];
    for (const n of NS) {
      const lb = labelFor(mode, n);
      const v = await prisma.runVariant.findFirst({
        where: { runId, label: lb },
        select: { id: true, assetSymbol: true },
      });
      if (!v) {
        cells.push("—");
        continue;
      }
      const acc = await accuracyForVariant(prisma, v.id, v.assetSymbol, retByKey);
      cells.push(acc == null ? "—" : `${(100 * acc).toFixed(2)}%`);
    }
    lines.push(`| ${mode} | ${cells.join(" | ")} |`);
  }

  await prisma.$disconnect();
  console.log(lines.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
