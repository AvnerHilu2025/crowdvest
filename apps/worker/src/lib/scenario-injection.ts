/**
 * Deterministic scenario file → InfoEventInput merge for decide.ts.
 */

import fs from "fs/promises";
import { clamp01, clamp11, type InfoEventInput } from "./exposure";
import { signalQualityFromSource } from "./agent-information-exposure";

export type ScenarioSensitivityOverrides = Record<string, number>;

export type ScenarioEventRecord = {
  step: number;
  assetSymbol: string;
  sourceType: string;
  sourceName: string;
  title: string;
  sentiment: number;
  confidence: number;
  urgency: number;
  relevance: number;
  reach: number;
  credibility: number;
  topicTags?: string[];
  targetArchetypes?: string[];
  sensitivityOverrides?: ScenarioSensitivityOverrides;
};

export type ScenarioFile = {
  version?: number;
  events: ScenarioEventRecord[];
};

function stableScenarioId(step: number, index: number, title: string, sourceKey: string): string {
  let h = 0;
  const s = `${step}:${index}:${title}:${sourceKey}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  const u = (h >>> 0).toString(16).padStart(8, "0");
  return `scenario:${step}:${index}:${u}`;
}

export function scenarioRecordToInfoEventInput(rec: ScenarioEventRecord, index: number): InfoEventInput {
  const sourceKey = `${String(rec.sourceType).trim()}:${String(rec.sourceName).trim()}`;
  const id = stableScenarioId(rec.step, index, rec.title, sourceKey);
  const topic =
    rec.topicTags && rec.topicTags.length > 0
      ? [...rec.topicTags].map((t) => t.trim()).filter(Boolean).sort().join("|")
      : rec.title.trim() || "(scenario)";
  const source = sourceKey;
  const reach = clamp01(rec.reach * clamp01(rec.relevance));
  const credibility = clamp01(rec.credibility * clamp01(rec.confidence));
  const volatilityImpact = clamp01(rec.urgency);
  const targets = rec.targetArchetypes
    ?.map((t) => String(t).trim().toLowerCase())
    .filter((t) => t.length > 0);
  return {
    id,
    sentiment: clamp11(rec.sentiment),
    credibility,
    reach,
    topic,
    source,
    signalQuality: signalQualityFromSource(source),
    volatilityImpact,
    scenarioInjected: true,
    scenarioTargetArchetypes: targets && targets.length > 0 ? targets : undefined,
    scenarioSensitivityOverrides: rec.sensitivityOverrides,
  };
}

/** If event has scenario targets, agent must match at least one (id or display name substring). */
export function filterScenarioEventsForAgent(
  events: InfoEventInput[],
  archetypeConfigId: string,
  archetypeLabel: string | null | undefined,
): InfoEventInput[] {
  const aid = archetypeConfigId.toLowerCase();
  const name = (archetypeLabel ?? "").toLowerCase();
  return events.filter((ev) => {
    if (!ev.scenarioInjected) return true;
    const targets = ev.scenarioTargetArchetypes;
    if (!targets || targets.length === 0) return true;
    return targets.some((t) => {
      const x = t.toLowerCase();
      return x === aid || name.includes(x) || aid.includes(x);
    });
  });
}

/**
 * Per-agent effective sentiment: base * (archetypeSentimentScale[id] ?? default ?? 1), clamped [-1,1].
 * Zero scale yields zero sentiment for that agent. When no scale fields exist on any event, returns the same array reference.
 */
export function applyArchetypeSentimentScaleForAgent(
  events: InfoEventInput[],
  archetypeConfigId: string,
): InfoEventInput[] {
  const aid = archetypeConfigId.trim().toLowerCase();
  let anyScale = false;
  for (const ev of events) {
    if (
      (ev.archetypeSentimentScale != null && Object.keys(ev.archetypeSentimentScale).length > 0) ||
      ev.defaultArchetypeSentimentScale != null
    ) {
      anyScale = true;
      break;
    }
  }
  if (!anyScale) return events;

  return events.map((ev) => {
    const map = ev.archetypeSentimentScale;
    const keyScale =
      map != null && typeof map[aid] === "number" && Number.isFinite(map[aid]) ? map[aid] : undefined;
    const def =
      ev.defaultArchetypeSentimentScale != null &&
      Number.isFinite(ev.defaultArchetypeSentimentScale)
        ? ev.defaultArchetypeSentimentScale
        : undefined;
    const scale = keyScale ?? def ?? 1;
    const effectiveSentiment = clamp11(ev.sentiment * scale);
    if (effectiveSentiment === ev.sentiment) return ev;
    return { ...ev, sentiment: effectiveSentiment };
  });
}

export function mergeScenarioEventsIntoMap(
  infoEventsByStep: Map<number, InfoEventInput[]>,
  records: ScenarioEventRecord[],
  assetSymbol: string,
  steps: number,
): void {
  const forAsset = records
    .filter((r) => r.assetSymbol === assetSymbol && r.step >= 0 && r.step < steps)
    .sort((a, b) => {
      if (a.step !== b.step) return a.step - b.step;
      if (a.title !== b.title) return a.title.localeCompare(b.title);
      return String(a.sourceName).localeCompare(String(b.sourceName));
    });

  for (let i = 0; i < forAsset.length; i++) {
    const rec = forAsset[i]!;
    const ev = scenarioRecordToInfoEventInput(rec, i);
    const list = infoEventsByStep.get(rec.step) ?? [];
    list.push(ev);
    list.sort((a, b) => a.id.localeCompare(b.id));
    infoEventsByStep.set(rec.step, list);
  }
}

export async function loadScenarioFile(filePath: string): Promise<ScenarioEventRecord[]> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as ScenarioFile;
  if (!parsed || !Array.isArray(parsed.events)) {
    throw new Error(`scenario file must be JSON with { "events": [...] }: ${filePath}`);
  }
  return parsed.events;
}
