import * as fs from "fs";
import * as path from "path";

/**
 * Canonical default SPY price CSV used by backtest-v0 and import endpoints.
 * Path: apps/worker/data/market/spy.us.daily.sample.csv
 */
export const DEFAULT_SPY_CSV_RELATIVE = "apps/worker/data/market/spy.us.daily.sample.csv";

/** Resolve the default SPY CSV path. Tries cwd-relative paths (monorepo root or apps/api). */
export function getDefaultSpyCsvPath(): string {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, DEFAULT_SPY_CSV_RELATIVE),
    path.resolve(cwd, "..", "worker", "data", "market", "spy.us.daily.sample.csv"),
    path.resolve(cwd, "..", "..", "apps", "worker", "data", "market", "spy.us.daily.sample.csv"),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      `Default SPY CSV not found. Tried: ${candidates.join(", ")}. Run from repo root or apps/api.`,
    );
  }
  return found;
}
