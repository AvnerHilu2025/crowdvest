import { Module } from "@nestjs/common";
import { ForecastService } from "./forecast.service";

@Module({
  providers: [ForecastService],
  exports: [ForecastService],
})
export class ForecastModule {}
