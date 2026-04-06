/**
 * Multi-seed validation for 4-channel signals after decide + crowd metrics.
 *
 * Usage:
 *   pnpm -C apps/worker run validate:postfix-signals -- \
 *     --runId <uuid> --assetSymbol SPY --steps 20 --seeds 1,42,123,777
 *
 * For each seed: runs `decide` (overwrite) → `compute-crowd-metrics` for that RunVariant,
 * then aggregates AgentDecision channel magnitudes and directional mix.
 *
 * By default child processes are silent so the script’s stdout is **only** the final JSON
 * (redirect: `... > report.json`). The pnpm/npm wrapper may still print a 1–2 line banner to stderr;
 * use `2>/dev/null` or `pnpm exec tsx src/scripts/validate-postfix-signals.ts -- ...` to avoid it.
 * Use `--verbose` to stream decide / compute-crowd-metrics logs to the terminal.
 *
 * Event vs FINAL_SIGNAL_TRACE: `decide` defaults to persist=lite (no AgentExperience), so
 * `evt_exp` is not in the DB and event metrics fall back to `AgentDecision.eventSignal` only.
 * This script defaults `--persist full` when invoking decide so `AgentExperience.actionJson.eventSignal`
 * holds `evt_exp` and validation can merge like `logFinalSignalTrace` in decide.ts. Pass `--persist lite`
 * to match a lite-only workflow (event stats may stay at 0 vs trace).
 * Optional `--includeEventRows` adds per-seed `eventRows` with step, agentId, event, event_exposure, event_behavior.
 * Optional `--label`, `--eventModel pre_hybrid_hard_gate|hybrid_soft_gate_v1`, and `--eventContribution full|zero`
 * (forwarded to decide) for model comparison / predictive-impact studies.
 */
import path from "path";
import fs from "fs";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@crowdvest/db";
import {
  getHybridEventBaselineMetadata,
  EVENT_MODEL_HYBRID_SOFT_GATE_V1,
  type EventModelName,
} from "../lib/archetype-profile";

const EPS = 1e-9;

/**
 * Matches `logFinalSignalTrace` event leg in decide.ts:
 * prefer upstream post-exposure `preSignals.event` when |pre| > EPS, else channel `eventSignal`.
 */
function effectiveEventLikeFinalTrace(
  preEvent: number | undefined,
  channelEvent: number | null | undefined,
): number {
  if (preEvent !== undefined && Math.abs(preEvent) > EPS) {
    return preEvent;
  }
  return channelEvent ?? 0;
}

function preEventFromExperienceActionJson(j: unknown): number | undefined {
  if (!j || typeof j !== "object") return undefined;
  const o = j as Record<string, unknown>;
  if (!("eventSignal" in o)) return undefined;
  const ev = o.eventSignal;
  if (typeof ev === "number" && Number.isFinite(ev)) return ev;
  return undefined;
}

function loadEnvFile(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

export function loadEnv(): void {
  const cwd = process.cwd();
  for (const p of [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, "..", ".env"),
    path.resolve(cwd, "..", "..", ".env"),
    path.resolve(__dirname, "..", "..", "..", ".env"),
  ]) {
    loadEnvFile(p);
  }
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set (load .env from repo root).");
  }
}

function parseArgv(): {
  runId: string;
  assetSymbol: string;
  steps: number;
  seeds: number[];
  allowSmallCrowd: boolean;
  verbose: boolean;
  /** Forwarded to decide.ts; default full so AgentExperience has evt_exp for event validation. */
  persist: "lite" | "full";
  includeEventRows: boolean;
  /** RunVariant label (distinct per model when comparing). */
  label: string;
  /** decide.ts event channel path. */
  eventModel: EventModelName;
  /** decide.ts: zero behavioral event channel before mixing (ablation). */
  eventContribution: "full" | "zero";
} {
  const raw = process.argv.slice(2).filter((a) => a !== "--");
  let runId = "";
  let assetSymbol = "RUN";
  let steps = 20;
  let seedsStr = "";
  let allowSmallCrowd = false;
  let verbose = false;
  let persist: "lite" | "full" = "full";
  let includeEventRows = false;
  let label = "";
  let eventModel: EventModelName = EVENT_MODEL_HYBRID_SOFT_GATE_V1;
  let eventContribution: "full" | "zero" = "full";
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "--runId" && raw[i + 1]) runId = raw[++i]!.trim();
    else if (raw[i] === "--assetSymbol" && raw[i + 1]) assetSymbol = raw[++i]!.trim() || "RUN";
    else if (raw[i] === "--steps" && raw[i + 1]) {
      const n = parseInt(raw[++i]!, 10);
      if (Number.isFinite(n) && n >= 1) steps = n;
    } else if (raw[i] === "--seeds" && raw[i + 1]) {
      seedsStr = raw[++i]!.trim();
    } else if (raw[i] === "--allowSmallCrowd") {
      allowSmallCrowd = true;
    } else if (raw[i] === "--verbose") {
      verbose = true;
    } else if (raw[i] === "--persist" && raw[i + 1]) {
      const v = raw[++i]!.trim().toLowerCase();
      if (v !== "lite" && v !== "full") {
        throw new Error(`--persist must be lite or full, got: ${v}`);
      }
      persist = v;
    } else if (raw[i] === "--includeEventRows") {
      includeEventRows = true;
    } else if (raw[i] === "--label" && raw[i + 1]) {
      label = raw[++i]!.trim();
    } else if (raw[i] === "--eventModel" && raw[i + 1]) {
      const v = raw[++i]!.trim();
      if (v !== "pre_hybrid_hard_gate" && v !== "hybrid_soft_gate_v1") {
        throw new Error(`--eventModel must be pre_hybrid_hard_gate|hybrid_soft_gate_v1, got: ${v}`);
      }
      eventModel = v as EventModelName;
    } else if (raw[i] === "--eventContribution" && raw[i + 1]) {
      const v = raw[++i]!.trim().toLowerCase();
      if (v !== "full" && v !== "zero") {
        throw new Error(`--eventContribution must be full|zero, got: ${v}`);
      }
      eventContribution = v as "full" | "zero";
    }
  }
  if (!runId) throw new Error("--runId is required");
  const seeds = seedsStr
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
  if (seeds.length === 0) throw new Error("--seeds is required (comma-separated integers, e.g. 1,42,123,777)");
  return {
    runId,
    assetSymbol,
    steps,
    seeds,
    allowSmallCrowd,
    verbose,
    persist,
    includeEventRows,
    label,
    eventModel,
    eventContribution,
  };
}

export type ValidatePostfixSignalsParams = ReturnType<typeof parseArgv>;

function meanAbs(vals: (number | null | undefined)[]): number {
  const xs = vals.filter((v): v is number => v != null && Number.isFinite(v));
  if (xs.length === 0) return 0;
  return xs.reduce((s, v) => s + Math.abs(v), 0) / xs.length;
}

function pctNonZero(vals: (number | null | undefined)[]): number {
  const xs = vals.filter((v): v is number => v != null && Number.isFinite(v));
  if (xs.length === 0) return 0;
  const nz = xs.filter((v) => Math.abs(v) > EPS).length;
  return (nz / xs.length) * 100;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((s, x) => s + (x - m) ** 2, 0) / values.length;
  return Math.sqrt(v);
}

function runWorkerScript(
  scriptName: "decide.ts" | "compute-crowd-metrics.ts",
  extraArgs: string[],
  workerRoot: string,
  verbose: boolean,
): void {
  const r = spawnSync(
    "pnpm",
    ["exec", "tsx", `src/scripts/${scriptName}`, "--", ...extraArgs],
    {
      cwd: workerRoot,
      stdio: verbose ? "inherit" : "ignore",
      env: process.env,
    },
  );
  if (r.error) throw r.error;
  if (r.status !== 0) {
    const hint = verbose ? "" : " Re-run with --verbose to see decide/compute output.";
    throw new Error(`${scriptName} exited with code ${r.status ?? "unknown"}.${hint}`);
  }
}

export async function runValidatePostfixSignals(
  params: ValidatePostfixSignalsParams,
): Promise<{
  baseline: ReturnType<typeof getHybridEventBaselineMetadata>;
  seeds: number[];
  bySeed: unknown[];
  summary: {
    avgAbsByChannel: unknown;
    pctNonZeroByChannel: unknown;
    directionalMix: unknown;
    signalStabilityAcrossSeeds: unknown;
    notes: string[];
  };
}> {
  const {
    runId,
    assetSymbol,
    steps,
    seeds,
    allowSmallCrowd,
    verbose,
    persist,
    includeEventRows,
    label,
    eventModel,
    eventContribution,
  } = params;
  const prisma = new PrismaClient();
  const workerRoot = path.join(__dirname, "..", "..");

  const bySeed: Array<{
    seed: number;
    runVariantId: string;
    rowCount: number;
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
    /** Where per-row event came from for metrics (see block after AgentDecision query). */
    eventChannelValidation: {
      decidePersist: "lite" | "full";
      agentExperienceRows: number;
      /** true when AgentExperience rows exist so evt_exp can be merged like FINAL_SIGNAL_TRACE. */
      canMergePreEventFromExperience: boolean;
    };
    eventRows?: Array<{
      step: number;
      agentId: string;
      event: number;
      event_exposure: number | null;
      event_behavior: number | null;
    }>;
    crowdMetrics?: {
      meanConsensus: number | null;
      meanPolarization: number | null;
      meanDiversityIndex: number | null;
      meanHerdingIndex: number | null;
      meanWisdomScore: number | null;
      meanSignal: number | null;
      steps: number;
    };
  }> = [];

  const notes: string[] = [];

  try {
    for (const seed of seeds) {
      const decideArgs = [
        "--runId",
        runId,
        "--assetSymbol",
        assetSymbol,
        "--steps",
        String(steps),
        "--seed",
        String(seed),
        "--label",
        label,
        "--overwrite",
        "--persist",
        persist,
        "--eventModel",
        eventModel,
        "--eventContribution",
        eventContribution,
      ];
      if (allowSmallCrowd) decideArgs.push("--allowSmallCrowd");

      runWorkerScript("decide.ts", decideArgs, workerRoot, verbose);

      const variant = await prisma.runVariant.findUnique({
        where: {
          runId_assetSymbol_seed_label: { runId, assetSymbol, seed, label },
        },
        select: { id: true },
      });
      if (!variant) {
        notes.push(`No RunVariant found after decide for seed=${seed}`);
        continue;
      }
      const runVariantId = variant.id;

      runWorkerScript(
        "compute-crowd-metrics.ts",
        ["--runId", runId, "--assetSymbol", assetSymbol, "--runVariantId", runVariantId, "--overwrite", "true"],
        workerRoot,
        verbose,
      );

      const decisions = await prisma.agentDecision.findMany({
        where: {
          runId,
          assetSymbol,
          runVariantId,
          step: { gte: 0, lt: steps },
        },
        select: {
          step: true,
          agentId: true,
          syntheticSignal: true,
          infoSignal: true,
          eventSignal: true,
          regimeSignal: true,
          action: true,
        },
      });

      const experiences = await prisma.agentExperience.findMany({
        where: { runId, runVariantId },
        select: { step: true, runAgentId: true, actionJson: true },
      });

      const preEventByStepAgent = new Map<string, number>();
      for (const e of experiences) {
        const pre = preEventFromExperienceActionJson(e.actionJson);
        if (pre !== undefined) {
          preEventByStepAgent.set(`${e.step}:${e.runAgentId}`, pre);
        }
      }

      // Per-row channel values for avgAbs / pctNonZero (and summary rollups).
      // decide.ts logFinalSignalTrace `signals.event`: prefer preSignals.event (post-exposure evt_exp)
      // when |pre| > EPS, else params.eventSignal (channel at trace). See ~278–282 in decide.ts.
      // Synthetic / info / regime here: AgentDecision.* (persisted row at commit).
      // Event: pre = AgentExperience.actionJson.eventSignal (evt_exp when decide --persist full), else
      // undefined; channel = AgentDecision.eventSignal; merge via effectiveEventLikeFinalTrace (same as evt above).
      const channelRows = decisions.map((d) => {
        const step = d.step;
        const agentId = d.agentId;
        const synthetic = d.syntheticSignal;
        const info = d.infoSignal;
        const regime = d.regimeSignal;
        const event_behavior = d.eventSignal;
        const preNum = preEventByStepAgent.get(`${step}:${agentId}`);
        const event_exposure = preNum !== undefined ? preNum : null;
        const event = effectiveEventLikeFinalTrace(preNum, event_behavior);
        return { step, agentId, synthetic, info, regime, event, event_exposure, event_behavior };
      });
      const syn = channelRows.map((r) => r.synthetic);
      const inf = channelRows.map((r) => r.info);
      const evtPrimary = channelRows.map((r) => r.event);
      const evtExposure = channelRows.map((r) => r.event_exposure);
      const evtBehavior = channelRows.map((r) => r.event_behavior);
      const reg = channelRows.map((r) => r.regime);

      let buy = 0;
      let sell = 0;
      let hold = 0;
      for (const d of decisions) {
        if (d.action === "BUY") buy++;
        else if (d.action === "SELL") sell++;
        else hold++;
      }

      const cmRows = await prisma.crowdMetrics.findMany({
        where: { runVariantId, assetSymbol },
        select: {
          consensus: true,
          polarization: true,
          diversityIndex: true,
          herdingIndex: true,
          wisdomScore: true,
          signal: true,
        },
      });

      const mean = (xs: (number | null)[]) => {
        const fs = xs.filter((x): x is number => x != null && Number.isFinite(x));
        if (fs.length === 0) return null;
        return fs.reduce((a, b) => a + b, 0) / fs.length;
      };

      const crowdMetrics =
        cmRows.length > 0
          ? {
              meanConsensus: mean(cmRows.map((r) => r.consensus)),
              meanPolarization: mean(cmRows.map((r) => r.polarization)),
              meanDiversityIndex: mean(cmRows.map((r) => r.diversityIndex)),
              meanHerdingIndex: mean(cmRows.map((r) => r.herdingIndex)),
              meanWisdomScore: mean(cmRows.map((r) => r.wisdomScore)),
              meanSignal: mean(cmRows.map((r) => r.signal)),
              steps: cmRows.length,
            }
          : undefined;

      if (persist === "full" && experiences.length === 0) {
        notes.push(
          `Seed ${seed}: expected AgentExperience rows (--persist full) but found 0; event metrics use AgentDecision.eventSignal only.`,
        );
      }

      bySeed.push({
        seed,
        runVariantId,
        rowCount: decisions.length,
        avgAbs: {
          synthetic: meanAbs(syn),
          info: meanAbs(inf),
          event: {
            primary: meanAbs(evtPrimary),
            exposure: meanAbs(evtExposure),
            behavior: meanAbs(evtBehavior),
          },
          regime: meanAbs(reg),
        },
        pctNonZero: {
          synthetic: pctNonZero(syn),
          info: pctNonZero(inf),
          event: {
            primary: pctNonZero(evtPrimary),
            exposure: pctNonZero(evtExposure),
            behavior: pctNonZero(evtBehavior),
          },
          regime: pctNonZero(reg),
        },
        directional: { buy, sell, hold },
        eventChannelValidation: {
          decidePersist: persist,
          agentExperienceRows: experiences.length,
          canMergePreEventFromExperience: experiences.length > 0,
        },
        ...(includeEventRows
          ? {
              eventRows: channelRows.map((r) => ({
                step: r.step,
                agentId: r.agentId,
                event: r.event,
                event_exposure: r.event_exposure,
                event_behavior: r.event_behavior,
              })),
            }
          : {}),
        ...(crowdMetrics ? { crowdMetrics } : {}),
      });
    }

    if (persist === "lite") {
      notes.push(
        "Event channel: decide used --persist lite (no AgentExperience); event metrics use AgentDecision.eventSignal only. Re-run with --persist full for FINAL_SIGNAL_TRACE parity.",
      );
    }

    const n = bySeed.length;
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    const avgAbsByChannel = {
      synthetic: avg(bySeed.map((b) => b.avgAbs.synthetic)),
      info: avg(bySeed.map((b) => b.avgAbs.info)),
      event: {
        primary: avg(bySeed.map((b) => b.avgAbs.event.primary)),
        exposure: avg(bySeed.map((b) => b.avgAbs.event.exposure)),
        behavior: avg(bySeed.map((b) => b.avgAbs.event.behavior)),
      },
      regime: avg(bySeed.map((b) => b.avgAbs.regime)),
    };

    const pctNonZeroByChannel = {
      synthetic: avg(bySeed.map((b) => b.pctNonZero.synthetic)),
      info: avg(bySeed.map((b) => b.pctNonZero.info)),
      event: {
        primary: avg(bySeed.map((b) => b.pctNonZero.event.primary)),
        exposure: avg(bySeed.map((b) => b.pctNonZero.event.exposure)),
        behavior: avg(bySeed.map((b) => b.pctNonZero.event.behavior)),
      },
      regime: avg(bySeed.map((b) => b.pctNonZero.regime)),
    };

    const directionalMix = {
      buyCount: bySeed.reduce((s, b) => s + b.directional.buy, 0),
      sellCount: bySeed.reduce((s, b) => s + b.directional.sell, 0),
      holdCount: bySeed.reduce((s, b) => s + b.directional.hold, 0),
    };

    const signalStabilityAcrossSeeds = {
      stdDevAvgAbsSynthetic: stdDev(bySeed.map((b) => b.avgAbs.synthetic)),
      stdDevAvgAbsInfo: stdDev(bySeed.map((b) => b.avgAbs.info)),
      stdDevAvgAbsEvent: {
        primary: stdDev(bySeed.map((b) => b.avgAbs.event.primary)),
        exposure: stdDev(bySeed.map((b) => b.avgAbs.event.exposure)),
        behavior: stdDev(bySeed.map((b) => b.avgAbs.event.behavior)),
      },
      stdDevAvgAbsRegime: stdDev(bySeed.map((b) => b.avgAbs.regime)),
    };

    const out = {
      baseline: getHybridEventBaselineMetadata(),
      seeds,
      bySeed,
      summary: {
        avgAbsByChannel,
        pctNonZeroByChannel,
        directionalMix,
        signalStabilityAcrossSeeds,
        notes,
      },
    };

    return out;
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  loadEnv();
  const out = await runValidatePostfixSignals(parseArgv());
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
