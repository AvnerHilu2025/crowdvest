import { Controller, Get } from "@nestjs/common";
import { DatasetsService } from "./datasets.service";

@Controller()
export class DatasetsController {
  constructor(private readonly datasetsService: DatasetsService) {}

  @Get("datasets")
  async getDatasets() {
    return this.datasetsService.getDatasets();
  }
}
