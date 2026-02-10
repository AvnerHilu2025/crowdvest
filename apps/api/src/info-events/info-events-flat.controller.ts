/**
 * InfoEvents – Flat routes (runId in body/query instead of path).
 * POST /info-events
 * GET /info-events?runId=&assetSymbol=&step=
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { InfoEventsService, normalizeCreatePayload } from "./info-events.service";
import { CreateInfoEventDto } from "./create-info-event.dto";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateRunId(runId: string): string {
  const s = runId?.trim() ?? "";
  if (s === "" || !UUID_REGEX.test(s)) {
    throw new BadRequestException("runId must be a UUID");
  }
  return s;
}

@Controller("info-events")
export class InfoEventsFlatController {
  constructor(private readonly infoEventsService: InfoEventsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(@Body() dto: CreateInfoEventDto) {
    const rid = validateRunId(dto.runId);
    const payload = normalizeCreatePayload({
      assetSymbol: dto.assetSymbol,
      step: dto.step,
      topic: dto.topic,
      type: dto.type,
      sentiment: dto.sentiment,
      credibility: dto.credibility,
      impact: dto.impact,
      reach: dto.reach,
      volatilityImpact: dto.volatilityImpact,
      source: dto.source,
    });
    return this.infoEventsService.create(rid, payload);
  }

  @Get()
  async list(
    @Query("runId") runIdParam?: string,
    @Query("assetSymbol") assetSymbol?: string,
    @Query("step") stepParam?: string,
  ) {
    if (!runIdParam) {
      throw new BadRequestException("runId query parameter is required");
    }
    const rid = validateRunId(runIdParam);
    const step = stepParam != null ? parseInt(stepParam, 10) : undefined;
    if (step != null && (!Number.isFinite(step) || step < 0)) {
      throw new BadRequestException("step must be a non-negative integer");
    }
    return this.infoEventsService.list(
      rid,
      assetSymbol ?? "RUN",
      step,
      step, // Use same step for both fromStep and toStep if provided
    );
  }
}
