import { Module } from "@nestjs/common";
import { ResultsModule } from "../results/results.module";
import { TimeseriesModule } from "../timeseries/timeseries.module";
import { RunsController } from "./runs.controller";
import { RunsService } from "./runs.service";

@Module({
  imports: [ResultsModule, TimeseriesModule],
  controllers: [RunsController],
  providers: [RunsService],
})
export class RunsModule {}
