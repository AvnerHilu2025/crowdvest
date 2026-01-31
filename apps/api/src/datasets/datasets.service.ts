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
}
