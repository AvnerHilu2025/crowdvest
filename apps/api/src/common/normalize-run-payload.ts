/**
 * Normalizes run payload for GET /runs/latest and GET /runs/:id.
 * Ensures prePersistHistogram and persistedHistogram are never null.
 */

type Histogram = { BUY: number; SELL: number; HOLD: number; OTHER: number };

const EMPTY_HISTOGRAM: Histogram = { BUY: 0, SELL: 0, HOLD: 0, OTHER: 0 };

function toHistogram(v: unknown): Histogram {
  if (v == null) return EMPTY_HISTOGRAM;
  const o = v as Record<string, unknown>;
  return {
    BUY: Number(o.BUY ?? 0),
    SELL: Number(o.SELL ?? 0),
    HOLD: Number(o.HOLD ?? 0),
    OTHER: Number(o.OTHER ?? 0),
  };
}

export interface RunMeta {
  id: string;
  name: string;
  status: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  lastError: string | null;
  seed: number;
  modelVersion: string;
  datasetVersion: string;
  schemaVersion: string;
}

export interface CompactPayload {
  runId: string;
  metrics: Record<string, unknown>;
  validation: Record<string, unknown>;
  archetypeTotals: Record<string, unknown>;
  debug?: {
    prePersistHistogram?: Histogram | null;
    persistedHistogram?: Histogram;
    decisionHistogram?: Histogram;
    sampleDecisions?: unknown[];
  };
  warnings: string[];
}

export interface NormalizedRunPayload {
  id: string;
  runId: string;
  startedAt: string | null;
  finishedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  lastError: string | null;
  status: string;
  name: string;
  seed: number;
  modelVersion: string;
  datasetVersion: string;
  schemaVersion: string;
  metrics: Record<string, unknown>;
  validation: Record<string, unknown>;
  archetypeTotals: Record<string, unknown>;
  warnings: string[];
  prePersistHistogram: Histogram;
  persistedHistogram: Histogram;
}

export function normalizeRunPayload(
  compact: CompactPayload,
  runMeta: RunMeta,
): NormalizedRunPayload {
  const d = compact.debug ?? {};
  const prePersist =
    d.prePersistHistogram != null
      ? toHistogram(d.prePersistHistogram)
      : d.decisionHistogram != null
        ? toHistogram(d.decisionHistogram)
        : EMPTY_HISTOGRAM;
  const persisted =
    d.persistedHistogram != null
      ? toHistogram(d.persistedHistogram)
      : d.decisionHistogram != null
        ? toHistogram(d.decisionHistogram)
        : EMPTY_HISTOGRAM;

  return {
    id: runMeta.id,
    runId: compact.runId ?? runMeta.id,
    startedAt: runMeta.startedAt?.toISOString() ?? null,
    finishedAt: runMeta.finishedAt?.toISOString() ?? null,
    completedAt: runMeta.completedAt?.toISOString() ?? null,
    failedAt: runMeta.failedAt?.toISOString() ?? null,
    lastError: runMeta.lastError ?? null,
    status: runMeta.status,
    name: runMeta.name,
    seed: runMeta.seed,
    modelVersion: runMeta.modelVersion,
    datasetVersion: runMeta.datasetVersion,
    schemaVersion: runMeta.schemaVersion,
    metrics: compact.metrics,
    validation: compact.validation,
    archetypeTotals: compact.archetypeTotals,
    warnings: compact.warnings,
    prePersistHistogram: prePersist,
    persistedHistogram: persisted,
  };
}
