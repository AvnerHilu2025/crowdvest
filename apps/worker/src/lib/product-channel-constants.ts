/**
 * Product channel layer — frozen calibration constants (v1).
 *
 * Source: implementation spec 2025-03-28. Values are fixed per asset class (no rolling).
 * Re-calibrate by editing this table and re-running validation targets (median balance,
 * event sparsity, regime label distribution).
 */

/** Broad asset buckets for p99 guardrails and σ_ref (not rolling). */
export type ProductAssetClassId = "us_large_cap_etf" | "us_small_cap_etf" | "generic";

/** Map ticker → class. Extend as new universes are onboarded. */
export function productAssetClassForSymbol(symbol: string): ProductAssetClassId {
  const s = symbol.trim().toUpperCase();
  if (["SPY", "QQQ", "DIA", "VOO", "IVV"].includes(s)) return "us_large_cap_etf";
  if (["IWM", "IJR", "VB"].includes(s)) return "us_small_cap_etf";
  return "generic";
}

/**
 * Fixed p99 of |raw_syn^(1)| on a one-time calibration pass (daily step returns, multi-horizon blend).
 * Frozen — no rolling window. Document provenance when values change.
 *
 * Provenance (v1): placeholder aligned with typical daily ETF raw_syn magnitudes pre-tanh;
 * replace after empirical calibration run.
 */
export const PRODUCT_P99_RAW_SYN: Record<ProductAssetClassId, number> = {
  us_large_cap_etf: 0.012,
  us_small_cap_etf: 0.015,
  generic: 0.013,
};

/** Reference vol for v_t = min(1, σ/σ_ref); frozen per asset class. */
export const PRODUCT_SIGMA_REF: Record<ProductAssetClassId, number> = {
  us_large_cap_etf: 0.012,
  us_small_cap_etf: 0.015,
  generic: 0.013,
};

export const PRODUCT_SYNTHETIC = {
  w1: 0.3,
  w2: 0.45,
  w3: 0.25,
  alphaSyn: 0.5,
  /** tanh scale; tune so median(|synthetic|) ≈ median(|info|) on reference corpus. */
  kappaSyn: 140,
  Lm: 5,
  Lv: 5,
  eps: 1e-6,
} as const;

export const PRODUCT_INFO = {
  /** k in a_n = min(1, log(1+n)/k); use log(1+20). */
  kCount: Math.log(21),
} as const;

export const PRODUCT_EVENT = {
  tauSig: 0.15,
  tauE: 0.05,
  gE: 1.4,
  /** Fallback only if agreement ≥ this and |agg| > aggFloor. */
  agreementFloor: 0.3,
  aggFloor: 0.2,
  fallbackScale: 0.3,
} as const;

export const PRODUCT_REGIME = {
  eta: 0.5,
  /** Discrete labels on continuous regime ∈ [-1,1]. */
  thetaPlus: 0.25,
  theta0: 0.15,
} as const;
