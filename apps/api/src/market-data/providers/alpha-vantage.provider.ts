export interface AlphaVantagePriceRow {
  symbol: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

const TIME_SERIES_KEY = "Time Series (Daily)" as const;

interface AlphaVantageDailyEntry {
  "1. open": string;
  "2. high": string;
  "3. low": string;
  "4. close": string;
  "5. volume": string;
}

/** Alpha Vantage provider for daily price data (free endpoint). */
export class AlphaVantageProvider {
  private readonly baseUrl = "https://www.alphavantage.co/query";

  constructor(private readonly apiKey: string) {
    if (!apiKey?.trim()) {
      throw new Error("Alpha Vantage API key is required");
    }
  }

  async fetchDailySeries(symbol: string): Promise<AlphaVantagePriceRow[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("function", "TIME_SERIES_DAILY");
    url.searchParams.set("symbol", symbol);
    // Alpha Vantage free tier supports compact output only in this integration.
    url.searchParams.set("outputsize", "compact");
    url.searchParams.set("apikey", this.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Alpha Vantage API error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as Record<string, unknown>;

    const err = json["Error Message"] as string | undefined;
    if (err) {
      throw new Error(`Alpha Vantage error: ${err}`);
    }

    const info = json["Information"] as string | undefined;
    if (info) {
      throw new Error(`Alpha Vantage: ${info}`);
    }

    const note = json["Note"] as string | undefined;
    if (note) {
      throw new Error(`Alpha Vantage: ${note}`);
    }

    const timeSeries = json[TIME_SERIES_KEY] as Record<string, AlphaVantageDailyEntry> | undefined;
    if (!timeSeries || typeof timeSeries !== "object") {
      throw new Error("Alpha Vantage: missing Time Series (Daily) in response");
    }

    const rows: AlphaVantagePriceRow[] = [];

    for (const [dateStr, entry] of Object.entries(timeSeries)) {
      if (!entry || typeof entry !== "object") continue;

      const open = parseFloat(entry["1. open"]);
      const high = parseFloat(entry["2. high"]);
      const low = parseFloat(entry["3. low"]);
      const close = parseFloat(entry["4. close"]);
      const volumeRaw = entry["5. volume"];
      const volume = volumeRaw != null ? parseInt(String(volumeRaw), 10) : null;

      if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        continue;
      }

      const timestamp = new Date(dateStr);
      if (Number.isNaN(timestamp.getTime())) continue;

      rows.push({
        symbol,
        timestamp,
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : null,
      });
    }

    rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return rows;
  }
}
