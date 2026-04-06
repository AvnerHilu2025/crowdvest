/**
 * Compare pre-hybrid (binary social gate) vs hybrid_soft_gate_v1 on the same runId/steps/seeds.
 * Uses distinct RunVariant labels so decide does not overwrite the same variant.
 *
 * Usage:
 *   pnpm -C apps/worker run report:event-model-comparison -- \
 *     --runId <uuid> --assetSymbols SPY,QQQ --steps 20 --seeds 1,42
 *
 * Optional: --output path.json
 * Stdout is JSON only when --output is omitted; with --output, file only.
 */
import fs from "fs";
import path from "path";
import {
  EVENT_MODEL_HYBRID_SOFT_GATE_V1,
  EVENT_MODEL_PRE_HYBRID_HARD_GATE,
} from "../lib/archetype-profile";
import { loadEnv, runValidatePostfixSignals } from "./validate-postfix-signals";

const LEFT_MODEL = EVENT_MODEL_PRE_HYBRID_HARD_GATE;
const RIGHT_MODEL = EVENT_MODEL_HYBRID_SOFT_GATE_V1;

function labelForEventModel(m: string): string {
  return `evtcmp_${m}`;
}

function parseArgv(): {
  runId: string;
  assetSymbols: string[];
  steps: number;
  seeds: number[];
  outputPath: string | null;
} {
  const raw = process.argv.slice(2).filter((a) => a !== "--");
  let runId = "";
  let assetSymbolsStr = "";
  let steps = 20;
  let seedsStr = "";
  let outputPath: string | null = null;
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
  return { runId, assetSymbols, steps, seeds, outputPath };
}

function pickComparableSummary(summary: {
  avgAbsByChannel: unknown;
  pctNonZeroByChannel: unknown;
  directionalMix: unknown;
  signalStabilityAcrossSeeds: unknown;
}) {
  return {
    avgAbsByChannel: summary.avgAbsByChannel,
    pctNonZeroByChannel: summary.pctNonZeroByChannel,
    directionalMix: summary.directionalMix,
    signalStabilityAcrossSeeds: summary.signalStabilityAcrossSeeds,
  };
}

function deltaDeep(left: unknown, right: unknown): unknown {
  if (
    typeof left === "number" &&
    typeof right === "number" &&
    Number.isFinite(left) &&
    Number.isFinite(right)
  ) {
    return right - left;
  }
  if (
    left &&
    right &&
    typeof left === "object" &&
    typeof right === "object" &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const L = left as Record<string, unknown>;
    const R = right as Record<string, unknown>;
    const keys = new Set([...Object.keys(L), ...Object.keys(R)]);
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      out[k] = deltaDeep(L[k], R[k]);
    }
    return out;
  }
  return right;
}

async function main(): Promise<void> {
  loadEnv();
  const { runId, assetSymbols, steps, seeds, outputPath } = parseArgv();

  const notes: string[] = [];
  const bySymbol: Record<
    string,
    {
      left: ReturnType<typeof pickComparableSummary>;
      right: ReturnType<typeof pickComparableSummary>;
      delta: unknown;
    }
  > = {};

  for (const assetSymbol of assetSymbols) {
    const left = await runValidatePostfixSignals({
      runId,
      assetSymbol,
      steps,
      seeds,
      allowSmallCrowd: false,
      verbose: false,
      persist: "full",
      includeEventRows: false,
      label: labelForEventModel(LEFT_MODEL),
      eventModel: LEFT_MODEL,
      eventContribution: "full",
    });
    notes.push(...left.summary.notes.map((n) => `[${LEFT_MODEL}] ${n}`));

    const right = await runValidatePostfixSignals({
      runId,
      assetSymbol,
      steps,
      seeds,
      allowSmallCrowd: false,
      verbose: false,
      persist: "full",
      includeEventRows: false,
      label: labelForEventModel(RIGHT_MODEL),
      eventModel: RIGHT_MODEL,
      eventContribution: "full",
    });
    notes.push(...right.summary.notes.map((n) => `[${RIGHT_MODEL}] ${n}`));

    const L = pickComparableSummary(left.summary);
    const R = pickComparableSummary(right.summary);
    bySymbol[assetSymbol] = {
      left: L,
      right: R,
      delta: deltaDeep(L, R),
    };
  }

  const report = {
    comparison: {
      leftModel: LEFT_MODEL,
      rightModel: RIGHT_MODEL,
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
