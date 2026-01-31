import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { listRunsResponseSchema } from "@crowdvest/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RunsService {
  private readonly logger = new Logger(RunsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(limit: number, offset: number) {
    const [items, total] = await Promise.all([
      this.prisma.simulationRun.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.simulationRun.count(),
    ]);
    const result = { items, total };
    const parsed = listRunsResponseSchema.safeParse(result);
    if (!parsed.success) {
      this.logger.warn("Runs response validation failed", parsed.error.flatten());
      throw new InternalServerErrorException("An error occurred while processing the request.");
    }
    return parsed.data;
  }
}
