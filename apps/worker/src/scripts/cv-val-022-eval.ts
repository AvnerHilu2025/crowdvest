/**
 * CV-VAL-022: plurality accuracy vs crowd size (constrained-diversity models).
 * Usage: npx tsx src/scripts/cv-val-022-eval.ts
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

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

async function main(): Promise<void> {
  loadEnv();
  const prisma = new PrismaClient();
  const runId = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";
  const labels = [100, 500, 2000, 5000, 10_000].map((n) => `cv_val022_${n}`);

  for (const label of labels) {
    const v = await prisma.runVariant.findFirst({
      where: { runId, label },
      select: { id: true, agents: true, assetSymbol: true },
    });
    if (!v) {
      console.log(JSON.stringify({ label, error: "variant not found" }));
      continue;
    }

    const decisions = await prisma.agentDecision.findMany({
      where: { runVariantId: v.id },
      select: { agentId: true, step: true, action: true },
    });
    const returns = await prisma.assetStepReturn.findMany({
      where: { runId },
      select: { assetSymbol: true, step: true, stepReturn: true },
    });
    const retByKey = new Map<string, number>();
    for (const r of returns) retByKey.set(`${r.assetSymbol}:${r.step}`, r.stepReturn);

    const byStep = new Map<number, { agentId: string; action: Action }[]>();
    for (const d of decisions) {
      let arr = byStep.get(d.step);
      if (!arr) {
        arr = [];
        byStep.set(d.step, arr);
      }
      arr.push({ agentId: d.agentId, action: d.action as Action });
    }

    let ok = 0;
    let tot = 0;
    for (const [step, decs] of byStep) {
      const nextRet = retByKey.get(`${v.assetSymbol}:${step + 1}`);
      if (nextRet == null || !Number.isFinite(nextRet)) continue;
      const c = { BUY: 0, SELL: 0, HOLD: 0 };
      for (const d of decs) c[d.action]++;
      const fore = majorityDirection(c.BUY, c.SELL, c.HOLD);
      const truth = directionFromReturn(nextRet);
      tot++;
      if (fore === truth) ok++;
    }

    console.log(
      JSON.stringify({
        agents: v.agents,
        label,
        accuracy: tot > 0 ? ok / tot : null,
        stepsScored: tot,
      }),
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
