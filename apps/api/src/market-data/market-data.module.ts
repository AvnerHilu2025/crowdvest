import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { MarketDataController } from "./market-data.controller";
import { MarketDataService } from "./market-data.service";

@Module({
  imports: [PrismaModule],
  controllers: [MarketDataController],
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
