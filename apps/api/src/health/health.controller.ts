import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get("health")
  get() {
    return { ok: true };
  }
}
