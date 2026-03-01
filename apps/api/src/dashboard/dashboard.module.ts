import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { JobsModule } from "../jobs/jobs.module";

@Module({
  imports: [JobsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
