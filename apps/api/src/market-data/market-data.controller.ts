import { Body, Controller, Get, Post } from "@nestjs/common";
import { MarketDataService } from "./market-data.service";

@Controller("market-data")
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

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
