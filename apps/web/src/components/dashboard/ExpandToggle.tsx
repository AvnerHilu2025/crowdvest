"use client";

export function ExpandToggle({
  expanded,
  onToggle,
  className = "",
  variant = "button",
}: {
  expanded: boolean;
  onToggle: () => void;
  className?: string;
  /** `minimal` = text link, less visual weight next to hero. */
  variant?: "button" | "minimal";
}) {
  if (variant === "minimal") {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={`shrink-0 text-sm font-medium text-sky-400/90 underline decoration-sky-500/40 underline-offset-4 transition hover:text-sky-300 ${className}`}
      >
        {expanded ? "Collapse" : "Expand"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`shrink-0 rounded-lg border border-slate-600/80 bg-slate-800/60 px-3 py-1.5 text-sm font-medium text-sky-400 transition hover:border-sky-500/50 hover:bg-slate-800 hover:text-sky-300 ${className}`}
    >
      {expanded ? "Collapse" : "Expand"}
    </button>
  );
}
