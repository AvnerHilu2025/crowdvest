import { Module } from "@nestjs/common";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";
import { AgentsGenerateService } from "./agents-generate.service";
import { AgentsV1Service } from "./agents-v1.service";

@Module({
  controllers: [AgentsController],
  providers: [AgentsService, AgentsGenerateService, AgentsV1Service],
})
export class AgentsModule {}
