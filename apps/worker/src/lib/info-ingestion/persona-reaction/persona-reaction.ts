import { loadArchetypesConfig } from "../../archetype-profile";
import type { NormalizedInfoEvent, PersonaEventImpact, PersonaSourcePreference } from "../types";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clamp11(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

export function buildPersonaSourcePreferences(): PersonaSourcePreference[] {
  const { archetypes } = (() => {
    const cfg = loadArchetypesConfig();
    return { archetypes: cfg.order.map((id) => cfg.byId.get(id)!).filter(Boolean) };
  })();

  return archetypes.map((a) => {
    const exp = a.informationExposure ?? { synthetic: 0.4, info: 0.4, event: 0.4, regime: 0.4 };
    const sum = exp.synthetic + exp.info + exp.event + exp.regime || 1;
    const infoW = exp.info / sum;
    const eventW = exp.event / sum;
    const macroW = exp.regime / sum;
    const newsAffinity = clamp01(infoW * 0.65 + eventW * 0.25 + macroW * 0.1);
    const socialAffinity = clamp01(infoW * 0.5 + eventW * 0.45 + 0.05);
    const macroAffinity = clamp01(macroW * 0.85 + infoW * 0.15);
    return {
      archetypeId: a.id,
      sourceAffinity: {
        news: newsAffinity,
        social: socialAffinity,
        macro: macroAffinity,
      },
      sentimentSensitivity: clamp01(a.decision.aggressiveness / Math.max(0.2, a.decision.threshold)) + 0.25,
      contrarianBias: clamp11(-a.bias.direction * a.bias.strength),
    };
  });
}

export function computePersonaEventImpact(
  event: NormalizedInfoEvent,
  preferences: PersonaSourcePreference[],
): PersonaEventImpact[] {
  const eventWeight = clamp01(event.relevance * 0.5 + event.urgency * 0.5);
  return preferences.map((pref) => {
    const affinity = pref.sourceAffinity[event.sourceType];
    const signedInfluence = clamp11(event.sentiment * pref.sentimentSensitivity + pref.contrarianBias * 0.3);
    const impactScore = clamp11(signedInfluence * affinity * (0.4 + eventWeight * 0.6));
    const confidence = clamp01((event.credibility * 0.6 + event.relevance * 0.4) * (0.4 + affinity * 0.6));
    const rationale: string[] = [
      `${event.sourceType} affinity ${(affinity * 100).toFixed(0)}%`,
      `sentiment ${event.sentiment >= 0 ? "+" : ""}${event.sentiment.toFixed(2)}`,
    ];
    if (Math.abs(pref.contrarianBias) > 0.1) {
      rationale.push(`contrarian bias ${pref.contrarianBias >= 0 ? "+" : ""}${pref.contrarianBias.toFixed(2)}`);
    }
    return {
      archetypeId: pref.archetypeId,
      eventId: event.eventId,
      symbol: event.symbol,
      impactScore,
      confidence,
      rationale,
    };
  });
}
