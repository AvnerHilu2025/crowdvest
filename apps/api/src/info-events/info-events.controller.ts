/**
 * InfoEvents – Nested routes (runId in path).
 * POST /runs/:runId/info-events
 * GET /runs/:runId/info-events?assetSymbol=RUN&fromStep=0&toStep=...
 * DELETE /runs/:runId/info-events?assetSymbol=RUN
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { InfoEventsService, normalizeCreatePayload } from "./info-events.service";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateRunId(runId: string): string {
  const s = runId?.trim() ?? "";
  if (s === "" || !UUID_REGEX.test(s)) {
    throw new BadRequestException("runId must be a UUID");
  }
  return s;
}

@Controller("runs/:runId/info-events")
export class InfoEventsController {
  constructor(private readonly infoEventsService: InfoEventsService) {}

  @Post()
  async create(
    @Param("runId") runId: string,
    @Body()
    body: {
      assetSymbol?: string;
      step: number;
      topic?: string;
      type?: string;
      sentiment: number;
      credibility: number;
      impact?: number;
      reach?: number;
      volatilityImpact?: number;
      source?: string | null;
    },
  ) {
    const rid = validateRunId(runId);
    if (typeof body.step !== "number" || !Number.isFinite(body.step) || body.step < 0) {
      throw new BadRequestException("step must be a non-negative number");
    }
    const payload = normalizeCreatePayload({
      assetSymbol: body.assetSymbol,
      step: body.step,
      topic: body.topic,
      type: body.type,
      sentiment: body.sentiment,
      credibility: body.credibility,
      impact: body.impact,
      reach: body.reach,
      volatilityImpact: body.volatilityImpact,
      source: body.source,
    });
    return this.infoEventsService.create(rid, payload);
  }

  @Get()
  async list(
    @Param("runId") runId: string,
    @Query("assetSymbol") assetSymbol?: string,
    @Query("fromStep") fromStepParam?: string,
    @Query("toStep") toStepParam?: string,
  ) {
    const rid = validateRunId(runId);
    const fromStep =
      fromStepParam != null ? parseInt(fromStepParam, 10) : undefined;
    const toStep = toStepParam != null ? parseInt(toStepParam, 10) : undefined;
    if (fromStep != null && !Number.isFinite(fromStep)) {
      throw new BadRequestException("fromStep must be a number");
    }
    if (toStep != null && !Number.isFinite(toStep)) {
      throw new BadRequestException("toStep must be a number");
    }
    return this.infoEventsService.list(
      rid,
      assetSymbol ?? "RUN",
      fromStep,
      toStep,
    );
  }

  @Delete()
  async deleteAll(
    @Param("runId") runId: string,
    @Query("assetSymbol") assetSymbol?: string,
  ) {
    const rid = validateRunId(runId);
    return this.infoEventsService.deleteAll(rid, assetSymbol ?? undefined);
  }
}
