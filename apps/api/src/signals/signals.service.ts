import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StrategyProfilesService } from "../strategy-profiles/strategy-profiles.service";
import { MarketDataService } from "../market-data/market-data.service";

const WINDOW = 20;

type RealizedDirection = "UP" | "DOWN" | "FLAT";

export type CrowdSignal =
  | "STRONG_BUY"
  | "BUY"
  | "NEUTRAL"
  | "SELL"
  | "STRONG_SELL";

export interface SignalItem {
  symbol: string;
  signal: CrowdSignal;
  confidence: number;
  disagreement: number;
  instability: number;
  runsUsed: number;
}

export interface LatestSignalsResponse {
  window: number;
  signals: SignalItem[];
}

interface CrowdMix {
  buyPct: number;
  sellPct: number;
  holdPct: number;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map((v) => (v - mean) ** 2);
  const variance = sqDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

@Injectable()
export class SignalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly strategyProfilesService: StrategyProfilesService,
    private readonly marketDataService: MarketDataService,
  ) {}

  /** Resolve symbols: explicit input > strategy run defaults > SPY,QQQ,IWM fallback. */
  resolveSymbols(symbolsInput?: string | null): string[] {
    const trimmed = (symbolsInput ?? "").trim();
    if (trimmed) {
      const parsed = trimmed
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .filter((s, i, arr) => arr.indexOf(s) === i)
        .slice(0, 20);
      if (parsed.length > 0) return parsed;
    }
    try {
      const d = this.strategyProfilesService.getDefaults();
      return [...(d.runDefaults?.assetSymbols ?? ["SPY", "QQQ", "IWM"])];
    } catch {
      return ["SPY", "QQQ", "IWM"];
    }
  }

  /** Get last N completed runs that have variants for the given symbol. */
  async getRecentRunsForSymbol(
    symbol: string,
    limit: number = WINDOW,
  ): Promise<Array<{ id: string }>> {
    const runs = await this.prisma.simulationRun.findMany({
      where: {
        status: "COMPLETED",
        runVariants: { some: { assetSymbol: symbol } },
      },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: { id: true },
    });
    return runs;
  }

  /** Compute per-run crowd mix (buyPct, sellPct, holdPct) for a run+symbol. */
  async computePerRunCrowdMix(
    runId: string,
    symbol: string,
  ): Promise<CrowdMix | null> {
    const variants = await this.prisma.runVariant.findMany({
      where: { runId, assetSymbol: symbol },
      select: {
        summary: { select: { debugDecisionCounts: true } },
      },
    });

    let BUY = 0;
    let SELL = 0;
    let HOLD = 0;

    for (const v of variants) {
      const raw = v.summary?.debugDecisionCounts as
        | { BUY?: number; SELL?: number; HOLD?: number; OTHER?: number }
        | null
        | undefined;
      if (raw) {
        BUY += typeof raw.BUY === "number" ? raw.BUY : 0;
        SELL += typeof raw.SELL === "number" ? raw.SELL : 0;
        HOLD += typeof raw.HOLD === "number" ? raw.HOLD : 0;
      }
    }

    if (BUY + SELL + HOLD > 0) {
      const total = BUY + SELL + HOLD;
      return {
        buyPct: BUY / total,
        sellPct: SELL / total,
        holdPct: HOLD / total,
      };
    }

    const decisionCount = await this.prisma.agentDecision.count({
      where: {
        runId,
        assetSymbol: symbol,
      },
    });
    if (decisionCount === 0) return null;

    const agg = await this.prisma.agentDecision.groupBy({
      by: ["action"],
      where: { runId, assetSymbol: symbol },
      _count: { id: true },
    });

    let buyCount = 0;
    let sellCount = 0;
    let holdCount = 0;
    for (const g of agg) {
      if (g.action === "BUY") buyCount = g._count.id;
      else if (g.action === "SELL") sellCount = g._count.id;
      else if (g.action === "HOLD") holdCount = g._count.id;
    }
    const total = buyCount + sellCount + holdCount;
    if (total <= 0) return null;

    return {
      buyPct: buyCount / total,
      sellPct: sellCount / total,
      holdPct: holdCount / total,
    };
  }

  /** Compute rolling signal for a symbol from a list of runs. */
  async computeRollingSignal(
    symbol: string,
    runs: Array<{ id: string }>,
  ): Promise<SignalItem | null> {
    if (runs.length === 0) return null;

    const mixes: CrowdMix[] = [];
    for (const r of runs) {
      const mix = await this.computePerRunCrowdMix(r.id, symbol);
      if (mix) mixes.push(mix);
    }

    if (mixes.length === 0) return null;

    const avgBuyPct =
      mixes.reduce((s, m) => s + m.buyPct, 0) / mixes.length;
    const avgSellPct =
      mixes.reduce((s, m) => s + m.sellPct, 0) / mixes.length;
    const avgHoldPct =
      mixes.reduce((s, m) => s + m.holdPct, 0) / mixes.length;

    let signal: CrowdSignal = "NEUTRAL";
    if (avgBuyPct >= 0.65) signal = "STRONG_BUY";
    else if (avgBuyPct >= 0.55) signal = "BUY";
    else if (avgSellPct >= 0.65) signal = "STRONG_SELL";
    else if (avgSellPct >= 0.55) signal = "SELL";

    const confidence = Math.max(avgBuyPct, avgSellPct, avgHoldPct);
    const disagreement = Math.max(0, 1 - confidence);

    const dominantShares = mixes.map((m) =>
      Math.max(m.buyPct, m.sellPct, m.holdPct),
    );
    const sd = stdDev(dominantShares);
    const instability = Math.min(1, Math.max(0, sd * 2));

    return {
      symbol,
      signal,
      confidence,
      disagreement,
      instability,
      runsUsed: mixes.length,
    };
  }

  /** Compute latest signals for given symbols (or strategy defaults). */
  async getLatestSignals(symbolsInput?: string | null): Promise<LatestSignalsResponse> {
    try {
      const symbols = this.resolveSymbols(symbolsInput);
      const signals: SignalItem[] = [];

      for (const symbol of symbols) {
        try {
          const runs = await this.getRecentRunsForSymbol(symbol, WINDOW);
          const item = await this.computeRollingSignal(symbol, runs);
          if (item) signals.push(item);
        } catch {
          /* skip symbol on error */
        }
      }

      return { window: WINDOW, signals };
    } catch {
      return { window: WINDOW, signals: [] };
    }
  }

  /** Get crowd signals for dashboard summary (returns empty items on error). */
  async getCrowdSignalsForSummary(symbols: string[]): Promise<{
    window: number;
    items: SignalItem[];
  }> {
    if (!symbols || symbols.length === 0) {
      return { window: WINDOW, items: [] };
    }
    try {
      const { window, signals } = await this.getLatestSignals(
        symbols.join(","),
      );
      return { window, items: Array.isArray(signals) ? signals : [] };
    } catch {
      return { window: WINDOW, items: [] };
    }
  }

  /** Create snapshot: compute latest signals and persist to SignalHistory. */
  async createSnapshot(symbolsInput?: string[]): Promise<{
    ok: boolean;
    created: number;
    window: number;
    items: Array<{
      symbol: string;
      signal: string;
      confidence: number;
      disagreement: number;
      instability: number;
      runsUsed: number;
      createdAt: string;
    }>;
  }> {
    const symbols = symbolsInput?.length
      ? symbolsInput
      : this.resolveSymbols(null);
    let datasetVersion: string | null = null;
    try {
      const ds = await this.marketDataService.getDataSourceInfo();
      datasetVersion = ds.datasetVersion ?? null;
    } catch {
      /* keep null */
    }
    let strategyProfile: string | null = null;
    let aggregationMode: string | null = null;
    let selectionPolicy: string | null = null;
    try {
      const p = this.strategyProfilesService.getActiveProfile();
      strategyProfile = p.key ?? null;
      aggregationMode = p.aggregationMode ?? null;
      selectionPolicy = p.selectionPolicy ?? null;
    } catch {
      /* keep null */
    }

    const { window, signals } = await this.getLatestSignals(symbols.join(","));
    const created: Array<{
      symbol: string;
      signal: string;
      confidence: number;
      disagreement: number;
      instability: number;
      runsUsed: number;
      createdAt: string;
    }> = [];

    for (const s of signals) {
      const row = await this.prisma.signalHistory.create({
        data: {
          symbol: s.symbol,
          signal: s.signal,
          confidence: s.confidence,
          disagreement: s.disagreement,
          instability: s.instability,
          runsUsed: s.runsUsed,
          windowSize: window,
          sourceRunId: null,
          datasetVersion,
          strategyProfile,
          aggregationMode,
          selectionPolicy,
        },
      });
      created.push({
        symbol: row.symbol,
        signal: row.signal,
        confidence: row.confidence,
        disagreement: row.disagreement,
        instability: row.instability,
        runsUsed: row.runsUsed,
        createdAt: row.createdAt.toISOString(),
      });
    }

    return { ok: true, created: created.length, window, items: created };
  }

  /** Get signal history, newest first. */
  async getHistory(
    symbolsInput?: string,
    limit: number = 50,
  ): Promise<{
    items: Array<{
      id: string;
      symbol: string;
      signal: string;
      confidence: number;
      disagreement: number;
      instability: number;
      runsUsed: number;
      windowSize: number;
      datasetVersion: string | null;
      strategyProfile: string | null;
      aggregationMode: string | null;
      selectionPolicy: string | null;
      createdAt: string;
    }>;
  }> {
    const symbols = symbolsInput?.trim()
      ? symbolsInput
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : null;

    const rows = await this.prisma.signalHistory.findMany({
      where: symbols?.length ? { symbol: { in: symbols } } : undefined,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
      select: {
        id: true,
        symbol: true,
        signal: true,
        confidence: true,
        disagreement: true,
        instability: true,
        runsUsed: true,
        windowSize: true,
        datasetVersion: true,
        strategyProfile: true,
        aggregationMode: true,
        selectionPolicy: true,
        createdAt: true,
      },
    });

    return {
      items: rows.map((r) => ({
        id: r.id,
        symbol: r.symbol,
        signal: r.signal,
        confidence: r.confidence,
        disagreement: r.disagreement,
        instability: r.instability,
        runsUsed: r.runsUsed,
        windowSize: r.windowSize,
        datasetVersion: r.datasetVersion,
        strategyProfile: r.strategyProfile,
        aggregationMode: r.aggregationMode,
        selectionPolicy: r.selectionPolicy,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /** Map signal to expected direction. */
  private signalToDirection(signal: string): RealizedDirection | null {
    if (signal === "STRONG_BUY" || signal === "BUY") return "UP";
    if (signal === "STRONG_SELL" || signal === "SELL") return "DOWN";
    if (signal === "NEUTRAL") return "FLAT";
    return null;
  }

  /** Get validation: compare signal history vs realized market moves. */
  async getValidation(
    symbolsInput?: string,
    limit: number = 50,
  ): Promise<{
    summary: { total: number; validated: number; accuracyRate: number | null };
    items: Array<{
      symbol: string;
      signal: string;
      createdAt: string;
      realizedDirection: "UP" | "DOWN" | "FLAT" | null;
      correct: boolean | null;
      confidence: number;
      instability: number;
    }>;
  }> {
    const { items } = await this.getHistory(symbolsInput, limit);
    const validatedItems: Array<{
      symbol: string;
      signal: string;
      createdAt: string;
      realizedDirection: "UP" | "DOWN" | "FLAT" | null;
      correct: boolean | null;
      confidence: number;
      instability: number;
    }> = [];

    let validated = 0;
    let correct = 0;

    for (const h of items) {
      let realizedDirection: "UP" | "DOWN" | "FLAT" | null = null;
      let correctVal: boolean | null = null;

      try {
        const latestDs = await this.marketDataService.getLatestDataset();
        const datasetVersion = latestDs?.datasetVersion ?? null;
        const where: { symbol: string; datasetVersion?: string } = { symbol: h.symbol };
        if (datasetVersion) where.datasetVersion = datasetVersion;

        const prices = await this.prisma.marketPrice.findMany({
          where,
          orderBy: { timestamp: "asc" },
          select: { timestamp: true, close: true },
        });
        const createdAt = new Date(h.createdAt);
        const atOrBefore = prices.filter((p) => p.timestamp <= createdAt);
        const current = atOrBefore.length > 0 ? atOrBefore[atOrBefore.length - 1]! : null;
        if (current) {
          const afterCurrent = prices.filter((p) => p.timestamp > current.timestamp);
          const next = afterCurrent.length > 0 ? afterCurrent[0]! : null;
          if (next) {
            if (next.close > current.close) realizedDirection = "UP";
            else if (next.close < current.close) realizedDirection = "DOWN";
            else realizedDirection = "FLAT";

            const expected = this.signalToDirection(h.signal);
            if (expected != null) {
              correctVal = realizedDirection === expected;
              validated++;
              if (correctVal) correct++;
            }
          }
        }
      } catch {
        /* keep nulls */
      }

      validatedItems.push({
        symbol: h.symbol,
        signal: h.signal,
        createdAt: h.createdAt,
        realizedDirection,
        correct: correctVal,
        confidence: h.confidence,
        instability: h.instability,
      });
    }

    return {
      summary: {
        total: items.length,
        validated,
        accuracyRate: validated > 0 ? correct / validated : null,
      },
      items: validatedItems,
    };
  }

  /**
   * Derive synthetic crowd mix from rolling momentum (market prices only).
   * Used for historical backfill when run-based signals are not available.
   */
  private deriveSyntheticCrowdMixFromPrices(
    prices: Array<{ close: number }>,
    lookback: number = 5,
  ): { buyPct: number; sellPct: number; holdPct: number; instability: number } | null {
    if (prices.length < 2 || lookback < 1) return null;
    const closes = prices.map((p) => p.close);
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const prev = closes[i - 1]!;
      if (prev === 0) continue;
      returns.push((closes[i]! - prev) / prev);
    }
    if (returns.length === 0) return null;
    const recent = returns.slice(-lookback);
    const momentum = recent.reduce((a, b) => a + b, 0) / recent.length;
    const momSd = stdDev(recent);
    const instability = Math.min(1, Math.max(0, momSd * 5));

    let buyPct: number;
    let sellPct: number;
    let holdPct: number;
    if (momentum > 0.02) {
      buyPct = 0.65;
      sellPct = 0.15;
      holdPct = 0.2;
    } else if (momentum > 0.01) {
      buyPct = 0.55;
      sellPct = 0.2;
      holdPct = 0.25;
    } else if (momentum < -0.02) {
      buyPct = 0.15;
      sellPct = 0.65;
      holdPct = 0.2;
    } else if (momentum < -0.01) {
      buyPct = 0.2;
      sellPct = 0.55;
      holdPct = 0.25;
    } else {
      buyPct = 0.33;
      sellPct = 0.33;
      holdPct = 0.34;
    }

    return { buyPct, sellPct, holdPct, instability };
  }

  /**
   * Map crowd mix to 5-level signal (same thresholds as computeRollingSignal).
   */
  private mixToSignal(buyPct: number, sellPct: number): CrowdSignal {
    if (buyPct >= 0.65) return "STRONG_BUY";
    if (buyPct >= 0.55) return "BUY";
    if (sellPct >= 0.65) return "STRONG_SELL";
    if (sellPct >= 0.55) return "SELL";
    return "NEUTRAL";
  }

  /** Backfill historical signal snapshots from market prices. Idempotent. */
  async backfill(opts?: {
    symbols?: string[];
    window?: number;
    maxSnapshotsPerSymbol?: number;
  }): Promise<{
    ok: boolean;
    window: number;
    symbols: string[];
    created: number;
    skippedExisting: number;
    itemsPerSymbol: Record<string, { created: number; skippedExisting: number }>;
  }> {
    const symbols =
      opts?.symbols?.length ? opts.symbols : this.resolveSymbols(null);
    const window = Math.max(1, Math.min(opts?.window ?? WINDOW, 100));
    const maxSnapshots = Math.max(1, Math.min(opts?.maxSnapshotsPerSymbol ?? 30, 200));

    let datasetVersion: string | null = null;
    try {
      const ds = await this.marketDataService.getLatestDataset();
      datasetVersion = ds?.datasetVersion ?? null;
    } catch {
      /* no market data */
    }
    if (!datasetVersion) {
      return {
        ok: true,
        window,
        symbols,
        created: 0,
        skippedExisting: 0,
        itemsPerSymbol: Object.fromEntries(symbols.map((s) => [s, { created: 0, skippedExisting: 0 }])),
      };
    }

    let strategyProfile: string | null = null;
    let aggregationMode: string | null = null;
    let selectionPolicy: string | null = null;
    try {
      const p = this.strategyProfilesService.getActiveProfile();
      strategyProfile = p.key ?? null;
      aggregationMode = p.aggregationMode ?? null;
      selectionPolicy = p.selectionPolicy ?? null;
    } catch {
      /* keep null */
    }

    let totalCreated = 0;
    let totalSkipped = 0;
    const itemsPerSymbol: Record<string, { created: number; skippedExisting: number }> = {};

    for (const symbol of symbols) {
      let created = 0;
      let skipped = 0;

      const allPrices = await this.prisma.marketPrice.findMany({
        where: { symbol, datasetVersion },
        orderBy: { timestamp: "desc" },
        take: maxSnapshots + 50,
        select: { timestamp: true, close: true },
      });
      if (allPrices.length < 2) {
        itemsPerSymbol[symbol] = { created: 0, skippedExisting: 0 };
        continue;
      }

      const evalTimestamps = allPrices.slice(0, maxSnapshots).map((p) => p.timestamp);

      for (const evalTs of evalTimestamps) {
        const pricesUpToT = await this.prisma.marketPrice.findMany({
          where: { symbol, datasetVersion, timestamp: { lte: evalTs } },
          orderBy: { timestamp: "asc" },
          select: { timestamp: true, close: true },
        });
        const mix = this.deriveSyntheticCrowdMixFromPrices(pricesUpToT, 5);
        if (!mix) continue;

        const { buyPct, sellPct, holdPct, instability: inst } = mix;
        const signal = this.mixToSignal(buyPct, sellPct);
        const confidence = Math.max(buyPct, sellPct, holdPct);
        const disagreement = Math.max(0, 1 - confidence);

        const existing = await this.prisma.signalHistory.findFirst({
          where: {
            symbol,
            createdAt: evalTs,
            windowSize: window,
            strategyProfile: strategyProfile ?? null,
            aggregationMode: aggregationMode ?? null,
            selectionPolicy: selectionPolicy ?? null,
          },
        });
        if (existing) {
          skipped++;
          continue;
        }

        await this.prisma.signalHistory.create({
          data: {
            symbol,
            signal,
            confidence,
            disagreement,
            instability: inst,
            runsUsed: window,
            windowSize: window,
            sourceRunId: null,
            datasetVersion,
            strategyProfile,
            aggregationMode,
            selectionPolicy,
            createdAt: evalTs,
          },
        });
        created++;
      }

      itemsPerSymbol[symbol] = { created, skippedExisting: skipped };
      totalCreated += created;
      totalSkipped += skipped;
    }

    return {
      ok: true,
      window,
      symbols,
      created: totalCreated,
      skippedExisting: totalSkipped,
      itemsPerSymbol,
    };
  }

  /** Get signal history stats for dashboard (totalSnapshots, symbolsCovered). */
  async getSignalHistoryStats(): Promise<{
    totalSnapshots: number;
    symbolsCovered: number;
  }> {
    const [count, symbols] = await Promise.all([
      this.prisma.signalHistory.count(),
      this.prisma.signalHistory.findMany({
        select: { symbol: true },
        distinct: ["symbol"],
      }),
    ]);
    return {
      totalSnapshots: count,
      symbolsCovered: symbols.length,
    };
  }

  /** Get signal validation for dashboard summary (never throws). */
  async getSignalValidationForSummary(symbols: string[]): Promise<{
    total: number;
    validated: number;
    accuracyRate: number | null;
    latestItems: Array<{
      symbol: string;
      signal: string;
      realizedDirection: "UP" | "DOWN" | "FLAT" | null;
      correct: boolean | null;
      confidence: number;
    }>;
  }> {
    try {
      const { summary, items } = await this.getValidation(
        symbols.join(","),
        20,
      );
      return {
        total: summary.total,
        validated: summary.validated,
        accuracyRate: summary.accuracyRate,
        latestItems: items.slice(0, 10).map((i) => ({
          symbol: i.symbol,
          signal: i.signal,
          realizedDirection: i.realizedDirection,
          correct: i.correct,
          confidence: i.confidence,
        })),
      };
    } catch {
      return {
        total: 0,
        validated: 0,
        accuracyRate: null,
        latestItems: [],
      };
    }
  }
}
