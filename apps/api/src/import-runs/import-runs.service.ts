import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { listImportRunsResponseSchema } from "@crowdvest/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ImportRunsService {
  private readonly logger = new Logger(ImportRunsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(limit: number, offset: number) {
    const [items, total] = await Promise.all([
      this.prisma.importRun.findMany({
        take: limit,
        skip: offset,
        orderBy: { startedAt: "desc" },
      }),
      this.prisma.importRun.count(),
    ]);
    const result = { items, total };
    const parsed = listImportRunsResponseSchema.safeParse(result);
    if (!parsed.success) {
      this.logger.warn("Import runs response validation failed", parsed.error.flatten());
      throw new InternalServerErrorException("An error occurred while processing the request.");
    }
    return parsed.data;
  }
}
