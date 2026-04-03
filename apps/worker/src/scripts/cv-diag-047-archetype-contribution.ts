/**
 * CV-DIAG-047: per-archetype contribution vs next-step return (CV-046 n=10000 labels).
 * Usage: npx tsx src/scripts/cv-diag-047-archetype-contribution.ts --runId <uuid> [--assetSymbol SPY]
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

type Action = "BUY" | "SELL" | "HOLD";

const STRUCTURED_TYPES = ["trend", "contrarian", "noise", "fundamental"] as const;
type StructuredArchetype = (typeof STRUCTURED_TYPES)[number];

const LABELS: { mix: number; label: string }[] = [1, 2, 3, 4, 5].map((mix) => ({
  mix,
  label: `cv_val046_mix${mix}_n10000`,
}));

const RUN_ID_DEFAULT = "1e7d4dab-f2e1-4d6d-9496-ebee9b22415b";

const CV046_STRUCT_RE = /cv046_mix\d+=(trend|contrarian|noise|fundamental)/;

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
  let runId = process.env.CV_DIAG047_RUN_ID?.trim() || RUN_ID_DEFAULT;
  let assetSymbol = "SPY";
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--runId" && a[i + 1]) runId = a[++i]!.trim();
    else if (a[i] === "--assetSymbol" && a[i + 1]) assetSymbol = a[++i]!.trim() || "SPY";
  }
  return { runId, assetSymbol };
}

function parseStructuredFromRationale(rationale: string | null): StructuredArchetype | "unknown" {
  if (!rationale) return "unknown";
  const m = rationale.match(CV046_STRUCT_RE);
  if (!m?.[1]) return "unknown";
  return m[1] as StructuredArchetype;
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

type Bucket = {
  buy: number;
  sell: number;
  hold: number;
  sumDist: number;
  nDist: number;
  ok: number;
  tot: number;
};

function emptyBucket(): Bucket {
  return { buy: 0, sell: 0, hold: 0, sumDist: 0, nDist: 0, ok: 0, tot: 0 };
}

/** Action distribution + mean distortedSignal over all rows for this archetype. */
function addActionDist(b: Bucket, action: Action, dist: number | null): void {
  if (action === "BUY") b.buy++;
  else if (action === "SELL") b.sell++;
  else b.hold++;
  if (dist != null && Number.isFinite(dist)) {
    b.sumDist += dist;
    b.nDist++;
  }
}

function crowdMeanSignalSignAccuracy(
  rows: { step: number; distortedSignal: number | null }[],
  assetSymbol: string,
  retByKey: Map<string, number>,
): number | null {
  const byStep = new Map<number, number[]>();
  for (const d of rows) {
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

function addAccuracy(b: Bucket, action: Action, truth: Action): void {
  b.tot++;
  if (action === truth) b.ok++;
}

function fmtPct(x: number, n: number): string {
  if (n <= 0) return "—";
  return `${((100 * x) / n).toFixed(1)}%`;
}

function fmtAcc(ok: number, tot: number): string {
  if (tot <= 0) return "—";
  return `${((100 * ok) / tot).toFixed(2)}%`;
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

  const pooled = new Map<StructuredArchetype | "unknown", Bucket>();
  for (const t of STRUCTURED_TYPES) pooled.set(t, emptyBucket());
  pooled.set("unknown", emptyBucket());

  const tableLines: string[] = [];
  tableLines.push("| mix | archetype | accuracy | meanDist | buy% | sell% | hold% |");
  tableLines.push("|-----|-----------|----------|----------|------|-------|-------|");

  for (const { mix, label } of LABELS) {
    const v = await prisma.runVariant.findFirst({
      where: { runId, assetSymbol, label },
      select: { id: true },
    });
    if (!v) {
      tableLines.push(`| ${mix} | (missing variant) | — | — | — | — | — |`);
      continue;
    }

    const decisions = await prisma.agentDecision.findMany({
      where: { runVariantId: v.id },
      select: { step: true, action: true, distortedSignal: true, rationale: true },
    });

    const crowdAcc = crowdMeanSignalSignAccuracy(decisions, assetSymbol, retByKey);
    tableLines.push(
      `| ${mix} | crowd_mean_signal_sign | ${crowdAcc == null ? "—" : `${(100 * crowdAcc).toFixed(2)}%`} | — | — | — | — |`,
    );

    const byArch = new Map<StructuredArchetype | "unknown", Bucket>();
    for (const t of STRUCTURED_TYPES) byArch.set(t, emptyBucket());
    byArch.set("unknown", emptyBucket());

    for (const d of decisions) {
      const action = d.action as Action;
      const arch = parseStructuredFromRationale(d.rationale);
      const b = byArch.get(arch)!;
      addActionDist(b, action, d.distortedSignal);
      const pb = pooled.get(arch)!;
      addActionDist(pb, action, d.distortedSignal);
    }

    for (const d of decisions) {
      const nextRet = retByKey.get(`${assetSymbol}:${d.step + 1}`);
      if (nextRet == null || !Number.isFinite(nextRet)) continue;
      const truth = directionFromReturn(nextRet);
      const action = d.action as Action;
      const arch = parseStructuredFromRationale(d.rationale);
      const b = byArch.get(arch)!;
      addAccuracy(b, action, truth);
      const pb = pooled.get(arch)!;
      addAccuracy(pb, action, truth);
    }

    for (const arch of [...STRUCTURED_TYPES, "unknown"] as const) {
      const b = byArch.get(arch)!;
      const n = b.buy + b.sell + b.hold;
      const meanDist = b.nDist > 0 ? b.sumDist / b.nDist : NaN;
      tableLines.push(
        `| ${mix} | ${arch} | ${fmtAcc(b.ok, b.tot)} | ${Number.isFinite(meanDist) ? meanDist.toFixed(4) : "—"} | ${fmtPct(b.buy, n)} | ${fmtPct(b.sell, n)} | ${fmtPct(b.hold, n)} |`,
      );
    }
  }

  await prisma.$disconnect();

  console.log(tableLines.join("\n"));
  console.log("");

  const ranked = STRUCTURED_TYPES.map((t) => {
    const b = pooled.get(t)!;
    const acc = b.tot > 0 ? b.ok / b.tot : NaN;
    return { t, acc, tot: b.tot };
  })
    .filter((x) => x.tot > 0)
    .sort((a, b) => b.acc - a.acc);

  const most = ranked[0];
  const least = ranked[ranked.length - 1];

  const nAcc = pooled.get("noise")!;
  const cAcc = pooled.get("contrarian")!;
  const tAcc = pooled.get("trend")!;
  const fAcc = pooled.get("fundamental")!;
  const avgTf =
    tAcc.tot + fAcc.tot > 0 ? (tAcc.ok + fAcc.ok) / (tAcc.tot + fAcc.tot) : NaN;

  console.log("--- Conclusion (pooled across mixes 1–5, per-agent vs next-step return) ---");
  if (most) {
    console.log(
      `Most accurate archetype: ${most.t} (${(100 * most.acc).toFixed(2)}%, n=${most.tot} scored steps).`,
    );
  }
  if (least && most && least.t !== most.t) {
    console.log(
      `Least accurate archetype: ${least.t} (${(100 * least.acc).toFixed(2)}%, n=${least.tot} scored steps).`,
    );
  }
  if (Number.isFinite(avgTf)) {
    const noiseVsTf = nAcc.tot > 0 ? nAcc.ok / nAcc.tot - avgTf : NaN;
    const contVsTf = cAcc.tot > 0 ? cAcc.ok / cAcc.tot - avgTf : NaN;
    console.log(
      `Trend+fundamental pooled accuracy: ${(100 * avgTf).toFixed(2)}%; noise vs that gap: ${Number.isFinite(noiseVsTf) ? (noiseVsTf * 100).toFixed(2) : "—"} pp; contrarian vs that gap: ${Number.isFinite(contVsTf) ? (contVsTf * 100).toFixed(2) : "—"} pp.`,
    );
    if (noiseVsTf < -0.005) {
      console.log(
        "Noise agents underperform trend+fundamental on average; larger noise share tends to dilute mean_signal_sign.",
      );
    } else if (noiseVsTf > 0.005) {
      console.log("Noise agents do not underperform trend+fundamental on this run (check sample size).");
    }
    if (contVsTf < -0.005) {
      console.log(
        "Contrarian agents underperform trend+fundamental on average; higher contrarian mix may hurt crowd accuracy.",
      );
    } else if (contVsTf > 0.005) {
      console.log("Contrarian agents do not underperform trend+fundamental on this run (check sample size).");
    }
  }
  if (tAcc.tot > 0 && fAcc.tot > 0) {
    const ta = tAcc.ok / tAcc.tot;
    const fa = fAcc.ok / fAcc.tot;
    if (ta > fa + 0.005) {
      console.log("Trend edges fundamental on pooled per-agent accuracy.");
    } else if (fa > ta + 0.005) {
      console.log("Fundamental edges trend on pooled per-agent accuracy.");
    } else {
      console.log("Trend and fundamental are similar on pooled per-agent accuracy.");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
