/**
 * CV-VAL-048: mean_signal_sign accuracy table for lean mix sweep (read-only).
 * Usage: npx tsx src/scripts/cv-val-048-eval.ts [--runId <uuid>] [--assetSymbol SPY]
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

type Action = "BUY" | "SELL" | "HOLD";

const RUN_ID_DEFAULT = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";

const MIX_LETTERS = ["A", "B", "C", "D"] as const;
const NS = [100, 2000, 10_000] as const;

function labelFor(letter: string, n: number): string {
  return `cv_val048_mix${letter}_n${n}`;
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

function parseArgv(): { runId: string; assetSymbol: string } {
  const a = process.argv.slice(2);
  let runId = process.env.CV_VAL048_RUN_ID?.trim() || RUN_ID_DEFAULT;
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

async function accuracyMeanSignalSign(
  prisma: PrismaClient,
  variantId: string,
  assetSymbol: string,
  retByKey: Map<string, number>,
): Promise<number | null> {
  const decisions = await prisma.agentDecision.findMany({
    where: { runVariantId: variantId },
    select: { step: true, distortedSignal: true },
  });
  const byStep = new Map<number, number[]>();
  for (const d of decisions) {
    const sig =
      d.distortedSignal != null && Number.isFinite(d.distortedSignal) ? d.distortedSignal : NaN;
    const list = byStep.get(d.step) ?? [];
    list.push(sig);
    byStep.set(d.step, list);
  }
  let ok = 0;
  let tot = 0;
  for (const [step, sigs] of byStep) {
    const finite = sigs.filter(Number.isFinite);
    const m = mean(finite);
    const nextRet = retByKey.get(`${assetSymbol}:${step + 1}`);
    if (nextRet == null || !Number.isFinite(nextRet)) continue;
    const truth = directionFromReturn(nextRet);
    const fore = forecastFromMean(m);
    tot++;
    if (fore === truth) ok++;
  }
  return tot > 0 ? ok / tot : null;
}

async function main(): Promise<void> {
  loadEnv();
  const { runId, assetSymbol } = parseArgv();
  const prisma = new PrismaClient();

  const returns = await prisma.assetStepReturn.findMany({
    where: { runId, assetSymbol },
    select: { step: true, stepReturn: true },
  });
  const retByKey = new Map<string, number>();
  for (const r of returns) retByKey.set(`${assetSymbol}:${r.step}`, r.stepReturn);

  const lines: string[] = [];
  lines.push("| mix | 100 | 2000 | 10000 |");
  lines.push("|-----|-----|------|-------|");

  for (const letter of MIX_LETTERS) {
    const cells: string[] = [];
    for (const n of NS) {
      const lb = labelFor(letter, n);
      const v = await prisma.runVariant.findFirst({
        where: { runId, assetSymbol, label: lb },
        select: { id: true },
      });
      if (!v) {
        cells.push("—");
        continue;
      }
      const acc = await accuracyMeanSignalSign(prisma, v.id, assetSymbol, retByKey);
      cells.push(acc == null ? "—" : `${(100 * acc).toFixed(2)}%`);
    }
    lines.push(`| ${letter} | ${cells.join(" | ")} |`);
  }

  await prisma.$disconnect();
  console.log(lines.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
