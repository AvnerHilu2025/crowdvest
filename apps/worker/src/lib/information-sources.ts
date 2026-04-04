export type InformationSourceType =
  | "market"
  | "news"
  | "social"
  | "macro"
  | "analyst"
  | "rumor"
  | "peer";

export type InformationSource = {
  id: string;
  type: InformationSourceType;
  baseCredibility: number;
  baseNoise: number;
  baseLatency: number;
  defaultWeight: number;
};

export const INFORMATION_SOURCES: InformationSource[] = [
  { id: "market_prices", type: "market", baseCredibility: 0.95, baseNoise: 0.05, baseLatency: 0, defaultWeight: 1.0 },
  { id: "breaking_news", type: "news", baseCredibility: 0.72, baseNoise: 0.18, baseLatency: 0, defaultWeight: 0.8 },
  { id: "macro_reports", type: "macro", baseCredibility: 0.88, baseNoise: 0.08, baseLatency: 1, defaultWeight: 0.9 },
  { id: "analyst_notes", type: "analyst", baseCredibility: 0.83, baseNoise: 0.12, baseLatency: 1, defaultWeight: 0.75 },
  { id: "social_feed", type: "social", baseCredibility: 0.42, baseNoise: 0.62, baseLatency: 0, defaultWeight: 0.65 },
  { id: "rumor_flow", type: "rumor", baseCredibility: 0.25, baseNoise: 0.9, baseLatency: 0, defaultWeight: 0.5 },
  { id: "peer_circle", type: "peer", baseCredibility: 0.55, baseNoise: 0.45, baseLatency: 0, defaultWeight: 0.55 },
];

export function getSourceById(id: string): InformationSource | undefined {
  return INFORMATION_SOURCES.find((s) => s.id === id);
}
