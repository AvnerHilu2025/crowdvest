import { Module } from "@nestjs/common";
import { TraitsController } from "./traits.controller";
import { TraitsService } from "./traits.service";
import { DatasetsModule } from "../datasets/datasets.module";

@Module({
  imports: [DatasetsModule],
  controllers: [TraitsController],
  providers: [TraitsService],
})
export class TraitsModule {}
