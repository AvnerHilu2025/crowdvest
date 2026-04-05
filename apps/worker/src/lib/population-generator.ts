import config from "../config/population.config.json";

type AgeGroup = "young" | "adult" | "senior";

type Persona =
  | "analytical"
  | "social"
  | "attention"
  | "authority"
  | "emotion"
  | "passive"
  | "random";

export type Worldview = "left" | "center" | "right" | "anti_establishment";

export interface AgentProfile {
  ageGroup: AgeGroup;
  persona: Persona;
  worldview: Worldview;
  channels: Record<string, number>;
  sourceFamilies: Record<string, string[]>;
}

function pickWeighted<T extends string>(dist: Record<T, number>): T {
  const r = Math.random();
  let acc = 0;
  for (const k in dist) {
    acc += dist[k];
    if (r <= acc) return k as T;
  }
  return Object.keys(dist)[0] as T;
}

export function generateAgentProfile(): AgentProfile {
  const ageGroup = pickWeighted(config.ageDistribution);
  const persona = pickWeighted(config.personaDistribution);
  const worldview = pickWeighted(
    (config as any).worldviewDistribution as Record<Worldview, number>,
  );

  const baseChannels = config.channelsByAge[ageGroup] || {};

  const personaMods = (config as any).personaChannelModifiers?.[persona] || {};

  const channels: Record<string, number> = {};
  for (const k in baseChannels) {
    let v = baseChannels[k as keyof typeof baseChannels] as number;

    if (personaMods[k] !== undefined) {
      v = v * personaMods[k];
    }

    const noise = (Math.random() - 0.5) * 0.1;
    v = v + noise;

    channels[k] = Math.max(0, Math.min(1, v));
  }

  // persona competition: boost top channels, suppress weak channels
  const entries = Object.entries(channels).sort((a, b) => b[1] - a[1]);
  if (entries.length > 0) {
    const top1 = entries[0][0];
    channels[top1] = Math.min(1, channels[top1] * 1.15);
  }
  if (entries.length > 1) {
    const top2 = entries[1][0];
    channels[top2] = Math.min(1, channels[top2] * 1.08);
  }
  for (const [k, v] of Object.entries(channels)) {
    if (v < 0.45) {
      channels[k] = Math.max(0, v * 0.75);
    }
  }

  if (persona === "random") {
    for (const k in channels) {
      channels[k] = Math.max(0, Math.min(1, Math.random()));
    }
  }

  if (persona === "passive") {
    for (const k in channels) {
      channels[k] = channels[k] * 0.8;
    }
  }

  const cfg = config as any;
  const sourceFamilies: Record<string, string[]> = {};

  for (const channelName of Object.keys(channels)) {
    const familyMap = cfg.sourceFamilies?.[channelName];
    if (!familyMap) continue;
    sourceFamilies[channelName] = familyMap[worldview] || [];
  }

  return {
    ageGroup,
    persona,
    worldview,
    channels,
    sourceFamilies,
  };
}
