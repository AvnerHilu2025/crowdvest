interface ThroughputChartProps {
  data: Array<{ agents: number; decisionsPerSec: number }>;
}

export function ThroughputChart({ data }: ThroughputChartProps) {
  if (data.length === 0) {
    return (
      <section className="card" style={{ marginBottom: 24 }}>
        <h2 className="card-title">Throughput vs Agents</h2>
        <p className="card-empty" style={{ marginTop: 8 }}>
          No data with decisions/sec available.
        </p>
      </section>
    );
  }

  const maxY = Math.max(...data.map((d) => d.decisionsPerSec), 1);
  const maxX = Math.max(...data.map((d) => d.agents), 1);
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const width = 600;
  const height = 280;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = data
    .sort((a, b) => a.agents - b.agents)
    .map((d) => {
      const x = padding.left + (d.agents / maxX) * chartWidth;
      const y = padding.top + chartHeight - (d.decisionsPerSec / maxY) * chartHeight;
      return { x, y, ...d };
    });

  const pathD =
    points.length > 0
      ? "M " + points[0]!.x + " " + points[0]!.y + " " +
        points.slice(1).map((p) => "L " + p.x + " " + p.y).join(" ")
      : "";

  return (
    <section className="card" style={{ marginBottom: 24 }}>
      <h2 className="card-title">Throughput vs Agents</h2>
      <p className="run-detail-meta" style={{ marginTop: 4, marginBottom: 0, fontSize: 12 }}>
        Last 50 scaling rows; excludes legacy runs without decisions/sec.
      </p>
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <svg
          width={width}
          height={height}
          viewBox={"0 0 " + width + " " + height}
          style={{ minWidth: width }}
          aria-label="Throughput vs Agents chart"
        >
          <text
            x={padding.left - 10}
            y={padding.top + chartHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={"rotate(-90, " + (padding.left - 10) + ", " + (padding.top + chartHeight / 2) + ")"}
            fontSize={12}
            fill="rgba(15, 23, 42, 0.6)"
          >
            decisions/sec
          </text>
          <text
            x={padding.left + chartWidth / 2}
            y={height - 8}
            textAnchor="middle"
            fontSize={12}
            fill="rgba(15, 23, 42, 0.6)"
          >
            agents
          </text>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = padding.top + chartHeight - t * chartHeight;
            const val = (maxY * t).toFixed(0);
            return (
              <g key={String(t)}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartWidth}
                  y2={y}
                  stroke="rgba(15, 23, 42, 0.08)"
                  strokeDasharray="2 2"
                />
                <text
                  x={padding.left - 6}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10}
                  fill="rgba(15, 23, 42, 0.5)"
                >
                  {val}
                </text>
              </g>
            );
          })}
          <path
            d={pathD}
            fill="none"
            stroke="var(--cv-accent, #00bcd4)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={4}
              fill="var(--cv-accent, #00bcd4)"
              stroke="#fff"
              strokeWidth={1}
            />
          ))}
        </svg>
      </div>
    </section>
  );
}
