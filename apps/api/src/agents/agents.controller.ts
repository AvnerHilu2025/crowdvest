import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { AgentsService } from "./agents.service";
import { AgentsGenerateService } from "./agents-generate.service";
import { AgentsV1Service } from "./agents-v1.service";
import { parseLimit, parseOffset } from "../common/parse-query";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly generateService: AgentsGenerateService,
    private readonly agentsV1Service: AgentsV1Service,
  ) {}

  /** POST /agents/generate?runId=&overwrite= — create N agents with traits for a run (Agents v1). overwrite=false: no-op if agents exist; overwrite=true: replace all. */
  @Post("agents/generate")
  @HttpCode(HttpStatus.CREATED)
  async generate(
    @Query("runId") runId: string | undefined,
    @Query("overwrite") overwriteParam: string | undefined,
    @Body() body: { count?: number; seed?: number; preset?: "default" },
  ) {
    const rid = runId?.trim();
    const resolvedRunId = rid && UUID_REGEX.test(rid)
      ? rid
      : await this.agentsV1Service.ensureRun();
    const overwrite = overwriteParam === "true" || overwriteParam === "1";
    return this.agentsV1Service.generate(resolvedRunId, {
      count: body.count ?? 100,
      seed: body.seed,
      preset: body.preset ?? "default",
      overwrite,
    });
  }

  /** GET /agents?runId=&limit=&offset= — list agents with trait summary (Agents v1). run_id alias for existing UI. */
  @Get("agents")
  async list(
    @Query("runId") runId: string | undefined,
    @Query("run_id") runIdAlias: string | undefined,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const rid = (runId ?? runIdAlias)?.trim();
    if (!rid || !UUID_REGEX.test(rid)) {
      throw new BadRequestException("runId (or run_id) is required and must be a UUID");
    }
    return this.agentsV1Service.list(
      rid,
      parseLimit(limit),
      parseOffset(offset),
    );
  }

  /** GET /agents/:id — single agent with all traits (Agents v1). Fallback: simulation agent (archetype + wallet). */
  @Get("agents/:id")
  async getById(@Param("id") id: string) {
    const s = id?.trim() ?? "";
    if (s === "" || !UUID_REGEX.test(s)) {
      throw new BadRequestException("id must be a UUID");
    }
    try {
      return await this.agentsV1Service.findOne(s);
    } catch {
      return this.agentsService.findOne(s);
    }
  }
}
