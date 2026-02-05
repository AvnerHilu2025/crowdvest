import { BadRequestException, Controller, Get, Param, Query } from "@nestjs/common";
import { ResultsService } from "./results.service";
import { parseLimit, parseOffset } from "../common/parse-query";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validateRunId(runId: string | undefined): string {
  const s = runId?.trim() ?? "";
  if (s === "") throw new BadRequestException("run_id is required");
  if (!UUID_REGEX.test(s)) throw new BadRequestException("run_id must be a UUID");
  return s;
}

/**
 * Read-only Results API. Returns data in the Results Data Model shape.
 * No auth. Clean separation from simulation logic (reads from SimulationRun / AgentExperience).
 */
@Controller("results")
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  /** GET /results/runs — list runs (paginated). */
  @Get("runs")
  async getRuns(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.resultsService.getRuns(parseLimit(limit), parseOffset(offset));
  }

  /** GET /results/runs/:id — one run by id. */
  @Get("runs/:id")
  async getRunById(@Param("id") id: string) {
    return this.resultsService.getRunById(id);
  }

  /** GET /results/agents?run_id= — per-agent rolled-up results for a run. Returns { items, total }. */
  @Get("agents")
  async getAgents(@Query("run_id") runId: string | undefined) {
    if (!runId || runId.trim() === "") {
      return { items: [], total: 0 };
    }
    return this.resultsService.getAgents(runId.trim());
  }

  /** GET /results/summary?run_id= — run-level + by-archetype summary for a run. */
  @Get("summary")
  async getSummary(@Query("run_id") runId: string | undefined) {
    if (!runId || runId.trim() === "") {
      return { run: null, byArchetype: [] };
    }
    return this.resultsService.getSummary(runId.trim());
  }

  /** GET /results/summary-compact?run_id= — compact post-run verification (CI-friendly). */
  @Get("summary-compact")
  async getSummaryCompact(@Query("run_id") runId: string | undefined) {
    const validRunId = validateRunId(runId);
    return this.resultsService.getSummaryCompact(validRunId);
  }
}
