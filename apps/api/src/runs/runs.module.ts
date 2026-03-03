import { Module } from "@nestjs/common";
import { ForecastModule } from "../forecast/forecast.module";
import { JobsModule } from "../jobs/jobs.module";
import { ResultsModule } from "../results/results.module";
import { TimeseriesModule } from "../timeseries/timeseries.module";
import { RunsController } from "./runs.controller";
import { RunsService } from "./runs.service";

@Module({
  imports: [ResultsModule, TimeseriesModule, JobsModule, ForecastModule],
  controllers: [RunsController],
  providers: [RunsService],
  exports: [RunsService],
})
export class RunsModule {}
