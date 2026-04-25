import { BadRequestException, Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { SimulationService, type InjectSimulationEventDto } from "./simulation.service";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateRunId(runId: string | undefined): string {
  const s = runId?.trim() ?? "";
  if (s === "" || !UUID_REGEX.test(s)) {
    throw new BadRequestException("runId must be a UUID");
  }
  return s;
}

@Controller("simulation")
export class SimulationController {
  constructor(private readonly simulation: SimulationService) {}

  /** Live dashboard injection: persists InfoEvent + optional decide rerun. */
  @Post("inject-event")
  async injectEvent(@Body() body: Record<string, unknown>) {
    const dto: InjectSimulationEventDto = {
      runId: String(body.runId ?? ""),
      assetSymbol: String(body.assetSymbol ?? ""),
      sourceType: String(body.sourceType ?? ""),
      sourceName: String(body.sourceName ?? ""),
      title: String(body.title ?? ""),
      sentiment: Number(body.sentiment),
      confidence: Number(body.confidence),
      urgency: Number(body.urgency),
      relevance: Number(body.relevance),
      reach: Number(body.reach),
      credibility: Number(body.credibility),
      step: Number(body.step),
      targetArchetypes: Array.isArray(body.targetArchetypes)
        ? (body.targetArchetypes as unknown[]).map((x) => String(x))
        : undefined,
      sensitivityOverrides:
        body.sensitivityOverrides != null && typeof body.sensitivityOverrides === "object"
          ? (body.sensitivityOverrides as Record<string, number>)
          : undefined,
      runVariantId: body.runVariantId != null ? String(body.runVariantId) : undefined,
      simulationPlatform:
        body.simulationPlatform != null && String(body.simulationPlatform).trim() !== ""
          ? String(body.simulationPlatform).trim().toLowerCase()
          : undefined,
      archetypeSentimentScale:
        body.archetypeSentimentScale != null && typeof body.archetypeSentimentScale === "object" && !Array.isArray(body.archetypeSentimentScale)
          ? (body.archetypeSentimentScale as Record<string, number>)
          : undefined,
      defaultArchetypeSentimentScale:
        body.defaultArchetypeSentimentScale != null && body.defaultArchetypeSentimentScale !== ""
          ? Number(body.defaultArchetypeSentimentScale)
          : undefined,
    };
    return this.simulation.injectEvent(dto);
  }

  @Get("injected-events")
  async injectedEvents(
    @Query("runId") runId: string | undefined,
    @Query("limit") limitParam?: string,
  ) {
    const rid = validateRunId(runId);
    const limit = limitParam != null ? parseInt(limitParam, 10) : 20;
    const items = await this.simulation.listInjectedEvents(rid, Number.isFinite(limit) ? limit : 20);
    return { runId: rid, items, total: items.length };
  }

  /** Reset simulation events for current variant scope: delete all InfoEvent rows and rerun pipelines. */
  @Delete("events")
  async resetEvents(
    @Query("runId") runId: string | undefined,
    @Query("runVariantId") runVariantId: string | undefined,
    @Query("assetSymbol") assetSymbol?: string,
  ) {
    const rid = validateRunId(runId);
    const vid = String(runVariantId ?? "").trim();
    if (vid === "") {
      throw new BadRequestException("runVariantId is required");
    }
    return this.simulation.resetSimulationEvents({ runId: rid, runVariantId: vid, assetSymbol });
  }

  /** Remove most recent InfoEvent in current variant scope and rerun pipelines. */
  @Delete("events/last")
  async removeLastEvent(
    @Query("runId") runId: string | undefined,
    @Query("runVariantId") runVariantId: string | undefined,
    @Query("assetSymbol") assetSymbol?: string,
  ) {
    const rid = validateRunId(runId);
    const vid = String(runVariantId ?? "").trim();
    if (vid === "") {
      throw new BadRequestException("runVariantId is required");
    }
    return this.simulation.removeLastSimulationEvent({ runId: rid, runVariantId: vid, assetSymbol });
  }
}
