export interface RegimeState {
  regimeSignal: number; // [-1,1]
  regimeStrength: number; // [0,1]
  volatility: number; // normalized [0,1]
}

export function computeRegimeState(
  priceByStep: number[],
  step: number,
): RegimeState {
  if (step < 3) {
    return { regimeSignal: 0, regimeStrength: 0, volatility: 0 };
  }

  const windowShort = 3;
  const windowMedium = 7;

  const shortMean = meanReturn(priceByStep, step, windowShort);
  const mediumMean = meanReturn(priceByStep, step, windowMedium);

  const trend = 0.6 * shortMean + 0.4 * mediumMean;

  const eps = 1e-6;
  const volRaw = computeVolatilityRaw(priceByStep, step, 7);
  const sharpeLike = trend / (volRaw + eps);
  const normalized = clamp11(sharpeLike * 0.7);

  return {
    regimeSignal: normalized,
    regimeStrength: clamp01(Math.abs(normalized)),
    volatility: clamp01(volRaw * 20),
  };
}

function computeVolatilityRaw(
  prices: number[],
  step: number,
  window: number,
): number {
  const returns: number[] = [];
  for (let i = Math.max(1, step - window + 1); i <= step; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  if (returns.length === 0) return 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;

  const variance =
    returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;

  return Math.sqrt(variance);
}

function meanReturn(prices: number[], step: number, window: number): number {
  let sum = 0;
  let count = 0;
  for (let i = Math.max(1, step - window + 1); i <= step; i++) {
    const r = (prices[i] - prices[i - 1]) / prices[i - 1];
    sum += r;
    count++;
  }
  return count > 0 ? sum / count : 0;
}

function computeVolatility(
  prices: number[],
  step: number,
  window: number,
): number {
  const returns: number[] = [];
  for (let i = Math.max(1, step - window + 1); i <= step; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  if (returns.length === 0) return 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;

  const variance =
    returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;

  const vol = Math.sqrt(variance);

  return clamp01(vol * 20);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function clamp11(x: number): number {
  return Math.max(-1, Math.min(1, x));
}
