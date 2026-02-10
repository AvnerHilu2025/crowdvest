/** Response shape for GET /runs/:runId/summary?assetSymbol= */
export interface RunSummaryResponse {
  run: { id: string; createdAt: string; updatedAt: string };
  asset: { symbol: string };
  counts: {
    agents: number;
    steps: number;
    agentStateRows: number;
    rewardsRows: number;
    crowdMetricsRows: number;
    assetStepReturnRows: number;
  };
  latest: {
    step: number | null;
    crowd: {
      wisdomScore: number | null;
      herdingIndex: number | null;
      noiseSensitivity: number | null;
      diversityIndex: number | null;
      independenceIndex: number | null;
      decisionHistogram: { BUY: number; SELL: number; HOLD: number; OTHER: number } | null;
    } | null;
    backtest: {
      id: string;
      createdAt: string;
      seed: number;
      steps: number;
      agents: number;
      pairsCount: number | null;
      corr: number | null;
      directionalAccuracy: number | null;
    } | null;
  };
  health: {
    marketDataPresent: boolean;
    learningPresent: boolean;
    rewardsPresent: boolean;
    crowdMetricsPresent: boolean;
    backtestPresent: boolean;
  };
}
