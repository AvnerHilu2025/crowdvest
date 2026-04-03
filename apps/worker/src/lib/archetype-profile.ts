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
