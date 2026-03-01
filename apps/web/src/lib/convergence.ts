export type ConvergenceStats = {
  n: number
  min: number | null
  max: number | null
  mean: number | null
  stdDev: number | null
  final: number | null
  csiStepIndex: number | null   // 0-based index
  csiStepNumber: number | null  // 1-based for display
  pctAboveThreshold: number | null
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x)
}

/**
 * agreementSeries can be:
 * - [0..1] values (e.g., 0.67)
 * - OR [0..100] values (e.g., 67)
 * We normalize to [0..1].
 */
export function computeConvergenceStats(
  agreementSeries: unknown,
  thresholdPct: number = 90
): ConvergenceStats {
  const threshold = thresholdPct / 100

  const arrRaw = Array.isArray(agreementSeries) ? agreementSeries : []
  const values01 = arrRaw
    .filter(isFiniteNumber)
    .map((v) => (v > 1 ? v / 100 : v)) // normalize

  const n = values01.length
  if (n === 0) {
    return {
      n: 0,
      min: null,
      max: null,
      mean: null,
      stdDev: null,
      final: null,
      csiStepIndex: null,
      csiStepNumber: null,
      pctAboveThreshold: null,
    }
  }

  let min = values01[0]
  let max = values01[0]
  let sum = 0
  for (const v of values01) {
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  const mean = sum / n

  let varSum = 0
  for (const v of values01) {
    const d = v - mean
    varSum += d * d
  }
  const stdDev = Math.sqrt(varSum / n)
  const final = values01[n - 1]

  const idx = values01.findIndex((v) => v >= threshold)
  const above = values01.filter((v) => v >= threshold).length
  const pctAboveThreshold = (above / n) * 100

  return {
    n,
    min,
    max,
    mean,
    stdDev,
    final,
    csiStepIndex: idx >= 0 ? idx : null,
    csiStepNumber: idx >= 0 ? idx + 1 : null,
    pctAboveThreshold,
  }
}

export function fmtPct01(v01: number | null, digits = 0): string {
  if (!isFiniteNumber(v01)) return "—"
  return `${(v01 * 100).toFixed(digits)}%`
}

export function fmtNum(v: number | null, digits = 2): string {
  if (!isFiniteNumber(v)) return "—"
  return v.toFixed(digits)
}

export type ConvergenceBand = "STRONG" | "MODERATE" | "DIVERGING"

export function classifyConvergenceBand(args: {
  csiStepNumber: number | null
  pctAboveThreshold: number | null
  stdDev: number | null
}): ConvergenceBand {
  const { csiStepNumber, pctAboveThreshold, stdDev } = args

  if (
    csiStepNumber != null &&
    pctAboveThreshold != null &&
    stdDev != null &&
    csiStepNumber <= 3 &&
    pctAboveThreshold >= 80 &&
    stdDev <= 0.12
  ) {
    return "STRONG"
  }

  if (
    csiStepNumber != null &&
    pctAboveThreshold != null &&
    stdDev != null &&
    csiStepNumber <= 8 &&
    pctAboveThreshold >= 60 &&
    stdDev <= 0.20
  ) {
    return "MODERATE"
  }

  return "DIVERGING"
}

export function bandStyles(band: ConvergenceBand): { label: string; className: string } {
  switch (band) {
    case "STRONG":
      return { label: "STRONG", className: "bg-green-100 text-green-800 border border-green-200" }
    case "MODERATE":
      return { label: "MODERATE", className: "bg-amber-100 text-amber-800 border border-amber-200" }
    default:
      return { label: "DIVERGING", className: "bg-red-100 text-red-800 border border-red-200" }
  }
}
