/**
 * Run: pnpm -C apps/worker exec tsx src/lib/product-channels.selftest.ts
 */
import { computeProductChannels } from "./product-channels";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const prices = [100, 100.5, 100.2, 100.8, 101.0, 101.2, 101.5, 101.1, 100.9, 101.4].map((x) => x);

const out = computeProductChannels({
  priceByStep: prices,
  step: 5,
  events: [
    {
      id: "e1",
      sentiment: 0.4,
      credibility: 0.8,
      reach: 0.5,
    },
  ],
  assetSymbol: "SPY",
});

assert(out.synthetic >= -1 && out.synthetic <= 1, "synthetic in [-1,1]");
assert(out.info >= -1 && out.info <= 1, "info in [-1,1]");
assert(out.event >= -1 && out.event <= 1, "event in [-1,1]");
assert(out.regime >= -1 && out.regime <= 1, "regime in [-1,1]");
assert(out.agreement >= 0 && out.agreement <= 1, "agreement in [0,1]");

const empty = computeProductChannels({
  priceByStep: prices,
  step: 5,
  events: [],
  assetSymbol: "SPY",
});
assert(empty.info === 0 && empty.event === 0, "empty events → no info/event bias");

console.log("product-channels.selftest: ok", { out, empty });
