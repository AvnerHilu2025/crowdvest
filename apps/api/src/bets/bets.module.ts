import { Module } from "@nestjs/common";
import { BetsController } from "./bets.controller";
import { BetsService } from "./bets.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [BetsController],
  providers: [BetsService],
})
export class BetsModule {}
