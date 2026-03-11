import { Module } from "@nestjs/common";
import { BenchModule } from "../bench/bench.module";
import { MarketDataModule } from "../market-data/market-data.module";
import { StrategyProfilesModule } from "../strategy-profiles/strategy-profiles.module";
import { LaunchPlanController } from "./launch-plan.controller";
import { LaunchPlanService } from "./launch-plan.service";

@Module({
  imports: [StrategyProfilesModule, BenchModule, MarketDataModule],
  controllers: [LaunchPlanController],
  providers: [LaunchPlanService],
  exports: [LaunchPlanService],
})
export class LaunchPlanModule {}
