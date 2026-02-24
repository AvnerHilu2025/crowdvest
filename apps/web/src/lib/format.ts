/**
 * Shared formatting helpers.
 */

export function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Deterministic UTC format for SSR/hydration safety. Returns YYYY-MM-DD HH:mm (UTC). */
export function formatDateUTC(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().replace("T", " ").slice(0, 16);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(value);
}

export { truncateMiddle } from "./ui";
