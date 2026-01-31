import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { listArchetypeProfilesResponseSchema } from "@crowdvest/shared";
import { PrismaService } from "../prisma/prisma.service";
import { DatasetsService } from "../datasets/datasets.service";

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

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
      const parsed = listArchetypeProfilesResponseSchema.safeParse(result);
      if (!parsed.success) {
        this.logger.warn("Archetype profiles response validation failed", parsed.error.flatten());
        throw new InternalServerErrorException("An error occurred while processing the request.");
      }
      return parsed.data;
    }
    const [items, total] = await Promise.all([
      this.prisma.archetypeTraitProfile.findMany({
        take: limit,
        skip: offset,
        orderBy: [{ archetypeId: "asc" }, { traitDefinitionId: "asc" }],
      }),
      this.prisma.archetypeTraitProfile.count(),
    ]);
    const result = { items, total };
    const parsed = listArchetypeProfilesResponseSchema.safeParse(result);
    if (!parsed.success) {
      this.logger.warn("Archetype profiles response validation failed", parsed.error.flatten());
      throw new InternalServerErrorException("An error occurred while processing the request.");
    }
    return parsed.data;
  }
}
