import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { listDatasetsResponseSchema } from "@crowdvest/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DatasetsService {
  private readonly logger = new Logger(DatasetsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDatasets() {
    const runs = await this.prisma.simulationRun.findMany({
      select: { datasetVersion: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const byVersion = new Map<string, Date>();
    for (const r of runs) {
      if (!byVersion.has(r.datasetVersion)) {
        byVersion.set(r.datasetVersion, r.createdAt);
      }
    }
    const items = Array.from(byVersion.entries()).map(([datasetVersion, createdAt]) => ({
      datasetVersion,
      createdAt,
    }));
    const result = { items };
    const parsed = listDatasetsResponseSchema.safeParse(result);
    if (!parsed.success) {
      this.logger.warn("Datasets response validation failed", parsed.error.flatten());
      throw new InternalServerErrorException("An error occurred while processing the request.");
    }
    return parsed.data;
  }

  async getLatestDatasetVersion(): Promise<string | null> {
    const run = await this.prisma.simulationRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: { datasetVersion: true },
    });
    return run?.datasetVersion ?? null;
  }

  /** Ingest price series (date, close) for a symbol. Upserts PriceSeriesPoint by (symbol, date). */
  async uploadPriceSeries(symbol: string, points: { date: string; close: number }[]): Promise<{ symbol: string; upserted: number }> {
    const sym = (symbol ?? "").trim().toUpperCase() || "SPY";
    if (points.length === 0) {
      return { symbol: sym, upserted: 0 };
    }
    let upserted = 0;
    for (const p of points) {
      const date = String(p.date ?? "").trim();
      const close = Number(p.close);
      if (!date || !Number.isFinite(close) || close <= 0) continue;
      await this.prisma.priceSeriesPoint.upsert({
        where: {
          symbol_date: { symbol: sym, date },
        },
        create: { symbol: sym, date, close },
        update: { close },
      });
      upserted++;
    }
    return { symbol: sym, upserted };
  }
}
