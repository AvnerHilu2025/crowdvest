/**
 * Deterministic sentiment / credibility / salience / eventType heuristics for normalization.
 */
import type { NormalizedInfoEventRecord, ParsedArticle } from "./types";

const WIRES_HIGH = [
  "reuters",
  "bloomberg",
  "associated press",
  "ap news",
  "wall street journal",
  "wsj",
  "financial times",
  "ft.com",
  "cnbc",
  "marketwatch",
  "dow jones",
];

const WIRES_MED = ["seeking alpha", "yahoo", "benzinga", "thestreet", "investor's business daily"];

function normLower(s: string): string {
  return s.trim().toLowerCase();
}

/** Map source label into [0,1] credibility. */
export function credibilityFromSource(source: string): number {
  const s = normLower(source);
  for (const w of WIRES_HIGH) {
    if (s.includes(w)) return 0.92;
  }
  for (const w of WIRES_MED) {
    if (s.includes(w)) return 0.72;
  }
  if (s.length === 0 || s === "unknown") return 0.35;
  return 0.5;
}

/** Deterministic placeholder sentiment in [-1,1] from headline. */
export function placeholderSentimentFromTitle(title: string): number {
  let h = 2166136261;
  for (let i = 0; i < title.length; i++) {
    h ^= title.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = Math.abs(h) % 2001;
  return u / 1000 - 1;
}

const EVENT_KEYWORDS: { re: RegExp; weight: number }[] = [
  { re: /\bearnings\b|\beps\b|\bguidance\b|\bprofit warning\b|\bpre-?announcement\b/i, weight: 1 },
  { re: /\bmerger\b|\bacquisition\b|\bm&a\b|\btakeover\b|\bbuyout\b/i, weight: 1 },
  { re: /\bfederal reserve\b|\bfed\b|\binterest rate\b|\brate hike\b|\brate cut\b|\bpowell\b|\becb\b|\bboj\b|\bcentral bank\b/i, weight: 1 },
  { re: /\bwar\b|\bgeopolitic|\binvasion\b|\bmissile\b|\bsanction\b|\bconflict\b/i, weight: 1 },
  { re: /\bsec\b|\bregulator\b|\brestriction\b|\bfine\b|\binvestigation\b|\bantitrust\b/i, weight: 0.9 },
  { re: /\bmajor guidance\b|\bforecast cut\b|\bforecast raise\b/i, weight: 1 },
];

/** Salience in [0,1]: higher for breaking / macro / corporate shock headlines. */
export function salienceFromTitle(title: string): number {
  const t = title;
  let score = 0.35;
  for (const { re, weight } of EVENT_KEYWORDS) {
    if (re.test(t)) score = Math.max(score, 0.45 + 0.45 * weight);
  }
  if (/\bbreaking\b|\bexclusive\b|\burgent\b/i.test(t)) score = Math.max(score, 0.75);
  return Math.max(0.15, Math.min(1, score));
}

export function classifyEventType(title: string): "info" | "event" {
  const t = title;
  for (const { re, weight } of EVENT_KEYWORDS) {
    if (weight >= 0.9 && re.test(t)) return "event";
  }
  return "info";
}

export function assignedStep(
  publishedAt: Date,
  dateFromStr: string,
  dateToStr: string,
  steps: number,
): number {
  if (steps <= 0) return 0;
  const t0 = new Date(`${dateFromStr}T00:00:00.000Z`).getTime();
  const t1 = new Date(`${dateToStr}T23:59:59.999Z`).getTime();
  const t = publishedAt.getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return 0;
  if (t <= t0) return 0;
  if (t >= t1) return steps - 1;
  const frac = (t - t0) / (t1 - t0);
  return Math.min(steps - 1, Math.floor(frac * steps));
}

export function buildNormalizedRecord(
  runId: string,
  assetSymbol: string,
  steps: number,
  dateFrom: string,
  dateTo: string,
  a: ParsedArticle,
): NormalizedInfoEventRecord {
  const sentiment =
    a.sentimentScore !== undefined && Number.isFinite(a.sentimentScore)
      ? Math.max(-1, Math.min(1, a.sentimentScore))
      : placeholderSentimentFromTitle(a.title);
  const credibility = credibilityFromSource(a.source);
  const salience = salienceFromTitle(a.title);
  const eventType = classifyEventType(a.title);
  const step = assignedStep(a.publishedAt, dateFrom, dateTo, steps);
  return {
    runId,
    assetSymbol: assetSymbol.trim().toUpperCase(),
    step,
    title: a.title,
    source: a.source,
    publishedAt: a.publishedAt.toISOString(),
    sentiment,
    credibility,
    salience,
    eventType,
    rawPayload: a.raw,
  };
}
