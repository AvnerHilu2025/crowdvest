import type { MarketDataProvider, ProviderPricePayload } from "./market-data-provider.interface";

/** Deterministic hash for symbol seeding */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

/** Mulberry32 deterministic PRNG */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dummy provider: returns deterministic synthetic price series seeded by symbol. Stable across runs. */
export class DummyMarketProvider implements MarketDataProvider {
  readonly name = "dummy";

  async fetchPrices(symbol: string, points: number): Promise<ProviderPricePayload> {
    const seed = hashString(symbol + "dummy-market-v1");
    const rng = mulberry32(seed);

    const basePrice = 100 + (rng() * 200);
    const prices: ProviderPricePayload["prices"] = [];

    let prevClose = basePrice;
    const startDate = new Date("2020-01-02");

    for (let i = 0; i < points; i++) {
      const ret = (rng() - 0.5) * 0.04;
      const close = Math.max(1, prevClose * (1 + ret));
      const high = Math.max(close, prevClose) * (1 + rng() * 0.01);
      const low = Math.min(close, prevClose) * (1 - rng() * 0.01);
      const open = prevClose;

      const d = new Date(startDate);
      d.setDate(d.getDate() + i);

      prices.push({
        time: d.toISOString(),
        open,
        high,
        low,
        close,
        volume: Math.floor(1_000_000 + rng() * 9_000_000),
      });
      prevClose = close;
    }

    return {
      symbol,
      provider: this.name,
      timestamp: new Date().toISOString(),
      prices,
    };
  }
}
