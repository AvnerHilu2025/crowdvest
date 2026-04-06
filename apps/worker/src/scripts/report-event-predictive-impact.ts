/**
 * Compare hybrid event channel on vs forced-zero on predictive quality (same runId / steps / seeds).
 *
 * Step returns are loaded like decide.ts (ordinal AssetStepReturn rows; synthetic zeros if insufficient rows).
 *
 * Usage:
 *   pnpm -C apps/worker run report:event-predictive-impact -- \
 *     --runId <uuid> --assetSymbols SPY,QQQ --steps 20 --seeds 1,42
 *
 * Optional: --output path.json  --eventModel hybrid_soft_gate_v1|pre_hybrid_hard_gate
 * Stdout is JSON only when --output is omitted.
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@crowdvest/db";
import {
  EVENT_MODEL_HYBRID_SOFT_GATE_V1,
  type EventModelName,
} from "../lib/archetype-profile";
import {
  computePredictiveMetrics,
  loadStepReturnsLikeDecide,
  variantIdsFromValidate,
  type MetricBlock,
} from "./predictive-impact-metrics";
import { loadEnv, runValidatePostfixSignals } from "./validate-postfix-signals";

function labelFor(symbol: string, mode: "full" | "zero"): string {
  return `evpi_${symbol}_${mode}`;
}

function deltaMetrics(withEvent: MetricBlock, withoutEvent: MetricBlock): MetricBlock {
  return {
    accuracy: withEvent.accuracy - withoutEvent.accuracy,
    avgReturnPerDecision: withEvent.avgReturnPerDecision - withoutEvent.avgReturnPerDecision,
    cumulativeReturn: withEvent.cumulativeReturn - withoutEvent.cumulativeReturn,
    sharpeLike: withEvent.sharpeLike - withoutEvent.sharpeLike,
    winRate: withEvent.winRate - withoutEvent.winRate,
    decisionCount: withEvent.decisionCount - withoutEvent.decisionCount,
  };
}

function parseArgv(): {
  runId: string;
  assetSymbols: string[];
  steps: number;
  seeds: number[];
  outputPath: string | null;
  eventModel: EventModelName;
} {
  const raw = process.argv.slice(2).filter((a) => a !== "--");
  let runId = "";
  let assetSymbolsStr = "";
  let steps = 20;
  let seedsStr = "";
  let outputPath: string | null = null;
  let eventModel: EventModelName = EVENT_MODEL_HYBRID_SOFT_GATE_V1;
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
    } else if (raw[i] === "--eventModel" && raw[i + 1]) {
      const v = raw[++i]!.trim();
      if (v !== "pre_hybrid_hard_gate" && v !== "hybrid_soft_gate_v1") {
        throw new Error(`--eventModel must be pre_hybrid_hard_gate|hybrid_soft_gate_v1, got: ${v}`);
      }
      eventModel = v as EventModelName;
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
  return { runId, assetSymbols, steps, seeds, outputPath, eventModel };
}

async function main(): Promise<void> {
  loadEnv();
  const { runId, assetSymbols, steps, seeds, outputPath, eventModel } = parseArgv();

  const prisma = new PrismaClient();
  const notes: string[] = [];

  const seriesBySymbol = new Map<string, number[]>();
  for (const sym of assetSymbols) {
    const { series, usedSynthetic, rowCount } = await loadStepReturnsLikeDecide(prisma, runId, sym, steps);
    seriesBySymbol.set(sym, series);
    if (usedSynthetic) {
      notes.push(
        `Predictive PnL for ${sym}: AssetStepReturn has ${rowCount} row(s) for this runId; decide requires >= ${steps} ordered rows (see decide.ts). Using synthetic zero returns — import market CSV for this run+symbol to get non-flat PnL metrics.`,
      );
    }
  }

  const allFullIds: string[] = [];
  const allZeroIds: string[] = [];

  const bySymbol: Record<
    string,
    {
      withEvent: MetricBlock;
      withoutEvent: MetricBlock;
      delta: MetricBlock;
    }
  > = {};

  try {
    for (const assetSymbol of assetSymbols) {
      const withRes = await runValidatePostfixSignals({
        runId,
        assetSymbol,
        steps,
        seeds,
        allowSmallCrowd: false,
        verbose: false,
        persist: "full",
        includeEventRows: false,
        label: labelFor(assetSymbol, "full"),
        eventModel,
        eventContribution: "full",
      });
      notes.push(...withRes.summary.notes.map((n) => `[evpi ${assetSymbol} full] ${n}`));

      const withoutRes = await runValidatePostfixSignals({
        runId,
        assetSymbol,
        steps,
        seeds,
        allowSmallCrowd: false,
        verbose: false,
        persist: "full",
        includeEventRows: false,
        label: labelFor(assetSymbol, "zero"),
        eventModel,
        eventContribution: "zero",
      });
      notes.push(...withoutRes.summary.notes.map((n) => `[evpi ${assetSymbol} zero] ${n}`));

      const fullIds = variantIdsFromValidate(withRes);
      const zeroIds = variantIdsFromValidate(withoutRes);
      allFullIds.push(...fullIds);
      allZeroIds.push(...zeroIds);

      const withEvent = await computePredictiveMetrics(prisma, runId, seriesBySymbol, fullIds, steps);
      const withoutEvent = await computePredictiveMetrics(prisma, runId, seriesBySymbol, zeroIds, steps);

      if (withEvent.decisionCount === 0) {
        notes.push(`No AgentDecision rows for ${assetSymbol} (with event); check RunVariant label ${labelFor(assetSymbol, "full")}.`);
      }
      if (withoutEvent.decisionCount === 0) {
        notes.push(`No AgentDecision rows for ${assetSymbol} (event zero); check RunVariant label ${labelFor(assetSymbol, "zero")}.`);
      }

      bySymbol[assetSymbol] = {
        withEvent,
        withoutEvent,
        delta: deltaMetrics(withEvent, withoutEvent),
      };
    }

    const withEventGlobal = await computePredictiveMetrics(prisma, runId, seriesBySymbol, allFullIds, steps);
    const withoutEventGlobal = await computePredictiveMetrics(prisma, runId, seriesBySymbol, allZeroIds, steps);

    const report = {
      comparison: {
        withEvent: withEventGlobal,
        withoutEvent: withoutEventGlobal,
        delta: deltaMetrics(withEventGlobal, withoutEventGlobal),
      },
      bySymbol,
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
