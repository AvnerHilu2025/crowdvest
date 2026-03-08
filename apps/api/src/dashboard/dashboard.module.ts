import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { JobsModule } from "../jobs/jobs.module";
import { BenchModule } from "../bench/bench.module";
import { StrategyProfilesModule } from "../strategy-profiles/strategy-profiles.module";

@Module({
  imports: [JobsModule, BenchModule, StrategyProfilesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
