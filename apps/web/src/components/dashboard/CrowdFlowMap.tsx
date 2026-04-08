"use client";

import { useState } from "react";
import type { DirectionBiasByAgentType } from "./crowd-intelligence-types";
import { ExpandToggle } from "./ExpandToggle";

const LABELS: Record<keyof DirectionBiasByAgentType, string> = {
  trendFollower: "Trend follower",
  contrarian: "Contrarian",
  balanced: "Balanced",
};

const LEAN_STYLES: Record<"BUY" | "SELL" | "HOLD", string> = {
  BUY: "text-emerald-400/95",
  SELL: "text-rose-400/95",
  HOLD: "text-slate-400",
};

/** On ties, prefer SELL → BUY → HOLD (deterministic; rare when shares match). */
const LEAN_PRIORITY: ("BUY" | "SELL" | "HOLD")[] = ["SELL", "BUY", "HOLD"];

function dominantLean(
  buyPct: number,
  sellPct: number,
  holdPct: number,
): { lean: "BUY" | "SELL" | "HOLD"; pct: number } {
  const m = new Map<"BUY" | "SELL" | "HOLD", number>([
    ["BUY", buyPct],
    ["SELL", sellPct],
    ["HOLD", holdPct],
  ]);
  let best: "BUY" | "SELL" | "HOLD" = "BUY";
  let bestV = -1;
  for (const dir of LEAN_PRIORITY) {
    const v = m.get(dir) ?? 0;
    if (v > bestV) {
      bestV = v;
      best = dir;
    } else if (v === bestV && LEAN_PRIORITY.indexOf(dir) < LEAN_PRIORITY.indexOf(best)) {
      best = dir;
    }
  }
  return { lean: best, pct: bestV * 100 };
}

type Cluster = {
  key: keyof DirectionBiasByAgentType | "__combined";
  label: string;
  buyCount: number;
  sellCount: number;
  holdCount: number;
  buyPct: number;
  sellPct: number;
  holdPct: number;
};

function pctParts(c: Cluster) {
  return {
    buy: c.buyPct * 100,
    sell: c.sellPct * 100,
    hold: c.holdPct * 100,
  };
}

function SegmentedStanceBar({ c, compact }: { c: Cluster; compact?: boolean }) {
  const { buy, sell, hold } = pctParts(c);
  const h = compact ? "h-2" : "h-2.5";
  return (
    <div
      className={`flex w-full max-w-md overflow-hidden rounded ${h} ring-1 ring-slate-700/80`}
      role="img"
      aria-label={`BUY ${buy.toFixed(0)} percent, SELL ${sell.toFixed(0)} percent, HOLD ${hold.toFixed(0)} percent`}
    >
      {buy > 0 && (
        <div
          className="min-w-0 bg-emerald-500/85 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.35)]"
          style={{ width: `${buy}%` }}
          title={`BUY ${buy.toFixed(0)}%`}
        />
      )}
      {sell > 0 && (
        <div
          className="min-w-0 bg-rose-500/85 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.35)]"
          style={{ width: `${sell}%` }}
          title={`SELL ${sell.toFixed(0)}%`}
        />
      )}
      {hold > 0 && (
        <div
          className="min-w-0 bg-slate-500/70 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.35)]"
          style={{ width: `${hold}%` }}
          title={`HOLD ${hold.toFixed(0)}%`}
        />
      )}
    </div>
  );
}

function ArchetypeRow({ c, compact, showRawCounts }: { c: Cluster; compact?: boolean; showRawCounts?: boolean }) {
  const totalPct = c.buyPct + c.sellPct + c.holdPct;
  const { lean, pct } = dominantLean(c.buyPct, c.sellPct, c.holdPct);
  const leanClass = LEAN_STYLES[lean];
  const { buy, sell, hold } = pctParts(c);
  const hasMass = totalPct > 1e-9;

  return (
    <div className="border-b border-slate-800/60 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-100">{c.label}</span>
        {hasMass ? (
          <span className={`text-sm font-semibold tabular-nums ${leanClass}`}>
            Leaning {lean} ({pct.toFixed(0)}%)
          </span>
        ) : (
          <span className="text-sm font-medium tabular-nums text-slate-500">—</span>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <span className="text-emerald-400/90">Buy</span>
          <span className="text-slate-600">|</span>
          <span className="text-rose-400/90">Sell</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Hold</span>
        </div>
        {hasMass ? (
          <SegmentedStanceBar c={c} compact={compact} />
        ) : (
          <div className={`w-full max-w-md rounded bg-slate-800/50 ${compact ? "h-2" : "h-2.5"}`} />
        )}
        <p className="font-mono text-xs text-slate-500">
          {hasMass ? `${buy.toFixed(0)}% B · ${sell.toFixed(0)}% S · ${hold.toFixed(0)}% H` : "No agent-timesteps in bucket"}
        </p>
        {showRawCounts && (c.buyCount > 0 || c.sellCount > 0 || c.holdCount > 0) && (
          <p className="font-mono text-[11px] text-slate-600">
            Counts: {c.buyCount} buy · {c.sellCount} sell · {c.holdCount} hold (summed over executed steps)
          </p>
        )}
      </div>
    </div>
  );
}

function buildClusters(directionBiasByAgentType: DirectionBiasByAgentType): Cluster[] {
  const keys = (["trendFollower", "contrarian", "balanced"] as const).filter((k) => directionBiasByAgentType[k]);
  return keys.map((k) => {
    const row = directionBiasByAgentType[k]!;
    const holdCount = row.neutralCount ?? 0;
    const total = row.positiveCount + row.negativeCount + holdCount;
    const buyPct = total > 0 ? row.positiveCount / total : 0;
    const sellPct = total > 0 ? row.negativeCount / total : 0;
    const holdPct = total > 0 ? holdCount / total : 0;
    return {
      key: k,
      label: LABELS[k],
      buyCount: row.positiveCount,
      sellCount: row.negativeCount,
      holdCount,
      buyPct,
      sellPct,
      holdPct,
    };
  });
}

function combinedCluster(clusters: Cluster[]): Cluster | null {
  if (clusters.length === 0) return null;
  let buyCount = 0;
  let sellCount = 0;
  let holdCount = 0;
  for (const c of clusters) {
    buyCount += c.buyCount;
    sellCount += c.sellCount;
    holdCount += c.holdCount;
  }
  const total = buyCount + sellCount + holdCount;
  if (total <= 0) return null;
  return {
    key: "__combined",
    label: "All profiles (combined)",
    buyCount,
    sellCount,
    holdCount,
    buyPct: buyCount / total,
    sellPct: sellCount / total,
    holdPct: holdCount / total,
  };
}

export function CrowdFlowMap({ directionBiasByAgentType }: { directionBiasByAgentType: DirectionBiasByAgentType | null | undefined }) {
  const [expanded, setExpanded] = useState(false);

  if (!directionBiasByAgentType) {
    return (
      <section className="border-b border-slate-800/60 pb-6">
        <h3 className="text-base font-semibold text-slate-200">Crowd flow</h3>
        <p className="mt-2 text-sm text-slate-500">No agent-type bias data for this view.</p>
      </section>
    );
  }

  const clusters = buildClusters(directionBiasByAgentType);
  if (clusters.length === 0) {
    return (
      <section className="border-b border-slate-800/60 pb-6">
        <h3 className="text-base font-semibold text-slate-200">Crowd flow</h3>
        <p className="mt-2 text-sm text-slate-500">No agent-type bias data for this view.</p>
      </section>
    );
  }

  const combined = combinedCluster(clusters);

  return (
    <section className="border-b border-slate-800/60 pb-6 lg:border-b-0 lg:pb-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Crowd flow</h3>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
            Per profile: share of agent stances with BUY (signal &gt; 0.01), SELL (&lt; −0.01), or HOLD (near zero). Counts sum across
            executed timesteps (agents × steps) so you can see how profiles mix; headline consensus may aggregate differently.
          </p>
        </div>
        <ExpandToggle expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
      </div>

      {combined && (
        <div className="mb-6 rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-3 sm:px-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Combined across archetypes</p>
          <ArchetypeRow c={combined} compact={!expanded} showRawCounts={expanded} />
        </div>
      )}

      <div className="space-y-0">
        {clusters.map((c) => (
          <ArchetypeRow key={c.key} c={c} compact={!expanded} showRawCounts={expanded} />
        ))}
      </div>

      {clusters.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {expanded ? "Raw counts are agent-instances × executed timesteps." : "Expand for raw timestep counts per bucket."}
        </p>
      )}
    </section>
  );
}
