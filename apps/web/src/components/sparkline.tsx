import React from "react";

type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  padding?: number;
  min?: number; // optional clamp
  max?: number; // optional clamp
  "data-testid"?: string;
  title?: string;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function Sparkline({
  values,
  width = 120,
  height = 28,
  padding = 2,
  min,
  max,
  title,
  ...rest
}: SparklineProps) {
  const clean = (values || []).filter((v) => Number.isFinite(v));
  if (clean.length < 2) {
    // keep layout stable
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        aria-label="sparkline"
        {...rest}
      >
        {title ? <title>{title}</title> : null}
        <rect x="0" y="0" width={width} height={height} fill="transparent" />
      </svg>
    );
  }

  const lo = Number.isFinite(min) ? (min as number) : Math.min(...clean);
  const hi = Number.isFinite(max) ? (max as number) : Math.max(...clean);
  const span = hi - lo || 1;

  const x0 = padding;
  const y0 = padding;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const pts = clean.map((v, i) => {
    const t = clean.length === 1 ? 0 : i / (clean.length - 1);
    const x = x0 + t * w;
    const norm = (clamp(v, lo, hi) - lo) / span; // 0..1
    const y = y0 + (1 - norm) * h;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-label="sparkline"
      {...rest}
    >
      {title ? <title>{title}</title> : null}

      {/* baseline */}
      <line x1={x0} y1={y0 + h} x2={x0 + w} y2={y0 + h} stroke="currentColor" opacity="0.25" />

      {/* polyline */}
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        points={pts.join(" ")}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* last-point dot */}
      <circle
        cx={pts[pts.length - 1].split(",")[0]}
        cy={pts[pts.length - 1].split(",")[1]}
        r="1.8"
        fill="currentColor"
      />
    </svg>
  );
}
