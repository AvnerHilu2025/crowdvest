import Link from "next/link";
import { formatFloat, formatPct01 } from "@/lib/format";
import { computeCis } from "@/lib/cis";

export const dynamic = "force-dynamic";

type DecisionCounts = { BUY?: number; SELL?: number; HOLD?: number; OTHER?: number };

type VariantItem = {
  id: string;
  runId: string;
  assetSymbol: string;
  seed: number;
  agents: number;
  steps: number;
  label?: string | null;
  summary?: {
    corr?: number | null;
    directionalAccuracy?: number | null; // 0..1
    pairsCount?: number | null;
    decisionCounts?: DecisionCounts | null;
  } | null;
};

function getDecision(dc: DecisionCounts | null | undefined, k: keyof DecisionCounts) {
  const v = dc?.[k];
  return typeof v === "number" ? v : 0;
}

function signOf(n: number | null | undefined): "pos" | "neg" | "zero" | "na" {
  if (typeof n !== "number" || Number.isNaN(n)) return "na";
  if (n > 0) return "pos";
  if (n < 0) return "neg";
  return "zero";
}

const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:4000";

export default async function CompareSeedsPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams?: Promise<{ assetSymbol?: string }>;
}) {
  const { runId } = await params;
  const { assetSymbol = "SPY" } = (await searchParams) ?? {};

  const res = await fetch(
    `${WEB_BASE}/api/runs/${encodeURIComponent(runId)}/variants?assetSymbol=${encodeURIComponent(assetSymbol)}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return (
      <div style={{ padding: 24 }}>
        <h1>Seed Comparison</h1>
        <p>Failed to load variants: HTTP {res.status}</p>
        <pre style={{ whiteSpace: "pre-wrap" }}>{txt}</pre>
        <p>
          <Link href={`/runs/${runId}?assetSymbol=${assetSymbol}`}>Back to Run</Link>
        </p>
      </div>
    );
  }

  const json = (await res.json()) as { items?: VariantItem[]; total?: number };
  const items = (json.items || []).slice().sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0));

  const cisList = items
    .map((v) => {
      const cis = computeCis({
        corr: v.summary?.corr ?? null,
        directionalAccuracy: v.summary?.directionalAccuracy ?? null,
        percentileScore: 0.5,
        convictionPenalty: 0,
      });
      return { id: v.id, seed: v.seed, cis: cis * 100, corr: v.summary?.corr ?? null };
    })
    .filter((x) => Number.isFinite(x.cis));

  const best = cisList.slice().sort((a, b) => b.cis - a.cis)[0];
  const worst = cisList.slice().sort((a, b) => a.cis - b.cis)[0];
  const spread = best && worst ? best.cis - worst.cis : null;

  const corrSigns = items.map((v) => signOf(v.summary?.corr ?? null));
  const signSet = new Set(corrSigns.filter((s) => s !== "na" && s !== "zero"));
  const signInstability = signSet.size > 1;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href={`/runs/${runId}?assetSymbol=${assetSymbol}`} className="run-detail-back">
          ← Back to Run
        </Link>
      </div>

      <h1 style={{ marginBottom: 8 }}>Seed Comparison</h1>
      <div style={{ marginBottom: 16, color: "#555" }}>
        Run: <code>{runId}</code> · Asset: <code>{assetSymbol}</code> · Seeds: <b>{items.length}</b>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Summary</h2>
        <div style={{ display: "grid", gap: 8 }}>
          <div>Best CIS: {best ? `seed=${best.seed} (${formatFloat(best.cis, 1)})` : "—"}</div>
          <div>Worst CIS: {worst ? `seed=${worst.seed} (${formatFloat(worst.cis, 1)})` : "—"}</div>
          <div>CIS spread: {spread === null ? "—" : formatFloat(spread, 1)}</div>
          <div>Correlation sign instability: {signInstability ? "YES" : "NO"}</div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Seeds</h2>

        <div style={{ overflowX: "auto" }}>
          <table className="runs-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid var(--cv-accent, #19B7D8)" }}>
                <th style={{ padding: "10px 8px" }}>Seed</th>
                <th style={{ padding: "10px 8px" }}>Corr</th>
                <th style={{ padding: "10px 8px" }}>Acc%</th>
                <th style={{ padding: "10px 8px" }}>CIS</th>
                <th style={{ padding: "10px 8px" }}>BUY</th>
                <th style={{ padding: "10px 8px" }}>SELL</th>
                <th style={{ padding: "10px 8px" }}>HOLD</th>
                <th style={{ padding: "10px 8px" }}>Pairs</th>
                <th style={{ padding: "10px 8px" }}>Link</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => {
                const dc = v.summary?.decisionCounts || {};
                const cis = computeCis({
                  corr: v.summary?.corr ?? null,
                  directionalAccuracy: v.summary?.directionalAccuracy ?? null,
                  percentileScore: 0.5,
                  convictionPenalty: 0,
                });
                const cisDisplay = Number.isFinite(cis) ? formatFloat(cis * 100, 1) : "—";
                return (
                  <tr key={v.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 8px" }}>{v.seed}</td>
                    <td style={{ padding: "10px 8px" }}>{formatFloat(v.summary?.corr ?? null, 4)}</td>
                    <td style={{ padding: "10px 8px" }}>{formatPct01(v.summary?.directionalAccuracy ?? null, 2)}</td>
                    <td style={{ padding: "10px 8px" }}>{cisDisplay}</td>
                    <td style={{ padding: "10px 8px" }}>{getDecision(dc, "BUY")}</td>
                    <td style={{ padding: "10px 8px" }}>{getDecision(dc, "SELL")}</td>
                    <td style={{ padding: "10px 8px" }}>{getDecision(dc, "HOLD")}</td>
                    <td style={{ padding: "10px 8px" }}>{v.summary?.pairsCount ?? "—"}</td>
                    <td style={{ padding: "10px 8px" }}>
                      <Link href={`/runs/${runId}/variants/${v.id}?assetSymbol=${assetSymbol}`} className="card-link">
                        Open variant
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: "12px 8px" }}>
                    No variants found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
