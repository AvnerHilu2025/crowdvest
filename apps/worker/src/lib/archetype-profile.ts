/**
 * CV-ARCH-052 full config: 24 archetypes from JSON + deterministic per-agent variation.
 */
import * as fs from "fs";
import * as path from "path";
import { clamp11, hashToUnitFloat } from "./exposure";

export type ArchetypeHorizon = "short" | "mid" | "long";

export interface ArchetypeConfigEntry {
  id: string;
  name: string;
  weights: { synthetic: number; info: number; event: number; regime: number };
  decision: { threshold: number; aggressiveness: number };
  bias: { direction: number; strength: number };
  behavior: {
    noiseSensitivity: number;
    volatilitySensitivity: number;
    reactionSpeed: number;
    memoryFactor: number;
  };
  confidence: { base: number; variance: number };
  horizon: ArchetypeHorizon;
  /** Per-channel visibility multipliers (0–1) before blend; not normalized. */
  informationExposure?: {
    synthetic: number;
    info: number;
    event: number;
    regime: number;
  };
  /** Step delays per channel (reserved; history not wired yet). */
  informationLatency?: {
    synthetic: number;
    info: number;
    event: number;
    regime: number;
  };
}

export interface ArchetypesConfigFile {
  version: number;
  archetypes: ArchetypeConfigEntry[];
}

export type EffectiveArchetypeProfile = {
  archetypeId: string;
  wSyn: number;
  wInfo: number;
  wEvt: number;
  wReg: number;
  thresholdMul: number;
  bias: number;
  noiseAmp: number;
  volatilitySensitivity: number;
  reactionSpeed: number;
  memoryFactor: number;
  confidenceBase: number;
  confidenceVariance: number;
  horizon: ArchetypeHorizon;
};

export type AgentPersonaProfile = {
  ageBucket: "young" | "mid" | "senior";
  digitalAffinity: number;
  institutionalTrust: number;
  socialReactivity: number;
};

export type AgentSourceAccess = {
  sourceId: string;
  exposure: number;
  trust: number;
  latencyTolerance: number;
};

export type PersonaProfile = {
  ageGroup: "young" | "adult" | "senior";
  digitalAffinity: number; // 0..1
  financialLiteracy: number; // 0..1
  confidenceLevel: number; // 0..1
  peerInfluence: number; // 0..1
  authorityTrust: number; // 0..1
  attentionBias: number; // 0..1
  impressionSensitivity: number; // 0..1
  engagementLevel: number; // 0..1
  randomnessFactor: number; // 0..1
};

export type DecisionMode =
  | "analytical"
  | "social"
  | "attention"
  | "impression"
  | "authority"
  | "random";

export type SourceAccess = {
  macro: boolean;
  news: boolean;
  social: boolean;
  peers: boolean;
  analyst: boolean;
  technical: boolean;
};

export type SourceTrust = {
  macro: number;
  news: number;
  social: number;
  peers: number;
  analyst: number;
  technical: number;
};

export type SourceLatency = {
  macro: number;
  news: number;
  social: number;
  peers: number;
  analyst: number;
  technical: number;
};

export type SourceProfile = {
  access: SourceAccess;
  trust: SourceTrust;
  latency: SourceLatency;
  maxSourcesPerStep: number;
};

let cached: { byId: Map<string, ArchetypeConfigEntry>; order: string[] } | null = null;

export function loadArchetypesConfig(): { byId: Map<string, ArchetypeConfigEntry>; order: string[] } {
  if (cached) return cached;
  const configPath = path.join(__dirname, "../config/archetypes.config.json");
  const raw = fs.readFileSync(configPath, "utf8");
  const data = JSON.parse(raw) as ArchetypesConfigFile;
  if (!Array.isArray(data.archetypes) || data.archetypes.length !== 24) {
    throw new Error(
      `archetypes.config.json must contain exactly 24 archetypes, got ${data.archetypes?.length ?? 0}`,
    );
  }
  const byId = new Map<string, ArchetypeConfigEntry>();
  const order: string[] = [];
  for (const a of data.archetypes) {
    if (byId.has(a.id)) throw new Error(`duplicate archetype id: ${a.id}`);
    byId.set(a.id, a);
    order.push(a.id);
  }
  cached = { byId, order };
  return cached;
}

function vary(agentId: string, archId: string, slot: string, lo: number, hi: number): number {
  const u = hashToUnitFloat(`cv052-var:${archId}:${agentId}:${slot}`);
  return lo + u * (hi - lo);
}

/**
 * Pick one of the 24 config archetypes per agent: match id/name when possible,
 * else deterministic slot from agentId + optional DB archetype id + label (still exactly one of 24).
 */
export function resolveArchetypeConfigId(
  agentId: string,
  archetypeLabel: string | null | undefined,
  archetypeUuid: string | null | undefined,
): string {
  const { byId, order } = loadArchetypesConfig();
  const raw = archetypeLabel?.trim() ?? "";
  if (raw) {
    const key = raw.toLowerCase();
    if (byId.has(key)) return key;
    for (const a of byId.values()) {
      if (a.name.toLowerCase() === key) return a.id;
    }
    const slug = key
      .replace(/^the\s+/i, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (slug && byId.has(slug)) return slug;
  }
  const tie = `${agentId}:${archetypeUuid ?? ""}:${raw}`;
  const u = hashToUnitFloat(`cv052-arch-pick:${tie}`);
  const idx = Math.floor(u * order.length);
  return order[idx]!;
}

export function effectiveArchetypeProfileForAgent(
  agentId: string,
  archetypeLabel: string | null | undefined,
  archetypeUuid: string | null | undefined,
): EffectiveArchetypeProfile {
  const { byId } = loadArchetypesConfig();
  const archId = resolveArchetypeConfigId(agentId, archetypeLabel, archetypeUuid);
  const def = byId.get(archId)!;

  /* CV-ARCH-058: tighter per-agent jitter so archetype base profiles dominate cross-type separation. */
  const wSyn = def.weights.synthetic * vary(agentId, archId, "ws", 0.82, 1.18);
  const wInfo = def.weights.info * vary(agentId, archId, "wi", 0.82, 1.18);
  const wEvt = def.weights.event * vary(agentId, archId, "we", 0.82, 1.18);
  const wReg = def.weights.regime * vary(agentId, archId, "wr", 0.82, 1.18);

  const thScale = vary(agentId, archId, "th", 0.88, 1.12);
  const aggScale = vary(agentId, archId, "agg", 0.9, 1.1);
  const thresholdMul =
    (def.decision.threshold * thScale) / Math.max(0.25, def.decision.aggressiveness * aggScale);

  const strJ = vary(agentId, archId, "bias", 0.9, 1.1);
  const bias = clamp11(def.bias.direction * def.bias.strength * strJ);

  const noiseAmp = def.behavior.noiseSensitivity * vary(agentId, archId, "noise", 0.88, 1.12);
  const volatilitySensitivity =
    def.behavior.volatilitySensitivity * vary(agentId, archId, "vol", 0.88, 1.12);
  const reactionSpeed = def.behavior.reactionSpeed * vary(agentId, archId, "react", 0.88, 1.12);
  let memoryFactor = def.behavior.memoryFactor * vary(agentId, archId, "mem", 0.88, 1.12);
  memoryFactor = Math.max(0.05, Math.min(0.98, memoryFactor));

  const confVar = def.confidence.variance * vary(agentId, archId, "cvar", 0.9, 1.1);
  const confBase = Math.max(
    0.12,
    Math.min(0.88, def.confidence.base * vary(agentId, archId, "cbase", 0.95, 1.05)),
  );

  return {
    archetypeId: archId,
    wSyn,
    wInfo,
    wEvt,
    wReg,
    thresholdMul,
    bias,
    noiseAmp,
    volatilitySensitivity,
    reactionSpeed,
    memoryFactor,
    confidenceBase: confBase,
    confidenceVariance: Math.max(0.01, Math.min(0.22, confVar)),
    horizon: def.horizon,
  };
}

export function buildAgentPersonaProfile(agentId: string): AgentPersonaProfile {
  const ageU = hashToUnitFloat(`persona:age:${agentId}`);
  const digU = hashToUnitFloat(`persona:dig:${agentId}`);
  const instU = hashToUnitFloat(`persona:inst:${agentId}`);
  const socU = hashToUnitFloat(`persona:soc:${agentId}`);

  const ageBucket = ageU < 0.33 ? "young" : ageU < 0.72 ? "mid" : "senior";

  return {
    ageBucket,
    digitalAffinity: digU,
    institutionalTrust: instU,
    socialReactivity: socU,
  };
}

export function buildAgentSourceAccess(archetypeId: string, persona: AgentPersonaProfile): AgentSourceAccess[] {
  const out: AgentSourceAccess[] = [];

  function push(sourceId: string, exposure: number, trust: number, latencyTolerance: number) {
    out.push({
      sourceId,
      exposure: Math.max(0, Math.min(1, exposure)),
      trust: Math.max(0, Math.min(1, trust)),
      latencyTolerance: Math.max(0, Math.min(1, latencyTolerance)),
    });
  }

  push("market_prices", 0.9, 0.95, 1.0);

  switch (archetypeId) {
    case "trend":
      push("social_feed", 0.55 + 0.35 * persona.digitalAffinity, 0.35 + 0.2 * persona.socialReactivity, 0.2);
      push("breaking_news", 0.5, 0.6, 0.4);
      push("macro_reports", 0.25, 0.55, 0.8);
      break;

    case "contrarian":
      push("social_feed", 0.35, 0.2, 0.2);
      push("breaking_news", 0.45, 0.45, 0.5);
      push("analyst_notes", 0.5, 0.65, 0.7);
      break;

    case "fundamental":
      push("analyst_notes", 0.8, 0.82 + 0.12 * persona.institutionalTrust, 0.85);
      push("macro_reports", 0.7, 0.84, 0.9);
      push("breaking_news", 0.35, 0.55, 0.5);
      break;

    case "noise":
      push("social_feed", 0.85, 0.35, 0.1);
      push("rumor_flow", 0.95, 0.22, 0.05);
      push("peer_circle", 0.75, 0.45, 0.2);
      break;

    default:
      push("breaking_news", 0.45, 0.58, 0.45);
      push("macro_reports", 0.35, 0.72, 0.7);
      push("analyst_notes", 0.35, 0.68, 0.7);
      push("social_feed", 0.25 + 0.35 * persona.digitalAffinity, 0.25 + 0.2 * persona.socialReactivity, 0.2);
      break;
  }

  if (persona.ageBucket === "senior") {
    out.forEach((x) => {
      if (x.sourceId === "social_feed" || x.sourceId === "rumor_flow") x.exposure *= 0.65;
      if (x.sourceId === "analyst_notes" || x.sourceId === "macro_reports") x.trust = Math.min(1, x.trust * 1.12);
    });
  }

  if (persona.ageBucket === "young") {
    out.forEach((x) => {
      if (x.sourceId === "social_feed" || x.sourceId === "rumor_flow") x.exposure = Math.min(1, x.exposure * 1.18);
    });
  }

  return out;
}

export function applyVolatilityToSignal(
  signal: number,
  syntheticSignal: number,
  volSens: number,
): number {
  const volMag = Math.min(1, Math.abs(syntheticSignal) * 2.6);
  return clamp11(signal * (1 + (volSens - 1) * volMag));
}

export function confidenceFromProfile(
  eff: EffectiveArchetypeProfile,
  agentId: string,
  step: number,
  signalI: number,
): number {
  const uc = hashToUnitFloat(`cv052-conf:${eff.archetypeId}:${agentId}:${step}`);
  const extra = 0.35 * Math.min(1, Math.abs(signalI));
  return Math.max(
    0,
    Math.min(1, eff.confidenceBase + eff.confidenceVariance * (uc - 0.5) * 2 + extra),
  );
}

export function applyArchetypeSignalBias(
  archetypeId: string,
  signals: {
    synthetic: number;
    info: number;
    event: number;
    regime: number;
  },
): typeof signals {
  const s = { ...signals };

  switch (archetypeId) {
    case "trend":
      s.synthetic *= 1.3;
      s.regime *= 1.2;
      break;

    case "contrarian":
      s.synthetic *= -1.2;
      break;

    case "noise":
      s.synthetic *= Math.random() * 2 - 1;
      s.info *= 0.3;
      break;

    case "fundamental":
      s.info *= 1.4;
      break;

    default:
      break;
  }

  return s;
}

export function buildDefaultPersona(archetypeId: string): PersonaProfile {
  switch (archetypeId) {
    case "trend":
      return {
        ageGroup: "young",
        digitalAffinity: 0.9,
        financialLiteracy: 0.5,
        confidenceLevel: 0.8,
        peerInfluence: 0.7,
        authorityTrust: 0.3,
        attentionBias: 0.8,
        impressionSensitivity: 0.4,
        engagementLevel: 0.9,
        randomnessFactor: 0.2,
      };

    case "fundamental":
      return {
        ageGroup: "adult",
        digitalAffinity: 0.5,
        financialLiteracy: 0.9,
        confidenceLevel: 0.6,
        peerInfluence: 0.2,
        authorityTrust: 0.7,
        attentionBias: 0.3,
        impressionSensitivity: 0.2,
        engagementLevel: 0.7,
        randomnessFactor: 0.1,
      };

    case "contrarian":
      return {
        ageGroup: "adult",
        digitalAffinity: 0.6,
        financialLiteracy: 0.7,
        confidenceLevel: 0.7,
        peerInfluence: 0.1,
        authorityTrust: 0.2,
        attentionBias: 0.4,
        impressionSensitivity: 0.3,
        engagementLevel: 0.6,
        randomnessFactor: 0.3,
      };

    default:
      return {
        ageGroup: "adult",
        digitalAffinity: 0.5,
        financialLiteracy: 0.5,
        confidenceLevel: 0.5,
        peerInfluence: 0.5,
        authorityTrust: 0.5,
        attentionBias: 0.5,
        impressionSensitivity: 0.5,
        engagementLevel: 0.5,
        randomnessFactor: 0.5,
      };
  }
}

export function getDecisionMode(persona: PersonaProfile): DecisionMode {
  if (persona.randomnessFactor > 0.7) return "random";
  if (persona.peerInfluence > 0.7) return "social";
  if (persona.attentionBias > 0.7) return "attention";
  if (persona.impressionSensitivity > 0.7) return "impression";
  if (persona.authorityTrust > 0.7) return "authority";
  return "analytical";
}

export function buildSourceProfile(persona: PersonaProfile): SourceProfile {
  const trust: SourceTrust = {
    macro: persona.financialLiteracy * 0.9,
    news: 0.3 + persona.engagementLevel * 0.5,
    social: persona.digitalAffinity * 0.9,
    peers: persona.peerInfluence * 0.9,
    analyst: persona.authorityTrust * 0.9,
    technical: persona.financialLiteracy * 0.8,
  };

  const totalTrust =
    (trust.macro +
      trust.news +
      trust.social +
      trust.peers +
      trust.analyst +
      trust.technical) || 1;

  trust.macro /= totalTrust;
  trust.news /= totalTrust;
  trust.social /= totalTrust;
  trust.peers /= totalTrust;
  trust.analyst /= totalTrust;
  trust.technical /= totalTrust;

  return {
    access: {
      macro: persona.financialLiteracy > 0.7,
      news: persona.engagementLevel > 0.4 && persona.digitalAffinity > 0.3,
      social: persona.digitalAffinity > 0.6,
      peers: persona.peerInfluence > 0.4,
      analyst: persona.authorityTrust > 0.6,
      technical: persona.financialLiteracy > 0.6,
    },
    trust,
    latency: {
      macro: 3,
      news: 1,
      social: 0,
      peers: 0,
      analyst: 2,
      technical: 1,
    },
    maxSourcesPerStep: Math.max(1, Math.floor(persona.engagementLevel * 3)),
  };
}
