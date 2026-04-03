/**
 * CV-VAL-027: per-preset plurality accuracy grids.
 * Usage: npx tsx src/scripts/cv-val-027-eval.ts
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";
import { CV_VAL027_PRESET_NAMES } from "../lib/agent-decision-models";

type Action = "BUY" | "SELL" | "HOLD";

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

const NS = [100, 500, 2000, 5000, 10_000] as const;

async function main(): Promise<void> {
  loadEnv();
  const prisma = new PrismaClient();
  const runId = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";

  const allReturns = await prisma.assetStepReturn.findMany({
    where: { runId },
    select: { assetSymbol: true, step: true, stepReturn: true },
  });
  const retByKey = new Map<string, number>();
  for (const r of allReturns) retByKey.set(`${r.assetSymbol}:${r.step}`, r.stepReturn);

  const out: string[] = [];
  for (const preset of CV_VAL027_PRESET_NAMES) {
    out.push(`Preset: ${preset}`);
    out.push("| agents | accuracy |");
    out.push("|--------|----------|");
    for (const n of NS) {
      const label = `cv_val027_${preset}_${n}`;
      const v = await prisma.runVariant.findFirst({
        where: { runId, label },
        select: { id: true, assetSymbol: true },
      });
      if (!v) {
        out.push(`| ${n} | — |`);
        continue;
      }
      const decisions = await prisma.agentDecision.findMany({
        where: { runVariantId: v.id },
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
        const nextRet = retByKey.get(`${v.assetSymbol}:${step + 1}`);
        if (nextRet == null || !Number.isFinite(nextRet)) continue;
        const c = { BUY: 0, SELL: 0, HOLD: 0 };
        for (const a of acts) c[a]++;
        const fore = majorityDirection(c.BUY, c.SELL, c.HOLD);
        const truth = directionFromReturn(nextRet);
        tot++;
        if (fore === truth) ok++;
      }
      const acc = tot > 0 ? ok / tot : null;
      out.push(`| ${n} | ${acc == null ? "—" : `${(100 * acc).toFixed(2)}%`} |`);
    }
    out.push("");
  }

  await prisma.$disconnect();
  console.log(out.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
