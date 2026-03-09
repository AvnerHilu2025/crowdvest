import { forwardRef, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RunsModule } from "../runs/runs.module";
import { JobsModule } from "../jobs/jobs.module";
import { ForecastModule } from "../forecast/forecast.module";
import { StrategyProfilesModule } from "../strategy-profiles/strategy-profiles.module";
import { BenchController } from "./bench.controller";
import { BenchService } from "./bench.service";
import { BenchWindowsSnapshotsController } from "./bench-windows-snapshots.controller";

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => RunsModule),
    JobsModule,
    ForecastModule,
    forwardRef(() => StrategyProfilesModule),
  ],
  controllers: [BenchController, BenchWindowsSnapshotsController],
  providers: [BenchService],
  exports: [BenchService],
})
export class BenchModule {}
