/**
 * Seeded RNG for reproducible simulations. Simple LCG + Box-Muller for normal.
 */

export function createSeededRng(seed: number) {
  let state = seed;
  return function next(): number {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffff_ffff;
  };
}

let spare: number | null = null;
let hasSpare = false;

/**
 * Normal(mean, stdev) using Box-Muller. Uses the provided uniform RNG.
 */
export function normal(mean: number, stdev: number, uniform: () => number): number {
  if (hasSpare) {
    hasSpare = false;
    return mean + stdev * (spare ?? 0);
  }
  let u: number;
  let v: number;
  let s: number;
  do {
    u = 2 * uniform() - 1;
    v = 2 * uniform() - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);
  const mul = Math.sqrt((-2 * Math.log(s)) / s);
  spare = v * mul;
  hasSpare = true;
  return mean + stdev * (u * mul);
}

/**
 * Sample market return for a step: Normal(mean, stdev). Resets Box-Muller state per call.
 */
export function sampleMarketReturn(
  mean: number,
  stdev: number,
  uniform: () => number,
): number {
  return normal(mean, stdev, uniform);
}
