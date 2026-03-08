import { Module } from "@nestjs/common";
import { StrategyProfilesController } from "./strategy-profiles.controller";
import { StrategyProfilesService } from "./strategy-profiles.service";

@Module({
  controllers: [StrategyProfilesController],
  providers: [StrategyProfilesService],
  exports: [StrategyProfilesService],
})
export class StrategyProfilesModule {}
