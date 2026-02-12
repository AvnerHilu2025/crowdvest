import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { JobsController } from "./jobs.controller";
import { RunQueueService } from "./run-queue.service";

@Module({
  imports: [PrismaModule],
  controllers: [JobsController],
  providers: [RunQueueService],
  exports: [RunQueueService],
})
export class JobsModule {}
