import { Module } from "@nestjs/common";
import { SignalsController } from "./signals.controller";
import { SignalsService } from "./signals.service";
import { StrategyProfilesModule } from "../strategy-profiles/strategy-profiles.module";
import { MarketDataModule } from "../market-data/market-data.module";

@Module({
  imports: [StrategyProfilesModule, MarketDataModule],
  controllers: [SignalsController],
  providers: [SignalsService],
  exports: [SignalsService],
})
export class SignalsModule {}
