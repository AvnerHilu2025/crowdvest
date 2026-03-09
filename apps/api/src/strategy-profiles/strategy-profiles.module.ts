import { forwardRef, Module } from "@nestjs/common";
import { BenchModule } from "../bench/bench.module";
import { StrategyProfilesController } from "./strategy-profiles.controller";
import { StrategyProfilesService } from "./strategy-profiles.service";

@Module({
  imports: [forwardRef(() => BenchModule)],
  controllers: [StrategyProfilesController],
  providers: [StrategyProfilesService],
  exports: [StrategyProfilesService],
})
export class StrategyProfilesModule {}
