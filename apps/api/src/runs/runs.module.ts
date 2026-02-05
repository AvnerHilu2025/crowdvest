import { Module } from "@nestjs/common";
import { ResultsModule } from "../results/results.module";
import { RunsController } from "./runs.controller";
import { RunsService } from "./runs.service";

@Module({
  imports: [ResultsModule],
  controllers: [RunsController],
  providers: [RunsService],
})
export class RunsModule {}
