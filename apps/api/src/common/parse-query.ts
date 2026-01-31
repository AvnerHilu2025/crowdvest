const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_OFFSET = 0;

export function parseLimit(limit: string | undefined): number {
  if (limit == null || limit === "") return DEFAULT_LIMIT;
  const n = parseInt(limit, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

export function parseOffset(offset: string | undefined): number {
  if (offset == null || offset === "") return DEFAULT_OFFSET;
  const n = parseInt(offset, 10);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_OFFSET;
  return n;
}
