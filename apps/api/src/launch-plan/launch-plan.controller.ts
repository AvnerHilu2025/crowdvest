import { Controller, Get } from "@nestjs/common";
import { LaunchPlanService } from "./launch-plan.service";

@Controller("launch-plan")
export class LaunchPlanController {
  constructor(private readonly launchPlanService: LaunchPlanService) {}

  /** GET /launch-plan — fully resolved launch plan for the product right now */
  @Get()
  getLaunchPlan() {
    return this.launchPlanService.getLaunchPlan();
  }
}
