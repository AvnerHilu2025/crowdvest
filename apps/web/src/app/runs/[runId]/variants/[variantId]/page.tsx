import Link from "next/link";
import {
  formatPercent,
  formatNumber,
  truncateMiddle,
} from "@/lib/format";
import { stdDev } from "@/lib/cis";
import {
  SectionCard,
  MetricRows,
  MetricRow,
  Badge,
  Divider,
  MiniChartPlaceholder,
} from "@/components/ui/dashboard";
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
        <SectionCard title="Performance">
          <MetricRows>
            <MetricRow
              label="Correlation"
              value={corr != null ? corr.toFixed(4) : "—"}
              mono
            />
            <MetricRow
              label="Directional Accuracy"
              value={formatPercent(directionalAccuracy)}
            />
            <MetricRow label="Pairs Count" value={formatNumber(pairsCount)} />
            {(variant.decisionsHash || variant.returnsHash) && (
              <MetricRow
                label="Hashes"
                value={
                  <>
                    decisions: {variant.decisionsHash ? truncateMiddle(variant.decisionsHash, 8, 6) : "—"}
                    {" · "}
                    returns: {variant.returnsHash ? truncateMiddle(variant.returnsHash, 8, 6) : "—"}
                  </>
                }
                mono
              />
            )}
          </MetricRows>
        </SectionCard>

        {/* 2. Decision Histogram */}
        <SectionCard title="Decision Histogram">
          <MetricRows>
            <MetricRow label="BUY" value={buyCount} />
            <MetricRow label="SELL" value={sellCount} />
            <MetricRow label="HOLD" value={holdCount} />
          </MetricRows>
          {decisionCounts == null && (
            <p className="card-empty" style={{ marginTop: 8 }}>
              No decision counts available
            </p>
          )}
        </SectionCard>

        {/* 3. Crowd Wisdom */}
        <SectionCard title="Crowd Wisdom">
          {crowdDump == null ? (
            <p className="card-error">
              Failed to load crowd data. Run must be COMPLETED.
            </p>
          ) : (
            <>
              <MetricRows>
                <MetricRow label="Agents" value={crowdDump.agents} />
                <MetricRow label="Steps" value={crowdDump.steps} />
                <MetricRow label="Decisions Count" value={crowdDump.decisionsCount} />
                <MetricRow label="Returns Count" value={crowdDump.returnsCount} />
              </MetricRows>
              {crowdOk && (
                <div style={{ marginTop: 12 }}>
                  <Badge tone="success">CROWD DATA OK</Badge>
                </div>
              )}
            </>
          )}
        </SectionCard>
      </div>

      {/* 4. Crowd Advantage */}
      <div style={{ marginTop: 24 }}>
      <SectionCard title="Crowd Advantage">
        <MetricRows>
          <MetricRow label="Crowd" value={formatPercent(crowdAccuracy)} />
          <MetricRow label="Median Agent" value={formatPercent(medianAccuracy)} />
          <MetricRow
            label="Delta"
            value={
              crowdDelta != null
                ? `${crowdDelta >= 0 ? "+" : ""}${(crowdDelta * 100).toFixed(2)}%`
                : "—"
            }
          />
          <Divider />
          <MetricRow
            label="Correlation"
            value={corr != null ? corr.toFixed(4) : "—"}
            mono
          />
          <MetricRow
            label="Signal"
            value={
              corr != null
                ? corr > 0
                  ? "Positive Market Alignment"
                  : "Inverse Signal"
                : "—"
            }
          />
          <Divider />
          <MetricRow label="Agents" value={variant.agents} />
          <MetricRow label="Steps" value={variant.steps} />
          <MetricRow label="Total Decisions" value={totalDecisions} />
        </MetricRows>
        <p className="run-detail-meta" style={{ marginTop: 12 }}>
          Simulation scale: {variant.agents} agents × {variant.steps} steps
        </p>
      </SectionCard>
      </div>

      {/* 5. Market Regime */}
      <div style={{ marginTop: 24 }}>
        <SectionCard
          title="Market Regime"
          right={
            returns.length > 0 ? (
              <Badge tone={trend === "Bull" ? "success" : "danger"}>
                {regime}
              </Badge>
            ) : undefined
          }
        >
          {returns.length === 0 ? (
            <p className="card-empty">
              Regime unavailable (pairs sample not present)
            </p>
          ) : (
            <MetricRows>
              <MetricRow label="Mean return" value={mu.toFixed(6)} mono />
              <MetricRow label="Volatility (σ)" value={sigma.toFixed(6)} mono />
              <MetricRow label="Up steps" value={`${(upPct * 100).toFixed(1)}%`} />
              <MetricRow label="Sample size" value={returns.length} />
            </MetricRows>
          )}
        </SectionCard>
      </div>

      {/* 6. Signal Calibration */}
      <div style={{ marginTop: 24 }}>
        <SectionCard
          title="Signal Calibration"
          right={<Badge tone={strengthLabel === "Strong" ? "success" : strengthLabel === "Moderate" ? "warn" : "neutral"}>{strengthLabel}</Badge>}
        >
          <MetricRows>
            <MetricRow label="Conviction Index" value={convictionIndex.toFixed(3)} mono />
            <MetricRow label="Net Bias" value={`${(netBias * 100).toFixed(1)}%`} />
            <MetricRow label="Interpretation" value={interpretation} />
          </MetricRows>
        </SectionCard>
      </div>

      {/* 7. Run Integrity */}
      <div style={{ marginTop: 24 }}>
        <SectionCard
          title="Run Integrity"
          right={
            <Badge tone={integrityOk ? "success" : "warn"}>
              {integrityOk
                ? "Deterministic Snapshot Verified"
                : "Incomplete Snapshot"}
            </Badge>
          }
        >
          <MetricRows>
            <MetricRow label="Schema Version" value={schemaVersion} />
            <MetricRow label="Model Version" value={modelVersion} />
            <MetricRow label="Dataset Version" value={datasetVersion} />
            <MetricRow
              label="Decisions Hash"
              value={decisionsHash ? truncateMiddle(decisionsHash, 6, 6) : "—"}
              mono
            />
            <MetricRow
              label="Returns Hash"
              value={returnsHash ? truncateMiddle(returnsHash, 6, 6) : "—"}
              mono
            />
          </MetricRows>
        </SectionCard>
      </div>

      {/* 8. Cross-Run Context */}
      <CrossRunContextCard />

      {/* 9. Stability (Across Seeds) */}
      <div style={{ marginTop: 24 }}>
        <SectionCard
          title="Stability (Across Seeds)"
          right={
            <Badge
              tone={
                seedsRating === "Stable"
                  ? "success"
                  : seedsRating === "Moderate"
                    ? "warn"
                    : "danger"
              }
            >
              {seedsRating}
            </Badge>
          }
        >
          <MetricRows>
            <MetricRow label="Seed family size (N)" value={nSeeds} />
            <MetricRow label="Accuracy Std Dev (%)" value={`${accStd.toFixed(2)}%`} mono />
            <MetricRow label="Corr Std Dev" value={corrStd.toFixed(4)} mono />
            <MetricRow
              label="Accuracy CI Range"
              value={`${ciLow.toFixed(1)} – ${ciHigh.toFixed(1)}`}
              mono
            />
          </MetricRows>
          {nSeeds >= 2 && (
            <div style={{ marginTop: 16 }}>
              <div className="run-detail-meta" style={{ marginBottom: 6, fontSize: 12 }}>
                Seeds (seed {(() => {
                  const seeds = seedsWithSummary.map((v) => v.seed).sort((a, b) => a - b);
                  return seeds.length > 1 ? `${seeds[0]}..${seeds[seeds.length - 1]}` : String(seeds[0] ?? "");
                })()})
              </div>
              <MiniChartPlaceholder />
            </div>
          )}
        </SectionCard>
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
