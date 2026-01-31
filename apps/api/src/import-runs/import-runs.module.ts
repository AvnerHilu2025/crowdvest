import { Module } from "@nestjs/common";
import { ImportRunsController } from "./import-runs.controller";
import { ImportRunsService } from "./import-runs.service";

@Module({
  controllers: [ImportRunsController],
  providers: [ImportRunsService],
})
export class ImportRunsModule {}
