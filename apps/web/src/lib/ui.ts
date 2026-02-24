/**
 * Shared UI helpers.
 */

export function truncateMiddle(id: string, head = 6, tail = 4): string {
  if (id.length <= head + tail) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function truncate(str: string, maxLen = 40): string {
  if (!str || str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}…`;
}
