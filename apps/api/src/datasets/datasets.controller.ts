import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { DatasetsService } from "./datasets.service";
import { UploadPriceSeriesDto } from "./upload-price-series.dto";

@Controller()
export class DatasetsController {
  constructor(private readonly datasetsService: DatasetsService) {}

  @Get("datasets")
  async getDatasets() {
    return this.datasetsService.getDatasets();
  }

  /** POST /datasets/price-series — ingest price series (JSON). Body: { symbol: string, points: [{ date: "YYYY-MM-DD", close: number }] }. */
  @Post("datasets/price-series")
  @HttpCode(HttpStatus.CREATED)
  async uploadPriceSeries(@Body() body: UploadPriceSeriesDto) {
    const symbol = body?.symbol?.trim();
    const points = Array.isArray(body?.points) ? body.points : [];
    if (!symbol) {
      throw new BadRequestException(["symbol is required"]);
    }
    return this.datasetsService.uploadPriceSeries(symbol, points);
  }
}
