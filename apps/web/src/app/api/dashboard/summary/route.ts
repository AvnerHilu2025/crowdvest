import { NextRequest, NextResponse } from "next/server";

const SAFE_DEFAULTS = {
  productionAggregationMode: null,
  aggregationModeRanking: [] as unknown[],
  strategyProfile: null,
  strategyDefaults: null,
  runFlowDefaults: null,
  executionPreset: null,
  launchPlan: null,
  dataSource: { type: "synthetic" as const, datasetVersion: null, provider: null },
  crowdSignals: { window: 20, items: [] as unknown[] },
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function shapeData(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };

  if (!("productionAggregationMode" in out) || out.productionAggregationMode == null) {
    out.productionAggregationMode = SAFE_DEFAULTS.productionAggregationMode;
  }
  if (!Array.isArray(out.aggregationModeRanking)) {
    out.aggregationModeRanking = SAFE_DEFAULTS.aggregationModeRanking;
  }
  if (!("strategyProfile" in out) || out.strategyProfile == null || !isPlainObject(out.strategyProfile)) {
    out.strategyProfile = SAFE_DEFAULTS.strategyProfile;
  }
  if (!("strategyDefaults" in out) || out.strategyDefaults == null || !isPlainObject(out.strategyDefaults)) {
    out.strategyDefaults = SAFE_DEFAULTS.strategyDefaults;
  }
  if (!("runFlowDefaults" in out) || out.runFlowDefaults == null || !isPlainObject(out.runFlowDefaults)) {
    out.runFlowDefaults = SAFE_DEFAULTS.runFlowDefaults;
  }
  if (!("executionPreset" in out) || out.executionPreset == null || !isPlainObject(out.executionPreset)) {
    out.executionPreset = SAFE_DEFAULTS.executionPreset;
  }
  if (!("launchPlan" in out) || out.launchPlan == null || !isPlainObject(out.launchPlan)) {
    out.launchPlan = SAFE_DEFAULTS.launchPlan;
  }
  if (
    !("dataSource" in out) ||
    out.dataSource == null ||
    !isPlainObject(out.dataSource)
  ) {
    out.dataSource = { ...SAFE_DEFAULTS.dataSource };
  } else {
    const ds = out.dataSource as Record<string, unknown>;
    if (typeof ds.type !== "string") ds.type = "synthetic";
    if (!("datasetVersion" in ds)) ds.datasetVersion = null;
    if (!("provider" in ds)) ds.provider = null;
  }
  if (
    !("crowdSignals" in out) ||
    out.crowdSignals == null ||
    !isPlainObject(out.crowdSignals) ||
    !Array.isArray((out.crowdSignals as Record<string, unknown>).items)
  ) {
    out.crowdSignals = { ...SAFE_DEFAULTS.crowdSignals };
  }
  if (
    !("signalValidation" in out) ||
    out.signalValidation == null ||
    !isPlainObject(out.signalValidation)
  ) {
    out.signalValidation = {
      total: 0,
      actionable: 0,
      abstained: 0,
      directionalValidated: 0,
      directionalAccuracyRate: null,
      coverageRate: null,
      avgSignalStrengthActionable: null,
      avgSignalStrengthAll: null,
      validated: 0,
      accuracyRate: null,
      latestItems: [],
    };
  } else {
    const sv = out.signalValidation as Record<string, unknown>;
    if (typeof sv.total !== "number") sv.total = 0;
    if (typeof sv.actionable !== "number") sv.actionable = 0;
    if (typeof sv.abstained !== "number") sv.abstained = 0;
    if (typeof sv.directionalValidated !== "number") sv.directionalValidated = (typeof sv.validated === "number" ? sv.validated : 0);
    if (sv.directionalAccuracyRate != null && typeof sv.directionalAccuracyRate !== "number") sv.directionalAccuracyRate = null;
    if (sv.coverageRate != null && typeof sv.coverageRate !== "number") sv.coverageRate = null;
    if (sv.avgSignalStrengthActionable != null && typeof sv.avgSignalStrengthActionable !== "number") sv.avgSignalStrengthActionable = null;
    if (sv.avgSignalStrengthAll != null && typeof sv.avgSignalStrengthAll !== "number") sv.avgSignalStrengthAll = null;
    if (typeof sv.validated !== "number") sv.validated = 0;
    if (sv.accuracyRate != null && typeof sv.accuracyRate !== "number") sv.accuracyRate = null;
    if (!Array.isArray(sv.latestItems)) sv.latestItems = [];
  }
  if ("signalHistoryStats" in out && out.signalHistoryStats != null && isPlainObject(out.signalHistoryStats)) {
    const shs = out.signalHistoryStats as Record<string, unknown>;
    if (typeof shs.totalSnapshots !== "number" || typeof shs.symbolsCovered !== "number") {
      out.signalHistoryStats = { totalSnapshots: 0, symbolsCovered: 0 };
    }
  }
  if ("signalCoverage" in out && out.signalCoverage != null && isPlainObject(out.signalCoverage)) {
    const sc = out.signalCoverage as Record<string, unknown>;
    if (typeof sc.total !== "number") sc.total = 0;
    if (typeof sc.actionable !== "number") sc.actionable = 0;
    if (typeof sc.abstained !== "number") sc.abstained = 0;
    if (typeof sc.coverageRate !== "number") sc.coverageRate = 0;
    if (!sc.bySignal || typeof sc.bySignal !== "object") sc.bySignal = { STRONG_BUY: 0, BUY: 0, NEUTRAL: 0, SELL: 0, STRONG_SELL: 0 };
  }
  if ("marketRegime" in out && out.marketRegime != null && isPlainObject(out.marketRegime)) {
    const mr = out.marketRegime as Record<string, unknown>;
    if (!["TRENDING", "MIXED", "CHAOTIC"].includes(mr.regime as string)) mr.regime = "MIXED";
    if (typeof mr.avgSignalStrength !== "number") mr.avgSignalStrength = 0;
    if (typeof mr.avgDisagreement !== "number") mr.avgDisagreement = 0;
    if (typeof mr.coverageRate !== "number") mr.coverageRate = 0;
  }
  if ("marketTransition" in out && out.marketTransition != null && isPlainObject(out.marketTransition)) {
    const mt = out.marketTransition as Record<string, unknown>;
    if (!["IMPROVING", "DETERIORATING", "STABLE"].includes(mt.trend as string)) mt.trend = "STABLE";
    if (typeof mt.strengthDelta !== "number") mt.strengthDelta = 0;
    if (typeof mt.disagreementDelta !== "number") mt.disagreementDelta = 0;
    if (typeof mt.coverageDelta !== "number") mt.coverageDelta = 0;
  }
  if ("marketStress" in out && out.marketStress != null && isPlainObject(out.marketStress)) {
    const ms = out.marketStress as Record<string, unknown>;
    if (!["PANIC", "EUPHORIA", "FRAGILITY", "CALM", "NORMAL"].includes(ms.state as string)) ms.state = "NORMAL";
    if (typeof ms.buyDominance !== "number") ms.buyDominance = 0;
    if (typeof ms.sellDominance !== "number") ms.sellDominance = 0;
    if (typeof ms.interpretation !== "string") ms.interpretation = "No unusual crowd stress pattern detected.";
  }
  if (!Array.isArray(out.marketAlerts)) {
    out.marketAlerts = [];
  } else {
    out.marketAlerts = (out.marketAlerts as Array<Record<string, unknown>>).map((a) => ({
      type: typeof a.type === "string" ? a.type : "UNKNOWN",
      severity: ["LOW", "MEDIUM", "HIGH"].includes(a.severity as string) ? a.severity : "LOW",
      confidence: typeof a.confidence === "number" ? Math.max(0, Math.min(1, a.confidence)) : 0,
      message: typeof a.message === "string" ? a.message : "",
    }));
  }
  if (!Array.isArray(out.symbolProbabilities)) {
    out.symbolProbabilities = [];
  } else {
    out.symbolProbabilities = (out.symbolProbabilities as Array<Record<string, unknown>>).map((p) => {
      const pb = typeof p.probabilityBuy === "number" ? Math.max(0, Math.min(1, p.probabilityBuy)) : 0;
      const ps = typeof p.probabilitySell === "number" ? Math.max(0, Math.min(1, p.probabilitySell)) : 0;
      const pn = Math.max(0, 1 - pb - ps);
      return {
        symbol: typeof p.symbol === "string" ? p.symbol : "?",
        probabilityBuy: pb,
        probabilitySell: ps,
        probabilityNeutral: pn,
        interpretation: typeof p.interpretation === "string" ? p.interpretation : "",
      };
    });
  }
  if (!("crowdConfidence" in out) || out.crowdConfidence == null || !isPlainObject(out.crowdConfidence)) {
    out.crowdConfidence = {
      regime: "LOW_CONFIDENCE",
      conviction: 0,
      disagreement: 0,
      coverageRate: 0,
      neutralProbability: 1,
      interpretation: "Crowd signals are currently weak and should be interpreted cautiously.",
    };
  } else {
    const cc = out.crowdConfidence as Record<string, unknown>;
    if (!["LOW_CONFIDENCE", "BUILDING_CONFIDENCE", "HIGH_CONFIDENCE"].includes(cc.regime as string)) cc.regime = "LOW_CONFIDENCE";
    if (typeof cc.conviction !== "number") cc.conviction = 0;
    if (typeof cc.disagreement !== "number") cc.disagreement = 0;
    if (typeof cc.coverageRate !== "number") cc.coverageRate = 0;
    if (typeof cc.neutralProbability !== "number") cc.neutralProbability = 1;
    if (typeof cc.interpretation !== "string") cc.interpretation = "Crowd signals are currently weak and should be interpreted cautiously.";
  }
  if (!("signalValidationMetrics" in out) || out.signalValidationMetrics == null || !isPlainObject(out.signalValidationMetrics)) {
    out.signalValidationMetrics = {
      totalSignals: 0,
      actionableSignals: 0,
      correctPredictions: 0,
      accuracy: 0,
      avgReturn: 0,
      benchmarkReturn: 0,
      edge: 0,
    };
  } else {
    const svm = out.signalValidationMetrics as Record<string, unknown>;
    if (typeof svm.totalSignals !== "number") svm.totalSignals = 0;
    if (typeof svm.actionableSignals !== "number") svm.actionableSignals = 0;
    if (typeof svm.correctPredictions !== "number") svm.correctPredictions = 0;
    if (typeof svm.accuracy !== "number") svm.accuracy = 0;
    if (typeof svm.avgReturn !== "number") svm.avgReturn = 0;
    if (typeof svm.benchmarkReturn !== "number") svm.benchmarkReturn = 0;
    if (typeof svm.edge !== "number") svm.edge = 0;
  }
  if (!("backtestMetrics" in out) || out.backtestMetrics == null || !isPlainObject(out.backtestMetrics)) {
    out.backtestMetrics = {
      trades: 0,
      winRate: null,
      avgTradeReturn: null,
      cumulativeReturn: null,
      benchmarkReturn: null,
      edge: null,
      maxDrawdown: null,
    };
  } else {
    const bm = out.backtestMetrics as Record<string, unknown>;
    if (typeof bm.trades !== "number") bm.trades = 0;
    if (bm.winRate != null && typeof bm.winRate !== "number") bm.winRate = null;
    if (bm.avgTradeReturn != null && typeof bm.avgTradeReturn !== "number") bm.avgTradeReturn = null;
    if (bm.cumulativeReturn != null && typeof bm.cumulativeReturn !== "number") bm.cumulativeReturn = null;
    if (bm.benchmarkReturn != null && typeof bm.benchmarkReturn !== "number") bm.benchmarkReturn = null;
    if (bm.edge != null && typeof bm.edge !== "number") bm.edge = null;
    if (bm.maxDrawdown != null && typeof bm.maxDrawdown !== "number") bm.maxDrawdown = null;
  }
  if (!("backtestDiagnostics" in out) || out.backtestDiagnostics == null || !isPlainObject(out.backtestDiagnostics)) {
    out.backtestDiagnostics = null;
  } else {
    const bd = out.backtestDiagnostics as Record<string, unknown>;
    if (typeof bd.candidateRows !== "number") bd.candidateRows = 0;
    if (typeof bd.skippedNonPrepare !== "number") bd.skippedNonPrepare = 0;
    if (typeof bd.skippedLowSignalStrength !== "number") bd.skippedLowSignalStrength = 0;
    if (typeof bd.skippedHighNeutral !== "number") bd.skippedHighNeutral = 0;
    if (typeof bd.skippedLowConviction !== "number") bd.skippedLowConviction = 0;
    if (typeof bd.executedTrades !== "number") bd.executedTrades = 0;
  }
  if (!("calibrationSweep" in out) || out.calibrationSweep == null || !isPlainObject(out.calibrationSweep)) {
    out.calibrationSweep = { totalRuns: 0, results: [] };
  } else {
    const cs = out.calibrationSweep as Record<string, unknown>;
    if (typeof cs.totalRuns !== "number") cs.totalRuns = 0;
    if (!Array.isArray(cs.results)) cs.results = [];
    else {
      cs.results = (cs.results as Array<Record<string, unknown>>).map((r) => ({
        signalStrengthThreshold: typeof r.signalStrengthThreshold === "number" ? r.signalStrengthThreshold : 0,
        convictionThreshold: typeof r.convictionThreshold === "number" ? r.convictionThreshold : 0,
        neutralThreshold: typeof r.neutralThreshold === "number" ? r.neutralThreshold : 0,
        trades: typeof r.trades === "number" ? r.trades : 0,
        winRate: r.winRate != null && typeof r.winRate === "number" ? r.winRate : null,
        avgTradeReturn: r.avgTradeReturn != null && typeof r.avgTradeReturn === "number" ? r.avgTradeReturn : null,
        cumulativeReturn: r.cumulativeReturn != null && typeof r.cumulativeReturn === "number" ? r.cumulativeReturn : null,
        benchmarkReturn: r.benchmarkReturn != null && typeof r.benchmarkReturn === "number" ? r.benchmarkReturn : null,
        edge: r.edge != null && typeof r.edge === "number" ? r.edge : null,
        maxDrawdown: r.maxDrawdown != null && typeof r.maxDrawdown === "number" ? r.maxDrawdown : null,
      }));
    }
  }
  if (!Array.isArray(out.crowdAcceleration)) {
    out.crowdAcceleration = [];
  } else {
    out.crowdAcceleration = (out.crowdAcceleration as Array<Record<string, unknown>>).map((a) => ({
      symbol: typeof a.symbol === "string" ? a.symbol : "?",
      type: ["BULLISH_ACCELERATION", "BEARISH_ACCELERATION", "NONE"].includes(a.type as string) ? a.type : "NONE",
      strength: typeof a.strength === "number" ? Math.max(0, Math.min(1, a.strength)) : 0,
      velocity: typeof a.velocity === "number" ? a.velocity : 0,
      acceleration: typeof a.acceleration === "number" ? a.acceleration : 0,
      reason: typeof a.reason === "string" ? a.reason : "",
    }));
  }
  if (!Array.isArray(out.crowdDivergence)) {
    out.crowdDivergence = [];
  } else {
    out.crowdDivergence = (out.crowdDivergence as Array<Record<string, unknown>>).map((d) => ({
      symbol: typeof d.symbol === "string" ? d.symbol : "?",
      type: ["BULLISH_DIVERGENCE", "BEARISH_DIVERGENCE", "NONE"].includes(d.type as string) ? d.type : "NONE",
      strength: typeof d.strength === "number" ? Math.max(0, Math.min(1, d.strength)) : 0,
      momentum: typeof d.momentum === "number" ? d.momentum : 0,
      crowdBias: typeof d.crowdBias === "number" ? d.crowdBias : 0,
      reason: typeof d.reason === "string" ? d.reason : "",
    }));
  }
  if (!Array.isArray(out.tradeSetups)) {
    out.tradeSetups = [];
  } else {
    out.tradeSetups = (out.tradeSetups as Array<Record<string, unknown>>).map((s) => ({
      symbol: typeof s.symbol === "string" ? s.symbol : "?",
      status: ["PREPARE_LONG", "PREPARE_SHORT", "WATCH", "IGNORE"].includes(s.status as string) ? s.status : "IGNORE",
      confidence: typeof s.confidence === "number" ? Math.max(0, Math.min(1, s.confidence)) : 0,
      reason: typeof s.reason === "string" ? s.reason : "",
    }));
  }
  if (!Array.isArray(out.watchlistCandidates)) {
    out.watchlistCandidates = [];
  } else {
    out.watchlistCandidates = (out.watchlistCandidates as Array<Record<string, unknown>>).map((c) => ({
      symbol: typeof c.symbol === "string" ? c.symbol : "?",
      score: typeof c.score === "number" ? Math.max(0, Math.min(1, c.score)) : 0,
      status: ["EMERGING", "WATCH", "IGNORE"].includes(c.status as string) ? c.status : "IGNORE",
      reason: typeof c.reason === "string" ? c.reason : "",
    }));
  }
  if (!("signalProbabilities" in out) || out.signalProbabilities == null || !isPlainObject(out.signalProbabilities)) {
    out.signalProbabilities = {
      probabilityBuy: 0,
      probabilitySell: 0,
      probabilityNeutral: 1,
      interpretation: "Directional probabilities unavailable.",
    };
  } else {
    const sp = out.signalProbabilities as Record<string, unknown>;
    if (typeof sp.probabilityBuy !== "number") sp.probabilityBuy = 0;
    if (typeof sp.probabilitySell !== "number") sp.probabilitySell = 0;
    if (typeof sp.probabilityNeutral !== "number") {
      sp.probabilityNeutral = 1 - (sp.probabilityBuy as number) - (sp.probabilitySell as number);
    }
    const sum = (sp.probabilityBuy as number) + (sp.probabilitySell as number) + (sp.probabilityNeutral as number);
    if (sum > 0) {
      sp.probabilityBuy = Math.max(0, Math.min(1, (sp.probabilityBuy as number) / sum));
      sp.probabilitySell = Math.max(0, Math.min(1, (sp.probabilitySell as number) / sum));
      sp.probabilityNeutral = 1 - (sp.probabilityBuy as number) - (sp.probabilitySell as number);
    }
    if (typeof sp.interpretation !== "string") sp.interpretation = "Directional probabilities unavailable.";
  }

  const emptyAcceptanceSide = () => ({
    preMappingCount: 0,
    passedSignalThresholdCount: 0,
    failedSignalThresholdCount: 0,
    passedConvictionCount: 0,
    failedConvictionCount: 0,
    finalAcceptedCount: 0,
    acceptanceRateFromPreMapping: 0,
    acceptanceRateAfterThreshold: 0,
  });
  const emptyBucket = () => ({ longCount: 0, shortCount: 0 });
  const emptySignalBuckets = () => ({
    "0_to_0_01": emptyBucket(),
    "0_01_to_0_02": emptyBucket(),
    "0_02_to_0_03": emptyBucket(),
    "0_03_to_0_04": emptyBucket(),
    "0_04_to_0_05": emptyBucket(),
    "0_05_to_0_075": emptyBucket(),
    "0_075_to_0_10": emptyBucket(),
    "0_10_plus": emptyBucket(),
  });
  const emptySymbolDir = () => ({
    preMappingLongCount: 0,
    preMappingShortCount: 0,
    finalLongCount: 0,
    finalShortCount: 0,
    avgLongSignal: null as number | null,
    avgShortSignal: null as number | null,
    avgLongConviction: null as number | null,
    avgShortConviction: null as number | null,
  });
  if (!("directionMappingDiagnostics" in out) || out.directionMappingDiagnostics == null || !isPlainObject(out.directionMappingDiagnostics)) {
    out.directionMappingDiagnostics = {};
  }
  const dmd = out.directionMappingDiagnostics as Record<string, unknown>;
  if (!isPlainObject(dmd.acceptanceBySide)) {
    dmd.acceptanceBySide = { LONG: emptyAcceptanceSide(), SHORT: emptyAcceptanceSide() };
  } else {
    const ab = dmd.acceptanceBySide as Record<string, unknown>;
    if (!isPlainObject(ab.LONG)) ab.LONG = emptyAcceptanceSide();
    if (!isPlainObject(ab.SHORT)) ab.SHORT = emptyAcceptanceSide();
  }
  if (!isPlainObject(dmd.signalBucketDiagnostics)) {
    dmd.signalBucketDiagnostics = emptySignalBuckets();
  }
  if (!isPlainObject(dmd.symbolDirectionAcceptance)) {
    dmd.symbolDirectionAcceptance = {
      SPY: emptySymbolDir(),
      QQQ: emptySymbolDir(),
      IWM: emptySymbolDir(),
    };
  } else {
    const sda = dmd.symbolDirectionAcceptance as Record<string, unknown>;
    for (const sym of ["SPY", "QQQ", "IWM"]) {
      if (!isPlainObject(sda[sym])) sda[sym] = emptySymbolDir();
    }
  }
  if (!isPlainObject(dmd.rejectionReasonSummary)) {
    dmd.rejectionReasonSummary = {
      rejectedLongBelowSignalThreshold: 0,
      rejectedLongBelowConvictionThreshold: 0,
      rejectedShortBelowSignalThreshold: 0,
      rejectedShortBelowConvictionThreshold: 0,
    };
  }

  return out;
}

export async function GET(req: NextRequest) {
  try {
    const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4001";
    const upstreamUrl = new URL("/dashboard/summary", apiBaseUrl);

    req.nextUrl.searchParams.forEach((value, key) => {
      upstreamUrl.searchParams.set(key, value);
    });

    const upstreamRes = await fetch(upstreamUrl.toString(), {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });

    const text = await upstreamRes.text();

    if (!upstreamRes.ok) {
      return new NextResponse(text || "Upstream error", {
        status: upstreamRes.status,
        headers: {
          "content-type": upstreamRes.headers.get("content-type") || "text/plain; charset=utf-8",
        },
      });
    }

    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return new NextResponse(text || "Invalid upstream JSON", {
        status: 502,
        headers: {
          "content-type": "text/plain; charset=utf-8",
        },
      });
    }

    if (!isPlainObject(data)) {
      data = {};
    }

    let shaped: Record<string, unknown>;
    try {
      shaped = shapeData(data);
    } catch {
      shaped = data;
    }

    return NextResponse.json(shaped, {
      status: 200,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.stack || error.message : "Unknown proxy error";
    return new NextResponse(message, {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }
}
