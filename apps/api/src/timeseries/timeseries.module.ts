import { Module } from "@nestjs/common";
import { TimeseriesService } from "./timeseries.service";

@Module({
  providers: [TimeseriesService],
  exports: [TimeseriesService],
})
export class TimeseriesModule {}
