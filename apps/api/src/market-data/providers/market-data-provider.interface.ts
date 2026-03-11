export interface ProviderPricePoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ProviderPricePayload {
  symbol: string;
  provider: string;
  timestamp: string;
  prices: ProviderPricePoint[];
}

export interface MarketDataProvider {
  name: string;
  fetchPrices(symbol: string, points: number): Promise<ProviderPricePayload>;
}
