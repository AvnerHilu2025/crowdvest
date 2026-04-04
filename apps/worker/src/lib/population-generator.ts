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

export interface AgentProfile {
  ageGroup: AgeGroup;
  persona: Persona;
  channels: Record<string, number>;
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

  const baseChannels = config.channelsByAge[ageGroup] || {};

  const personaMods = (config as any).personaChannelModifiers?.[persona] || {};

  const channels: Record<string, number> = {};
  for (const k in baseChannels) {
    let v = baseChannels[k as keyof typeof baseChannels] as number;

    // apply persona modifier if exists
    if (personaMods[k] !== undefined) {
      v = v * personaMods[k];
    }

    // noise
    const noise = (Math.random() - 0.5) * 0.1;
    v = v + noise;

    // clamp
    channels[k] = Math.max(0, Math.min(1, v));
  }

  return {
    ageGroup,
    persona,
    channels,
  };
}
