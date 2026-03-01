export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// Deterministic date formatting (SSR/CSR safe):
// - fixed locale
// - fixed timezone
// - fixed 24h clock
const DT_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// Input can be ISO string, Date, or null/undefined
export function formatDateTimeUTC(input?: string | Date | null): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  const t = d.getTime();
  if (!Number.isFinite(t)) return "—";
  return DT_FMT.format(d).replace(",", "");
}

export function formatInt(n?: number | null): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return Math.round(n).toString();
}

export function formatFloat(n?: number | null, digits = 4): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return Number(n).toFixed(digits);
}

// percent as 0..1 -> "39.29%"
export function formatPct01(p?: number | null, digits = 2): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "—";
  return `${(p * 100).toFixed(digits)}%`;
}

export function formatSignedFloat(n?: number | null, digits = 4): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const v = Number(n);
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(digits)}`;
}

export function truncateMiddle(id: string, head = 6, tail = 4): string {
  if (!id) return "";
  if (id.length <= head + tail) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

// Backward-compat aliases for existing consumers
export const formatPercent = formatPct01;
export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(value);
}

/** Format ms as human-readable duration. null/undefined -> "—"; else "Xs" (e.g. 0.0s, 8.6s) */
export function formatDurationMs(ms?: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}
