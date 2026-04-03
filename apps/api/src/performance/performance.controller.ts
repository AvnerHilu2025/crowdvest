import { BadRequestException, Controller, Get, Param } from "@nestjs/common";
import { PerformanceService } from "./performance.service";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller("runs")
export class PerformanceController {
  constructor(private readonly service: PerformanceService) {}

  /** GET /runs/:runId/performance — reads `RunAccuracy` (populate via GET /runs/:id/accuracy on a COMPLETED run). */
  @Get(":runId/performance")
  async getPerformance(@Param("runId") runId: string) {
    const id = runId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) {
      throw new BadRequestException("run id must be a UUID");
    }
    return this.service.getRunPerformance(id);
  }
}
