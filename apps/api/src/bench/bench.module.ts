import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RunsModule } from "../runs/runs.module";
import { JobsModule } from "../jobs/jobs.module";
import { ForecastModule } from "../forecast/forecast.module";
import { BenchController } from "./bench.controller";
import { BenchService } from "./bench.service";
import { BenchWindowsSnapshotsController } from "./bench-windows-snapshots.controller";

@Module({
  imports: [PrismaModule, RunsModule, JobsModule, ForecastModule],
  controllers: [BenchController, BenchWindowsSnapshotsController],
  providers: [BenchService],
})
export class BenchModule {}
