import { Module } from "@nestjs/common";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";
import { DatasetsModule } from "../datasets/datasets.module";

@Module({
  imports: [DatasetsModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}
