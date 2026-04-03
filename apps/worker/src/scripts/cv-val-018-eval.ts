/**
 * CV-VAL-018: plurality vs competence-weighted plurality accuracy + overlap from RunVariant.config.
 * Usage: npx tsx src/scripts/cv-val-018-eval.ts
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

function weightedForecast(
  decisions: { agentId: string; action: Action }[],
  weights: Map<string, number>,
): Action {
  let b = 0;
  let s = 0;
  let h = 0;
  for (const d of decisions) {
    const w = weights.get(d.agentId) ?? 0.5;
    if (d.action === "BUY") b += w;
    else if (d.action === "SELL") s += w;
    else h += w;
  }
  return majorityDirection(b, s, h);
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
  const labels = [100, 500, 2000, 5000, 10_000].map((n) => `cv_val018_${n}`);

  for (const label of labels) {
    const v = await prisma.runVariant.findFirst({
      where: { runId, label },
      select: { id: true, agents: true, config: true, assetSymbol: true },
    });
    if (!v) {
      console.log(JSON.stringify({ label, error: "variant not found" }));
      continue;
    }

    const cfg = v.config as Record<string, unknown> | null;
    const cv = cfg?.cvVal018 as { avgPairwiseEventOverlap?: number } | undefined;
    const avgOverlap = cv?.avgPairwiseEventOverlap ?? null;

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

    const agentIds = [...new Set(decisions.map((d) => d.agentId))];
    const traits = await prisma.runAgentTrait.findMany({
      where: {
        agentId: { in: agentIds },
        key: { in: ["understanding", "rationality"] },
      },
      select: { agentId: true, key: true, valueNum: true },
    });
    const wMap = new Map<string, number>();
    for (const aid of agentIds) {
      wMap.set(aid, 0.5);
    }
    const byAgent = new Map<string, Map<string, number>>();
    for (const t of traits) {
      if (t.valueNum == null || !Number.isFinite(t.valueNum)) continue;
      let m = byAgent.get(t.agentId);
      if (!m) {
        m = new Map();
        byAgent.set(t.agentId, m);
      }
      m.set(t.key, Math.max(0, Math.min(1, t.valueNum)));
    }
    for (const aid of agentIds) {
      const m = byAgent.get(aid);
      const u = m?.get("understanding") ?? 0.5;
      const r = m?.get("rationality") ?? 0.5;
      wMap.set(aid, 0.12 + 0.88 * u * r);
    }

    const byStep = new Map<number, { agentId: string; action: Action }[]>();
    for (const d of decisions) {
      let arr = byStep.get(d.step);
      if (!arr) {
        arr = [];
        byStep.set(d.step, arr);
      }
      arr.push({ agentId: d.agentId, action: d.action as Action });
    }

    let pOk = 0;
    let wOk = 0;
    let tot = 0;
    for (const [step, decs] of byStep) {
      const nextRet = retByKey.get(`${v.assetSymbol}:${step + 1}`);
      if (nextRet == null || !Number.isFinite(nextRet)) continue;
      const c = { BUY: 0, SELL: 0, HOLD: 0 };
      for (const d of decs) c[d.action]++;
      const pFore = majorityDirection(c.BUY, c.SELL, c.HOLD);
      const wFore = weightedForecast(decs, wMap);
      const truth = directionFromReturn(nextRet);
      tot++;
      if (pFore === truth) pOk++;
      if (wFore === truth) wOk++;
    }

    console.log(
      JSON.stringify({
        agents: v.agents,
        label,
        plurality: tot > 0 ? pOk / tot : null,
        weighted: tot > 0 ? wOk / tot : null,
        avg_overlap: avgOverlap,
      }),
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
