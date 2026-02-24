"use client";

/**
 * This is our MVP viz layer. Later we can swap internals (chart-lib adapter)
 * without changing screen-level APIs.
 */
export function MiniSparkline({
  values,
  width = 160,
  height = 36,
  strokeWidth = 2,
  title,
  kind = "line",
  zeroLine = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  title?: string;
  kind?: "line" | "bars";
  zeroLine?: boolean;
}) {
  const pad = 4;
  const innerW = Math.max(0, width - pad * 2);
  const innerH = Math.max(0, height - pad * 2);

  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const allSame = range === 0;
  const effectiveMin = allSame ? min - 1 : min;
  const effectiveRange = allSame ? 2 : range;

  const crossesZero = zeroLine && min <= 0 && max >= 0;
  const zeroY =
    pad +
    innerH -
    (innerH * (0 - effectiveMin)) / effectiveRange;

  const xStep =
    values.length > 1 ? innerW / (values.length - 1) : innerW;

  const points = values.map((v, i) => {
    const x = pad + i * xStep;
    const y =
      pad +
      innerH -
      (innerH * (v - effectiveMin)) / effectiveRange;
    return { x, y };
  });

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-hidden={!title}
    >
      {title && <title>{title}</title>}
      {crossesZero && (
        <line
          x1={pad}
          y1={zeroY}
          x2={width - pad}
          y2={zeroY}
          stroke="var(--cv-border, #e2e8f0)"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      )}
      {kind === "line" && points.length > 0 && (
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--cv-accent, #22D3EE)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {kind === "bars" &&
        points.map((p, i) => {
          const barH = Math.abs(p.y - (crossesZero ? zeroY : pad + innerH));
          const barY = crossesZero
            ? Math.min(p.y, zeroY)
            : Math.min(p.y, pad + innerH);
          return (
            <rect
              key={i}
              x={p.x - Math.max(2, xStep * 0.4)}
              y={barY}
              width={Math.max(2, xStep * 0.8)}
              height={barH}
              fill="var(--cv-accent, #22D3EE)"
              opacity={0.7}
            />
          );
        })}
    </svg>
  );
}
