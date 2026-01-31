import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { listTraitsResponseSchema } from "@crowdvest/shared";
import { PrismaService } from "../prisma/prisma.service";
import { DatasetsService } from "../datasets/datasets.service";

@Injectable()
export class TraitsService {
  private readonly logger = new Logger(TraitsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly datasetsService: DatasetsService,
  ) {}

  async findAll(limit: number, offset: number, datasetVersion?: string) {
    const effectiveVersion =
      datasetVersion != null && datasetVersion !== ""
        ? datasetVersion
        : await this.datasetsService.getLatestDatasetVersion();
    const latest = await this.datasetsService.getLatestDatasetVersion();
    if (effectiveVersion != null && latest != null && effectiveVersion !== latest) {
      const result = { items: [], total: 0 };
      const parsed = listTraitsResponseSchema.safeParse(result);
      if (!parsed.success) {
        this.logger.warn("Traits response validation failed", parsed.error.flatten());
        throw new InternalServerErrorException("An error occurred while processing the request.");
      }
      return parsed.data;
    }
    const [items, total] = await Promise.all([
      this.prisma.traitDefinition.findMany({
        take: limit,
        skip: offset,
        orderBy: { key: "asc" },
      }),
      this.prisma.traitDefinition.count(),
    ]);
    const result = { items, total };
    const parsed = listTraitsResponseSchema.safeParse(result);
    if (!parsed.success) {
      this.logger.warn("Traits response validation failed", parsed.error.flatten());
      throw new InternalServerErrorException("An error occurred while processing the request.");
    }
    return parsed.data;
  }
}
