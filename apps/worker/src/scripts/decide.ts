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
 *   --minAgents 100        Minimum agents required (default: 100). Enforces crowd wisdom.
 *   --allowSmallCrowd      Bypass minAgents check for dev debugging (default: false).
 *
 * Wisdom of crowds: requires minAgents (default 100). Use --allowSmallCrowd to bypass in dev.
 * Generate agents: POST /agents/generate?runId=...&overwrite=true
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";
import {
  clamp01,
  clamp11,
  distortSignal,
  decisionFromSignalWithPreferences,
  computeConfidence,
  applyExperienceModulation,
  buildRationale,
  updateFatigue,
  updateAttention,
  computePreferenceDeltas,
  computeBeliefBiasDrift,
  type Action,
  type Biases,
  type HumanState,
} from "../decision/bias";
import {
  aggregateInfoSignal,
  computeEventSignal,
  type InfoEventInput,
} from "../lib/exposure";

const ALPHA = 0.35; // weight of infoSignal vs synthetic (1-ALPHA = synthetic weight)

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

function parseArgv(): {
  runId: string;
  steps: number;
  assetSymbol: string;
  seed: number | undefined;
  overwrite: boolean;
  minAgents: number;
  allowSmallCrowd: boolean;
} {
  const args = process.argv.slice(2);
  let runId = "";
  let steps = 20;
  let assetSymbol = "RUN";
  let seed: number | undefined;
  let overwrite = false; // Default: overwrite=false (idempotent)
  let minAgents = DEFAULT_MIN_AGENTS;
  let allowSmallCrowd = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--runId" && args[i + 1]) {
      runId = args[++i]!.trim();
    } else if (arg === "--steps" && args[i + 1]) {
      steps = Math.max(1, parseInt(args[++i]!, 10) || 20);
    } else if (arg === "--assetSymbol" && args[i + 1]) {
      assetSymbol = args[++i]!.trim() || "RUN";
    } else if (arg === "--seed" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n)) seed = n;
    } else if (arg.startsWith("--overwrite=")) {
      // Handle --overwrite=false or --overwrite=true (single arg)
      const value = arg.slice("--overwrite=".length);
      overwrite = parseBool(value, false);
    } else if (arg === "--overwrite") {
      // Handle --overwrite false or --overwrite true (two args)
      if (args[i + 1] != null) {
        overwrite = parseBool(args[++i], false);
      } else {
        // Flag present without value: default to true (backward compat)
        overwrite = true;
      }
    } else if (arg === "--minAgents" && args[i + 1]) {
      const n = parseInt(args[++i]!, 10);
      if (Number.isFinite(n) && n >= 1) minAgents = n;
    } else if (arg === "--allowSmallCrowd") {
      allowSmallCrowd = true;
    }
  }
  if (process.env.DEBUG_ARGS === "1" || process.env.DEBUG_ARGS === "true") {
    console.log(`[DEBUG_ARGS] raw argv: ${JSON.stringify(process.argv)}`);
    console.log(`[DEBUG_ARGS] parsed overwrite: ${overwrite}`);
  }
  if (!runId) throw new Error("--runId is required");
  return { runId, steps, assetSymbol, seed, overwrite, minAgents, allowSmallCrowd };
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

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function main(): Promise<void> {
  loadEnv();
  const argv = parseArgv();
  log(`decide runId=${argv.runId} steps=${argv.steps} assetSymbol=${argv.assetSymbol} seed=${argv.seed ?? "random"} overwrite=${argv.overwrite}`);

  const prisma = new PrismaClient();

  const run = await prisma.simulationRun.findUnique({
    where: { id: argv.runId },
    select: { id: true, seed: true },
  });
  if (!run) throw new Error(`Run not found: ${argv.runId}`);

  const agents = await prisma.runAgent.findMany({
    where: { runId: argv.runId },
    include: { traits: true },
    orderBy: { name: "asc" },
  });
  if (agents.length === 0) throw new Error(`No RunAgents for run ${argv.runId}. Create agents first (POST /agents/generate).`);

  const crowdCheck = validateCrowdSize(agents.length, argv.minAgents, argv.allowSmallCrowd);
  if (!crowdCheck.ok) throw new Error(crowdCheck.message);

  log(`Loaded ${agents.length} agents`);

  if (argv.overwrite) {
    // Do NOT delete AssetStepReturn: it is imported market data, not derived from decisions.
    const [deletedDec, deletedInfo, deletedExp, deletedCrowd, deletedRewards, deletedAgentState] = await Promise.all([
      prisma.agentDecision.deleteMany({
        where: { runId: argv.runId, assetSymbol: argv.assetSymbol },
      }),
      prisma.agentInfoState.deleteMany({
        where: { runId: argv.runId, assetSymbol: argv.assetSymbol },
      }),
      prisma.agentExperience.deleteMany({ where: { runId: argv.runId } }),
      prisma.crowdMetrics.deleteMany({
        where: { runId: argv.runId, assetSymbol: argv.assetSymbol },
      }),
      prisma.agentReward.deleteMany({
        where: { runId: argv.runId, assetSymbol: argv.assetSymbol },
      }),
      prisma.agentState.deleteMany({
        where: { runId: argv.runId, assetSymbol: argv.assetSymbol },
      }),
    ]);
    log(`Deleted ${deletedDec.count} decisions, ${deletedInfo.count} AgentInfoState, ${deletedExp.count} experiences, ${deletedCrowd.count} CrowdMetrics, ${deletedRewards.count} AgentReward, ${deletedAgentState.count} AgentState (overwrite)`);
  }

  const [experienceCount, infoStateCount] = await Promise.all([
    prisma.agentExperience.count({ where: { runId: argv.runId } }),
    prisma.agentInfoState.count({
      where: { runId: argv.runId, assetSymbol: argv.assetSymbol },
    }),
  ]);
  log(`experienceCount=${experienceCount} infoStateCount=${infoStateCount} overwrite=${argv.overwrite}`);

  const globalSeed = argv.seed ?? run.seed ?? Math.floor(Math.random() * 0x7fffffff);

  const traitMapByAgent = new Map<string, Map<string, number>>();
  for (const a of agents) {
    const m = new Map<string, number>();
    for (const t of a.traits) {
      if (t.valueNum != null && Number.isFinite(t.valueNum)) {
        m.set(t.key, t.valueNum);
      }
    }
    traitMapByAgent.set(a.id, m);
  }

  const priceByStep: number[] = [1];
  const drift = 0.001;
  const noiseScale = 0.02;
  const baseRng = createSeededRng(globalSeed);
  for (let s = 1; s <= argv.steps; s++) {
    const prev = priceByStep[s - 1]!;
    const noise = (baseRng() - 0.5) * 2 * noiseScale;
    const ret = drift + noise;
    priceByStep.push(prev * (1 + ret));
  }

  const dbExperiencesByRunAgent = new Map<
    string,
    { step: number; action: Action; outcomePositive: boolean; confidence: number }[]
  >();
  const crowdSignalByStep = new Map<number, number>();

  if (!argv.overwrite && experienceCount > 0) {
    const [dbExps, crowdMetrics, decisions] = await Promise.all([
      prisma.agentExperience.findMany({
        where: { runId: argv.runId },
        select: { runAgentId: true, step: true, actionJson: true },
        orderBy: { step: "asc" },
      }),
      prisma.crowdMetrics.findMany({
        where: { runId: argv.runId, assetSymbol: argv.assetSymbol },
        select: { step: true, weightedSignal: true },
      }),
      prisma.agentDecision.findMany({
        where: { runId: argv.runId, assetSymbol: argv.assetSymbol },
        select: { step: true, action: true, confidence: true },
      }),
    ]);

    for (const row of crowdMetrics) {
      crowdSignalByStep.set(row.step, row.weightedSignal);
    }
    if (decisions.length > 0) {
      const byStep = new Map<number, { sum: number; n: number }>();
      for (const d of decisions) {
        const w =
          d.action === "BUY" ? d.confidence : d.action === "SELL" ? -d.confidence : 0;
        const cur = byStep.get(d.step) ?? { sum: 0, n: 0 };
        cur.sum += w;
        cur.n += 1;
        byStep.set(d.step, cur);
      }
      for (const [step, { sum, n }] of byStep) {
        if (!crowdSignalByStep.has(step) && n > 0) {
          crowdSignalByStep.set(step, clamp11(sum / n));
        }
      }
    }

    for (const e of dbExps) {
      const meta = (e.actionJson as { action?: Action; confidence?: number }) ?? {};
      const action = (meta.action ?? "HOLD") as Action;
      const confidence = typeof meta.confidence === "number" ? meta.confidence : 0.5;
      const p0 = priceByStep[e.step] ?? 1;
      const p1 = priceByStep[e.step + 1] ?? p0;
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
    step: number;
    agentId: string;
    assetSymbol: string;
    action: Action;
    confidence: number;
    rationale: string;
  }[] = [];
  const agentInfoStates: {
    runId: string;
    assetSymbol: string;
    agentId: string;
    step: number;
    exposedCount: number;
    infoSignal: number;
  }[] = [];
  const agentStatesToPersist: {
    runId: string;
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
    runAgentId: string;
    step: number;
    action: Action;
    confidence: number;
    crowdSignalAtStep: number;
    wasWithMajority: boolean;
    eventSignal: number;
  }[] = [];
  const eventSignalByAgent = new Map<string, number>();

  let crowdSampleSignal = 0;
  let lastBaseSignal: number | null = null;
  const agentState = new Map<
    string,
    { lastAction: Action | null; fatigue: number; attentionLevel: number }
  >();
  const prevExperienceByAgent = new Map<string, { wasWithMajority: boolean }>();
  let prevStepHist: { BUY: number; SELL: number; HOLD: number } | null = null;
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
  const allEvents = await prisma.infoEvent.findMany({
    where: {
      runId: argv.runId,
      assetSymbol: argv.assetSymbol,
      step: { gte: 0, lt: argv.steps },
    },
    orderBy: { step: "asc" },
  });
  for (const e of allEvents) {
    const list = infoEventsByStep.get(e.step) ?? [];
    list.push({
      id: e.id,
      sentiment: e.sentiment,
      credibility: e.credibility,
      reach: e.reach,
    });
    infoEventsByStep.set(e.step, list);
  }

  for (let step = 0; step < argv.steps; step++) {
    const price0 = priceByStep[step]!;
    const price1 = priceByStep[step + 1]!;
    const delta = (price1 - price0) / price0;
    const syntheticSignal = clamp11(delta * 10);
    const momentum = step > 0 ? syntheticSignal - (lastBaseSignal ?? 0) : 0;
    const eventsForStep = infoEventsByStep.get(step) ?? [];

    let prevConsensus = 0;
    let prevMajorityAction: Action = "HOLD";
    if (step > 0 && prevStepHist) {
      const N = prevStepHist.BUY + prevStepHist.SELL + prevStepHist.HOLD;
      if (N > 0) {
        const maxCount = Math.max(
          prevStepHist.BUY,
          prevStepHist.SELL,
          prevStepHist.HOLD,
        );
        prevConsensus = maxCount / N;
        prevMajorityAction =
          prevStepHist.BUY >= prevStepHist.SELL && prevStepHist.BUY >= prevStepHist.HOLD
            ? "BUY"
            : prevStepHist.SELL >= prevStepHist.HOLD
              ? "SELL"
              : "HOLD";
      }
    }

    if (step > 0 && prevExperienceByAgent.size === 0) {
      const prevExps = await prisma.agentExperience.findMany({
        where: { runId: argv.runId, step: step - 1 },
        select: { runAgentId: true, actionJson: true },
      });
      for (const e of prevExps) {
        const meta = e.actionJson as { wasWithMajority?: boolean } | null;
        if (meta?.wasWithMajority !== undefined) {
          prevExperienceByAgent.set(e.runAgentId, { wasWithMajority: meta.wasWithMajority });
        }
      }
    }

    const hist = { BUY: 0, SELL: 0, HOLD: 0 };
    let sumConf = 0;
    let weightedSum = 0;
    let sumPrefBUY = 0;
    let sumPrefSELL = 0;
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
    for (const exp of experiencesToPersist) {
      if (exp.step >= step) continue;
      const p0 = priceByStep[exp.step] ?? 1;
      const p1 = priceByStep[exp.step + 1] ?? p0;
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
      const agentSeed = hashToSeed(`${argv.runId}-${agent.id}-${step}-${globalSeed}`);
      const rng = createSeededRng(agentSeed);

      const anchorSign = crowdSampleSignal !== 0 ? crowdSampleSignal : syntheticSignal;
      const { infoSignal, exposedCount } = aggregateInfoSignal({
        events: eventsForStep,
        agentId: agent.id,
        step,
        seed: globalSeed,
        attentionLevel: state.attentionLevel,
        confirmationBias: biases.confirmationBias,
        overconfidence: biases.overconfidence,
        anchorSign,
      });

      // Compute direct eventSignal from InfoEvents (additive impact)
      const eventSignal = computeEventSignal({
        events: eventsForStep,
        confirmationBias: biases.confirmationBias,
        herding: biases.herding,
        attentionLevel: state.attentionLevel,
        fatigue: state.fatigue,
        emotionalVolatility: getTrait(traits, "emotionalVolatility"),
        crowdConsensusDirection: crowdSampleSignal,
      });
      eventSignalByAgent.set(agent.id, eventSignal);

      const baseSignal = clamp11(
        (1 - ALPHA) * syntheticSignal + ALPHA * infoSignal + eventSignal,
      );

      const distorted = distortSignal({
        baseSignal,
        crowdSampleSignal,
        lastSignal: lastBaseSignal,
        momentum,
        lastAction: state.lastAction,
        biases,
        humanState: {
          attentionLevel: state.attentionLevel,
          emotionalVolatility: getTrait(traits, "emotionalVolatility"),
          fatigue: state.fatigue,
        },
        rng,
      });

      const agentExps = experiencesByRunAgent.get(agent.id) ?? [];
      const experienceEntries = agentExps.map((e) => ({
        step: e.step,
        action: e.action,
        outcomePositive: e.outcomePositive,
      }));

      const learningRate =
        0.02 + 0.1 * (1 - state.fatigue) * state.attentionLevel;
      const volatilityProxy = Math.min(1, Math.abs(syntheticSignal) * 2);
      const prefDeltas = computePreferenceDeltas({
        experiences: experienceEntries,
        learningRate,
        lossAversion: biases.lossAversion,
        overconfidence: biases.overconfidence,
        volatility: volatilityProxy,
        uncertainty: 0.3,
      });

      const beliefBiasDrift = computeBeliefBiasDrift({
        experiences: agentExps,
        crowdSignalByStep,
        currentStep: step,
        recencyBias: biases.recencyBias,
        herding: biases.herding,
        lossAversion: biases.lossAversion,
      });

      const distortedWithDrift = clamp11(distorted + beliefBiasDrift);

      sumPrefBUY += prefDeltas.prefBUY;
      sumPrefSELL += prefDeltas.prefSELL;

      let action = decisionFromSignalWithPreferences({
        distorted: distortedWithDrift,
        prefBUY: prefDeltas.prefBUY,
        prefSELL: prefDeltas.prefSELL,
        prefHOLD: prefDeltas.prefHOLD,
        attentionLevel: state.attentionLevel,
        overconfidence: biases.overconfidence,
        fatigue: state.fatigue,
        uncertainty: 0.3,
        rng,
      });

      let confidence = computeConfidence({
        distorted: distortedWithDrift,
        action,
        uncertainty: 0.3,
        overconfidence: biases.overconfidence,
        fatigue: state.fatigue,
      });
      const prevExp = prevExperienceByAgent.get(agent.id);
      confidence = applyExperienceModulation({
        confidence,
        wasWithMajority: prevExp?.wasWithMajority ?? null,
        lossAversion: biases.lossAversion,
        overconfidence: biases.overconfidence,
      });

      let rationale = buildRationale({
        action,
        distorted: distortedWithDrift,
        crowdSampleSignal,
        biases,
        humanState: {
          attentionLevel: state.attentionLevel,
          emotionalVolatility: getTrait(traits, "emotionalVolatility"),
          fatigue: state.fatigue,
        },
        exposedCount,
        infoSignal,
        fromReinforcement: experienceEntries.length > 0,
      });

      if (step > 0 && prevStepHist) {
        const emotionalVolatility = getTrait(traits, "emotionalVolatility");
        const attentionLevel = state.attentionLevel;
        const p = clamp01(
          biases.herding *
            (0.3 + 0.7 * prevConsensus) *
            emotionalVolatility *
            (1 - attentionLevel),
        );
        if (rng() < p) {
          action = prevMajorityAction;
          confidence = clamp01(confidence + 0.06);
          rationale = rationale + " (social contagion: followed previous step majority)";
        }
      }

      agentInfoStates.push({
        runId: argv.runId,
        assetSymbol: argv.assetSymbol,
        agentId: agent.id,
        step,
        exposedCount,
        infoSignal,
      });
      const baselineConf = getTrait(traits, "confidence", 0.5);
      const baselineRisk = getTrait(traits, "riskTolerance", 0.5);
      const baselineHerding = getTrait(traits, "herding", 0.5);
      agentStatesToPersist.push({
        runId: argv.runId,
        assetSymbol: argv.assetSymbol,
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
      weightedSum += action === "BUY" ? confidence : action === "SELL" ? -confidence : 0;
      stepDecisions.push({ agentId: agent.id, action, confidence });

      state.lastAction = action;
      state.fatigue = updateFatigue(state.fatigue, state.attentionLevel);
      state.attentionLevel = updateAttention(state.attentionLevel, state.fatigue);

      decisions.push({
        runId: argv.runId,
        step,
        agentId: agent.id,
        assetSymbol: argv.assetSymbol,
        action,
        confidence,
        rationale,
      });
    }

    crowdSampleSignal = agents.length > 0 ? weightedSum / agents.length : 0;
    lastBaseSignal = syntheticSignal;

    const majorityAction: Action =
      crowdSampleSignal > 0.1 ? "BUY" : crowdSampleSignal < -0.1 ? "SELL" : "HOLD";
    prevExperienceByAgent.clear();
    for (const d of stepDecisions) {
      const wasWithMajority = d.action === majorityAction;
      prevExperienceByAgent.set(d.agentId, { wasWithMajority });
      experiencesToPersist.push({
        runId: argv.runId,
        runAgentId: d.agentId,
        step,
        action: d.action,
        confidence: d.confidence,
        crowdSignalAtStep: crowdSampleSignal,
        wasWithMajority,
        eventSignal: eventSignalByAgent.get(d.agentId) ?? 0,
      });
    }

    prevStepHist = { BUY: hist.BUY, SELL: hist.SELL, HOLD: hist.HOLD };

    const avgConf = agents.length > 0 ? sumConf / agents.length : 0;
    const avgPrefBUY = agents.length > 0 ? sumPrefBUY / agents.length : 0;
    const avgPrefSELL = agents.length > 0 ? sumPrefSELL / agents.length : 0;
    const signalStrength = Math.max(0, Math.min(1, Math.abs(syntheticSignal)));
    log(
      `Step ${step}: signal=${syntheticSignal.toFixed(3)} strength=${signalStrength.toFixed(3)} BUY=${hist.BUY} SELL=${hist.SELL} HOLD=${hist.HOLD} avgConf=${avgConf.toFixed(3)} avgPrefBUY=${avgPrefBUY.toFixed(3)} avgPrefSELL=${avgPrefSELL.toFixed(3)}`,
    );
  }

  for (const s of agentInfoStates) {
    await prisma.agentInfoState.upsert({
      where: {
        runId_assetSymbol_agentId_step: {
          runId: s.runId,
          assetSymbol: s.assetSymbol,
          agentId: s.agentId,
          step: s.step,
        },
      },
      create: s,
      update: { exposedCount: s.exposedCount, infoSignal: s.infoSignal },
    });
  }
  log(`Persisted ${agentInfoStates.length} AgentInfoState rows`);

  for (const s of agentStatesToPersist) {
    await prisma.agentState.upsert({
      where: {
        runId_assetSymbol_agentId_step: {
          runId: s.runId,
          assetSymbol: s.assetSymbol,
          agentId: s.agentId,
          step: s.step,
        },
      },
      create: s,
      update: {
        exposedCount: s.exposedCount,
        infoSignal: s.infoSignal,
        confidence: s.confidence,
        riskTolerance: s.riskTolerance,
        herding: s.herding,
      },
    });
  }
  log(`Persisted ${agentStatesToPersist.length} AgentState rows`);

  const stepTs = new Date();
  if (experiencesToPersist.length > 0) {
    await prisma.agentExperience.createMany({
      data: experiencesToPersist.map((exp) => ({
        runId: exp.runId,
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
      })),
    });
  }
  log(`Persisted ${experiencesToPersist.length} AgentExperience rows`);

  for (const d of decisions) {
    await prisma.agentDecision.upsert({
      where: {
        runId_step_agentId_assetSymbol: {
          runId: argv.runId,
          step: d.step,
          agentId: d.agentId,
          assetSymbol: argv.assetSymbol,
        },
      },
      create: {
        runId: d.runId,
        step: d.step,
        agentId: d.agentId,
        assetSymbol: d.assetSymbol,
        action: d.action,
        confidence: d.confidence,
        rationale: d.rationale,
      },
      update: {
        action: d.action,
        confidence: d.confidence,
        rationale: d.rationale,
      },
    });
  }

  log(`Persisted ${decisions.length} decisions`);
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
