import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ForecastModule } from "../forecast/forecast.module";
import { ResultsModule } from "../results/results.module";
import { AccuracyService } from "./accuracy.service";
import { AccuracyController } from "./accuracy.controller";
import { VariantsController } from "./variants.controller";

@Module({
  imports: [PrismaModule, ForecastModule, ResultsModule],
  controllers: [AccuracyController, VariantsController],
  providers: [AccuracyService],
  exports: [AccuracyService],
})
export class AnalyticsModule {}
