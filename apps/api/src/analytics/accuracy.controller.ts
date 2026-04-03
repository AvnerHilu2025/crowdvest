import { BadRequestException, Controller, Get, Param } from "@nestjs/common";
import { AccuracyService } from "./accuracy.service";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller("analytics")
export class AccuracyController {
  constructor(private readonly accuracyService: AccuracyService) {}

  /**
   * GET /analytics/runs/:runId/prediction-validation
   * Crowd accuracy vs next-step return, naive baselines, and rolling hit rates.
   */
  @Get("runs/:runId/prediction-validation")
  async predictionValidation(@Param("runId") runId: string) {
    const id = runId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) {
      throw new BadRequestException("runId must be a UUID");
    }
    const full = await this.accuracyService.computePredictionValidation(id);
    return {
      accuracy: full.accuracy,
      baseline: {
        buy: full.baseline.buy,
        sell: full.baseline.sell,
        random: full.baseline.random,
      },
      rolling: {
        last5: full.rolling.last5,
        last10: full.rolling.last10,
      },
    };
  }
}
