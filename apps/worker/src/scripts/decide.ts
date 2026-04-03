/**
 * CLI: pnpm -C apps/worker run decide -- --runId <uuid> [options]
 * Decision Engine v1 + Humanization Layer: generates BUY/SELL/HOLD with cognitive biases.
 * Idempotent unless --overwrite. Deterministic given same seed.
 *
 * Overwrite (--overwrite): deletes AgentDecision, AgentInfoState, AgentExperience, CrowdMetrics,
 * AgentReward, AgentState for (runId, assetSymbol). Does NOT delete AssetStepReturn (imported market data).
 *
 * Smoke: decide --overwrite -> compute-crowd-metrics -> SQL check CrowdMetrics:
 *   Expect min_step=0, max_step=steps-1, n=steps for runId+assetSymbol.
 *
 * Options:
 *   --runId <uuid>         Required. Run to generate decisions for.
 *   --steps 20             Number of steps (default: 20).
 *   --assetSymbol RUN      Asset symbol (default: RUN).
 *   --seed 123             Random seed for determinism.
 *   --overwrite            Replace existing decisions for run+asset.
 *   --agents 200           Agent count when auto-generating (default: 200).
 *   --autoGenerateAgents   If RunAgents missing, call API to generate (default: true). Set false to fail instead.
 *   --minAgents 100        Minimum agents required (default: 100). Enforces crowd wisdom.
 *   --allowSmallCrowd      Bypass minAgents check for dev debugging (default: false).
 *   --pipelineDiag         Print === DECISION PIPELINE DIAGNOSTICS === after all steps (observability only).
 *   --pipelineDiagSample N Agents per step in sample tables (default: 8, max: 500).
 *   --neutralMode          (deprecated; ignored — architecture is always independent-agent / sign(signal).)
 *   --herdingCrowdScale    (deprecated; ignored.)
 *
 * CV-ARCH-001/005 / CV-VAL-022/023: Exposure layer, **masked base_signal**, per-archetype
 * **scale / bias / smoothing / delay×delay_i**; **decorrelationShock** (mixed noise families);
 * decision_i = sign(signal_i). No crowd feedback into decisions.
 *
 * When no RunAgents exist and --autoGenerateAgents=true, decide calls POST /agents/generate (same as API).
 */
import path from "path";
import fs from "fs";
import { createHash } from "crypto";
import { Prisma, PrismaClient } from "@crowdvest/db";
import {
  clamp01,
  clamp11,
  randn,
  updateFatigue,
  updateAttention,
  type Action,
  type Biases,
  type HumanState,
} from "../decision/bias";
import {
  aggregateInfoSignal,
  computeEventSignalIndependent,
  hashToUnitFloat,
  type InfoEventInput,
} from "../lib/exposure";
import {
  selectAgentEventSubset,
  blindTopicsForAgent,
  filterEventsVisibleToAgent,
  approxMeanPairwiseJaccard,
  applyInformationExposureLayer,
  blendInfoWithUnderstanding,
  computeAgentSyntheticSignal,
  computeAgentRegimeSignal,
  signalQualityFromSource,
} from "../lib/agent-information-exposure";
import { computeRegimeState } from "../market/regime";
import { assertRunExists } from "../lib/assert-run-exists";
import { chunk } from "../lib/chunk";
import {
  decisionModelKindForAgent,
  computeBaseSignal,
  computeBaseSignalWithWeights,
  computeBaseSignalWithSharedPreset,
  featureMaskForAgent,
  delayMultiplierForAgent,
  decorrelationShock,
  applyConstrainedDiversityTransform,
  emptyModelActionHistogram,
  parseCvVal024Mode,
  cvVal024FlagsForArgv,
  getSharedWeightPreset,
  goldSoftWeights,
  goldDelaySteps,
  goldDelayFloat,
  goldLagAlpha,
  interpolateHistory,
  type CvVal024ModeLetter,
  type FeatureMask,
  type GoldSoftWeights,
} from "../lib/agent-decision-models";
import {
  applyVolatilityToSignal,
  confidenceFromProfile,
  effectiveArchetypeProfileForAgent,
  loadArchetypesConfig,
  resolveArchetypeConfigId,
  type EffectiveArchetypeProfile,
} from "../lib/archetype-profile";

/** Extra Gaussian shock scale for low-rationality agents (CV-ARCH-002). */
const RATIONALITY_NOISE_SCALE = 0.18;

/** Private idiosyncratic shock σ ∝ (1 - understanding) (CV-VAL-018). */
const PRIVATE_SIGNAL_SCALE = 0.1;

/** Tighten fraction of events sampled after blind spots (overlap control). */
const VAL018_TARGET_FRAC_SCALE = 0.78;

/** Samples per step for mean pairwise Jaccard of exposed event-id sets. */
const VAL018_OVERLAP_SAMPLES = 12_000;

function clampRegimeForBlend(x: number): number {
  return Math.tanh(x * 0.5);
}

function applyExposure(signal: number, factor: number): number {
  return signal * factor;
}

/** Reserved for per-channel delayed observations (history not wired yet). */
function applyLatency(current: number, history: number[], delay: number): number {
  if (delay <= 0 || history.length <= delay) return current;
  return history[history.length - 1 - delay]!;
}

/**
 * Deterministic competence draw: 30% low / 50% medium / 20% high (understanding + rationality).
 */
function sampleCompetenceTraits(agentId: string): { understanding: number; rationality: number } {
  const tierU = hashToUnitFloat(`cv-arch-002:${agentId}`);
  const rngU = createSeededRng(hashToSeed(`${agentId}:understanding`));
  const rngR = createSeededRng(hashToSeed(`${agentId}:rationality`));
  if (tierU < 0.3) {
    return {
      understanding: uniform(rngU, 0.08, 0.32),
      rationality: uniform(rngR, 0.08, 0.32),
    };
  }
  if (tierU < 0.8) {
    return {
      understanding: uniform(rngU, 0.36, 0.64),
      rationality: uniform(rngR, 0.36, 0.64),
    };
  }
  return {
    understanding: uniform(rngU, 0.68, 0.96),
    rationality: uniform(rngR, 0.68, 0.96),
  };
}

const DATABASE_URL_MISSING =
  "DATABASE_URL is not set. Create a .env at the repository root with DATABASE_URL=postgresql://...";

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

function loadEnv(): void {
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
    throw new Error(`${DATABASE_URL_MISSING} (cwd: ${cwd})`);
  }
}

const DEFAULT_MIN_AGENTS = 100;

export function validateCrowdSize(
  loaded: number,
  minAgents: number,
  allowSmallCrowd: boolean,
): { ok: true } | { ok: false; message: string } {
  if (allowSmallCrowd || loaded >= minAgents) return { ok: true };
  return {
    ok: false,
    message: `Not enough agents for run. loaded=${loaded} min=${minAgents}. Generate agents first: POST /agents/generate?runId=...&overwrite=true`,
  };
}

function parseBool(v: unknown, defaultVal: boolean): boolean {
  if (v === undefined || v === null) return defaultVal;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return defaultVal;
}

const DEFAULT_AGENTS = 200;

type PersistMode = "lite" | "full";

type CvVal029TransformMode =
  | "current"
  | "none"
  | "smooth_only"
  | "minimal_memory"
  | "amplify_extremes"
  | "diverse_agents";

/** CV-VAL-048: lean structured mix labels (trend / contrarian / noise / fundamental %). */
type CvVal048MixLetter = "A" | "B" | "C" | "D";

/** Compact decimal for cv_val033 / cv_val034 explicit labels (0.4 → 0p4). */
function cvVal029ExplicitNumToken(x: number): string {
  const r = Math.round(x * 10000) / 10000;
  let s = r.toFixed(4);
  s = s.replace(/(\.\d*?[1-9])0+$/, "$1");
  s = s.replace(/\.0+$/, "");
  return s.replace(".", "p");
}

function parseArgv(): {
  runId: string;
  runVariantId: string | undefined;
  steps: number;
  assetSymbol: string;
  seed: number | undefined;
  label: string | undefined;
  overwrite: boolean;
  agents: number;
  autoGenerateAgents: boolean;
  minAgents: number;
  allowSmallCrowd: boolean;
  persistMode: PersistMode;
  neutralMode: boolean;
  herdingCrowdScale: number;
  cvVal024: CvVal024ModeLetter | undefined;
  cvVal025: boolean;
  cvVal026: boolean;
  cvVal027: boolean;
  cvVal029: boolean;
  /** CV-VAL-038: per-agent diversity on transformMode=none (with --cvVal029). */
  cvVal038: boolean;
  /** CV-VAL-039: tuned (weaker) diversity ranges + cv_val039 label. */
  cvVal039: boolean;
  /** CV-VAL-040: structured archetypes on transformMode=none (with --cvVal029). */
  cvVal040: boolean;
  /** CV-VAL-046: structured mix sweep (1–5), mutually exclusive with --cvVal040. */
  cvVal046MixId: number | undefined;
  /** CV-VAL-048: lean structured mix (A–D), mutually exclusive with --cvVal040 / --cvVal046MixId. */
  cvVal048MixLetter: CvVal048MixLetter | undefined;
  weightPreset: string;
  /** CV-VAL-029 only: optional weight/threshold overrides (sweep / experiments). */
  overrideSyn: number | undefined;
  overrideInfo: number | undefined;
  overrideEvt: number | undefined;
  overrideReg: number | undefined;
  overrideThreshold: number | undefined;
  overrideDecisionScale: number | undefined;
  transformMode: CvVal029TransformMode;
  transformModeExplicit: boolean;
  /** When true, print === DECISION PIPELINE DIAGNOSTICS === (no change to decisions logic). */
  pipelineDiag: boolean;
  /** Agents per step in sample trace (first N by sorted id). */
  pipelineDiagSample: number;
} {
  const args = process.argv.slice(2);
  let runId = "";
  let runVariantId: string | undefined;
  let steps = 20;
  let assetSymbol = "RUN";
  let seed: number | undefined;
  let label: string | undefined;
  let overwrite = false; // Default: overwrite=false (idempotent)
  let agents = DEFAULT_AGENTS;
  let autoGenerateAgents = true;
  let minAgents = DEFAULT_MIN_AGENTS;
  let allowSmallCrowd = false;
  let persistMode: PersistMode = "lite";
  let neutralMode = false;
  let herdingCrowdScale = 1;
  let cvVal024: CvVal024ModeLetter | undefined;
  let cvVal025 = false;
  let cvVal026 = false;
  let cvVal027 = false;
  let cvVal029 = false;
  let cvVal038 = false;
  let cvVal039 = false;
  let cvVal040 = false;
  let cvVal046MixId: number | undefined;
  let cvVal048MixLetter: CvVal048MixLetter | undefined;
  let weightPreset = "baseline";
  let overrideSyn: number | undefined;
  let overrideInfo: number | undefined;
  let overrideEvt: number | undefined;
  let overrideReg: number | undefined;
  let overrideThreshold: number | undefined;
  let overrideDecisionScale: number | undefined;
  let transformMode: CvVal029TransformMode = "current";
  let transformModeExplicit = false;
  let pipelineDiag = false;
  let pipelineDiagSample = 8;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--runVariantId" && args[i + 1]) {
      runVariantId = args[++i]!.trim();
    } else if (arg === "--runId" && args[i + 1]) {
      runId = args[++i]!.trim();
    } else if (arg === "--steps" && args[i + 1]) {
      steps = Math.max(1, parseInt(args[++i]!, 10) || 20);
    } else if (arg === "--assetSymbol" && args[i + 1]) {
      assetSymbol = args[++i]!.trim() || "RUN";
    } else if (arg === "--seed" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n)) seed = n;
    } else if (arg === "--label" && args[i + 1]) {
      label = args[++i]!.trim();
    } else if (arg.startsWith("--overwrite=")) {
      const value = arg.slice("--overwrite=".length);
      overwrite = parseBool(value, false);
    } else if (arg === "--overwrite") {
      const next = args[i + 1];
      if (next != null && !String(next).startsWith("--")) {
        overwrite = parseBool(args[++i], false);
      } else {
        overwrite = true;
      }
    } else if (arg === "--agents" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n) && n >= 1) agents = Math.min(n, 10_000);
    } else if (arg.startsWith("--autoGenerateAgents=")) {
      autoGenerateAgents = parseBool(arg.slice("--autoGenerateAgents=".length), true);
    } else if (arg === "--autoGenerateAgents" && args[i + 1] != null) {
      autoGenerateAgents = parseBool(args[++i], true);
    } else if (arg === "--minAgents" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n) && n >= 1) minAgents = n;
    } else if (arg === "--allowSmallCrowd") {
      allowSmallCrowd = true;
    } else if (arg === "--persist" && args[i + 1]) {
      const v = String(args[++i]).trim().toLowerCase();
      if (v !== "lite" && v !== "full") {
        throw new Error(`--persist must be lite or full, got: ${v}`);
      }
      persistMode = v as PersistMode;
    } else if (arg === "--neutralMode") {
      const nextNm = args[i + 1];
      if (nextNm != null && !String(nextNm).startsWith("--")) {
        neutralMode = parseBool(args[++i], false);
      } else {
        neutralMode = true;
      }
    } else if (arg.startsWith("--neutralMode=")) {
      neutralMode = parseBool(arg.slice("--neutralMode=".length), false);
    } else if (arg === "--herdingCrowdScale" && args[i + 1]) {
      const x = parseFloat(args[++i]!);
      if (Number.isFinite(x) && x >= 0 && x <= 10) herdingCrowdScale = x;
    } else if (arg.startsWith("--herdingCrowdScale=")) {
      const x = parseFloat(arg.slice("--herdingCrowdScale=".length));
      if (Number.isFinite(x) && x >= 0 && x <= 10) herdingCrowdScale = x;
    } else if (arg === "--cvVal024" && args[i + 1]) {
      const raw = args[++i]!.trim();
      const m = parseCvVal024Mode(raw);
      if (!m) {
        throw new Error(`--cvVal024 must be a single letter A–H, got: ${raw}`);
      }
      cvVal024 = m;
    } else if (arg === "--cvVal025") {
      cvVal025 = true;
    } else if (arg === "--cvVal026") {
      cvVal026 = true;
    } else if (arg === "--cvVal027") {
      cvVal027 = true;
    } else if (arg === "--cvVal029") {
      cvVal029 = true;
    } else if (arg === "--cvVal038") {
      cvVal038 = true;
    } else if (arg === "--cvVal039") {
      cvVal039 = true;
    } else if (arg === "--cvVal040") {
      cvVal040 = true;
    } else if (arg === "--cvVal046MixId" && args[i + 1]) {
      const raw = parseInt(args[++i]!, 10);
      if (Number.isFinite(raw) && raw >= 1 && raw <= 5) cvVal046MixId = raw;
    } else if (arg === "--cvVal048MixLetter" && args[i + 1]) {
      const raw = args[++i]!.trim().toUpperCase();
      if (raw === "A" || raw === "B" || raw === "C" || raw === "D") cvVal048MixLetter = raw;
    } else if (arg === "--weightPreset" && args[i + 1]) {
      weightPreset = args[++i]!.trim();
    } else if (arg === "--overrideSyn" && args[i + 1]) {
      const x = parseFloat(args[++i]!);
      if (Number.isFinite(x)) overrideSyn = x;
    } else if (arg === "--overrideInfo" && args[i + 1]) {
      const x = parseFloat(args[++i]!);
      if (Number.isFinite(x)) overrideInfo = x;
    } else if (arg === "--overrideEvt" && args[i + 1]) {
      const x = parseFloat(args[++i]!);
      if (Number.isFinite(x)) overrideEvt = x;
    } else if (arg === "--overrideReg" && args[i + 1]) {
      const x = parseFloat(args[++i]!);
      if (Number.isFinite(x)) overrideReg = x;
    } else if (arg === "--overrideThreshold" && args[i + 1]) {
      const x = parseFloat(args[++i]!);
      if (Number.isFinite(x)) overrideThreshold = x;
    } else if (arg === "--overrideDecisionScale" && args[i + 1]) {
      const x = parseFloat(args[++i]!);
      if (Number.isFinite(x)) overrideDecisionScale = x;
    } else if (arg === "--transformMode" && args[i + 1]) {
      const raw = args[++i]!.trim();
      if (
        raw !== "current" &&
        raw !== "none" &&
        raw !== "smooth_only" &&
        raw !== "minimal_memory" &&
        raw !== "amplify_extremes" &&
        raw !== "diverse_agents"
      ) {
        throw new Error(
          `--transformMode must be current|none|smooth_only|minimal_memory|amplify_extremes|diverse_agents, got: ${raw}`,
        );
      }
      transformMode = raw as CvVal029TransformMode;
      transformModeExplicit = true;
    } else if (arg === "--pipelineDiag") {
      pipelineDiag = true;
    } else if (arg.startsWith("--pipelineDiag=")) {
      pipelineDiag = parseBool(arg.slice("--pipelineDiag=".length), false);
    } else if (arg === "--pipelineDiagSample" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n) && n >= 1) pipelineDiagSample = Math.min(n, 500);
    }
  }
  if (cvVal029) {
    cvVal027 = false;
  }
  if (cvVal027 || cvVal029) {
    cvVal026 = false;
    cvVal025 = false;
    cvVal024 = undefined;
  }
  if (cvVal026) {
    cvVal025 = false;
    cvVal024 = undefined;
  }
  if (cvVal025) {
    cvVal024 = undefined;
  }
  if (cvVal038 && cvVal039) {
    throw new Error("--cvVal038 and --cvVal039 are mutually exclusive");
  }
  if (cvVal040 && (cvVal038 || cvVal039)) {
    throw new Error("--cvVal040 is mutually exclusive with --cvVal038 and --cvVal039");
  }
  if (cvVal046MixId != null && (cvVal038 || cvVal039)) {
    throw new Error("--cvVal046MixId is mutually exclusive with --cvVal038 and --cvVal039");
  }
  if (cvVal046MixId != null && cvVal040) {
    throw new Error("--cvVal046MixId is mutually exclusive with --cvVal040");
  }
  if (cvVal048MixLetter != null && (cvVal038 || cvVal039)) {
    throw new Error("--cvVal048MixLetter is mutually exclusive with --cvVal038 and --cvVal039");
  }
  if (cvVal048MixLetter != null && cvVal040) {
    throw new Error("--cvVal048MixLetter is mutually exclusive with --cvVal040");
  }
  if (cvVal048MixLetter != null && cvVal046MixId != null) {
    throw new Error("--cvVal048MixLetter is mutually exclusive with --cvVal046MixId");
  }
  if (cvVal038) {
    if (!cvVal029) {
      throw new Error("--cvVal038 requires --cvVal029");
    }
    if (!transformModeExplicit || transformMode !== "none") {
      throw new Error("--cvVal038 requires explicit --transformMode none");
    }
  }
  if (cvVal039) {
    if (!cvVal029) {
      throw new Error("--cvVal039 requires --cvVal029");
    }
    if (!transformModeExplicit || transformMode !== "none") {
      throw new Error("--cvVal039 requires explicit --transformMode none");
    }
  }
  if (cvVal040) {
    if (!cvVal029) {
      throw new Error("--cvVal040 requires --cvVal029");
    }
    if (!transformModeExplicit || transformMode !== "none") {
      throw new Error("--cvVal040 requires explicit --transformMode none");
    }
  }
  if (cvVal046MixId != null) {
    if (!cvVal029) {
      throw new Error("--cvVal046MixId requires --cvVal029");
    }
    if (!transformModeExplicit || transformMode !== "none") {
      throw new Error("--cvVal046MixId requires explicit --transformMode none");
    }
  }
  if (cvVal048MixLetter != null) {
    if (!cvVal029) {
      throw new Error("--cvVal048MixLetter requires --cvVal029");
    }
    if (!transformModeExplicit || transformMode !== "none") {
      throw new Error("--cvVal048MixLetter requires explicit --transformMode none");
    }
  }
  if (cvVal029 && label == null) {
    if (transformModeExplicit) {
      if (cvVal048MixLetter != null) {
        label = `cv_val048_mix${cvVal048MixLetter}_n${agents}`;
      } else if (cvVal046MixId != null) {
        label = `cv_val046_mix${cvVal046MixId}_n${agents}`;
      } else {
        const w = getSharedWeightPreset(weightPreset);
        const effSyn = overrideSyn ?? w.syn;
        const effInfo = overrideInfo ?? w.info;
        const effEvt = overrideEvt ?? w.evt;
        const effReg = overrideReg ?? w.reg;
        const effTh = overrideThreshold ?? 0.02;
        const effDs = overrideDecisionScale ?? 0.7;
        const labelTail =
          `syn${cvVal029ExplicitNumToken(effSyn)}_info${cvVal029ExplicitNumToken(effInfo)}_evt${cvVal029ExplicitNumToken(effEvt)}_reg${cvVal029ExplicitNumToken(effReg)}_th${cvVal029ExplicitNumToken(effTh)}_ds${cvVal029ExplicitNumToken(effDs)}_n${agents}`;
        label =
          transformMode === "amplify_extremes"
            ? `cv_val037_amplify_extremes_${labelTail}`
            : cvVal040
              ? `cv_val040_structured_agents_${labelTail}`
              : cvVal039
                ? `cv_val039_diverse_tuned_${labelTail}`
                : transformMode === "diverse_agents" || cvVal038
                  ? `cv_val038_diverse_agents_${labelTail}`
                  : `cv_val034_${transformMode}_${labelTail}`;
      }
    } else {
      label = `cv_val029_${weightPreset}_${agents}`;
    }
  }
  if (cvVal027 && label == null) {
    label = `cv_val027_${weightPreset}_${agents}`;
  }
  if (cvVal026 && label == null) {
    label = `cv_val026_${agents}`;
  }
  if (cvVal025 && label == null) {
    label = `cv_val025_${agents}`;
  }
  if (cvVal024 && label == null) {
    label = `cv_val024_${cvVal024}_${agents}`;
  }
  if (process.env.DEBUG_ARGS === "1" || process.env.DEBUG_ARGS === "true") {
    console.log(`[DEBUG_ARGS] raw argv: ${JSON.stringify(process.argv)}`);
    console.log(`[DEBUG_ARGS] parsed overwrite: ${overwrite} autoGenerateAgents: ${autoGenerateAgents} agents: ${agents} persistMode: ${persistMode}`);
  }
  if (!runId) {
    const fromEnv = process.env.RUN_ID ?? process.env.runId;
    if (fromEnv) runId = String(fromEnv).trim();
  }
  if (runVariantId) {
    if (!runId) runId = ""; // will be resolved from RunVariant
  } else {
    if (!runId) throw new Error("RUN_ID is required");
  }
  return {
    runId,
    runVariantId,
    steps,
    assetSymbol,
    seed,
    label,
    overwrite,
    agents,
    autoGenerateAgents,
    minAgents,
    allowSmallCrowd,
    persistMode,
    neutralMode,
    herdingCrowdScale,
    cvVal024,
    cvVal025,
    cvVal026,
    cvVal027,
    cvVal029,
    cvVal038,
    cvVal039,
    cvVal040,
    cvVal046MixId,
    cvVal048MixLetter,
    weightPreset,
    overrideSyn,
    overrideInfo,
    overrideEvt,
    overrideReg,
    overrideThreshold,
    overrideDecisionScale,
    transformMode,
    transformModeExplicit,
    pipelineDiag:
      (pipelineDiag as unknown) === true || (pipelineDiag as unknown) === "true",
    pipelineDiagSample: Math.min(500, Number(pipelineDiagSample || 8)),
  };
}

/** Mulberry32 seeded RNG. */
function createSeededRng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash string to 32-bit int for deterministic agent RNG seed. */
function hashToSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** Legacy CV-ARCH-001 mix scaled by CV-ARCH-052 effective archetype weights (default path). */
const ARCH052_LEGACY_SYN = 0.38;
const ARCH052_LEGACY_INFO = 0.38;
const ARCH052_LEGACY_EVT = 0.14;
const ARCH052_LEGACY_REG = 0.5;

function baseSignalArch052Default(
  channels: {
    synthetic_i: number;
    regime_i: number;
    infoSignal: number;
    eventSignal: number;
  },
  mask: FeatureMask | null,
  ap: EffectiveArchetypeProfile,
): number {
  if (mask) {
    const synWeight = (mask.syn ? ARCH052_LEGACY_SYN : 0) * ap.wSyn;
    const infoWeight = (mask.info ? ARCH052_LEGACY_INFO : 0) * ap.wInfo;
    const eventWeight = (mask.evt ? ARCH052_LEGACY_EVT : 0) * ap.wEvt;
    const regimeWeight = (mask.reg ? ARCH052_LEGACY_REG : 0) * ap.wReg;
    const syntheticI = channels.synthetic_i;
    const infoSignal = channels.infoSignal;
    const eventSignal = channels.eventSignal;
    const regimeI = channels.regime_i;
    const regimeBlend = clampRegimeForBlend(regimeI);
    const regimeWeightEffective = regimeWeight * 0.3;
    const sum = synWeight + infoWeight + eventWeight + regimeWeight;
    if (sum < 1e-9) return 0;
    const finalSignal =
      synWeight * syntheticI +
      infoWeight * infoSignal +
      eventWeight * eventSignal +
      regimeWeightEffective * regimeBlend;
    return clamp11(finalSignal / sum);
  }
  const synWeight = ARCH052_LEGACY_SYN * ap.wSyn;
  const infoWeight = ARCH052_LEGACY_INFO * ap.wInfo;
  const eventWeight = ARCH052_LEGACY_EVT * ap.wEvt;
  const regimeWeight = ARCH052_LEGACY_REG * ap.wReg;
  const syntheticI = channels.synthetic_i;
  const infoSignal = channels.infoSignal;
  const eventSignal = channels.eventSignal;
  const regimeI = channels.regime_i;
  const regimeBlend = clampRegimeForBlend(regimeI);
  const regimeWeightEffective = regimeWeight * 0.3;
  const finalSignal =
    synWeight * syntheticI +
    infoWeight * infoSignal +
    eventWeight * eventSignal +
    regimeWeightEffective * regimeBlend;
  return clamp11(finalSignal);
}

/** Default path gains a small symmetric deadband; archetype scales the band width. */
const ARCH052_DEFAULT_BASE_TH = 0.011;

/** CV-ARCH-058: slightly amplify additive archetype bias so directional archetypes separate in action mix. */
const ARCH058_ARCHETYPE_BIAS_SCALE = 1.22;

function actionFromSignalArch052Default(signal: number, threshold: number): Action {
  if (signal > threshold) return "BUY";
  if (signal < -threshold) return "SELL";
  return "HOLD";
}

type PipelineDiagPathTag = "cv029" | "cv027" | "cv026" | "cv025" | "arch052";

type PipelineDiagRow = {
  step: number;
  agentId: string;
  archetypeLabel: string;
  pathTag: PipelineDiagPathTag;
  synthetic_market: number;
  synthetic_i: number;
  info_signal: number;
  event_signal: number;
  regime_raw: number;
  regime_i: number;
  distorted_signal: number;
  /** Signal compared to threshold (scaled for cv029, else pre-threshold signal). */
  final_signal: number;
  /** Positive half-width for BUY/SELL band; 0 if path uses sign(signal) only. */
  threshold: number;
  dominant_leg: string;
  action: Action;
  syn_exp: number;
  info_exp: number;
  evt_exp: number;
  reg_exp: number;
};

function dominantLegAbsChannels(ch: {
  synthetic_i: number;
  infoSignal: number;
  eventSignal: number;
  regime_i: number;
}): string {
  const parts: [string, number][] = [
    ["synthetic", Math.abs(ch.synthetic_i)],
    ["info", Math.abs(ch.infoSignal)],
    ["event", Math.abs(ch.eventSignal)],
    ["regime", Math.abs(ch.regime_i)],
  ];
  parts.sort((a, b) => b[1] - a[1]);
  return parts[0]![0]!;
}

function dominantLegCv029(
  effSyn: number,
  effInfo: number,
  effEvt: number,
  effReg: number,
  arch: EffectiveArchetypeProfile,
  ch: { synthetic_i: number; infoSignal: number; eventSignal: number; regime_i: number },
): string {
  const parts: [string, number][] = [
    ["synthetic", Math.abs(effSyn * arch.wSyn * ch.synthetic_i)],
    ["info", Math.abs(effInfo * arch.wInfo * ch.infoSignal)],
    ["event", Math.abs(effEvt * arch.wEvt * ch.eventSignal)],
    ["regime", Math.abs(effReg * arch.wReg * ch.regime_i)],
  ];
  parts.sort((a, b) => b[1] - a[1]);
  return parts[0]![0]!;
}

function dominantLegArch052Default(
  channels: { synthetic_i: number; regime_i: number; infoSignal: number; eventSignal: number },
  mask: FeatureMask | null,
  ap: EffectiveArchetypeProfile,
): string {
  if (mask) {
    const ws = (mask.syn ? ARCH052_LEGACY_SYN : 0) * ap.wSyn;
    const wi = (mask.info ? ARCH052_LEGACY_INFO : 0) * ap.wInfo;
    const we = (mask.evt ? ARCH052_LEGACY_EVT : 0) * ap.wEvt;
    const wr = (mask.reg ? ARCH052_LEGACY_REG : 0) * ap.wReg;
    const parts: [string, number][] = [
      ["synthetic", Math.abs(ws * channels.synthetic_i)],
      ["info", Math.abs(wi * channels.infoSignal)],
      ["event", Math.abs(we * channels.eventSignal)],
      ["regime", Math.abs(wr * channels.regime_i)],
    ];
    parts.sort((a, b) => b[1] - a[1]);
    return parts[0]![0]!;
  }
  const ws = ARCH052_LEGACY_SYN * ap.wSyn;
  const wi = ARCH052_LEGACY_INFO * ap.wInfo;
  const we = ARCH052_LEGACY_EVT * ap.wEvt;
  const wr = ARCH052_LEGACY_REG * ap.wReg;
  const parts: [string, number][] = [
    ["synthetic", Math.abs(ws * channels.synthetic_i)],
    ["info", Math.abs(wi * channels.infoSignal)],
    ["event", Math.abs(we * channels.eventSignal)],
    ["regime", Math.abs(wr * channels.regime_i)],
  ];
  parts.sort((a, b) => b[1] - a[1]);
  return parts[0]![0]!;
}

function sampleStdDev(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  let s = 0;
  for (const x of xs) {
    const d = x - mean;
    s += d * d;
  }
  return Math.sqrt(s / (n - 1));
}

function printPipelineDiagnostics(
  rows: PipelineDiagRow[],
  opts: { steps: number; sampleSize: number; agentIdsSorted: string[] },
): void {
  const sampleSet = new Set(opts.agentIdsSorted.slice(0, Math.min(opts.sampleSize, opts.agentIdsSorted.length)));
  const lines: string[] = [];
  lines.push("");
  lines.push("=== DECISION PIPELINE DIAGNOSTICS ===");
  lines.push("");
  lines.push("--- A. Per-step sample (same market synthetic_signal for all agents at step; *_i = per-agent) ---");
  lines.push("");
  for (let st = 0; st < opts.steps; st++) {
    const stepRows = rows.filter((r) => r.step === st && sampleSet.has(r.agentId));
    if (stepRows.length === 0) continue;
    lines.push(`step=${st}`);
    lines.push(
      "| agentId | archetype | path | syn_mkt | syn_i | info | evt | reg_raw | reg_i | syn_e | inf_e | evt_e | reg_e | distorted | final | th | dom | act |",
    );
    lines.push(
      "|---------|-----------|------|---------|-------|------|-----|---------|-------|-------|-------|-------|-------|-----------|-------|----|-----|-----|",
    );
    for (const r of stepRows.sort((a, b) => a.agentId.localeCompare(b.agentId))) {
      const aid = r.agentId.length > 8 ? `${r.agentId.slice(0, 8)}…` : r.agentId;
      lines.push(
        `| ${aid} | ${r.archetypeLabel.replace(/\|/g, "\\|")} | ${r.pathTag} | ${r.synthetic_market.toFixed(4)} | ${r.synthetic_i.toFixed(4)} | ${r.info_signal.toFixed(4)} | ${r.event_signal.toFixed(4)} | ${r.regime_raw.toFixed(4)} | ${r.regime_i.toFixed(4)} | ${r.syn_exp.toFixed(4)} | ${r.info_exp.toFixed(4)} | ${r.evt_exp.toFixed(4)} | ${r.reg_exp.toFixed(4)} | ${r.distorted_signal.toFixed(4)} | ${r.final_signal.toFixed(4)} | ${r.threshold.toFixed(5)} | ${r.dominant_leg} | ${r.action} |`,
      );
    }
    lines.push("");
  }

  const byArch = new Map<string, PipelineDiagRow[]>();
  for (const r of rows) {
    const k = r.archetypeLabel;
    const list = byArch.get(k) ?? [];
    list.push(r);
    byArch.set(k, list);
  }
  const archKeys = [...byArch.keys()].sort((a, b) => a.localeCompare(b));

  lines.push("--- B. Per-archetype aggregates (all agents × steps) ---");
  lines.push("");
  lines.push(
    "| archetype | n | mean_final_signal | std_final_signal | BUY% | SELL% | HOLD% | mean_distorted | std_distorted | mean_threshold |",
  );
  lines.push(
    "|-----------|---|-------------------|------------------|------|-------|-------|----------------|---------------|----------------|",
  );
  const meanFinalByArch: number[] = [];
  const meanThrByArch: number[] = [];
  for (const ak of archKeys) {
    const list = byArch.get(ak)!;
    const finals = list.map((x) => x.final_signal);
    const dists = list.map((x) => x.distorted_signal);
    const ths = list.map((x) => x.threshold);
    const meanF = finals.reduce((a, b) => a + b, 0) / finals.length;
    const meanD = dists.reduce((a, b) => a + b, 0) / dists.length;
    const meanTh = ths.reduce((a, b) => a + b, 0) / ths.length;
    meanFinalByArch.push(meanF);
    meanThrByArch.push(meanTh);
    let b = 0,
      s = 0,
      h = 0;
    for (const x of list) {
      if (x.action === "BUY") b++;
      else if (x.action === "SELL") s++;
      else h++;
    }
    const t = list.length;
    lines.push(
      `| ${ak.replace(/\|/g, "\\|")} | ${t} | ${meanF.toFixed(6)} | ${sampleStdDev(finals).toFixed(6)} | ${((100 * b) / t).toFixed(2)} | ${((100 * s) / t).toFixed(2)} | ${((100 * h) / t).toFixed(2)} | ${meanD.toFixed(6)} | ${sampleStdDev(dists).toFixed(6)} | ${meanTh.toFixed(6)} |`,
    );
  }
  lines.push("");

  const spreadMeans =
    meanFinalByArch.length >= 2 ? Math.max(...meanFinalByArch) - Math.min(...meanFinalByArch) : 0;
  const stdAcrossArchMeans = sampleStdDev(meanFinalByArch);
  lines.push("--- C. Compression / clustering hints ---");
  lines.push("");
  lines.push(
    `A. Signal compression: spread of archetype mean(final_signal)=${spreadMeans.toFixed(6)} | std across archetype means=${stdAcrossArchMeans.toFixed(6)} (low spread → similar average post-pipeline signal across types)`,
  );
  const thrSpread = meanThrByArch.length >= 2 ? Math.max(...meanThrByArch) - Math.min(...meanThrByArch) : 0;
  const thrStd = sampleStdDev(meanThrByArch);
  lines.push(
    `B. Threshold clustering: spread of mean(threshold) per archetype=${thrSpread.toFixed(6)} | std=${thrStd.toFixed(6)} (low spread → similar effective bands)`,
  );

  const domCount = new Map<string, Map<string, number>>();
  for (const ak of archKeys) {
    const m = new Map<string, number>();
    for (const r of byArch.get(ak)!) {
      m.set(r.dominant_leg, (m.get(r.dominant_leg) ?? 0) + 1);
    }
    domCount.set(ak, m);
  }
  lines.push("C. Dominant raw channel (weighted for arch052/cv029 rows; abs max for sign paths):");
  for (const ak of archKeys) {
    const m = domCount.get(ak)!;
    const tot = [...m.values()].reduce((a, b) => a + b, 0);
    const parts = [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([leg, c]) => `${leg}:${((100 * c) / tot).toFixed(1)}%`)
      .join(", ");
    lines.push(`  - ${ak}: ${parts}`);
  }
  lines.push("");
  lines.push(`rows_captured=${rows.length}`);
  process.stdout.write(lines.join("\n") + "\n");
}

/** Deterministic UUID from name (sha256 first 16 bytes, UUID v4 form). */
function uuidFromName(name: string): string {
  const hex = createHash("sha256").update(name).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function uniform(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** CV-ARCH-038: once-per-agent diversity params (deterministic). */
type Cv038DiverseParams = {
  noiseSigma: number;
  sensitivity: number;
  thresholdFactor: number;
};

function cv038DiverseParamsForAgent(agentId: string, globalSeed: number): Cv038DiverseParams {
  const rng = createSeededRng(hashToSeed(`cv-arch-038:${globalSeed}:${agentId}`));
  return {
    noiseSigma: uniform(rng, 0, 0.05),
    sensitivity: uniform(rng, 0.8, 1.2),
    thresholdFactor: uniform(rng, 0.8, 1.2),
  };
}

/** CV-ARCH-039: weaker per-agent diversity (noise/sensitivity/threshold ranges). */
function cv039DiverseParamsForAgent(agentId: string, globalSeed: number): Cv038DiverseParams {
  const rng = createSeededRng(hashToSeed(`cv-arch-039:${globalSeed}:${agentId}`));
  return {
    noiseSigma: uniform(rng, 0, 0.02),
    sensitivity: uniform(rng, 0.9, 1.1),
    thresholdFactor: uniform(rng, 0.9, 1.1),
  };
}

/** CV-ARCH-040: four structured archetypes; no random sigma/sensitivity/threshold. */
const CV040_STRUCTURED_TYPES = ["trend", "contrarian", "noise", "fundamental"] as const;
type Cv040StructuredType = (typeof CV040_STRUCTURED_TYPES)[number];

/** Even split: sort agent ids, assign types[i % 4] (deterministic). */
function cv040StructuredTypeByAgentFromList(agents: { id: string }[]): Map<string, Cv040StructuredType> {
  const sorted = [...agents].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const m = new Map<string, Cv040StructuredType>();
  for (let i = 0; i < sorted.length; i++) {
    m.set(sorted[i]!.id, CV040_STRUCTURED_TYPES[i % 4]!);
  }
  return m;
}

/** CV-ARCH-046: percent mix (trend, contrarian, noise, fundamental), must sum to 100. */
const CV046_MIXES: Record<number, [number, number, number, number]> = {
  1: [25, 25, 25, 25],
  2: [30, 20, 20, 30],
  3: [35, 15, 15, 35],
  4: [20, 30, 10, 40],
  5: [40, 20, 10, 30],
};

/** CV-VAL-048: lean mixes (trend, contrarian, noise, fundamental), each sums to 100. */
const CV048_MIXES: Record<CvVal048MixLetter, [number, number, number, number]> = {
  A: [35, 5, 10, 50],
  B: [40, 5, 5, 50],
  C: [30, 10, 10, 50],
  D: [25, 5, 5, 65],
};

function cv046StructuredTypeByMix(agents: { id: string }[], mixId: number): Map<string, Cv040StructuredType> {
  const pct = CV046_MIXES[mixId];
  if (!pct) {
    throw new Error(`CV-046: mixId must be 1–5, got ${mixId}`);
  }
  const n = agents.length;
  const sorted = [...agents].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const counts = pct.map((p) => Math.floor((n * p) / 100));
  let deficit = n - counts.reduce((a, b) => a + b, 0);
  let di = 0;
  while (deficit > 0) {
    counts[di % 4]++;
    di++;
    deficit--;
  }
  const seq: Cv040StructuredType[] = [];
  for (let t = 0; t < 4; t++) {
    for (let k = 0; k < counts[t]!; k++) {
      seq.push(CV040_STRUCTURED_TYPES[t]!);
    }
  }
  while (seq.length < n) seq.push("fundamental");
  while (seq.length > n) seq.pop();
  const m = new Map<string, Cv040StructuredType>();
  for (let i = 0; i < sorted.length; i++) {
    m.set(sorted[i]!.id, seq[i]!);
  }
  return m;
}

function cv048StructuredTypeByMix(agents: { id: string }[], letter: CvVal048MixLetter): Map<string, Cv040StructuredType> {
  const pct = CV048_MIXES[letter];
  const n = agents.length;
  const sorted = [...agents].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const counts = pct.map((p) => Math.floor((n * p) / 100));
  let deficit = n - counts.reduce((a, b) => a + b, 0);
  let di = 0;
  while (deficit > 0) {
    counts[di % 4]++;
    di++;
    deficit--;
  }
  const seq: Cv040StructuredType[] = [];
  for (let t = 0; t < 4; t++) {
    for (let k = 0; k < counts[t]!; k++) {
      seq.push(CV040_STRUCTURED_TYPES[t]!);
    }
  }
  while (seq.length < n) seq.push("fundamental");
  while (seq.length > n) seq.pop();
  const m = new Map<string, Cv040StructuredType>();
  for (let i = 0; i < sorted.length; i++) {
    m.set(sorted[i]!.id, seq[i]!);
  }
  return m;
}

/** CV-ARCH-050: ensure Archetype reference rows for structured roles; returns role name -> Archetype.id. */
async function ensureCvStructuredArchetypeRows(prisma: PrismaClient): Promise<Map<Cv040StructuredType, string>> {
  const m = new Map<Cv040StructuredType, string>();
  for (const name of CV040_STRUCTURED_TYPES) {
    const row = await prisma.archetype.upsert({
      where: { name },
      create: { name, description: "CV structured crowd role (engineering)" },
      update: {},
      select: { id: true },
    });
    m.set(name, row.id);
  }
  return m;
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

const POOL_RUN_PREFIX = "agent-pool-";

/** Ensure global agent pool has at least agentsCount RunAgents with deterministic ids. Returns pool runId. */
async function ensureAgentPool(
  prisma: PrismaClient,
  datasetVersion: string,
  agentsCount: number,
): Promise<string> {
  let poolRun = await prisma.simulationRun.findFirst({
    where: { name: { startsWith: POOL_RUN_PREFIX }, datasetVersion },
    select: { id: true },
  });
  if (!poolRun) {
    poolRun = await prisma.simulationRun.create({
      data: {
        name: `${POOL_RUN_PREFIX}${datasetVersion.slice(0, 20)}`,
        status: "PENDING",
        seed: 0,
        modelVersion: "stage1",
        datasetVersion,
        schemaVersion: "v1",
        startedAt: new Date(),
      },
      select: { id: true },
    });
  }
  const poolRunId = poolRun.id;
  const existingCount = await prisma.runAgent.count({ where: { runId: poolRunId } });
  if (existingCount >= agentsCount) {
    return poolRunId;
  }
  await ensureCvStructuredArchetypeRows(prisma);
  const archetypes = await prisma.archetype.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });
  const toCreate = agentsCount - existingCount;
  const pad = String(agentsCount).length;
  for (let i = existingCount; i < agentsCount; i++) {
    const namespace = "crowdvest-agent-v1";
    const name = `${datasetVersion}:${i}`;
    const agentId = uuidFromName(`${namespace}:${name}`);
    const rng = createSeededRng(hashToSeed(name));
    const herding = uniform(rng, 0, 1);
    const lossAversion = uniform(rng, 0, 1);
    const overconfidence = uniform(rng, 0, 1);
    const recencyBias = uniform(rng, 0, 1);
    const confirmationBias = uniform(rng, 0, 1);
    const fomo = uniform(rng, 0, 1);
    const anchoring = uniform(rng, 0, 1);
    const attentionLevel = uniform(rng, 0.3, 0.95);
    const emotionalVolatility = uniform(rng, 0, 1);
    const fatigue = uniform(rng, 0, 0.2);
    const rot = archetypes.length > 0 ? archetypes[i % archetypes.length]! : null;
    const agentName = `Agent ${String(i + 1).padStart(pad, "0")}`;
    await prisma.runAgent.create({
      data: {
        id: agentId,
        runId: poolRunId,
        name: agentName,
        archetype: rot?.name ?? null,
        archetypeId: rot?.id ?? null,
        biases: { herding, lossAversion, overconfidence, recencyBias, confirmationBias, fomo, anchoring },
        humanState: { attentionLevel, emotionalVolatility, fatigue },
      },
    });
    const traits: { agentId: string; key: string; valueNum: number | null; valueStr: string | null }[] = [];
    const age = Math.round(uniform(rng, 18, 75));
    traits.push({ agentId, key: "age", valueNum: age, valueStr: null });
    traits.push({ agentId, key: "gender", valueNum: null, valueStr: pick(rng, ["M", "F", "X"]) });
    traits.push({ agentId, key: "riskTolerance", valueNum: uniform(rng, 0, 1), valueStr: null });
    traits.push({ agentId, key: "confidence", valueNum: uniform(rng, 0, 1), valueStr: null });
    traits.push({ agentId, key: "hesitation", valueNum: uniform(rng, 0, 1), valueStr: null });
    traits.push({ agentId, key: "impulsivity", valueNum: uniform(rng, 0, 1), valueStr: null });
    traits.push({ agentId, key: "patience", valueNum: uniform(rng, 0, 1), valueStr: null });
    traits.push({ agentId, key: "lossAversion", valueNum: lossAversion, valueStr: null });
    traits.push({ agentId, key: "herding", valueNum: herding, valueStr: null });
    traits.push({ agentId, key: "contrarian", valueNum: uniform(rng, 0, 1), valueStr: null });
    traits.push({ agentId, key: "overconfidence", valueNum: overconfidence, valueStr: null });
    traits.push({ agentId, key: "recencyBias", valueNum: recencyBias, valueStr: null });
    traits.push({ agentId, key: "confirmationBias", valueNum: confirmationBias, valueStr: null });
    traits.push({ agentId, key: "fomo", valueNum: fomo, valueStr: null });
    traits.push({ agentId, key: "anchoring", valueNum: anchoring, valueStr: null });
    traits.push({ agentId, key: "attentionLevel", valueNum: attentionLevel, valueStr: null });
    traits.push({ agentId, key: "emotionalVolatility", valueNum: emotionalVolatility, valueStr: null });
    traits.push({ agentId, key: "fatigue", valueNum: fatigue, valueStr: null });
    traits.push({ agentId, key: "timeHorizonDays", valueNum: Math.round(uniform(rng, 7, 3650)), valueStr: null });
    traits.push({ agentId, key: "newsSensitivity", valueNum: uniform(rng, 0, 1), valueStr: null });
    const { understanding, rationality } = sampleCompetenceTraits(agentId);
    traits.push({ agentId, key: "understanding", valueNum: understanding, valueStr: null });
    traits.push({ agentId, key: "rationality", valueNum: rationality, valueStr: null });
    await prisma.runAgentTrait.createMany({ data: traits });
  }
  return poolRunId;
}

function getTrait(traits: Map<string, number>, key: string, def = 0.5): number {
  const v = traits.get(key);
  return typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(1, v))
    : def;
}

function extractBiases(traits: Map<string, number>): Biases {
  return {
    herding: getTrait(traits, "herding"),
    lossAversion: getTrait(traits, "lossAversion"),
    overconfidence: getTrait(traits, "overconfidence"),
    recencyBias: getTrait(traits, "recencyBias"),
    confirmationBias: getTrait(traits, "confirmationBias"),
    fomo: getTrait(traits, "fomo"),
    anchoring: getTrait(traits, "anchoring"),
  };
}

function extractHumanState(traits: Map<string, number>): HumanState {
  return {
    attentionLevel: getTrait(traits, "attentionLevel", 0.7),
    emotionalVolatility: getTrait(traits, "emotionalVolatility"),
    fatigue: getTrait(traits, "fatigue", 0),
  };
}

function actionFromSignSignal(signal: number): Action {
  if (signal > 0) return "BUY";
  if (signal < 0) return "SELL";
  return "HOLD";
}

/** Plurality over raw vote counts (post-aggregation only; not used in agent decisions). */
function pluralityActionFromHist(hist: { BUY: number; SELL: number; HOLD: number }): Action {
  const { BUY: b, SELL: s, HOLD: h } = hist;
  const m = Math.max(b, s, h);
  if (b === m && b >= s && b >= h) return "BUY";
  if (s === m && s >= h) return "SELL";
  return "HOLD";
}

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

/** Resolve runVariantId: from --runVariantId or find/create by runId+assetSymbol+seed+label. */
async function resolveRunVariant(
  prisma: PrismaClient,
  argv: {
    runId: string;
    runVariantId: string | undefined;
    assetSymbol: string;
    seed: number | undefined;
    label: string | undefined;
    steps: number;
    agents: number;
  },
): Promise<{ runVariantId: string; runId: string; assetSymbol: string; steps: number; seed: number }> {
  if (argv.runVariantId) {
    const v = await prisma.runVariant.findUnique({
      where: { id: argv.runVariantId },
      select: { id: true, runId: true, assetSymbol: true, steps: true, seed: true },
    });
    if (!v) throw new Error(`RunVariant not found: ${argv.runVariantId}`);
    return {
      runVariantId: v.id,
      runId: v.runId,
      assetSymbol: v.assetSymbol,
      steps: v.steps,
      seed: v.seed,
    };
  }
  const runId = argv.runId;
  const seed = argv.seed ?? 0;
  const label = argv.label != null ? argv.label : "";
  const run = await prisma.simulationRun.findUnique({
    where: { id: runId },
    select: { id: true },
  });
  if (!run) throw new Error(`Run not found: ${runId}`);
  let v = await prisma.runVariant.findUnique({
    where: {
      runId_assetSymbol_seed_label: { runId, assetSymbol: argv.assetSymbol, seed, label },
    },
    select: { id: true, runId: true, assetSymbol: true, steps: true },
  });
  if (!v) {
    v = await prisma.runVariant.create({
      data: {
        runId,
        assetSymbol: argv.assetSymbol,
        seed,
        label,
        agents: argv.agents,
        steps: argv.steps,
      },
      select: { id: true, runId: true, assetSymbol: true, steps: true },
    });
    log(`Created RunVariant id=${v.id} runId=${runId} assetSymbol=${v.assetSymbol} seed=${seed} label=${label || "(none)"}`);
  }
  return {
    runVariantId: v.id,
    runId: v.runId,
    assetSymbol: v.assetSymbol,
    steps: v.steps,
    seed,
  };
}

async function main(): Promise<void> {
  loadEnv();
  const argv = parseArgv();
  const prisma = new PrismaClient();
  if (argv.runId) {
    await assertRunExists(prisma, argv.runId);
  }

  const variant = await resolveRunVariant(prisma, {
    runId: argv.runId,
    runVariantId: argv.runVariantId,
    assetSymbol: argv.assetSymbol,
    seed: argv.seed,
    label: argv.label,
    steps: argv.steps,
    agents: argv.agents,
  });
  const runId = variant.runId;
  console.log(`[ARGS] runId=${runId}`);
  const runVariantId = variant.runVariantId;
  const assetSymbol = variant.assetSymbol;
  const steps = variant.steps;
  const seed = argv.seed ?? variant.seed ?? 0;
  const val024 = cvVal024FlagsForArgv(argv.cvVal024);
  if (argv.cvVal027 || argv.cvVal029) {
    getSharedWeightPreset(argv.weightPreset);
  }

  log(
    `decide runId=${runId} runVariantId=${runVariantId} steps=${steps} assetSymbol=${assetSymbol} seed=${seed} overwrite=${argv.overwrite} agents=${argv.agents} autoGenerateAgents=${argv.autoGenerateAgents} neutralMode=${argv.neutralMode} herdingCrowdScale=${argv.herdingCrowdScale}`,
  );
  if (argv.cvVal029) {
    log(
      `[CV-VAL-029] threshold decision + preset=${argv.weightPreset} transformMode=${argv.transformMode} cvVal038=${argv.cvVal038} cvVal039=${argv.cvVal039} cvVal040=${argv.cvVal040} cvVal046MixId=${argv.cvVal046MixId ?? ""} cvVal048MixLetter=${argv.cvVal048MixLetter ?? ""}, label=${argv.label ?? ""}`,
    );
  }
  if (argv.cvVal027) {
    log(
      `[CV-VAL-027] delay-only + preset=${argv.weightPreset}, label=${argv.label ?? ""}`,
    );
  }
  if (argv.cvVal026) {
    log(`[CV-VAL-026] temporal-only decorrelation (shared base weights), label=${argv.label ?? ""}`);
  }
  if (argv.cvVal025) {
    log(`[CV-VAL-025] gold config (soft weights + discrete lag), label=${argv.label ?? ""}`);
  }
  if (argv.cvVal024) {
    log(
      `[CV-VAL-024] mode=${argv.cvVal024} mask=${val024.useFeatureMask} delay_i=${val024.useDelayI} mixedNoise=${val024.useDecorrelationNoise} label=${argv.label ?? ""}`,
    );
  }

  if (!argv.overwrite) {
    const decisionCount = await prisma.agentDecision.count({ where: { runVariantId } });
    if (decisionCount > 0) {
      const GREEN = "\x1b[32m";
      const RESET = "\x1b[0m";
      console.log(`${GREEN}✅ SKIP decisions (existing ${decisionCount}, overwrite=false)${RESET}`);
      await prisma.$disconnect();
      process.exit(0);
    }
  }

  const run = await prisma.simulationRun.findUnique({
    where: { id: runId },
    select: { id: true, datasetVersion: true },
  });
  if (!run) throw new Error(`Run not found: ${runId}`);
  const datasetVersion = run.datasetVersion ?? "default";

  if (argv.autoGenerateAgents) {
    await ensureAgentPool(prisma, datasetVersion, argv.agents);
  }
  const poolRun = await prisma.simulationRun.findFirst({
    where: { name: { startsWith: POOL_RUN_PREFIX }, datasetVersion },
    select: { id: true },
  });
  if (!poolRun) throw new Error(`Agent pool not found for datasetVersion=${datasetVersion}`);
  const poolRunId = poolRun.id;

  const agents = await prisma.runAgent.findMany({
    where: { runId: poolRunId },
    orderBy: { id: "asc" },
    take: argv.agents,
    include: { traits: true },
  });
  agents.sort((a, b) => a.id.localeCompare(b.id));

  const crowdCheck = validateCrowdSize(agents.length, argv.minAgents, argv.allowSmallCrowd);
  if (!crowdCheck.ok) throw new Error(crowdCheck.message);

  const agentIdsSorted = agents.map((a) => a.id).sort();
  const agentIdsHash = createHash("sha256").update(agentIdsSorted.join("\n")).digest("hex");
  const first3AgentIds = agentIdsSorted.slice(0, 3);
  const agentSetKey = `${datasetVersion}:${assetSymbol}:${seed}:${agents.length}`;
  const pipelineDiagRows: PipelineDiagRow[] = [];
  if (argv.pipelineDiag) {
    log(`[pipelineDiag] enabled samplePerStep=${argv.pipelineDiagSample} (observability only; no logic change)`);
  }
  log(`seed=${seed} agentSetKey=${agentSetKey} first3AgentIds=${JSON.stringify(first3AgentIds)} agentIdsHash=${agentIdsHash}`);
  log(`Loaded ${agents.length} agents`);

  if (argv.overwrite) {
    // Delete only this variant's data; do not delete AssetStepReturn (imported market data).
    const [deletedDec, deletedInfo, deletedExp, deletedCrowd, deletedRewards, deletedAgentState] = await Promise.all([
      prisma.agentDecision.deleteMany({ where: { runVariantId } }),
      prisma.agentInfoState.deleteMany({ where: { runVariantId } }),
      prisma.agentExperience.deleteMany({ where: { runVariantId } }),
      prisma.crowdMetrics.deleteMany({ where: { runVariantId } }),
      prisma.agentReward.deleteMany({ where: { runVariantId } }),
      prisma.agentState.deleteMany({ where: { runVariantId } }),
    ]);
    log(`Deleted ${deletedDec.count} decisions, ${deletedInfo.count} AgentInfoState, ${deletedExp.count} experiences, ${deletedCrowd.count} CrowdMetrics, ${deletedRewards.count} AgentReward, ${deletedAgentState.count} AgentState (overwrite variant)`);
  }

  const [experienceCount, infoStateCount] = await Promise.all([
    prisma.agentExperience.count({ where: { runId, runVariantId } }),
    prisma.agentInfoState.count({
      where: { runId, assetSymbol, runVariantId },
    }),
  ]);
  log(`experienceCount=${experienceCount} infoStateCount=${infoStateCount} overwrite=${argv.overwrite}`);

  const globalSeed = seed;

  const traitMapByAgent = new Map<string, Map<string, number>>();
  for (const a of agents) {
    const m = new Map<string, number>();
    for (const t of a.traits) {
      if (t.valueNum != null && Number.isFinite(t.valueNum)) {
        m.set(t.key, t.valueNum);
      }
    }
    if (!m.has("understanding") || !m.has("rationality")) {
      const c = sampleCompetenceTraits(a.id);
      if (!m.has("understanding")) m.set("understanding", c.understanding);
      if (!m.has("rationality")) m.set("rationality", c.rationality);
    }
    traitMapByAgent.set(a.id, m);
  }

  const priceByStepBySymbol = new Map<string, number[]>();

  let assetStepReturns = await prisma.assetStepReturn.findMany({
    where: { runId, assetSymbol },
    orderBy: { step: "asc" },
    select: { step: true, stepReturn: true },
  });

  if (assetStepReturns.length < steps) {
    console.warn(
      `[WARN] AssetStepReturn missing for runId=${runId}, asset=${assetSymbol}. Using synthetic zero returns.`,
    );

    assetStepReturns = Array.from({ length: steps }, (_, i) => ({
      step: i,
      stepReturn: 0,
    }));
  }

  const priceByStep: number[] = [1];
  for (let s = 0; s < steps; s++) {
    const ret = assetStepReturns[s]!.stepReturn;
    const prev = priceByStep[s]!;
    priceByStep.push(prev * (1 + ret));
  }
  priceByStepBySymbol.set(assetSymbol, priceByStep);

  const stepReturns = priceByStep
    .slice(0, steps)
    .map((p0, i) => (priceByStep[i + 1]! - p0) / p0);
  const first3 = stepReturns.slice(0, 3);
  const last3 = stepReturns.slice(-3);
  log(`[RETURN_AUDIT] runId=${runId} asset=${assetSymbol} first3=${JSON.stringify(first3)} last3=${JSON.stringify(last3)}`);

  const dbExperiencesByRunAgent = new Map<
    string,
    { step: number; action: Action; outcomePositive: boolean; confidence: number }[]
  >();
  if (!argv.overwrite && experienceCount > 0) {
    const dbExps = await prisma.agentExperience.findMany({
      where: { runId, runVariantId },
      select: { runAgentId: true, step: true, actionJson: true },
      orderBy: [{ step: "asc" }, { runAgentId: "asc" }],
    });

    const priceByStepForDb = priceByStepBySymbol.get(assetSymbol)!;
    for (const e of dbExps) {
      const meta = (e.actionJson as { action?: Action; confidence?: number }) ?? {};
      const action = (meta.action ?? "HOLD") as Action;
      const confidence = typeof meta.confidence === "number" ? meta.confidence : 0.5;
      const p0 = priceByStepForDb[e.step] ?? 1;
      const p1 = priceByStepForDb[e.step + 1] ?? p0;
      const delta = (p1 - p0) / p0;
      const outcomePositive =
        action === "BUY" ? delta > 0 : action === "SELL" ? delta < 0 : false;
      const list = dbExperiencesByRunAgent.get(e.runAgentId) ?? [];
      list.push({ step: e.step, action, outcomePositive, confidence });
      dbExperiencesByRunAgent.set(e.runAgentId, list);
    }
  }

  const decisions: {
    runId: string;
    runVariantId: string;
    step: number;
    agentId: string;
    assetSymbol: string;
    action: Action;
    confidence: number;
    rationale: string;
    syntheticSignal?: number;
    infoSignal?: number;
    eventSignal?: number;
    regimeSignal?: number;
    distortedSignal?: number;
    beliefDrift?: number;
    prefBUY?: number;
    prefSELL?: number;
    prefHOLD?: number;
  }[] = [];
  const agentInfoStates: {
    runId: string;
    runVariantId: string;
    assetSymbol: string;
    agentId: string;
    step: number;
    exposedCount: number;
    infoSignal: number;
  }[] = [];
  const agentStatesToPersist: {
    runId: string;
    runVariantId: string;
    assetSymbol: string;
    agentId: string;
    step: number;
    exposedCount: number;
    infoSignal: number;
    confidence: number;
    riskTolerance: number;
    herding: number;
  }[] = [];
  const experiencesToPersist: {
    runId: string;
    runVariantId: string;
    runAgentId: string;
    step: number;
    action: Action;
    confidence: number;
    crowdSignalAtStep: number;
    wasWithMajority: boolean;
    eventSignal: number;
  }[] = [];
  const eventSignalByAgent = new Map<string, number>();

  const agentState = new Map<
    string,
    { lastAction: Action | null; fatigue: number; attentionLevel: number }
  >();
  for (const a of agents) {
    const traits = traitMapByAgent.get(a.id) ?? new Map();
    const humanState = extractHumanState(traits);
    agentState.set(a.id, {
      lastAction: null,
      fatigue: humanState.fatigue,
      attentionLevel: humanState.attentionLevel,
    });
  }

  const infoEventsByStep = new Map<number, InfoEventInput[]>();
  // CV-VAL-018: include cross-asset stories on the same run+step (macro/news heterogeneity).
  const allEvents = await prisma.infoEvent.findMany({
    where: {
      runId,
      step: { gte: 0, lt: steps },
    },
    orderBy: [{ step: "asc" }, { id: "asc" }],
  });
  for (const e of allEvents) {
    const list = infoEventsByStep.get(e.step) ?? [];
    list.push({
      id: e.id,
      sentiment: e.sentiment,
      credibility: e.credibility,
      reach: e.reach,
      topic: e.topic,
      source: e.source,
      signalQuality: signalQualityFromSource(e.source),
    });
    infoEventsByStep.set(e.step, list);
  }

  const stepJaccards: number[] = [];

  /** CV-VAL-022: per-agent delay/smoothing memory (base_signal path only). */
  const constrainedDiversityMemory = new Map<
    string,
    { prevBase?: number; prevSmoothedMid?: number }
  >();
  /** CV-VAL-033 smooth_only: per-agent EMA of baseNow (no constrained-diversity transform). */
  const cv033SmoothMemory = new Map<string, number>();
  /** CV-VAL-034 minimal_memory: previous step baseNow per agent (no constrained-diversity transform). */
  const cv034MinimalMemory = new Map<string, number>();
  /** CV-VAL-038/039 / diverse_agents: per-agent noise/sensitivity/threshold factors (once per run). */
  const cv038DiverseByAgent = new Map<string, Cv038DiverseParams>();
  if (argv.cvVal029 && argv.cvVal039) {
    for (const a of agents) {
      cv038DiverseByAgent.set(a.id, cv039DiverseParamsForAgent(a.id, globalSeed));
    }
  } else if (
    argv.cvVal029 &&
    (argv.cvVal038 ||
      (argv.transformModeExplicit && argv.transformMode === "diverse_agents"))
  ) {
    for (const a of agents) {
      cv038DiverseByAgent.set(a.id, cv038DiverseParamsForAgent(a.id, globalSeed));
    }
  }
  const cv040StructuredTypeByAgent =
    argv.cvVal029 && argv.cvVal040
      ? cv040StructuredTypeByAgentFromList(agents)
      : argv.cvVal029 && argv.cvVal048MixLetter != null
        ? cv048StructuredTypeByMix(agents, argv.cvVal048MixLetter)
        : argv.cvVal029 && argv.cvVal046MixId != null
          ? cv046StructuredTypeByMix(agents, argv.cvVal046MixId)
          : null;

  if (cv040StructuredTypeByAgent) {
    const idByStructuredName = await ensureCvStructuredArchetypeRows(prisma);
    const dbgCounts: Partial<Record<Cv040StructuredType, number>> = {};
    for (const ag of agents) {
      const ty = cv040StructuredTypeByAgent.get(ag.id)!;
      dbgCounts[ty] = (dbgCounts[ty] ?? 0) + 1;
    }
    const CHUNK = 250;
    for (let ci = 0; ci < agents.length; ci += CHUNK) {
      const slice = agents.slice(ci, ci + CHUNK);
      await prisma.$transaction(
        slice.map((ag) => {
          const ty = cv040StructuredTypeByAgent.get(ag.id)!;
          const aid = idByStructuredName.get(ty);
          if (!aid) throw new Error(`[CV-ARCH-050] missing Archetype id for structured role: ${ty}`);
          return prisma.runAgent.update({
            where: { id: ag.id },
            data: { archetype: ty, archetypeId: aid },
          });
        }),
      );
    }
    console.log("[CV-ARCH-050] RunAgent structured archetype counts:", JSON.stringify(dbgCounts));
  }

  const goldBaseHist = new Map<string, number[]>();
  const goldWByAgent = new Map<string, GoldSoftWeights>();
  const goldLagByAgent = new Map<string, number>();
  if (argv.cvVal025) {
    for (const a of agents) {
      goldWByAgent.set(a.id, goldSoftWeights(a.id));
      goldLagByAgent.set(a.id, goldDelaySteps(a.id));
    }
  }
  const cv026Hist = new Map<string, number[]>();
  const cv026PrevTemporal = new Map<string, number>();

  for (let step = 0; step < steps; step++) {
    const priceByStepCur = priceByStepBySymbol.get(assetSymbol);
    if (!priceByStepCur) {
      throw new Error(`Missing priceByStep for asset ${assetSymbol} (runId=${runId})`);
    }
    const price0 = priceByStepCur[step]!;
    const price1 = priceByStepCur[step + 1]!;
    const delta = (price1 - price0) / price0;
    const syntheticSignal = clamp11(delta * 10);
    const regime = computeRegimeState(priceByStepCur, step);
    const eventsForStep = infoEventsByStep.get(step) ?? [];
    const exposureSets: Set<string>[] = [];

    const hist = { BUY: 0, SELL: 0, HOLD: 0 };
    const modelHist = emptyModelActionHistogram();
    let sumConf = 0;
    let sumSignalI = 0;
    const stepDecisions: { agentId: string; action: Action; confidence: number }[] = [];

    const experiencesByRunAgent = new Map<
      string,
      { step: number; action: Action; outcomePositive: boolean; confidence: number }[]
    >();
    for (const [runAgentId, list] of dbExperiencesByRunAgent) {
      const filtered = list.filter((e) => e.step < step);
      if (filtered.length > 0) {
        experiencesByRunAgent.set(runAgentId, [...filtered]);
      }
    }
    const priceByStepForExp = priceByStepBySymbol.get(assetSymbol)!;
    for (const exp of experiencesToPersist) {
      if (exp.step >= step) continue;
      const p0 = priceByStepForExp[exp.step] ?? 1;
      const p1 = priceByStepForExp[exp.step + 1] ?? p0;
      const delta = (p1 - p0) / p0;
      const outcomePositive =
        exp.action === "BUY" ? delta > 0 : exp.action === "SELL" ? delta < 0 : false;
      const entry = {
        step: exp.step,
        action: exp.action,
        outcomePositive,
        confidence: exp.confidence,
      };
      const list = experiencesByRunAgent.get(exp.runAgentId) ?? [];
      const existing = list.findIndex((e) => e.step === exp.step);
      if (existing >= 0) list[existing] = entry;
      else list.push(entry);
      experiencesByRunAgent.set(exp.runAgentId, list);
    }

    for (const agent of agents) {
      const traits = traitMapByAgent.get(agent.id) ?? new Map();
      const biases = extractBiases(traits);
      const state = agentState.get(agent.id)!;
      const agentSeed = hashToSeed(`${datasetVersion}:${assetSymbol}:${globalSeed}:${agent.id}:${step}`);
      const rng = createSeededRng(agentSeed);

      const distinctTopics = [...new Set(eventsForStep.map((ev) => ev.topic ?? ""))];
      const blindTopics = blindTopicsForAgent(distinctTopics, agent.id, step, globalSeed);
      const visibleEvents = filterEventsVisibleToAgent(eventsForStep, blindTopics);
      const eventPool = visibleEvents.length > 0 ? visibleEvents : eventsForStep;
      const subset = selectAgentEventSubset({
        events: eventPool,
        agentId: agent.id,
        step,
        seed: globalSeed,
        archetypeName: agent.archetype ?? null,
        attentionLevel: state.attentionLevel,
        targetFracScale: VAL018_TARGET_FRAC_SCALE,
      });
      exposureSets.push(
        new Set(subset.map((ev) => (ev.topic && ev.topic.length > 0 ? ev.topic : ev.id))),
      );

      const anchorSign = syntheticSignal;
      const { infoSignal: rawInfo, exposedCount } = aggregateInfoSignal({
        events: subset,
        agentId: agent.id,
        step,
        seed: globalSeed,
        attentionLevel: state.attentionLevel,
        confirmationBias: biases.confirmationBias,
        overconfidence: biases.overconfidence,
        anchorSign,
      });

      const infoAfterExposure = applyInformationExposureLayer({
        rawInfoSignal: rawInfo,
        syntheticSignal,
        optimisticBias: (getTrait(traits, "confidence", 0.5) - 0.5) * 2,
        politicalLean: (getTrait(traits, "contrarian", 0.5) - 0.5) * 2,
        economicLean: (getTrait(traits, "newsSensitivity", 0.5) - 0.5) * 2,
        rng,
      });

      const understanding = getTrait(traits, "understanding", 0.5);
      const infoSignalRaw = blendInfoWithUnderstanding({
        infoRaw: infoAfterExposure,
        understanding,
        rng,
      });

      const eventSignalRaw = computeEventSignalIndependent({
        events: subset,
        attentionLevel: state.attentionLevel,
        fatigue: state.fatigue,
        emotionalVolatility: getTrait(traits, "emotionalVolatility"),
      });

      const synthetic_i_raw = computeAgentSyntheticSignal({
        syntheticSignal,
        riskTolerance: getTrait(traits, "riskTolerance"),
        rng,
      });
      const regime_i_raw = computeAgentRegimeSignal({
        regimeSignal: regime.regimeSignal,
        newsSensitivity: getTrait(traits, "newsSensitivity"),
        rng,
      });

      const archCfgId = resolveArchetypeConfigId(
        agent.id,
        agent.archetype ?? null,
        agent.archetypeId ?? null,
      );
      const archetypeConfig = loadArchetypesConfig().byId.get(archCfgId)!;
      const exposure = archetypeConfig.informationExposure ?? {
        synthetic: 1,
        info: 1,
        event: 1,
        regime: 1,
      };
      const latency = archetypeConfig.informationLatency ?? {
        synthetic: 0,
        info: 0,
        event: 0,
        regime: 0,
      };
      void latency;

      const syn_i_exp = applyExposure(synthetic_i_raw, exposure.synthetic);
      const info_exp = applyExposure(infoSignalRaw, exposure.info);
      const evt_exp = applyExposure(eventSignalRaw, exposure.event);
      const reg_exp = applyExposure(regime_i_raw, exposure.regime);

      eventSignalByAgent.set(agent.id, evt_exp);

      let infoSignal = info_exp;
      let eventSignal = evt_exp;
      const synthetic_i = syn_i_exp;
      const regime_i = reg_exp;
      const channels = { synthetic_i, regime_i, infoSignal, eventSignal };

      const rationality = getTrait(traits, "rationality", 0.5);
      const decisionModel = decisionModelKindForAgent(agent.id);
      let baseForRationale: number;
      let rationale: string;

      if (argv.cvVal029) {
        const w029 = getSharedWeightPreset(argv.weightPreset);
        const effSyn = argv.overrideSyn ?? w029.syn;
        const effInfo = argv.overrideInfo ?? w029.info;
        const effEvt = argv.overrideEvt ?? w029.evt;
        const effReg = argv.overrideReg ?? w029.reg;
        const effArch = effectiveArchetypeProfileForAgent(
          agent.id,
          agent.archetype ?? null,
          agent.archetypeId ?? null,
        );
        const baseNow = clamp11(
          effSyn * effArch.wSyn * channels.synthetic_i +
            effInfo * effArch.wInfo * channels.infoSignal +
            effEvt * effArch.wEvt * channels.eventSignal +
            effReg * effArch.wReg * channels.regime_i,
        );
        const tm = argv.transformMode;
        const useStructuredAgents =
          tm === "none" &&
          (argv.cvVal040 || argv.cvVal046MixId != null || argv.cvVal048MixLetter != null);
        const useCv038Diversity =
          !useStructuredAgents &&
          ((argv.cvVal038 && tm === "none") ||
            (argv.cvVal039 && tm === "none") ||
            tm === "diverse_agents");
        const cv039NoiseKey = argv.cvVal039 ? "cv039" : "cv038";
        let signalI: number;
        if (tm === "none" && !useCv038Diversity && !useStructuredAgents) {
          signalI = baseNow;
        } else if (useStructuredAgents && cv040StructuredTypeByAgent) {
          signalI = baseNow;
          const ty = cv040StructuredTypeByAgent.get(agent.id)!;
          if (ty === "trend") {
            const momentumComponent = clamp11(synthetic_i * 0.25);
            signalI += momentumComponent;
          } else if (ty === "contrarian") {
            signalI *= -0.7;
          } else if (ty === "noise") {
            const rng040 = createSeededRng(
              hashToSeed(`cv040noise:${globalSeed}:${agent.id}:${step}`),
            );
            signalI += randn(rng040) * 0.01;
          } else {
            signalI = 0.7 * infoSignal + 0.3 * signalI;
          }
          signalI = clamp11(signalI);
        } else if (useCv038Diversity) {
          const p = cv038DiverseByAgent.get(agent.id)!;
          signalI = baseNow * p.sensitivity * effArch.reactionSpeed;
          const rng038 = createSeededRng(
            hashToSeed(`${cv039NoiseKey}:${globalSeed}:${agent.id}:${step}`),
          );
          signalI += randn(rng038) * p.noiseSigma;
        } else if (tm === "smooth_only") {
          const prevSm = cv033SmoothMemory.get(agent.id);
          const mem = effArch.memoryFactor;
          const newW = 0.85 - 0.15 * mem;
          const oldW = 1 - newW;
          signalI =
            prevSm === undefined ? baseNow : newW * baseNow + oldW * prevSm;
          cv033SmoothMemory.set(agent.id, signalI);
        } else if (tm === "minimal_memory") {
          const prevBase = cv034MinimalMemory.get(agent.id);
          const nw = 0.92 - 0.12 * effArch.memoryFactor;
          signalI =
            prevBase === undefined ? baseNow : nw * baseNow + (1 - nw) * prevBase;
          cv034MinimalMemory.set(agent.id, baseNow);
        } else if (tm === "amplify_extremes") {
          const absBn = Math.abs(baseNow);
          const exp = Math.min(1.35, 1.05 + 0.12 * effArch.reactionSpeed);
          if (absBn < 0.05) {
            signalI = baseNow;
          } else {
            signalI = Math.sign(baseNow) * Math.pow(absBn, exp);
          }
        } else {
          const delayI = delayMultiplierForAgent(agent.id);
          const divMem029 = constrainedDiversityMemory.get(agent.id) ?? {};
          const { signal: coreFromModel, nextSmoothedMid: nsm029 } =
            applyConstrainedDiversityTransform(
              decisionModel,
              agent.id,
              baseNow,
              {
                prevBase: divMem029.prevBase,
                prevSmoothedMid: divMem029.prevSmoothedMid,
              },
              delayI,
            );
          constrainedDiversityMemory.set(agent.id, {
            prevBase: baseNow,
            prevSmoothedMid: nsm029,
          });
          const reactMul = Math.min(1.35, Math.max(0.65, 0.72 + 0.28 * effArch.reactionSpeed));
          signalI = clamp11(coreFromModel * reactMul);
        }
        signalI = applyVolatilityToSignal(signalI, syntheticSignal, effArch.volatilitySensitivity);
        const archNoise =
          (hashToUnitFloat(`cv052n:${globalSeed}:${agent.id}:${step}`) - 0.5) * 2;
        signalI = clamp11(
          signalI + effArch.bias * ARCH058_ARCHETYPE_BIAS_SCALE + archNoise * 0.14 * effArch.noiseAmp,
        );
        const decisionScale = argv.overrideDecisionScale ?? 0.7;
        const scaledSignal = signalI * decisionScale;
        const baseTh029 = argv.overrideThreshold ?? 0.02;
        let TH = baseTh029 * effArch.thresholdMul;
        if (useCv038Diversity) {
          TH *= cv038DiverseByAgent.get(agent.id)!.thresholdFactor;
        }
        let action: Action;
        if (scaledSignal > TH) action = "BUY";
        else if (scaledSignal < -TH) action = "SELL";
        else action = "HOLD";
        const confidence = confidenceFromProfile(effArch, agent.id, step, signalI);
        modelHist[decisionModel][action]++;
        const structTy =
          useStructuredAgents && cv040StructuredTypeByAgent
            ? cv040StructuredTypeByAgent.get(agent.id)!
            : "";
        const structTag =
          structTy && argv.cvVal048MixLetter != null
            ? ` cv048_mix${argv.cvVal048MixLetter}=${structTy}`
            : structTy && argv.cvVal046MixId != null
              ? ` cv046_mix${argv.cvVal046MixId}=${structTy}`
              : structTy
              ? ` cv040=${structTy}`
              : "";
        const rationale029 =
          `model=${decisionModel} cvVal029 preset=${argv.weightPreset} transformMode=${tm} base=${baseNow.toFixed(3)} signal=${signalI.toFixed(3)} ` +
          `(syn_i=${synthetic_i.toFixed(2)} info=${infoSignal.toFixed(2)} evt=${eventSignal.toFixed(
            2,
          )} reg_i=${regime_i.toFixed(2)} exposed=${exposedCount}${structTag})`;

        agentInfoStates.push({
          runId,
          runVariantId,
          assetSymbol,
          agentId: agent.id,
          step,
          exposedCount,
          infoSignal,
        });
        const baselineConf029 = getTrait(traits, "confidence", 0.5);
        const baselineRisk029 = getTrait(traits, "riskTolerance", 0.5);
        const baselineHerding029 = getTrait(traits, "herding", 0.5);
        agentStatesToPersist.push({
          runId,
          runVariantId,
          assetSymbol,
          agentId: agent.id,
          step,
          exposedCount,
          infoSignal,
          confidence: baselineConf029,
          riskTolerance: baselineRisk029,
          herding: baselineHerding029,
        });

        hist[action]++;
        sumConf += confidence;
        sumSignalI += signalI;
        stepDecisions.push({ agentId: agent.id, action, confidence });

        state.lastAction = action;
        state.fatigue = updateFatigue(state.fatigue, state.attentionLevel);
        state.attentionLevel = updateAttention(state.attentionLevel, state.fatigue);

        if (argv.pipelineDiag) {
          pipelineDiagRows.push({
            step,
            agentId: agent.id,
            archetypeLabel: agent.archetype ?? "(null)",
            pathTag: "cv029",
            synthetic_market: syntheticSignal,
            synthetic_i: synthetic_i_raw,
            info_signal: infoSignalRaw,
            event_signal: eventSignalRaw,
            regime_raw: regime.regimeSignal,
            regime_i: regime_i_raw,
            distorted_signal: signalI,
            final_signal: scaledSignal,
            threshold: TH,
            dominant_leg: dominantLegCv029(effSyn, effInfo, effEvt, effReg, effArch, channels),
            action,
            syn_exp: syn_i_exp,
            info_exp: info_exp,
            evt_exp: evt_exp,
            reg_exp: reg_exp,
          });
        }

        decisions.push({
          runId,
          runVariantId,
          step,
          agentId: agent.id,
          assetSymbol,
          action,
          confidence,
          rationale: rationale029,
          syntheticSignal,
          infoSignal,
          eventSignal,
          regimeSignal: regime.regimeSignal,
          distortedSignal: signalI,
          beliefDrift: 0,
          prefBUY: 0,
          prefSELL: 0,
          prefHOLD: 0,
        });
        continue;
      }

      if (argv.cvVal027) {
        const baseNow = computeBaseSignalWithSharedPreset(channels, argv.weightPreset);
        const delayI = delayMultiplierForAgent(agent.id);
        const divMem027 = constrainedDiversityMemory.get(agent.id) ?? {};
        const { signal: coreFromModel, nextSmoothedMid: nsm027 } =
          applyConstrainedDiversityTransform(
            decisionModel,
            agent.id,
            baseNow,
            {
              prevBase: divMem027.prevBase,
              prevSmoothedMid: divMem027.prevSmoothedMid,
            },
            delayI,
          );
        constrainedDiversityMemory.set(agent.id, {
          prevBase: baseNow,
          prevSmoothedMid: nsm027,
        });
        const signalI = clamp11(coreFromModel);
        const action = actionFromSignSignal(signalI);
        const confidence = clamp01(0.45 + 0.35 * Math.min(1, Math.abs(signalI)));
        modelHist[decisionModel][action]++;
        const rationale027 =
          `model=${decisionModel} cvVal027 preset=${argv.weightPreset} base=${baseNow.toFixed(3)} signal=${signalI.toFixed(3)} ` +
          `(syn_i=${synthetic_i.toFixed(2)} info=${infoSignal.toFixed(2)} evt=${eventSignal.toFixed(
            2,
          )} reg_i=${regime_i.toFixed(2)} exposed=${exposedCount})`;

        agentInfoStates.push({
          runId,
          runVariantId,
          assetSymbol,
          agentId: agent.id,
          step,
          exposedCount,
          infoSignal,
        });
        const baselineConf027 = getTrait(traits, "confidence", 0.5);
        const baselineRisk027 = getTrait(traits, "riskTolerance", 0.5);
        const baselineHerding027 = getTrait(traits, "herding", 0.5);
        agentStatesToPersist.push({
          runId,
          runVariantId,
          assetSymbol,
          agentId: agent.id,
          step,
          exposedCount,
          infoSignal,
          confidence: baselineConf027,
          riskTolerance: baselineRisk027,
          herding: baselineHerding027,
        });

        hist[action]++;
        sumConf += confidence;
        sumSignalI += signalI;
        stepDecisions.push({ agentId: agent.id, action, confidence });

        state.lastAction = action;
        state.fatigue = updateFatigue(state.fatigue, state.attentionLevel);
        state.attentionLevel = updateAttention(state.attentionLevel, state.fatigue);

        if (argv.pipelineDiag) {
          pipelineDiagRows.push({
            step,
            agentId: agent.id,
            archetypeLabel: agent.archetype ?? "(null)",
            pathTag: "cv027",
            synthetic_market: syntheticSignal,
            synthetic_i: synthetic_i_raw,
            info_signal: infoSignalRaw,
            event_signal: eventSignalRaw,
            regime_raw: regime.regimeSignal,
            regime_i: regime_i_raw,
            distorted_signal: signalI,
            final_signal: signalI,
            threshold: 0,
            dominant_leg: dominantLegAbsChannels({
              synthetic_i,
              infoSignal,
              eventSignal,
              regime_i,
            }),
            action,
            syn_exp: syn_i_exp,
            info_exp: info_exp,
            evt_exp: evt_exp,
            reg_exp: reg_exp,
          });
        }

        decisions.push({
          runId,
          runVariantId,
          step,
          agentId: agent.id,
          assetSymbol,
          action,
          confidence,
          rationale: rationale027,
          syntheticSignal,
          infoSignal,
          eventSignal,
          regimeSignal: regime.regimeSignal,
          distortedSignal: signalI,
          beliefDrift: 0,
          prefBUY: 0,
          prefSELL: 0,
          prefHOLD: 0,
        });
        continue;
      }

      if (argv.cvVal026) {
        const baseNow = computeBaseSignal(channels);
        const h026 = cv026Hist.get(agent.id) ?? [];
        h026.push(baseNow);
        cv026Hist.set(agent.id, h026);
        const delayF = goldDelayFloat(agent.id);
        const lagAlpha = goldLagAlpha(agent.id);
        const delayedSignal = interpolateHistory(h026, step - delayF);
        const prevSignal = cv026PrevTemporal.get(agent.id) ?? delayedSignal;
        const temporalSignal = (1 - lagAlpha) * delayedSignal + lagAlpha * prevSignal;
        cv026PrevTemporal.set(agent.id, temporalSignal);
        const divMem026 = constrainedDiversityMemory.get(agent.id) ?? {};
        const { signal: coreFromModel, nextSmoothedMid: nsm026 } =
          applyConstrainedDiversityTransform(
            decisionModel,
            agent.id,
            temporalSignal,
            {
              prevBase: divMem026.prevBase,
              prevSmoothedMid: divMem026.prevSmoothedMid,
            },
            1,
          );
        constrainedDiversityMemory.set(agent.id, {
          prevBase: temporalSignal,
          prevSmoothedMid: nsm026,
        });
        const signalI = clamp11(coreFromModel);
        const action = actionFromSignSignal(signalI);
        const confidence = clamp01(0.45 + 0.35 * Math.min(1, Math.abs(signalI)));
        modelHist[decisionModel][action]++;
        rationale =
          `model=${decisionModel} cvVal026 temporal=${temporalSignal.toFixed(3)} signal=${signalI.toFixed(3)} ` +
          `(syn_i=${synthetic_i.toFixed(2)} info=${infoSignal.toFixed(2)} evt=${eventSignal.toFixed(
            2,
          )} reg_i=${regime_i.toFixed(2)} exposed=${exposedCount})`;

        agentInfoStates.push({
          runId,
          runVariantId,
          assetSymbol,
          agentId: agent.id,
          step,
          exposedCount,
          infoSignal,
        });
        const baselineConf026 = getTrait(traits, "confidence", 0.5);
        const baselineRisk026 = getTrait(traits, "riskTolerance", 0.5);
        const baselineHerding026 = getTrait(traits, "herding", 0.5);
        agentStatesToPersist.push({
          runId,
          runVariantId,
          assetSymbol,
          agentId: agent.id,
          step,
          exposedCount,
          infoSignal,
          confidence: baselineConf026,
          riskTolerance: baselineRisk026,
          herding: baselineHerding026,
        });

        hist[action]++;
        sumConf += confidence;
        sumSignalI += signalI;
        stepDecisions.push({ agentId: agent.id, action, confidence });

        state.lastAction = action;
        state.fatigue = updateFatigue(state.fatigue, state.attentionLevel);
        state.attentionLevel = updateAttention(state.attentionLevel, state.fatigue);

        if (argv.pipelineDiag) {
          pipelineDiagRows.push({
            step,
            agentId: agent.id,
            archetypeLabel: agent.archetype ?? "(null)",
            pathTag: "cv026",
            synthetic_market: syntheticSignal,
            synthetic_i: synthetic_i_raw,
            info_signal: infoSignalRaw,
            event_signal: eventSignalRaw,
            regime_raw: regime.regimeSignal,
            regime_i: regime_i_raw,
            distorted_signal: signalI,
            final_signal: signalI,
            threshold: 0,
            dominant_leg: dominantLegAbsChannels({
              synthetic_i,
              infoSignal,
              eventSignal,
              regime_i,
            }),
            action,
            syn_exp: syn_i_exp,
            info_exp: info_exp,
            evt_exp: evt_exp,
            reg_exp: reg_exp,
          });
        }

        decisions.push({
          runId,
          runVariantId,
          step,
          agentId: agent.id,
          assetSymbol,
          action,
          confidence,
          rationale,
          syntheticSignal,
          infoSignal,
          eventSignal,
          regimeSignal: regime.regimeSignal,
          distortedSignal: signalI,
          beliefDrift: 0,
          prefBUY: 0,
          prefSELL: 0,
          prefHOLD: 0,
        });
        continue;
      }

      if (argv.cvVal025) {
        const w = goldWByAgent.get(agent.id)!;
        const lag = goldLagByAgent.get(agent.id)!;
        const baseNow = computeBaseSignalWithWeights(channels, w);
        const gHist = goldBaseHist.get(agent.id) ?? [];
        gHist.push(baseNow);
        goldBaseHist.set(agent.id, gHist);
        const idx = Math.max(0, step - lag);
        const baseForTransform = gHist[idx]!;
        baseForRationale = baseForTransform;
        const divMem = constrainedDiversityMemory.get(agent.id) ?? {};
        const { signal: coreFromModel, nextSmoothedMid } = applyConstrainedDiversityTransform(
          decisionModel,
          agent.id,
          baseForTransform,
          {
            prevBase: divMem.prevBase,
            prevSmoothedMid: divMem.prevSmoothedMid,
          },
          1,
        );
        constrainedDiversityMemory.set(agent.id, {
          prevBase: baseForTransform,
          prevSmoothedMid: nextSmoothedMid,
        });
        let signalI = coreFromModel;
        signalI += randn(rng) * RATIONALITY_NOISE_SCALE * (1 - rationality);
        signalI += randn(rng) * PRIVATE_SIGNAL_SCALE * (1 - understanding);
        signalI = clamp11(signalI);
        const action = actionFromSignSignal(signalI);
        const confidence = clamp01(0.45 + 0.35 * Math.min(1, Math.abs(signalI)));
        modelHist[decisionModel][action]++;
        rationale =
          `model=${decisionModel} cvVal025 lag=${lag} baseNow=${baseNow.toFixed(3)} baseUse=${baseForTransform.toFixed(3)} signal=${signalI.toFixed(3)} ` +
          `(syn_i=${synthetic_i.toFixed(2)} info=${infoSignal.toFixed(2)} evt=${eventSignal.toFixed(
            2,
          )} reg_i=${regime_i.toFixed(2)} exposed=${exposedCount})`;

        agentInfoStates.push({
          runId,
          runVariantId,
          assetSymbol,
          agentId: agent.id,
          step,
          exposedCount,
          infoSignal,
        });
        const baselineConf = getTrait(traits, "confidence", 0.5);
        const baselineRisk = getTrait(traits, "riskTolerance", 0.5);
        const baselineHerding = getTrait(traits, "herding", 0.5);
        agentStatesToPersist.push({
          runId,
          runVariantId,
          assetSymbol,
          agentId: agent.id,
          step,
          exposedCount,
          infoSignal,
          confidence: baselineConf,
          riskTolerance: baselineRisk,
          herding: baselineHerding,
        });

        hist[action]++;
        sumConf += confidence;
        sumSignalI += signalI;
        stepDecisions.push({ agentId: agent.id, action, confidence });

        state.lastAction = action;
        state.fatigue = updateFatigue(state.fatigue, state.attentionLevel);
        state.attentionLevel = updateAttention(state.attentionLevel, state.fatigue);

        if (argv.pipelineDiag) {
          pipelineDiagRows.push({
            step,
            agentId: agent.id,
            archetypeLabel: agent.archetype ?? "(null)",
            pathTag: "cv025",
            synthetic_market: syntheticSignal,
            synthetic_i: synthetic_i_raw,
            info_signal: infoSignalRaw,
            event_signal: eventSignalRaw,
            regime_raw: regime.regimeSignal,
            regime_i: regime_i_raw,
            distorted_signal: signalI,
            final_signal: signalI,
            threshold: 0,
            dominant_leg: dominantLegAbsChannels({
              synthetic_i,
              infoSignal,
              eventSignal,
              regime_i,
            }),
            action,
            syn_exp: syn_i_exp,
            info_exp: info_exp,
            evt_exp: evt_exp,
            reg_exp: reg_exp,
          });
        }

        decisions.push({
          runId,
          runVariantId,
          step,
          agentId: agent.id,
          assetSymbol,
          action,
          confidence,
          rationale,
          syntheticSignal,
          infoSignal,
          eventSignal,
          regimeSignal: regime.regimeSignal,
          distortedSignal: signalI,
          beliefDrift: 0,
          prefBUY: 0,
          prefSELL: 0,
          prefHOLD: 0,
        });
        continue;
      }

      const effArchDefault = effectiveArchetypeProfileForAgent(
        agent.id,
        agent.archetype ?? null,
        agent.archetypeId ?? null,
      );
      const baseSignal = baseSignalArch052Default(
        channels,
        val024.useFeatureMask ? featureMaskForAgent(agent.id) : null,
        effArchDefault,
      );
      baseForRationale = baseSignal;
      const delayI = val024.useDelayI ? delayMultiplierForAgent(agent.id) : 1;
      const divMem = constrainedDiversityMemory.get(agent.id) ?? {};
      const { signal: coreFromModel, nextSmoothedMid } = applyConstrainedDiversityTransform(
        decisionModel,
        agent.id,
        baseSignal,
        {
          prevBase: divMem.prevBase,
          prevSmoothedMid: divMem.prevSmoothedMid,
        },
        delayI,
      );
      constrainedDiversityMemory.set(agent.id, {
        prevBase: baseSignal,
        prevSmoothedMid: nextSmoothedMid,
      });
      const reactMulDef = Math.min(
        1.35,
        Math.max(0.65, 0.72 + 0.28 * effArchDefault.reactionSpeed),
      );
      let signalI = clamp11(coreFromModel * reactMulDef);
      const noiseScale = Math.min(1.6, Math.max(0.45, effArchDefault.noiseAmp * 0.55 + 0.45));
      if (val024.useDecorrelationNoise) {
        signalI += decorrelationShock(
          agent.id,
          rationality,
          understanding,
          RATIONALITY_NOISE_SCALE,
          PRIVATE_SIGNAL_SCALE,
          rng,
        ) * noiseScale;
      } else {
        signalI += randn(rng) * RATIONALITY_NOISE_SCALE * (1 - rationality) * noiseScale;
        signalI += randn(rng) * PRIVATE_SIGNAL_SCALE * (1 - understanding) * noiseScale;
      }
      signalI = clamp11(signalI);
      signalI = applyVolatilityToSignal(
        signalI,
        syntheticSignal,
        effArchDefault.volatilitySensitivity,
      );
      const archNoise052 =
        (hashToUnitFloat(`cv052n:${globalSeed}:${agent.id}:${step}`) - 0.5) * 2;
      signalI = clamp11(
        signalI +
          effArchDefault.bias * ARCH058_ARCHETYPE_BIAS_SCALE +
          archNoise052 * 0.14 * effArchDefault.noiseAmp,
      );

      const baseThreshold = ARCH052_DEFAULT_BASE_TH;
      const thresholdMul = effArchDefault.thresholdMul;
      const ra = (globalThis as unknown as { ra?: { archetype?: string | null } }).ra;
      const archetype =
        agent?.archetype ??
        (typeof ra !== "undefined" ? ra?.archetype : undefined) ??
        "(unknown)";
      // --- CV-DIAG-058: Archetype threshold shaping (safe, bounded) ---
      let archetypeFactor = 1.0;

      switch (archetype) {
        case "contrarian":
        case "The Contrarian":
          archetypeFactor = 0.85;
          break;

        case "noise":
        case "The Meme Follower":
          archetypeFactor = 0.75;
          break;

        case "The Day Trader":
          archetypeFactor = 0.8;
          break;

        case "The Cautious Learner":
        case "The Conservative Planner":
          archetypeFactor = 1.25;
          break;

        case "The Passive Indexer":
          archetypeFactor = 1.15;
          break;

        default:
          archetypeFactor = 1.0;
      }

      // clamp to avoid extreme behavior
      archetypeFactor = Math.max(0.6, Math.min(1.4, archetypeFactor));

      const threshold = baseThreshold * thresholdMul * archetypeFactor;

      const action = actionFromSignalArch052Default(signalI, threshold);
      const confidence = confidenceFromProfile(effArchDefault, agent.id, step, signalI);

      modelHist[decisionModel][action]++;

      rationale =
        `model=${decisionModel} base=${baseForRationale.toFixed(3)} signal=${signalI.toFixed(3)} ` +
        `(syn_i=${synthetic_i.toFixed(2)} info=${infoSignal.toFixed(2)} evt=${eventSignal.toFixed(
          2,
        )} reg_i=${regime_i.toFixed(2)} exposed=${exposedCount})`;

      agentInfoStates.push({
        runId,
        runVariantId,
        assetSymbol,
        agentId: agent.id,
        step,
        exposedCount,
        infoSignal,
      });
      const baselineConf = getTrait(traits, "confidence", 0.5);
      const baselineRisk = getTrait(traits, "riskTolerance", 0.5);
      const baselineHerding = getTrait(traits, "herding", 0.5);
      agentStatesToPersist.push({
        runId,
        runVariantId,
        assetSymbol,
        agentId: agent.id,
        step,
        exposedCount,
        infoSignal,
        confidence: baselineConf,
        riskTolerance: baselineRisk,
        herding: baselineHerding,
      });

      hist[action]++;
      sumConf += confidence;
      sumSignalI += signalI;
      stepDecisions.push({ agentId: agent.id, action, confidence });

      state.lastAction = action;
      state.fatigue = updateFatigue(state.fatigue, state.attentionLevel);
      state.attentionLevel = updateAttention(state.attentionLevel, state.fatigue);

      if (argv.pipelineDiag) {
        const archMask = val024.useFeatureMask ? featureMaskForAgent(agent.id) : null;
        pipelineDiagRows.push({
          step,
          agentId: agent.id,
          archetypeLabel: agent.archetype ?? "(null)",
          pathTag: "arch052",
          synthetic_market: syntheticSignal,
          synthetic_i: synthetic_i_raw,
          info_signal: infoSignalRaw,
          event_signal: eventSignalRaw,
          regime_raw: regime.regimeSignal,
          regime_i: regime_i_raw,
          distorted_signal: signalI,
          final_signal: signalI,
          threshold,
          dominant_leg: dominantLegArch052Default(channels, archMask, effArchDefault),
          action,
          syn_exp: syn_i_exp,
          info_exp: info_exp,
          evt_exp: evt_exp,
          reg_exp: reg_exp,
        });
      }

      decisions.push({
        runId,
        runVariantId,
        step,
        agentId: agent.id,
        assetSymbol,
        action,
        confidence,
        rationale,
        syntheticSignal,
        infoSignal,
        eventSignal,
        regimeSignal: regime.regimeSignal,
        distortedSignal: signalI,
        beliefDrift: 0,
        prefBUY: 0,
        prefSELL: 0,
        prefHOLD: 0,
      });
    }

    const nAg = agents.length;
    const overlapRng = createSeededRng(hashToSeed(`${runVariantId}:jaccard:${step}`));
    const overlapSampleCount = Math.min(VAL018_OVERLAP_SAMPLES, Math.max(400, nAg * 30));
    const hasExposure = exposureSets.some((s) => s.size > 0);
    let pairJaccardLog = "n/a";
    if (hasExposure) {
      const stepJaccard = approxMeanPairwiseJaccard(exposureSets, overlapSampleCount, overlapRng);
      stepJaccards.push(stepJaccard);
      pairJaccardLog = stepJaccard.toFixed(3);
    }
    const avgAgentSignal = nAg > 0 ? sumSignalI / nAg : 0;

    const pluralityAction = pluralityActionFromHist(hist);

    for (const d of stepDecisions) {
      const wasWithMajority = d.action === pluralityAction;
      experiencesToPersist.push({
        runId,
        runVariantId,
        runAgentId: d.agentId,
        step,
        action: d.action,
        confidence: d.confidence,
        crowdSignalAtStep: avgAgentSignal,
        wasWithMajority,
        eventSignal: eventSignalByAgent.get(d.agentId) ?? 0,
      });
    }

    const buyPct = nAg > 0 ? (100 * hist.BUY) / nAg : 0;
    const sellPct = nAg > 0 ? (100 * hist.SELL) / nAg : 0;
    const avgConf = nAg > 0 ? sumConf / nAg : 0;
    log(
      `Step ${step}: marketSignal=${syntheticSignal.toFixed(3)} buyPct=${buyPct.toFixed(
        1,
      )} sellPct=${sellPct.toFixed(1)} avgAgentSignal=${avgAgentSignal.toFixed(3)} ` +
        `pairJaccard≈${pairJaccardLog} BUY=${hist.BUY} SELL=${hist.SELL} HOLD=${hist.HOLD} avgConf=${avgConf.toFixed(3)}`,
    );
    log(
      `[CV-ARCH-005] modelActions=${JSON.stringify(modelHist)}`,
    );
  }

  if (argv.pipelineDiag && pipelineDiagRows.length > 0) {
    printPipelineDiagnostics(pipelineDiagRows, {
      steps,
      sampleSize: argv.pipelineDiagSample,
      agentIdsSorted,
    });
  }

  // Delete + batch createMany (deterministic; no upsert overhead)
  // lite: skip AgentInfoState, AgentState, AgentExperience (keep AgentDecision for CrowdMetrics)
  if (argv.persistMode === "full") {
    await prisma.agentInfoState.deleteMany({ where: { runVariantId } });
    for (const batch of chunk(agentInfoStates, 1000)) {
      await prisma.agentInfoState.createMany({ data: batch });
    }
    log(`Persisted ${agentInfoStates.length} AgentInfoState rows`);

    await prisma.agentState.deleteMany({ where: { runVariantId } });
    for (const batch of chunk(agentStatesToPersist, 1000)) {
      await prisma.agentState.createMany({ data: batch });
    }
    log(`Persisted ${agentStatesToPersist.length} AgentState rows`);

    await prisma.agentExperience.deleteMany({ where: { runVariantId } });
    const stepTs = new Date();
    const experienceData = experiencesToPersist.map((exp) => ({
      runId: exp.runId,
      runVariantId: exp.runVariantId,
      runAgentId: exp.runAgentId,
      step: exp.step,
      ts: stepTs,
      actionJson: {
        action: exp.action,
        confidence: exp.confidence,
        crowdSignalAtStep: exp.crowdSignalAtStep,
        wasWithMajority: exp.wasWithMajority,
        eventSignal: exp.eventSignal,
      },
    }));
    for (const batch of chunk(experienceData, 1000)) {
      await prisma.agentExperience.createMany({ data: batch });
    }
    log(`Persisted ${experiencesToPersist.length} AgentExperience rows`);
  } else {
    log(`Skipped AgentInfoState/AgentState/AgentExperience (persist=lite)`);
  }

  await prisma.agentDecision.deleteMany({ where: { runVariantId } });
  const decisionData = decisions.map((d) => ({
    runId: d.runId,
    runVariantId: d.runVariantId,
    step: d.step,
    agentId: d.agentId,
    assetSymbol: d.assetSymbol,
    action: d.action,
    confidence: d.confidence,
    rationale: d.rationale,
    syntheticSignal: d.syntheticSignal,
    infoSignal: d.infoSignal,
    eventSignal: d.eventSignal,
    regimeSignal: d.regimeSignal,
    distortedSignal: d.distortedSignal,
    beliefDrift: d.beliefDrift,
    prefBUY: d.prefBUY,
    prefSELL: d.prefSELL,
    prefHOLD: d.prefHOLD,
  }));
  for (const batch of chunk(decisionData, 1000)) {
    await prisma.agentDecision.createMany({ data: batch });
  }

  log(`Persisted ${decisions.length} decisions`);

  const avgOverlap =
    stepJaccards.length > 0
      ? stepJaccards.reduce((a, b) => a + b, 0) / stepJaccards.length
      : 0;
  const rvCfg = await prisma.runVariant.findUnique({
    where: { id: runVariantId },
    select: { config: true },
  });
  const prevCfg =
    rvCfg?.config && typeof rvCfg.config === "object" && !Array.isArray(rvCfg.config)
      ? { ...(rvCfg.config as Record<string, unknown>) }
      : {};
  await prisma.runVariant.update({
    where: { id: runVariantId },
    data: {
      config: {
        ...prevCfg,
        cvVal018: {
          avgPairwiseEventOverlap: avgOverlap,
          overlapStepCount: stepJaccards.length,
        },
      } as Prisma.InputJsonValue,
    },
  });
  log(
    `[CV-VAL-018] avgPairwiseEventOverlap=${avgOverlap.toFixed(3)} (target band ~0.2–0.4 when topics permit)`,
  );

  await prisma.$disconnect();
}

const isDecideEntry =
  typeof process !== "undefined" &&
  process.argv[1]?.includes("decide") &&
  !process.argv[1]?.includes("decide-validate");
if (isDecideEntry) {
  main().catch((err) => {
    console.error("decide failed:", err);
    process.exit(1);
  });
}
