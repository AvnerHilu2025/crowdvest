import { Module } from "@nestjs/common";
import { ForecastModule } from "../forecast/forecast.module";
import { JobsModule } from "../jobs/jobs.module";
import { ResultsModule } from "../results/results.module";
import { StrategyProfilesModule } from "../strategy-profiles/strategy-profiles.module";
import { TimeseriesModule } from "../timeseries/timeseries.module";
import { RunsController } from "./runs.controller";
import { RunsService } from "./runs.service";

@Module({
  imports: [ResultsModule, TimeseriesModule, JobsModule, ForecastModule, StrategyProfilesModule],
  controllers: [RunsController],
  providers: [RunsService],
  exports: [RunsService],
})
export class RunsModule {}
