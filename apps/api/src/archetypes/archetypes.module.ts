import { Module } from "@nestjs/common";
import { ArchetypesController } from "./archetypes.controller";
import { ArchetypesService } from "./archetypes.service";
import { DatasetsModule } from "../datasets/datasets.module";

@Module({
  imports: [DatasetsModule],
  controllers: [ArchetypesController],
  providers: [ArchetypesService],
})
export class ArchetypesModule {}
