import React from "react";

type MiniBarProps = {
  /** 0..1 */
  value01: number | null | undefined;
  /** Optional label shown to the left (e.g., "0.44" or "67%") */
  text?: string;
  /** If true, bar direction is "higher is worse" (so we render a warning style). */
  higherIsWorse?: boolean;
  /** If true, bar direction is "lower is worse" (rare). */
  lowerIsWorse?: boolean;
  /** Small hint (title attr). */
  title?: string;
};

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Compact visual indicator to make tables scannable.
 * We intentionally keep it tiny and neutral.
 */
export function MiniBar(props: MiniBarProps) {
  const raw = props.value01;
  const v = raw == null ? null : clamp01(raw);

  // Style intent:
  // - Default: calm blue-ish/gray.
  // - If higherIsWorse: warm/red tint.
  // - If lowerIsWorse: warm/red tint as value goes down (we invert).
  const widthPct =
    v == null ? 0 : props.lowerIsWorse ? Math.round((1 - v) * 100) : Math.round(v * 100);

  const isWarn = Boolean(props.higherIsWorse) || Boolean(props.lowerIsWorse);

  return (
    <div className="flex items-center gap-2" title={props.title}>
      {props.text ? (
        <span className="tabular-nums text-sm text-slate-800">{props.text}</span>
      ) : null}

      <div className="h-2 w-24 rounded bg-slate-100 ring-1 ring-slate-200 overflow-hidden">
        <div
          className={isWarn ? "h-full bg-rose-300" : "h-full bg-sky-300"}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

type BadgeProps = {
  kind: "stable" | "unstable" | "diverging" | "legacy" | "neutral" | "overhead-soft" | "overhead-hard";
  text: string;
};

export function Badge({ kind, text }: BadgeProps) {
  const cls =
    kind === "stable"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : kind === "unstable"
        ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
        : kind === "diverging"
          ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
          : kind === "legacy"
            ? "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
            : kind === "overhead-hard"
              ? "bg-rose-100 text-rose-800 ring-1 ring-rose-300"
              : kind === "overhead-soft"
                ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                : "bg-slate-50 text-slate-700 ring-1 ring-slate-200";

  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {text}
    </span>
  );
}
