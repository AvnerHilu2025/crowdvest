/**
 * Multi-symbol, multi-seed comparison report for the hybrid event baseline.
 * Reuses validate-postfix-signals (decide → compute-crowd-metrics → aggregates).
 *
 * Usage:
 *   pnpm -C apps/worker run report:hybrid-event-baseline -- \
 *     --runId <uuid> --assetSymbols SPY,QQQ,IWM --steps 20 --seeds 1,42,777
 *
 * Optional: --output path/to/report.json
 * Stdout is JSON only (redirect stderr to silence pnpm banner: 2>/dev/null).
 */
import fs from "fs";
import path from "path";
import { EVENT_MODEL_HYBRID_SOFT_GATE_V1, getHybridEventBaselineMetadata } from "../lib/archetype-profile";
import { loadEnv, runValidatePostfixSignals } from "./validate-postfix-signals";

type BySeedRow = {
  seed: number;
  avgAbs: {
    synthetic: number;
    info: number;
    event: { primary: number; exposure: number; behavior: number };
    regime: number;
  };
  pctNonZero: {
    synthetic: number;
    info: number;
    event: { primary: number; exposure: number; behavior: number };
    regime: number;
  };
  directional: { buy: number; sell: number; hold: number };
};

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
  if (assetSymbols.length === 0) throw new Error("--assetSymbols is required (comma-separated, e.g. SPY,QQQ)");
  const seeds = seedsStr
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
  if (seeds.length === 0) throw new Error("--seeds is required (comma-separated integers)");
  return { runId, assetSymbols, steps, seeds, outputPath };
}

function metricsFromBySeed(b: BySeedRow) {
  return {
    avgAbsByChannel: {
      synthetic: b.avgAbs.synthetic,
      info: b.avgAbs.info,
      event: {
        primary: b.avgAbs.event.primary,
        exposure: b.avgAbs.event.exposure,
        behavior: b.avgAbs.event.behavior,
      },
      regime: b.avgAbs.regime,
    },
    pctNonZeroByChannel: {
      synthetic: b.pctNonZero.synthetic,
      info: b.pctNonZero.info,
      event: {
        primary: b.pctNonZero.event.primary,
        exposure: b.pctNonZero.event.exposure,
        behavior: b.pctNonZero.event.behavior,
      },
      regime: b.pctNonZero.regime,
    },
    directionalMix: {
      buyCount: b.directional.buy,
      sellCount: b.directional.sell,
      holdCount: b.directional.hold,
    },
    event: {
      primary: b.avgAbs.event.primary,
      exposure: b.avgAbs.event.exposure,
      behavior: b.avgAbs.event.behavior,
    },
  };
}

async function main(): Promise<void> {
  loadEnv();
  const { runId, assetSymbols, steps, seeds, outputPath } = parseArgv();

  const baseline = getHybridEventBaselineMetadata();
  const runs: Array<{
    assetSymbol: string;
    seed: number;
    metrics: ReturnType<typeof metricsFromBySeed>;
  }> = [];
  const summaryBySymbol: Record<
    string,
    {
      avgAbsByChannel: unknown;
      pctNonZeroByChannel: unknown;
      directionalMix: unknown;
      signalStabilityAcrossSeeds: unknown;
    }
  > = {};
  const notes: string[] = [];

  for (const assetSymbol of assetSymbols) {
    const result = await runValidatePostfixSignals({
      runId,
      assetSymbol,
      steps,
      seeds,
      allowSmallCrowd: false,
      verbose: false,
      persist: "full",
      includeEventRows: false,
      label: "",
      eventModel: EVENT_MODEL_HYBRID_SOFT_GATE_V1,
      eventContribution: "full",
    });
    notes.push(...result.summary.notes);
    summaryBySymbol[assetSymbol] = {
      avgAbsByChannel: result.summary.avgAbsByChannel,
      pctNonZeroByChannel: result.summary.pctNonZeroByChannel,
      directionalMix: result.summary.directionalMix,
      signalStabilityAcrossSeeds: result.summary.signalStabilityAcrossSeeds,
    };
    for (const row of result.bySeed as BySeedRow[]) {
      runs.push({
        assetSymbol,
        seed: row.seed,
        metrics: metricsFromBySeed(row),
      });
    }
  }

  const report = {
    baseline,
    runs,
    summaryBySymbol,
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
