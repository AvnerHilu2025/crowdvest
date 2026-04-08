/** Subset of GET /dashboard/summary fields used by crowd intelligence UI. */

export type TradeDirectionDiagnostics = {
  executedLongTrades: number;
  executedShortTrades: number;
  longShare: number | null;
  shortShare: number | null;
  sampleTradeDirections?: unknown[];
};

export type TradeDirectionDiagnosticsCrowd = {
  runId: string | null;
  assetSymbol: string;
  executedLongTrades: number;
  executedShortTrades: number;
  longShare: number | null;
  shortShare: number | null;
};

export type TradeDirectionDivergence = {
  divergence: number | null;
  directionAgreement: boolean | null;
};

export type ChannelDirectionalBreakdown = {
  channel: "synthetic" | "info" | "event" | "regime";
  meanBuy: number | null;
  meanSell: number | null;
  directionalPush: number | null;
};

export type TradeDirectionDivergenceExplanation = {
  runId: string | null;
  assetSymbol: string;
  decisionRowCount: number;
  topCrowdBiasByArchetype: Array<{
    archetype: string;
    buyCount: number;
    sellCount: number;
    holdCount: number;
    netBuyMinusSell: number;
  }>;
  buySellHoldByArchetype: Array<{
    archetype: string;
    buyCount: number;
    sellCount: number;
    holdCount: number;
  }>;
  signalContributions: {
    syntheticMean: number | null;
    infoMean: number | null;
    eventMean: number | null;
    regimeMean: number | null;
    channelsByAbsoluteStrength: Array<{ channel: string; mean: number }>;
    channelDirectionalBreakdown: ChannelDirectionalBreakdown[];
    channelsAlignedWithCrowdDirection: Array<{ channel: string; directionalPush: number }>;
  };
  archetypesWithNetAlignedToCrowd: string[];
  /** Mean synthetic / info / event / regime per `agent.archetype` (AgentDecision rows). */
  archetypeChannelMeans?: Array<{
    archetype: string;
    meanSynthetic: number | null;
    meanInfo: number | null;
    meanEvent: number | null;
    meanRegime: number | null;
  }>;
  summary: string | null;
};

export type DirectionBiasByAgentType = {
  trendFollower?: {
    avgSignal: number;
    positiveCount: number;
    negativeCount: number;
    /** Agents with near-zero final signal (|signal| ≤ 0.01), summed across executed timesteps — shown as HOLD. */
    neutralCount?: number;
  };
  contrarian?: {
    avgSignal: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount?: number;
  };
  balanced?: {
    avgSignal: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount?: number;
  };
};

/** Shares 0–1 from summary consensus (fields may be partial from API). */
export type ConsensusSnapshot = {
  buyPct?: number;
  sellPct?: number;
  holdPct?: number;
  majorityPct?: number;
  entropy?: number;
  polarization?: number;
};
