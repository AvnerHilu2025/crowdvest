/**
 * POST /datasets/price-series body.
 * CSV format: date (YYYY-MM-DD), close (number).
 */
export class UploadPriceSeriesDto {
  symbol!: string;
  points!: { date: string; close: number }[];
}
