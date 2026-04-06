/**
 * Audit whether legacy metric tuning (hybrid event path vs pre-hybrid reference) holds on
 * data-correct measurement. Only symbols with AssetStepReturn row count >= steps are used.
 *
 * Usage:
 *   pnpm -C apps/worker run report:legacy-tuning-audit -- \
 *     --runId <uuid> --assetSymbols SPY,QQQ,IWM --steps 20 --seeds 1,42
 *
 * Optional: --output path.json  --includeEventAblation (extra hybrid full vs event-zero runs)
 * Stdout is JSON only when --output is omitted.
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@crowdvest/db";
import {
  EVENT_MODEL_HYBRID_SOFT_GATE_V1,
  EVENT_MODEL_PRE_HYBRID_HARD_GATE,
} from "../lib/archetype-profile";
import {
  computePredictiveMetrics,
  loadStepReturnsLikeDecide,
  variantIdsFromValidate,
  type MetricBlock,
} from "./predictive-impact-metrics";
import { loadEnv, runValidatePostfixSignals } from "./validate-postfix-signals";

type Verdict = "keep" | "re-test" | "revert";

function labelHybrid(sym: string): string {
  return `lta_hybrid_${sym}`;
}

function labelPre(sym: string): string {
  return `lta_pre_${sym}`;
}

function labelHybridEvtZero(sym: string): string {
  return `lta_hybrid_${sym}_evt0`;
}

function parseArgv(): {
  runId: string;
  assetSymbols: string[];
  steps: number;
  seeds: number[];
  outputPath: string | null;
  includeEventAblation: boolean;
} {
  const raw = process.argv.slice(2).filter((a) => a !== "--");
  let runId = "";
  let assetSymbolsStr = "";
  let steps = 20;
  let seedsStr = "";
  let outputPath: string | null = null;
  let includeEventAblation = false;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "--runId" && raw[i + 1]) runId = raw[++i]!.trim();
    else if (raw[i] === "--assetSymbols" && raw[i + 1]) assetSymbolsStr = raw[++i]!.trim();
    else if (raw[i] === "--steps" && raw[i + 1]) {
      const n = parseInt(raw[++i]!, 10);
      if (Number.isFinite(n) && n >= 1) steps = n;
    } else if (raw[i] === "--seeds" && raw[i + 1]) {
      seedsStr = raw[++i]!.trim();
    } else if (raw[i] === "--output" && raw[i + 1]) {
      outputPath = raw[++i]!.trim() || null;
    } else if (raw[i] === "--includeEventAblation") {
      includeEventAblation = true;
    }
  }
  if (!runId) throw new Error("--runId is required");
  const assetSymbols = assetSymbolsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (assetSymbols.length === 0) throw new Error("--assetSymbols is required (comma-separated)");
  const seeds = seedsStr
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
  if (seeds.length === 0) throw new Error("--seeds is required");
  return { runId, assetSymbols, steps, seeds, outputPath, includeEventAblation };
}

async function filterSymbolsWithCoverage(
  prisma: PrismaClient,
  runId: string,
  assetSymbols: string[],
  steps: number,
): Promise<{ ok: string[]; excluded: Array<{ symbol: string; reason: string; rowCount: number }> }> {
  const ok: string[] = [];
  const excluded: Array<{ symbol: string; reason: string; rowCount: number }> = [];
  for (const sym of assetSymbols) {
    const rowCount = await prisma.assetStepReturn.count({
      where: { runId, assetSymbol: sym },
    });
    if (rowCount >= steps) {
      ok.push(sym);
    } else {
      excluded.push({
        symbol: sym,
        reason: `AssetStepReturn row count ${rowCount} < required ${steps} (confirmed coverage)`,
        rowCount,
      });
    }
  }
  return { ok, excluded };
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function verdictHybridVsPre(
  hybrid: MetricBlock[],
  pre: MetricBlock[],
): { verdict: Verdict; rationale: string; meanDelta: Record<string, number> } {
  const n = Math.min(hybrid.length, pre.length);
  if (n === 0) {
    return {
      verdict: "re-test",
      rationale: "No per-symbol predictive metrics to compare.",
      meanDelta: {},
    };
  }
  const dSharpe = [];
  const dAcc = [];
  const dWin = [];
  const dAvgRet = [];
  for (let i = 0; i < n; i++) {
    dSharpe.push(hybrid[i]!.sharpeLike - pre[i]!.sharpeLike);
    dAcc.push(hybrid[i]!.accuracy - pre[i]!.accuracy);
    dWin.push(hybrid[i]!.winRate - pre[i]!.winRate);
    dAvgRet.push(hybrid[i]!.avgReturnPerDecision - pre[i]!.avgReturnPerDecision);
  }
  const meanDelta = {
    sharpeLike: mean(dSharpe),
    accuracy: mean(dAcc),
    winRate: mean(dWin),
    avgReturnPerDecision: mean(dAvgRet),
  };
  const composite = meanDelta.sharpeLike * 2 + meanDelta.accuracy * 0.4 + meanDelta.winRate * 0.4 + meanDelta.avgReturnPerDecision * 50;
  let verdict: Verdict;
  let rationale: string;
  if (composite > 0.008) {
    verdict = "keep";
    rationale =
      "Hybrid soft-gate path improves or matches reference on pooled directional deltas (sharpe/accuracy/win vs pre-hybrid); current tuning remains justified on this run.";
  } else if (composite < -0.008) {
    verdict = "revert";
    rationale =
      "Pre-hybrid reference scores better on predictive composites; consider reverting event-path tuning or re-validating inputs.";
  } else {
    verdict = "re-test";
    rationale =
      "Mixed or marginal deltas between hybrid and pre-hybrid; re-run with more seeds or additional symbols with coverage.";
  }
  return { verdict, rationale, meanDelta };
}

function verdictEventAblation(
  full: MetricBlock[],
  zero: MetricBlock[],
): { verdict: Verdict; rationale: string; meanDelta: Record<string, number> } {
  const n = Math.min(full.length, zero.length);
  if (n === 0) {
    return {
      verdict: "re-test",
      rationale: "No event ablation metrics.",
      meanDelta: {},
    };
  }
  const dSharpe = [];
  const dAcc = [];
  for (let i = 0; i < n; i++) {
    dSharpe.push(full[i]!.sharpeLike - zero[i]!.sharpeLike);
    dAcc.push(full[i]!.accuracy - zero[i]!.accuracy);
  }
  const meanDelta = {
    sharpeLike: mean(dSharpe),
    accuracy: mean(dAcc),
  };
  const composite = meanDelta.sharpeLike * 2 + meanDelta.accuracy * 0.3;
  let verdict: Verdict;
  let rationale: string;
  if (composite > 0.005) {
    verdict = "keep";
    rationale =
      "Behavioral event channel (full vs zero) improves predictive composites; event tuning adds signal on this measurement.";
  } else if (composite < -0.005) {
    verdict = "revert";
    rationale =
      "Forcing event to zero scores better or equal; behavioral event may be noise — consider reverting or softening event contribution.";
  } else {
    verdict = "re-test";
    rationale =
      "Event ablation effect is marginal; re-test with longer steps or more seeds before changing event weights.";
  }
  return { verdict, rationale, meanDelta };
}

type Slice = {
  predictive: MetricBlock;
  eventMetrics: {
    avgAbsEventLeg: unknown;
    pctNonZeroEventLeg: unknown;
  };
  directionalMix: unknown;
  signalStabilityAcrossSeeds: unknown;
};

function sliceFromValidate(
  result: Awaited<ReturnType<typeof runValidatePostfixSignals>>,
  predictive: MetricBlock,
): Slice {
  const s = result.summary;
  const abs = s.avgAbsByChannel as { event?: unknown } | undefined;
  const nz = s.pctNonZeroByChannel as { event?: unknown } | undefined;
  return {
    predictive,
    eventMetrics: {
      avgAbsEventLeg: abs?.event ?? null,
      pctNonZeroEventLeg: nz?.event ?? null,
    },
    directionalMix: s.directionalMix,
    signalStabilityAcrossSeeds: s.signalStabilityAcrossSeeds,
  };
}

async function main(): Promise<void> {
  loadEnv();
  const { runId, assetSymbols, steps, seeds, outputPath, includeEventAblation } = parseArgv();

  const prisma = new PrismaClient();
  const notes: string[] = [];

  const { ok: symbolsUsed, excluded: symbolsExcluded } = await filterSymbolsWithCoverage(
    prisma,
    runId,
    assetSymbols,
    steps,
  );

  if (symbolsUsed.length === 0) {
    await prisma.$disconnect();
    throw new Error(
      "No symbols pass AssetStepReturn coverage (need count >= steps for runId). " +
        symbolsExcluded.map((e) => `${e.symbol}: ${e.reason}`).join("; "),
    );
  }

  const seriesBySymbol = new Map<string, number[]>();
  for (const sym of symbolsUsed) {
    const { series, usedSynthetic, rowCount } = await loadStepReturnsLikeDecide(prisma, runId, sym, steps);
    seriesBySymbol.set(sym, series);
    if (usedSynthetic) {
      notes.push(
        `Unexpected synthetic series for ${sym} after coverage filter (rowCount=${rowCount}). Check DB consistency.`,
      );
    }
  }

  const bySymbol: Record<
    string,
    {
      tunedHybrid: Slice;
      referencePreHybrid: Slice;
      deltaPredictiveTunedMinusReference: MetricBlock;
      eventAblation?: { hybridFull: Slice; hybridEventZero: Slice; deltaPredictive: MetricBlock };
    }
  > = {};

  const hybridPredList: MetricBlock[] = [];
  const prePredList: MetricBlock[] = [];
  const abFullList: MetricBlock[] = [];
  const abZeroList: MetricBlock[] = [];
  const allHybridIds: string[] = [];
  const allPreIds: string[] = [];

  try {
    for (const assetSymbol of symbolsUsed) {
      const hybridRes = await runValidatePostfixSignals({
        runId,
        assetSymbol,
        steps,
        seeds,
        allowSmallCrowd: false,
        verbose: false,
        persist: "full",
        includeEventRows: false,
        label: labelHybrid(assetSymbol),
        eventModel: EVENT_MODEL_HYBRID_SOFT_GATE_V1,
        eventContribution: "full",
      });
      notes.push(...hybridRes.summary.notes.map((n) => `[lta hybrid ${assetSymbol}] ${n}`));

      const preRes = await runValidatePostfixSignals({
        runId,
        assetSymbol,
        steps,
        seeds,
        allowSmallCrowd: false,
        verbose: false,
        persist: "full",
        includeEventRows: false,
        label: labelPre(assetSymbol),
        eventModel: EVENT_MODEL_PRE_HYBRID_HARD_GATE,
        eventContribution: "full",
      });
      notes.push(...preRes.summary.notes.map((n) => `[lta pre ${assetSymbol}] ${n}`));

      const hybridIds = variantIdsFromValidate(hybridRes);
      const preIds = variantIdsFromValidate(preRes);
      allHybridIds.push(...hybridIds);
      allPreIds.push(...preIds);

      const predHybrid = await computePredictiveMetrics(prisma, runId, seriesBySymbol, hybridIds, steps);
      const predPre = await computePredictiveMetrics(prisma, runId, seriesBySymbol, preIds, steps);
      hybridPredList.push(predHybrid);
      prePredList.push(predPre);

      let ablationBlock: (typeof bySymbol)[string]["eventAblation"] = undefined;
      if (includeEventAblation) {
        const evt0Res = await runValidatePostfixSignals({
          runId,
          assetSymbol,
          steps,
          seeds,
          allowSmallCrowd: false,
          verbose: false,
          persist: "full",
          includeEventRows: false,
          label: labelHybridEvtZero(assetSymbol),
          eventModel: EVENT_MODEL_HYBRID_SOFT_GATE_V1,
          eventContribution: "zero",
        });
        notes.push(...evt0Res.summary.notes.map((n) => `[lta hybrid evt0 ${assetSymbol}] ${n}`));
        const evt0Ids = variantIdsFromValidate(evt0Res);
        const predZero = await computePredictiveMetrics(prisma, runId, seriesBySymbol, evt0Ids, steps);
        abFullList.push(predHybrid);
        abZeroList.push(predZero);
        ablationBlock = {
          hybridFull: sliceFromValidate(hybridRes, predHybrid),
          hybridEventZero: sliceFromValidate(evt0Res, predZero),
          deltaPredictive: {
            accuracy: predHybrid.accuracy - predZero.accuracy,
            avgReturnPerDecision: predHybrid.avgReturnPerDecision - predZero.avgReturnPerDecision,
            cumulativeReturn: predHybrid.cumulativeReturn - predZero.cumulativeReturn,
            sharpeLike: predHybrid.sharpeLike - predZero.sharpeLike,
            winRate: predHybrid.winRate - predZero.winRate,
            decisionCount: predHybrid.decisionCount - predZero.decisionCount,
          },
        };
      }

      bySymbol[assetSymbol] = {
        tunedHybrid: sliceFromValidate(hybridRes, predHybrid),
        referencePreHybrid: sliceFromValidate(preRes, predPre),
        deltaPredictiveTunedMinusReference: {
          accuracy: predHybrid.accuracy - predPre.accuracy,
          avgReturnPerDecision: predHybrid.avgReturnPerDecision - predPre.avgReturnPerDecision,
          cumulativeReturn: predHybrid.cumulativeReturn - predPre.cumulativeReturn,
          sharpeLike: predHybrid.sharpeLike - predPre.sharpeLike,
          winRate: predHybrid.winRate - predPre.winRate,
          decisionCount: predHybrid.decisionCount - predPre.decisionCount,
        },
        ...(ablationBlock ? { eventAblation: ablationBlock } : {}),
      };
    }

    const pooledHybrid = await computePredictiveMetrics(prisma, runId, seriesBySymbol, allHybridIds, steps);
    const pooledPre = await computePredictiveMetrics(prisma, runId, seriesBySymbol, allPreIds, steps);

    const recEventModel = verdictHybridVsPre(hybridPredList, prePredList);
    const recommendationsByTuningArea: Record<
      string,
      { verdict: Verdict; rationale: string; meanDelta?: Record<string, number>; pooledPredictiveDelta?: MetricBlock }
    > = {
      eventModelHybridSoftGateVsPreHybridHardGate: {
        verdict: recEventModel.verdict,
        rationale: recEventModel.rationale,
        meanDelta: recEventModel.meanDelta,
        pooledPredictiveDelta: {
          accuracy: pooledHybrid.accuracy - pooledPre.accuracy,
          avgReturnPerDecision: pooledHybrid.avgReturnPerDecision - pooledPre.avgReturnPerDecision,
          cumulativeReturn: pooledHybrid.cumulativeReturn - pooledPre.cumulativeReturn,
          sharpeLike: pooledHybrid.sharpeLike - pooledPre.sharpeLike,
          winRate: pooledHybrid.winRate - pooledPre.winRate,
          decisionCount: pooledHybrid.decisionCount - pooledPre.decisionCount,
        },
      },
    };

    if (includeEventAblation && abFullList.length > 0) {
      const recAb = verdictEventAblation(abFullList, abZeroList);
      recommendationsByTuningArea.eventBehavioralChannelFullVsZero = {
        verdict: recAb.verdict,
        rationale: recAb.rationale,
        meanDelta: recAb.meanDelta,
      };
    }

    const report = {
      runId,
      steps,
      seeds,
      tunedConfiguration: {
        eventModel: EVENT_MODEL_HYBRID_SOFT_GATE_V1,
        eventContribution: "full",
        description: "Current hybrid soft-gate + awareness path (production default).",
      },
      referenceConfiguration: {
        eventModel: EVENT_MODEL_PRE_HYBRID_HARD_GATE,
        eventContribution: "full",
        description: "Legacy binary social gate for event channel (closest in-repo reference to pre-hybrid behavior).",
      },
      symbolsRequested: assetSymbols,
      symbolsUsed,
      symbolsExcluded,
      predictivePooled: {
        tunedHybrid: pooledHybrid,
        referencePreHybrid: pooledPre,
        deltaTunedMinusReference: {
          accuracy: pooledHybrid.accuracy - pooledPre.accuracy,
          avgReturnPerDecision: pooledHybrid.avgReturnPerDecision - pooledPre.avgReturnPerDecision,
          cumulativeReturn: pooledHybrid.cumulativeReturn - pooledPre.cumulativeReturn,
          sharpeLike: pooledHybrid.sharpeLike - pooledPre.sharpeLike,
          winRate: pooledHybrid.winRate - pooledPre.winRate,
          decisionCount: pooledHybrid.decisionCount - pooledPre.decisionCount,
        },
      },
      bySymbol,
      recommendationsByTuningArea,
      notes,
    };

    const json = JSON.stringify(report, null, 2);
    if (outputPath) {
      const resolved = path.resolve(outputPath);
      const dir = path.dirname(resolved);
      if (dir !== ".") fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(resolved, json, "utf8");
    } else {
      console.log(json);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
