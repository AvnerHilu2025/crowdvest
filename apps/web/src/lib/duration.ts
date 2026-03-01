/**
 * Derive durations from persisted fields. Used when durationMs is null.
 * Accepts ISO strings for timestamps.
 */

function parseMs(iso?: string | null): number | null {
  if (iso == null || iso === "") return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function diffMs(startIso?: string | null, endIso?: string | null): number | null {
  const start = parseMs(startIso);
  const end = parseMs(endIso);
  if (start == null || end == null) return null;
  const d = end - start;
  return Number.isFinite(d) && d >= 0 ? d : null;
}

/** Derive run duration: runDurationMs if present, else from startedAt/finishedAt or completedAt. */
export function deriveRunDurationMs(params: {
  runDurationMs?: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  completedAt?: string | null;
}): number | null {
  const { runDurationMs, startedAt, finishedAt, completedAt } = params;
  if (runDurationMs != null && Number.isFinite(runDurationMs) && runDurationMs > 0) {
    return runDurationMs;
  }
  const endIso = finishedAt ?? completedAt ?? null;
  return diffMs(startedAt, endIso);
}

/** Derive variant duration: durationMs if present, else from startedAt/completedAt. */
export function deriveVariantDurationMs(params: {
  durationMs?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
}): number | null {
  const { durationMs, startedAt, completedAt } = params;
  if (durationMs != null && Number.isFinite(durationMs) && durationMs > 0) {
    return durationMs;
  }
  return diffMs(startedAt, completedAt);
}
