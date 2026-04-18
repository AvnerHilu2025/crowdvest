/**
 * Canonical dashboard persona archetypes (24). Source: apps/worker/src/config/archetypes.config.json
 * Keep in sync when archetype roster changes.
 */
export const DASHBOARD_ARCHETYPE_CATALOG: ReadonlyArray<{ id: string; label: string }> = [
  { id: "linear_quant", label: "Linear Quant" },
  { id: "nonlinear_quant", label: "Nonlinear Quant" },
  { id: "mean_reversion", label: "Mean Reversion Trader" },
  { id: "momentum_trader", label: "Momentum Trader" },
  { id: "news_reactor", label: "News Reactor" },
  { id: "info_skeptic", label: "Information Skeptic" },
  { id: "event_sniper", label: "Event Sniper" },
  { id: "late_event_follower", label: "Late Event Follower" },
  { id: "false_event_reactor", label: "False Event Reactor" },
  { id: "macro_follower", label: "Macro Follower" },
  { id: "regime_contrarian", label: "Regime Contrarian" },
  { id: "stability_seeker", label: "Stability Seeker" },
  { id: "volatility_chaser", label: "Volatility Chaser" },
  { id: "volatility_avoider", label: "Volatility Avoider" },
  { id: "optimist", label: "Optimist" },
  { id: "pessimist", label: "Pessimist" },
  { id: "conviction_buyer", label: "Conviction Buyer" },
  { id: "conviction_seller", label: "Conviction Seller" },
  { id: "passive_allocator", label: "Passive Allocator" },
  { id: "conservative_planner", label: "Conservative Planner" },
  { id: "noise_amplifier", label: "Noise Amplifier" },
  { id: "noise_dampener", label: "Noise Dampener" },
  { id: "short_horizon_scalper", label: "Short Horizon Scalper" },
  { id: "long_horizon_allocator", label: "Long Horizon Allocator" },
];

const NORM = (s: string) => s.trim().toLowerCase();

/** Map RunAgent.archetype (often display name) to catalog slug for aggregation keys. */
export function catalogIdForRunAgentArchetype(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (s === "") return "Unknown";

  for (const e of DASHBOARD_ARCHETYPE_CATALOG) {
    if (e.id === s) return e.id;
  }
  const lower = NORM(s);
  for (const e of DASHBOARD_ARCHETYPE_CATALOG) {
    if (NORM(e.label) === lower) return e.id;
  }
  const slugGuess = lower.replace(/\s+/g, "_");
  for (const e of DASHBOARD_ARCHETYPE_CATALOG) {
    if (e.id === slugGuess) return e.id;
  }
  return "Unknown";
}
