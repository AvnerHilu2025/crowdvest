import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { JobsModule } from "../jobs/jobs.module";
import { BenchModule } from "../bench/bench.module";
import { LaunchPlanModule } from "../launch-plan/launch-plan.module";
import { MarketDataModule } from "../market-data/market-data.module";
import { StrategyProfilesModule } from "../strategy-profiles/strategy-profiles.module";
import { SignalsModule } from "../signals/signals.module";

@Module({
  imports: [JobsModule, BenchModule, LaunchPlanModule, MarketDataModule, StrategyProfilesModule, SignalsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
