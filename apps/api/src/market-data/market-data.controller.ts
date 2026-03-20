import { Body, Controller, Get, Post } from "@nestjs/common";
import { MarketDataService } from "./market-data.service";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Controller("market-data")
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  /** POST /market-data/import-alpha — ingest daily adjusted prices from Alpha Vantage */
  @Post("import-alpha")
  async importAlpha(@Body() body: { symbols?: string[] }) {
    const symbols = Array.isArray(body?.symbols)
      ? body.symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean).slice(0, 10)
      : ["SPY", "QQQ", "IWM"];

    if (symbols.length === 0) {
      return { ok: false, error: "symbols must be a non-empty array" };
    }

    const imported: Record<string, number> = {};
    const failed: Record<string, string> = {};

    // Alpha Vantage free tier requires paced sequential requests.
    for (let i = 0; i < symbols.length; i++) {
      if (i > 0) await sleep(1200);

      const symbol = symbols[i]!;
      try {
        const rows = await this.marketDataService.importFromAlphaVantage(symbol);
        imported[symbol] = rows;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        failed[symbol] = msg;
        return {
          ok: false,
          partial: Object.keys(imported).length > 0,
          imported,
          failed,
        };
      }
    }

    return { ok: true, imported };
  }

  /** POST /market-data/import — ingest market data from provider */
  @Post("import")
  async import(@Body() body: { provider?: string; symbols?: string[]; points?: number }) {
    const provider = (body?.provider ?? "dummy").trim();
    const symbols = Array.isArray(body?.symbols)
      ? body.symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean).slice(0, 10)
      : ["SPY", "QQQ", "IWM"];
    const points = Math.min(Math.max(2, Number(body?.points) || 29), 365);

    if (symbols.length === 0) {
      return { ok: false, error: "symbols must be a non-empty array" };
    }

    return this.marketDataService.importFromProvider({ provider, symbols, points });
  }

  /** GET /market-data/datasets/latest — latest ingested dataset */
  @Get("datasets/latest")
  async getLatestDataset() {
    const result = await this.marketDataService.getLatestDataset();
    return result ?? { datasetVersion: null, symbols: [], rows: 0, createdAt: null };
  }
}
