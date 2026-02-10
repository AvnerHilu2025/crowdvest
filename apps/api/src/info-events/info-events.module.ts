import { Module } from "@nestjs/common";
import { InfoEventsController } from "./info-events.controller";
import { InfoEventsFlatController } from "./info-events-flat.controller";
import { InfoEventsService } from "./info-events.service";

@Module({
  controllers: [InfoEventsController, InfoEventsFlatController],
  providers: [InfoEventsService],
})
export class InfoEventsModule {}
