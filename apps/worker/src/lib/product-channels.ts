/**
 * Product-grade channel builders: explicit formulas only (no ratioOr, no routing, no fallback noise).
 * See product-channel-constants.ts for frozen parameters.
 */

import { clamp11 } from "./exposure";
import type { InfoEventInput } from "./exposure";
import {
  PRODUCT_EVENT,
  PRODUCT_INFO,
  PRODUCT_P99_RAW_SYN,
  PRODUCT_REGIME,
  PRODUCT_SIGMA_REF,
  PRODUCT_SYNTHETIC,
  productAssetClassForSymbol,
  type ProductAssetClassId,
} from "./product-channel-constants";

export type ProductRegimeLabel = "BULL" | "BEAR" | "NEUTRAL";

export interface ProductChannelResult {
  synthetic: number;
  info: number;
  event: number;
  regime: number;
  /** Weighted-mean aggregate (same denominator as info leg). */
  agg: number;
  agreement: number;
  regimeLabel: ProductRegimeLabel;
}

function stepReturn(prices: number[], step: number): number {
  if (step < 1) return 0;
  const p0 = prices[step - 1]!;
  const p1 = prices[step]!;
  if (Math.abs(p0) < 1e-12) return 0;
  return (p1 - p0) / p0;
}

function meanStepReturns(prices: number[], step: number, window: number): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < window; i++) {
    const t = step - i;
    if (t < 1) break;
    sum += stepReturn(prices, t);
    count++;
  }
  return count > 0 ? sum / count : 0;
}

function volStepReturns(prices: number[], step: number, window: number): number {
  const rets: number[] = [];
  for (let i = 0; i < window; i++) {
    const t = step - i;
    if (t < 1) break;
    rets.push(stepReturn(prices, t));
  }
  if (rets.length === 0) return PRODUCT_SYNTHETIC.eps;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  return Math.max(Math.sqrt(variance), PRODUCT_SYNTHETIC.eps);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function normRegimeLabel(r: number): ProductRegimeLabel {
  if (r > PRODUCT_REGIME.thetaPlus) return "BULL";
  if (r < -PRODUCT_REGIME.thetaPlus) return "BEAR";
  return "NEUTRAL";
}

function buildSyntheticRaw(prices: number[], step: number, assetClass: ProductAssetClassId): number {
  const { w1, w2, w3, alphaSyn, Lm, Lv, eps } = PRODUCT_SYNTHETIC;
  const r1 = stepReturn(prices, step);
  const rm = meanStepReturns(prices, step, Lm);
  const sigma = volStepReturns(prices, step, Lv);
  const rSig = sigma > eps ? r1 / sigma : 0;
  const raw0 = w1 * r1 + w2 * rm + w3 * rSig;
  const sigmaRef = PRODUCT_SIGMA_REF[assetClass];
  const v = Math.min(1, sigma / sigmaRef);
  let raw1 = raw0 * (1 + alphaSyn * v);
  const p99 = PRODUCT_P99_RAW_SYN[assetClass];
  if (Math.abs(raw1) > p99) {
    raw1 = Math.sign(raw1) * p99;
  }
  return raw1;
}

function normalizeWeights(items: InfoEventInput[]): { w: number[]; c: number[]; s: number[] } {
  const n = items.length;
  if (n === 0) {
    return { w: [], c: [], s: [] };
  }
  let sumReach = 0;
  for (const e of items) {
    sumReach += Math.max(0, e.reach ?? 0);
  }
  const w: number[] = [];
  if (sumReach <= 1e-12) {
    const u = 1 / n;
    for (let i = 0; i < n; i++) w.push(u);
  } else {
    for (const e of items) {
      w.push(Math.max(0, e.reach ?? 0) / sumReach);
    }
  }
  const c: number[] = items.map((e) => clamp01(e.credibility ?? 1));
  const s: number[] = items.map((e) => clamp11(e.sentiment));
  return { w, c, s };
}

/** If Σ(w_i * c_i) > 1, scale weights so mass = 1 (same agg/agreement, stable bound). */
function applyMassBound(w: number[], c: number[]): number[] {
  if (w.length === 0) return w;
  let mass = 0;
  for (let i = 0; i < w.length; i++) {
    mass += w[i]! * c[i]!;
  }
  if (mass <= 1 + 1e-12) return w;
  const inv = 1 / mass;
  return w.map((wi) => wi * inv);
}

function normalizeWeightsWithMassBound(items: InfoEventInput[]): { w: number[]; c: number[]; s: number[] } {
  const { w, c, s } = normalizeWeights(items);
  if (w.length === 0) return { w, c, s };
  const wB = applyMassBound(w, c);
  return { w: wB, c, s };
}

const INFO_RANGE_EPS = 1e-9;

function assertInfoRangeStable(info: number): void {
  if (!Number.isFinite(info)) {
    throw new Error("[PRODUCT_CHANNELS] info is not finite");
  }
  if (Math.abs(info) > 1 + INFO_RANGE_EPS) {
    throw new Error(`[PRODUCT_CHANNELS] info out of stable range [-1,1]: ${info}`);
  }
}

function buildInfoAndAgreement(items: InfoEventInput[]): {
  agg: number;
  agreement: number;
  info: number;
} {
  if (items.length === 0) {
    return { agg: 0, agreement: 0, info: 0 };
  }
  const { w, c, s } = normalizeWeightsWithMassBound(items);
  const n = items.length;
  let sumWC = 0;
  let sumWCS = 0;
  let sumWCabsS = 0;
  for (let i = 0; i < n; i++) {
    const wi = w[i]!;
    const ci = c[i]!;
    const si = s[i]!;
    sumWC += wi * ci;
    sumWCS += wi * ci * si;
    sumWCabsS += wi * ci * Math.abs(si);
  }
  if (sumWC < 1e-15) {
    return { agg: 0, agreement: 0, info: 0 };
  }
  const agg = sumWCS / sumWC;
  const agreement = sumWCabsS < 1e-15 ? 0 : Math.abs(sumWCS) / sumWCabsS;
  const aN = Math.min(1, Math.log(1 + n) / PRODUCT_INFO.kCount);
  const rawInfo = agg * (0.5 + 0.5 * agreement) * aN;
  const info = clamp11(rawInfo);
  assertInfoRangeStable(info);
  return { agg, agreement, info };
}

function buildEventPrimaryAndFallback(
  items: InfoEventInput[],
  agg: number,
  agreement: number,
): { event: number } {
  if (items.length === 0) {
    return { event: 0 };
  }
  const { w, c, s } = normalizeWeightsWithMassBound(items);
  const n = items.length;
  let bestScore = 0;
  let bestIdx = 0;
  for (let i = 0; i < n; i++) {
    const e = items[i]!;
    const ci = clamp01(e.credibility ?? 1);
    const si = clamp11(e.sentiment);
    const q = clamp01(e.signalQuality ?? 1);
    const score = Math.max(0, e.reach ?? 0) * ci * Math.abs(si) * q;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  let primary = 0;
  if (bestScore >= PRODUCT_EVENT.tauSig) {
    const si = s[bestIdx]!;
    const raw = Math.sign(si) * Math.min(1, PRODUCT_EVENT.gE * bestScore);
    if (Math.abs(raw) >= PRODUCT_EVENT.tauE) {
      primary = clamp11(raw);
    }
  }
  if (primary !== 0) {
    return { event: primary };
  }
  if (
    agreement < PRODUCT_EVENT.agreementFloor ||
    Math.abs(agg) <= PRODUCT_EVENT.aggFloor
  ) {
    return { event: 0 };
  }
  let maxProd = 0;
  let maxIdx = 0;
  for (let i = 0; i < n; i++) {
    const wi = w[i]!;
    const ci = c[i]!;
    const si = s[i]!;
    const prod = wi * ci * Math.abs(si);
    if (prod > maxProd) {
      maxProd = prod;
      maxIdx = i;
    }
  }
  const sStar = s[maxIdx]!;
  const mag = PRODUCT_EVENT.fallbackScale * maxProd;
  const fb = Math.sign(sStar) * Math.min(1, mag);
  return { event: clamp11(fb) };
}

function buildRegime(prices: number[], step: number, assetClass: ProductAssetClassId): {
  regime: number;
  label: ProductRegimeLabel;
} {
  const { Lm, Lv, eps } = PRODUCT_SYNTHETIC;
  const { eta } = PRODUCT_REGIME;
  const mu = meanStepReturns(prices, step, Lm);
  const sigma = volStepReturns(prices, step, Lv);
  const sigmaRef = PRODUCT_SIGMA_REF[assetClass];
  const v = Math.min(1, sigma / sigmaRef);
  const rawReg = Math.tanh(mu / (sigma + eps)) * (1 + eta * v);
  const regime = clamp11(rawReg);
  return { regime, label: normRegimeLabel(regime) };
}

/** RunIds that have already emitted the empty-events diagnostic (once per runId per process). */
const productChannelsEmptyEventsLoggedRunIds = new Set<string>();

export interface ProductChannelInput {
  priceByStep: number[];
  step: number;
  events: InfoEventInput[];
  assetSymbol: string;
  /**
   * Diagnostics only: when set, logs once per runId (first time `events.length === 0`), not per agent.
   * Does not affect channel math.
   */
  diagnosticRunId?: string;
}

/**
 * Build four channels from prices + event list. No persistent bias without data:
 * empty events → info=0, event=0; insufficient prices → neutral synthetic/regime as defined.
 */
export function computeProductChannels(input: ProductChannelInput): ProductChannelResult {
  const { priceByStep, step, events, assetSymbol, diagnosticRunId } = input;
  if (
    events.length === 0 &&
    diagnosticRunId &&
    !productChannelsEmptyEventsLoggedRunIds.has(diagnosticRunId)
  ) {
    productChannelsEmptyEventsLoggedRunIds.add(diagnosticRunId);
    console.warn(
      `[PRODUCT_CHANNELS_DBG] computeProductChannels: events.length===0 (first occurrence this run) step=${step} runId=${diagnosticRunId}`,
    );
  }
  const assetClass = productAssetClassForSymbol(assetSymbol);

  const rawSynCapped = buildSyntheticRaw(priceByStep, step, assetClass);
  const synthetic = clamp11(Math.tanh(PRODUCT_SYNTHETIC.kappaSyn * rawSynCapped));

  const { agg, agreement, info } = buildInfoAndAgreement(events);
  const { event } = buildEventPrimaryAndFallback(events, agg, agreement);
  const { regime, label } = buildRegime(priceByStep, step, assetClass);

  return {
    synthetic,
    info,
    event,
    regime,
    agg,
    agreement,
    regimeLabel: label,
  };
}
