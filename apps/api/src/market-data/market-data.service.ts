import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { ConfigService } from "../config/config.service";
import { PrismaService } from "../prisma/prisma.service";
import type { ProviderPricePayload } from "./providers/market-data-provider.interface";
import { AlphaVantageProvider } from "./providers/alpha-vantage.provider";
import { DummyMarketProvider } from "./providers/dummy-market.provider";

function computeDatasetVersion(provider: string, symbol: string, points: number, timestamp: string): string {
  const input = `${provider}:${symbol}:${points}:${timestamp}`;
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

function computeDatasetVersionAlphaVantage(
  provider: string,
  symbol: string,
  maxTimestamp: string,
  rowCount: number,
): string {
  const input = `${provider}:${symbol}:${maxTimestamp}:${rowCount}`;
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

@Injectable()
export class MarketDataService {
  private readonly providers = new Map<string, { fetchPrices: (symbol: string, points: number) => Promise<ProviderPricePayload> }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const dummy = new DummyMarketProvider();
    this.providers.set("dummy", { fetchPrices: (s, p) => dummy.fetchPrices(s, p) });
  }

  async importFromProvider(opts: {
    provider: string;
    symbols: string[];
    points: number;
  }): Promise<{ datasetVersion: string; symbols: string[]; rowsInserted: number; provider: string }> {
    const provider = this.providers.get(opts.provider);
    if (!provider) {
      throw new BadRequestException(`Unknown provider: ${opts.provider}. Supported: dummy`);
    }

    const timestamp = new Date().toISOString();
    let totalRows = 0;
    const firstSymbol = opts.symbols[0] ?? "";
    let batchDatasetVersion = "";

    for (const symbol of opts.symbols) {
      const payload = await provider.fetchPrices(symbol, opts.points);
      const dv = computeDatasetVersion(opts.provider, symbol, opts.points, timestamp);
      if (!batchDatasetVersion) batchDatasetVersion = dv;

      await this.prisma.marketDataPayload.create({
        data: {
          provider: opts.provider,
          symbol,
          payloadJson: payload as object,
          datasetVersion: dv,
        },
      });

      const rows = await this.upsertNormalizedPrices(payload, dv);
      totalRows += rows;
    }

    return {
      datasetVersion: batchDatasetVersion || computeDatasetVersion(opts.provider, firstSymbol, opts.points, timestamp),
      symbols: opts.symbols,
      rowsInserted: totalRows,
      provider: opts.provider,
    };
  }

  private async upsertNormalizedPrices(payload: ProviderPricePayload, datasetVersion: string): Promise<number> {
    const data = payload.prices.map((p) => ({
      datasetVersion,
      symbol: payload.symbol,
      timestamp: new Date(p.time),
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
      volume: p.volume ?? null,
    }));

    for (const row of data) {
      await this.prisma.marketPrice.upsert({
        where: {
          datasetVersion_symbol_timestamp: {
            datasetVersion,
            symbol: row.symbol,
            timestamp: row.timestamp,
          },
        },
        create: row,
        update: row,
      });
    }
    return data.length;
  }

  async getLatestDataset(): Promise<{
    datasetVersion: string;
    symbols: string[];
    rows: number;
    createdAt: string;
  } | null> {
    const latest = await this.prisma.marketPrice.findFirst({
      orderBy: { timestamp: "desc" },
      select: { datasetVersion: true, timestamp: true },
    });
    if (!latest) return null;

    const [count, symbolRows] = await Promise.all([
      this.prisma.marketPrice.count({ where: { datasetVersion: latest.datasetVersion } }),
      this.prisma.marketPrice.findMany({
        where: { datasetVersion: latest.datasetVersion },
        select: { symbol: true },
        distinct: ["symbol"],
      }),
    ]);

    const symbols: string[] = symbolRows.map((r: { symbol: string }) => r.symbol);

    return {
      datasetVersion: latest.datasetVersion,
      symbols,
      rows: count,
      createdAt: latest.timestamp.toISOString(),
    };
  }

  hasMarketDataIngestion(): boolean {
    return this.providers.size > 0;
  }

  /** Import daily adjusted prices from Alpha Vantage. */
  async importFromAlphaVantage(symbol: string): Promise<number> {
    const apiKey = this.configService.getAlphaVantageKey();
    if (!apiKey?.trim()) {
      throw new BadRequestException(
        "ALPHAVANTAGE_API_KEY is not set. Add it to .env and restart the API.",
      );
    }

    const provider = new AlphaVantageProvider(apiKey);
    const rows = await provider.fetchDailySeries(symbol);

    if (rows.length === 0) {
      return 0;
    }

    const maxTimestamp = rows.reduce(
      (max, r) => (r.timestamp > max ? r.timestamp : max),
      rows[0]!.timestamp,
    );
    const datasetVersion = computeDatasetVersionAlphaVantage(
      "alphavantage",
      symbol,
      maxTimestamp.toISOString(),
      rows.length,
    );

    await this.prisma.marketDataPayload.create({
      data: {
        provider: "alphavantage",
        symbol,
        payloadJson: { rowCount: rows.length, maxTimestamp: maxTimestamp.toISOString() } as object,
        datasetVersion,
      },
    });

    for (const row of rows) {
      await this.prisma.marketPrice.upsert({
        where: {
          datasetVersion_symbol_timestamp: {
            datasetVersion,
            symbol: row.symbol,
            timestamp: row.timestamp,
          },
        },
        create: {
          datasetVersion,
          symbol: row.symbol,
          timestamp: row.timestamp,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.volume,
        },
        update: {
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.volume,
        },
      });
    }

    return rows.length;
  }

  /** Returns data source info for dashboard/launch plan. */
  async getDataSourceInfo(): Promise<{
    type: "synthetic" | "market-data";
    datasetVersion: string | null;
    provider: string | null;
  }> {
    const latest = await this.getLatestDataset();
    if (latest && latest.rows > 0) {
      const payload = await this.prisma.marketDataPayload.findFirst({
        where: { datasetVersion: latest.datasetVersion },
        select: { provider: true },
      });
      return {
        type: "market-data",
        datasetVersion: latest.datasetVersion,
        provider: payload?.provider ?? null,
      };
    }
    return { type: "synthetic", datasetVersion: null, provider: null };
  }
}
