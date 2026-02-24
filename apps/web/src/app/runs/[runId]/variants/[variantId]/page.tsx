import Link from "next/link";
import {
  formatPercent,
  formatNumber,
  truncateMiddle,
} from "@/lib/format";
import { stdDev } from "@/lib/cis";
import { MiniSparkline } from "@/components/viz/mini-sparkline";
import { CrossRunProvider } from "./cross-run-provider";
import { CrossRunContextCard } from "./cross-run-context-card";
import { CrowdIntelligenceScoreCard } from "./crowd-intelligence-score-card";
import { StabilityCard } from "./stability-card";

export const dynamic = "force-dynamic";

const WEB_BASE =
  process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:4000";

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stddev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  const variance =
    xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

interface VariantItem {
  id: string;
  runId: string;
  assetSymbol: string;
  seed: number;
  agents: number;
  steps: number;
  label: string | null;
  createdAt: string;
  decisionsHash: string | null;
  returnsHash: string | null;
  summary?: {
    corr: number | null;
    directionalAccuracy: number | null;
    pairsCount: number | null;
    decisionCounts?: { BUY?: number; SELL?: number; HOLD?: number } | null;
    debug?: {
      medianAgentDirectionalAccuracy?: number;
      pairsSample?: Array<{ r?: unknown; step?: number; actualSign?: unknown; predictedSign?: unknown }>;
    } | null;
  } | null;
}

interface VariantsResponse {
  items: VariantItem[];
  total: number;
}

interface CrowdWisdomDumpResponse {
  runId: string;
  assetSymbol: string;
  steps: number;
  agents: number;
  decisionsCount: number;
  returnsCount: number;
}

interface RunDetailResponse {
  schemaVersion?: string;
  modelVersion?: string;
  datasetVersion?: string;
}

async function fetchRunDetail(
  runId: string,
): Promise<RunDetailResponse | null> {
  try {
    const res = await fetch(
      `${WEB_BASE}/api/runs/${encodeURIComponent(runId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as RunDetailResponse;
  } catch {
    return null;
  }
}

async function fetchVariants(
  runId: string,
  assetSymbol: string,
): Promise<VariantsResponse | null> {
  try {
    const res = await fetch(
      `${WEB_BASE}/api/runs/${encodeURIComponent(runId)}/variants?assetSymbol=${encodeURIComponent(assetSymbol)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as VariantsResponse;
  } catch {
    return null;
  }
}

async function fetchCrowdWisdomDump(
  runId: string,
  assetSymbol: string,
): Promise<CrowdWisdomDumpResponse | null> {
  try {
    const res = await fetch(
      `${WEB_BASE}/api/results/crowd-wisdom-dump?runId=${encodeURIComponent(runId)}&assetSymbol=${encodeURIComponent(assetSymbol)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as CrowdWisdomDumpResponse;
  } catch {
    return null;
  }
}

export default async function VariantDetailPage({
  params,
}: {
  params: Promise<{ runId: string; variantId: string }>;
}) {
  const { runId, variantId } = await params;
  const assetSymbol = "SPY";

  const [variantsData, crowdDump, run] = await Promise.all([
    fetchVariants(runId, assetSymbol),
    fetchCrowdWisdomDump(runId, assetSymbol),
    fetchRunDetail(runId),
  ]);

  const variant = variantsData?.items?.find((v) => v.id === variantId) ?? null;

  if (!variant) {
    return (
      <div>
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/runs">Runs</Link>
          <span className="breadcrumb-sep">›</span>
          <Link href={`/runs/${runId}?assetSymbol=SPY`}>
            Run {truncateMiddle(runId)}
          </Link>
          <span className="breadcrumb-sep">›</span>
          <span>Variant {truncateMiddle(variantId)}</span>
        </nav>
        <div className="card" style={{ marginTop: 16 }}>
          <p className="card-error">Variant not found.</p>
        </div>
      </div>
    );
  }

  const summary = variant.summary;
  const crowdAccuracy = summary?.directionalAccuracy ?? null;
  const medianAccuracy =
    summary?.debug?.medianAgentDirectionalAccuracy ?? 0.5;
  const crowdDelta =
    crowdAccuracy != null ? crowdAccuracy - medianAccuracy : null;

  const decisionCounts = summary?.decisionCounts ?? null;
  const corr = summary?.corr ?? null;
  const directionalAccuracy = summary?.directionalAccuracy ?? null;
  const pairsCount = summary?.pairsCount ?? null;

  const totalDecisions =
    (decisionCounts?.BUY ?? 0) +
    (decisionCounts?.SELL ?? 0) +
    (decisionCounts?.HOLD ?? 0);

  const buyCount = decisionCounts?.BUY ?? 0;
  const sellCount = decisionCounts?.SELL ?? 0;
  const holdCount = decisionCounts?.HOLD ?? 0;

  const crowdOk =
    crowdDump != null &&
    crowdDump.decisionsCount > 0 &&
    crowdDump.returnsCount > 0;

  const pairs = summary?.debug?.pairsSample ?? [];
  const returns = pairs
    .map((p) => Number(p.r))
    .filter((n) => Number.isFinite(n));
  const mu = mean(returns);
  const sigma = stddev(returns);
  const upPct = returns.length
    ? returns.filter((x) => x > 0).length / returns.length
    : 0;
  const trend = mu >= 0 ? "Bull" : "Bear";
  const vol = sigma >= 0.006 ? "High Vol" : "Low Vol";
  const regime = `${trend} / ${vol}`;

  const buy = summary?.decisionCounts?.BUY ?? 0;
  const sell = summary?.decisionCounts?.SELL ?? 0;
  const hold = summary?.decisionCounts?.HOLD ?? 0;
  const total = buy + sell + hold;

  const convictionIndex =
    total > 0 ? Math.abs(buy - sell) / total : 0;
  const netBias = total > 0 ? (buy - sell) / total : 0;

  let strengthLabel = "Weak";
  if (convictionIndex >= 0.25) strengthLabel = "Strong";
  else if (convictionIndex >= 0.1) strengthLabel = "Moderate";

  const accuracy = summary?.directionalAccuracy ?? 0.5;
  let interpretation = "";
  if (convictionIndex >= 0.25 && accuracy < 0.5)
    interpretation = "High conviction, low accuracy → Overconfident crowd.";
  else if (convictionIndex < 0.1 && accuracy >= 0.5)
    interpretation = "Low conviction, stable alignment.";
  else if (convictionIndex >= 0.25 && accuracy >= 0.5)
    interpretation = "Conviction supported by performance.";
  else interpretation = "Signal mixed.";

  const schemaVersion = run?.schemaVersion ?? "—";
  const modelVersion = run?.modelVersion ?? "—";
  const datasetVersion = run?.datasetVersion ?? "—";
  const decisionsHash = variant.decisionsHash ?? null;
  const returnsHash = variant.returnsHash ?? null;
  const integrityOk =
    Boolean(decisionsHash) &&
    Boolean(returnsHash) &&
    totalDecisions > 0;

  const allVariants = variantsData?.items ?? [];
  const seedsWithSummary = allVariants.filter(
    (v) =>
      v.summary &&
      v.summary.directionalAccuracy != null &&
      Number.isFinite(v.summary.directionalAccuracy) &&
      v.summary.corr != null &&
      Number.isFinite(v.summary.corr),
  );
  const nSeeds = seedsWithSummary.length;

  const accsPct =
    nSeeds > 0
      ? seedsWithSummary.map((v) => (v.summary!.directionalAccuracy! * 100))
      : [];
  const corrs =
    nSeeds > 0 ? seedsWithSummary.map((v) => v.summary!.corr!) : [];

  const accMean = accsPct.length > 0 ? mean(accsPct) : 0;
  const accStd = accsPct.length > 0 ? stdDev(accsPct) : 0;
  const corrStd = corrs.length > 0 ? stdDev(corrs) : 0;

  const clamp = (x: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, x));
  const ciLow = clamp(accMean - 1.96 * accStd, 0, 100);
  const ciHigh = clamp(accMean + 1.96 * accStd, 0, 100);

  let seedsRating: "Stable" | "Moderate" | "Unstable" = "Unstable";
  if (nSeeds >= 3) {
    if (accStd <= 2.5 && corrStd <= 0.1) {
      seedsRating = "Stable";
    } else if (accStd <= 3.5 && corrStd <= 0.17) {
      seedsRating = "Moderate";
    } else {
      seedsRating = "Unstable";
    }
  }

  const meanCorr = corrs.length > 0 ? mean(corrs) : 0;
  const signInstability =
    nSeeds >= 3 &&
    corrs.some((c) => c > 0.1) &&
    corrs.some((c) => c < -0.1);
  const weakSignal = nSeeds >= 3 && Math.abs(meanCorr) < 0.05;

  return (
    <div>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/runs">Runs</Link>
        <span className="breadcrumb-sep">›</span>
        <Link href={`/runs/${runId}?assetSymbol=SPY`}>
          Run {truncateMiddle(runId)}
        </Link>
        <span className="breadcrumb-sep">›</span>
        <span>Variant {truncateMiddle(variantId)}</span>
      </nav>

      <div className="card" style={{ marginTop: 16 }}>
        <Link
          href={`/runs/${runId}?assetSymbol=SPY`}
          className="run-detail-back"
        >
          ← Back to Run
        </Link>
        <h1 className="run-detail-title" style={{ marginTop: 12 }}>
          Variant {truncateMiddle(variantId)}
          {variant.label && (
            <span className="run-detail-meta" style={{ marginLeft: 8 }}>
              ({variant.label})
            </span>
          )}
        </h1>
      </div>

      <CrossRunProvider
        runId={runId}
        assetSymbol={assetSymbol}
        currentAccuracy={directionalAccuracy}
        currentCorr={corr}
      >
        <CrowdIntelligenceScoreCard
          directionalAccuracy={directionalAccuracy}
          corr={corr}
          convictionIndex={convictionIndex}
          accStd={accStd}
          corrStd={corrStd}
          nSeeds={nSeeds}
          signInstability={signInstability}
          weakSignal={weakSignal}
        />

      <div className="variant-cards">
        {/* 1. Performance */}
        <div className="card variant-card">
          <h2 className="card-title">Performance</h2>
          <div className="card-row">
            <span className="card-row-label">Correlation</span>
            <span className="card-row-value">
              {corr != null ? corr.toFixed(4) : "—"}
            </span>
          </div>
          <div className="card-row">
            <span className="card-row-label">Directional Accuracy</span>
            <span className="card-row-value">
              {formatPercent(directionalAccuracy)}
            </span>
          </div>
          <div className="card-row">
            <span className="card-row-label">Pairs Count</span>
            <span className="card-row-value">{formatNumber(pairsCount)}</span>
          </div>
          {(variant.decisionsHash || variant.returnsHash) && (
            <div className="card-row" style={{ marginTop: 8 }}>
              <span className="card-row-label">Hashes</span>
              <span className="card-row-value mono" style={{ fontSize: 12 }}>
                decisions: {variant.decisionsHash ? truncateMiddle(variant.decisionsHash, 8, 6) : "—"}
                {" · "}
                returns: {variant.returnsHash ? truncateMiddle(variant.returnsHash, 8, 6) : "—"}
              </span>
            </div>
          )}
        </div>

        {/* 2. Decision Histogram */}
        <div className="card variant-card">
          <h2 className="card-title">Decision Histogram</h2>
          <div className="histogram-grid">
            <div className="histogram-item">
              <span className="histogram-label">BUY</span>
              <span className="histogram-value">{buyCount}</span>
            </div>
            <div className="histogram-item">
              <span className="histogram-label">SELL</span>
              <span className="histogram-value">{sellCount}</span>
            </div>
            <div className="histogram-item">
              <span className="histogram-label">HOLD</span>
              <span className="histogram-value">{holdCount}</span>
            </div>
          </div>
          {decisionCounts == null && (
            <p className="card-empty" style={{ marginTop: 8 }}>
              No decision counts available
            </p>
          )}
        </div>

        {/* 3. Crowd Wisdom */}
        <div className="card variant-card">
          <h2 className="card-title">Crowd Wisdom</h2>
          {crowdDump == null ? (
            <p className="card-error">
              Failed to load crowd data. Run must be COMPLETED.
            </p>
          ) : (
            <>
              <div className="card-row">
                <span className="card-row-label">Agents</span>
                <span className="card-row-value">{crowdDump.agents}</span>
              </div>
              <div className="card-row">
                <span className="card-row-label">Steps</span>
                <span className="card-row-value">{crowdDump.steps}</span>
              </div>
              <div className="card-row">
                <span className="card-row-label">Decisions Count</span>
                <span className="card-row-value">{crowdDump.decisionsCount}</span>
              </div>
              <div className="card-row">
                <span className="card-row-label">Returns Count</span>
                <span className="card-row-value">{crowdDump.returnsCount}</span>
              </div>
              {crowdOk && (
                <span className="badge badge-success" style={{ marginTop: 12 }}>
                  CROWD DATA OK
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* 4. Crowd Advantage */}
      <div className="crowd-advantage-card">
        <h2 className="card-title">Crowd Advantage</h2>
        <div className="crowd-advantage-grid">
          <div className="crowd-advantage-col">
            <div className="card-row-label" style={{ marginBottom: 8 }}>
              Accuracy Comparison
            </div>
            <div className="card-row-label" style={{ fontSize: 12, marginBottom: 4 }}>
              Directional Accuracy
            </div>
            <div className="card-row">
              <span className="card-row-label">Crowd:</span>
              <span className="card-row-value">
                {formatPercent(crowdAccuracy)}
              </span>
            </div>
            <div className="card-row">
              <span className="card-row-label">Median Agent:</span>
              <span className="card-row-value">
                {formatPercent(medianAccuracy)}
              </span>
            </div>
            <div className="card-row">
              <span className="card-row-label">Delta:</span>
              <span
                className={
                  crowdDelta != null
                    ? crowdDelta > 0
                      ? "delta-positive"
                      : crowdDelta < 0
                        ? "delta-negative"
                        : ""
                    : ""
                }
              >
                {crowdDelta != null
                  ? `${crowdDelta >= 0 ? "+" : ""}${(crowdDelta * 100).toFixed(2)}%`
                  : "—"}
              </span>
            </div>
          </div>
          <div className="crowd-advantage-col">
            <div className="card-row-label" style={{ marginBottom: 8 }}>
              Correlation Signal
            </div>
            <div className="card-row">
              <span className="card-row-label">Correlation</span>
              <span className="card-row-value">
                {corr != null ? corr.toFixed(4) : "—"}
              </span>
            </div>
            {corr != null && (
              <span
                className={
                  corr > 0 ? "signal-positive" : "signal-negative"
                }
              >
                {corr > 0 ? "Positive Market Alignment" : "Inverse Signal"}
              </span>
            )}
          </div>
          <div className="crowd-advantage-col">
            <div className="card-row-label" style={{ marginBottom: 8 }}>
              Simulation Scale
            </div>
            <div className="card-row">
              <span className="card-row-label">Agents</span>
              <span className="card-row-value">{variant.agents}</span>
            </div>
            <div className="card-row">
              <span className="card-row-label">Steps</span>
              <span className="card-row-value">{variant.steps}</span>
            </div>
            <div className="card-row">
              <span className="card-row-label">Total Decisions</span>
              <span className="card-row-value">{totalDecisions}</span>
            </div>
            <p className="run-detail-meta" style={{ marginTop: 12 }}>
              Simulation scale: {variant.agents} agents × {variant.steps} steps
            </p>
          </div>
        </div>
      </div>

      {/* 5. Market Regime */}
      <div className="card variant-card regime-card" style={{ marginTop: 24 }}>
        <h2 className="card-title">Market Regime</h2>
        {returns.length === 0 ? (
          <p className="card-empty">
            Regime unavailable (pairs sample not present)
          </p>
        ) : (
          <>
            <div className="card-row">
              <span className="card-row-label">Regime</span>
              <span
                className={`regime-badge regime-badge-${trend.toLowerCase()}`}
              >
                {regime}
              </span>
            </div>
            <div className="card-row">
              <span className="card-row-label">Mean return</span>
              <span className="card-row-value mono">{mu.toFixed(6)}</span>
            </div>
            <div className="card-row">
              <span className="card-row-label">Volatility (σ)</span>
              <span className="card-row-value mono">{sigma.toFixed(6)}</span>
            </div>
            <div className="card-row">
              <span className="card-row-label">Up steps</span>
              <span className="card-row-value">
                {(upPct * 100).toFixed(1)}%
              </span>
            </div>
            <div className="card-row">
              <span className="card-row-label">Sample size</span>
              <span className="card-row-value">{returns.length}</span>
            </div>
          </>
        )}
      </div>

      {/* 6. Signal Calibration */}
      <div className="card variant-card" style={{ marginTop: 24 }}>
        <h2 className="card-title">Signal Calibration</h2>
        <div className="card-row">
          <span className="card-row-label">Conviction Index</span>
          <span className="card-row-value mono">
            {convictionIndex.toFixed(3)}
          </span>
        </div>
        <div className="card-row">
          <span className="card-row-label">Net Bias</span>
          <span className="card-row-value">
            {(netBias * 100).toFixed(1)}%
          </span>
        </div>
        <div className="card-row">
          <span className="card-row-label">Signal Strength</span>
          <span className="card-row-value">{strengthLabel}</span>
        </div>
        <div className="card-row">
          <span className="card-row-label">Interpretation</span>
          <span className="card-row-value" style={{ maxWidth: 320 }}>
            {interpretation}
          </span>
        </div>
      </div>

      {/* 7. Run Integrity */}
      <div className="card variant-card" style={{ marginTop: 24 }}>
        <h2 className="card-title">Run Integrity</h2>
        <div className="card-row">
          <span className="card-row-label">Schema Version</span>
          <span className="card-row-value">{schemaVersion}</span>
        </div>
        <div className="card-row">
          <span className="card-row-label">Model Version</span>
          <span className="card-row-value">{modelVersion}</span>
        </div>
        <div className="card-row">
          <span className="card-row-label">Dataset Version</span>
          <span className="card-row-value">{datasetVersion}</span>
        </div>
        <div className="card-row">
          <span className="card-row-label">Decisions Hash</span>
          <span className="card-row-value mono" title={decisionsHash ?? undefined}>
            {decisionsHash ? truncateMiddle(decisionsHash, 6, 6) : "—"}
          </span>
        </div>
        <div className="card-row">
          <span className="card-row-label">Returns Hash</span>
          <span className="card-row-value mono" title={returnsHash ?? undefined}>
            {returnsHash ? truncateMiddle(returnsHash, 6, 6) : "—"}
          </span>
        </div>
        <div className="card-row" style={{ marginTop: 12 }}>
          <span className="card-row-label">Validation Status</span>
          <span
            className={
              integrityOk
                ? "badge badge-success"
                : "badge badge-amber"
            }
          >
            {integrityOk
              ? "Deterministic Snapshot Verified"
              : "Incomplete Snapshot"}
          </span>
        </div>
      </div>

      {/* 8. Cross-Run Context */}
      <CrossRunContextCard />

      {/* 9. Stability (Across Seeds) */}
      <div className="card variant-card" style={{ marginTop: 24 }}>
        <h2 className="card-title">Stability (Across Seeds)</h2>
        <div className="card-row">
          <span className="card-row-label">Seed family size (N)</span>
          <span className="card-row-value">{nSeeds}</span>
        </div>
        <div className="card-row">
          <span className="card-row-label">Accuracy Std Dev (%)</span>
          <span className="card-row-value mono">
            {accStd.toFixed(2)}%
          </span>
        </div>
        <div className="card-row">
          <span className="card-row-label">Corr Std Dev</span>
          <span className="card-row-value mono">
            {corrStd.toFixed(4)}
          </span>
        </div>
        <div className="card-row">
          <span className="card-row-label">Accuracy CI Range</span>
          <span className="card-row-value mono">
            {ciLow.toFixed(1)} – {ciHigh.toFixed(1)}
          </span>
        </div>
        <div className="card-row" style={{ marginTop: 12 }}>
          <span className="card-row-label">Stability</span>
          <span
            className={
              seedsRating === "Stable"
                ? "badge badge-success"
                : seedsRating === "Moderate"
                  ? "badge badge-amber"
                  : "badge badge-error"
            }
          >
            {seedsRating}
          </span>
        </div>
        {nSeeds >= 2 && (
          <div style={{ marginTop: 16 }}>
            <div className="card-row-label" style={{ marginBottom: 6 }}>
              Seeds
            </div>
            <MiniSparkline
              values={[...seedsWithSummary]
                .sort((a, b) => a.seed - b.seed)
                .map((v) => v.summary!.corr!)}
              title="Correlation by seed"
            />
            <p className="run-detail-meta" style={{ marginTop: 6, fontSize: 12 }}>
              seed {(() => {
                const seeds = seedsWithSummary.map((v) => v.seed).sort((a, b) => a - b);
                return seeds.length > 1 ? `${seeds[0]}..${seeds[seeds.length - 1]}` : String(seeds[0] ?? "");
              })()}
            </p>
          </div>
        )}
      </div>

      {/* 10. Stability (Comparable Runs) */}
      <StabilityCard
        runId={runId}
        assetSymbol={assetSymbol}
        steps={variant.steps}
        agents={variant.agents}
      />
      </CrossRunProvider>
    </div>
  );
}
