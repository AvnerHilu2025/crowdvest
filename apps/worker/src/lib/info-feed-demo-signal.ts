/**
 * Deterministic InfoEvent → event-channel contribution for decide.ts (demo-ready).
 * Formula per event: sentiment * relevance * personaSource * decay * archetypeWeight
 * - relevance = reach * credibility (clamped)
 * - personaSource = signal quality from source (same basis as CV-VAL-018)
 * - decay = f(volatilityImpact) when present, else 1
 * - archetypeWeight: event_sniper ↑, info_skeptic ↓, noise_dampener ↓; late_event_follower uses step lag outside the sum
 */

import { clamp01, clamp11, scenarioChannelMul, type InfoEventInput } from "./exposure";
import { signalQualityFromSource } from "./agent-information-exposure";

function archetypeEventFeedWeight(archetypeConfigId: string): number {
  switch (archetypeConfigId) {
    case "event_sniper":
      return 1.42;
    case "info_skeptic":
      return 0.32;
    case "late_event_follower":
      return 1.05;
    case "noise_dampener":
      return 0.4;
    default:
      return 0.92;
  }
}

export function computeInfoFeedDemoEventContribution(input: {
  events: InfoEventInput[];
  archetypeConfigId: string;
  /** Previous step's raw mean (same agent) for late_event_follower lag. */
  prevRawForLag: number | undefined;
}): { rawUnlagged: number; lagged: number } {
  const { events, archetypeConfigId, prevRawForLag } = input;
  if (events.length === 0) {
    return { rawUnlagged: 0, lagged: 0 };
  }

  const wArch = archetypeEventFeedWeight(archetypeConfigId);
  let sum = 0;
  for (const ev of events) {
    const relevance = clamp01(ev.reach * ev.credibility);
    const personaSource = clamp01(ev.signalQuality ?? signalQualityFromSource(ev.source));
    const vol = ev.volatilityImpact;
    const decay = clamp01(1 - 0.28 * clamp01(Math.abs(vol ?? 0)));
    const sentiment = clamp11(ev.sentiment);
    const senEvt = scenarioChannelMul(ev.scenarioSensitivityOverrides, "event");
    sum += sentiment * relevance * personaSource * decay * wArch * senEvt;
  }

  const rawUnlagged = clamp11(sum / events.length);
  const prev = prevRawForLag ?? 0;
  const lagged =
    archetypeConfigId === "late_event_follower"
      ? clamp11(0.26 * rawUnlagged + 0.74 * prev)
      : rawUnlagged;

  return { rawUnlagged, lagged };
}
