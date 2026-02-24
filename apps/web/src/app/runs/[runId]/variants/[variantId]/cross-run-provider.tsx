"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface RunsV2Item {
  id: string;
  status: string;
  assetSymbol: string | null;
}

interface VariantSummary {
  corr: number | null;
  directionalAccuracy: number | null;
}

interface VariantsItem {
  summary?: VariantSummary | null;
}

export interface CrossRunStats {
  avgAccuracy: number;
  avgCorr: number;
  percentile: number;
  interpretation: string;
  runCount: number;
}

const CrossRunContext = createContext<{
  stats: CrossRunStats | null;
  loading: boolean;
  error: string | null;
} | null>(null);

export function useCrossRunStats() {
  const ctx = useContext(CrossRunContext);
  if (!ctx) throw new Error("useCrossRunStats must be used within CrossRunProvider");
  return ctx;
}

export function CrossRunProvider({
  runId,
  assetSymbol,
  currentAccuracy,
  currentCorr,
  children,
}: {
  runId: string;
  assetSymbol: string;
  currentAccuracy: number | null;
  currentCorr: number | null;
  children: ReactNode;
}) {
  const [stats, setStats] = useState<CrossRunStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const runsRes = await fetch(
          "/api/results/runs-v2?limit=20&offset=0",
          { cache: "no-store" },
        );
        if (!runsRes.ok) throw new Error("Failed to fetch runs");
        const runsData = (await runsRes.json()) as { items: RunsV2Item[] };
        const runs = runsData.items ?? [];

        const filtered = runs.filter(
          (r) =>
            r.assetSymbol === assetSymbol &&
            r.id !== runId &&
            r.status === "COMPLETED",
        );

        const accuracies: number[] = [];
        const corrs: number[] = [];

        await Promise.all(
          filtered.map(async (r) => {
            try {
              const res = await fetch(
                `/api/runs/${encodeURIComponent(r.id)}/variants?assetSymbol=${encodeURIComponent(assetSymbol)}`,
                { cache: "no-store" },
              );
              if (!res.ok) return;
              const data = (await res.json()) as { items: VariantsItem[] };
              const items = data.items ?? [];
              const v = items[0];
              if (v?.summary) {
                const acc = v.summary.directionalAccuracy;
                const cor = v.summary.corr;
                if (acc != null && Number.isFinite(acc)) accuracies.push(acc);
                if (cor != null && Number.isFinite(cor)) corrs.push(cor);
              }
            } catch {
              // skip failed variant fetch
            }
          }),
        );

        if (cancelled) return;

        const runCount = accuracies.length;
        const avgAccuracy =
          runCount > 0
            ? accuracies.reduce((a, b) => a + b, 0) / runCount
            : 0;
        const avgCorr =
          corrs.length > 0
            ? corrs.reduce((a, b) => a + b, 0) / corrs.length
            : 0;

        const curAcc = currentAccuracy ?? 0;
        const belowCount = accuracies.filter((a) => a < curAcc).length;
        const percentile =
          runCount > 0 ? (belowCount / runCount) * 100 : 50;

        let interpretation = "Within normal performance range.";
        if (percentile >= 75) interpretation = "Top quartile performance.";
        else if (percentile <= 25)
          interpretation = "Bottom quartile performance.";

        setStats({
          avgAccuracy,
          avgCorr,
          percentile,
          interpretation,
          runCount,
        });
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [runId, assetSymbol, currentAccuracy, currentCorr]);

  return (
    <CrossRunContext.Provider value={{ stats, loading, error }}>
      {children}
    </CrossRunContext.Provider>
  );
}
