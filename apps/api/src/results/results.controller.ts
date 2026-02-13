import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { ResultsService } from "./results.service";
import { parseLimit, parseOffset, parseHistoryLimit } from "../common/parse-query";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validateRunId(runId: string | undefined): string {
  const s = runId?.trim() ?? "";
  if (s === "") throw new BadRequestException(["runId is required"]);
  if (!UUID_REGEX.test(s)) throw new BadRequestException(["runId must be a UUID"]);
  return s;
}

function validateAgentId(agentId: string | undefined): string {
  const s = agentId?.trim() ?? "";
  if (s === "") throw new BadRequestException(["agentId is required"]);
  if (!UUID_REGEX.test(s)) throw new BadRequestException(["agentId must be a UUID"]);
  return s;
}

/**
 * Read-only Results API. Returns data in the Results Data Model shape.
 * No auth. Clean separation from simulation logic (reads from SimulationRun / AgentExperience).
 */
@Controller("results")
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  /** GET /results/latest?assetSymbol=SPY — latest COMPLETED run, default variant, and summary. */
  @Get("latest")
  async latest(@Query("assetSymbol") assetSymbol = "SPY") {
    return this.resultsService.latest(assetSymbol);
  }

  /** GET /results/runs-v2 — UI-ready runs list with variant info. */
  @Get("runs-v2")
  async getRunsV2(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.resultsService.getRunsV2(parseLimit(limit), parseOffset(offset));
  }

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

  /** GET /results/agents-count?runId= — RunAgent count for the run. */
  @Get("agents-count")
  async getAgentsCount(@Query("runId") runId: string | undefined) {
    const rid = runId?.trim();
    if (!rid) throw new BadRequestException("runId is required");
    if (!UUID_REGEX.test(rid)) throw new BadRequestException("runId must be a UUID");
    return this.resultsService.getAgentsCount(rid);
  }

  /** GET /results/agents?run_id= — per-agent rolled-up results for a run. Returns { items, total }. */
  @Get("agents")
  async getAgents(@Query("run_id") runId: string | undefined) {
    if (!runId || runId.trim() === "") {
      return { items: [], total: 0 };
    }
    return this.resultsService.getAgents(runId.trim());
  }

  /** GET /results/decisions?run_id=&step=&assetSymbol= — per-step decision summary from AgentDecision. */
  @Get("decisions")
  async getDecisions(
    @Query("run_id") runId: string | undefined,
    @Query("runId") runIdAlt: string | undefined,
    @Query("step") stepParam: string | undefined,
    @Query("assetSymbol") assetSymbol: string | undefined,
  ) {
    const validRunId = validateRunId(runId ?? runIdAlt);
    const step = parseInt(stepParam ?? "0", 10);
    if (!Number.isFinite(step) || step < 0) {
      throw new BadRequestException("step must be a non-negative integer");
    }
    const sym = (assetSymbol ?? "RUN").trim() || "RUN";
    return this.resultsService.getDecisions(validRunId, step, sym);
  }

  /** GET /results/crowd-wisdom-dump?runId=&assetSymbol= — raw decisions + returns for Crowd Wisdom validation. Run must be COMPLETED. */
  @Get("crowd-wisdom-dump")
  async getCrowdWisdomDump(
    @Query("runId") runId: string | undefined,
    @Query("run_id") runIdAlt: string | undefined,
    @Query("assetSymbol") assetSymbol: string | undefined,
  ) {
    const validRunId = validateRunId(runId ?? runIdAlt);
    const sym = (assetSymbol ?? "SPY").trim() || "SPY";
    return this.resultsService.getCrowdWisdomDump(validRunId, sym);
  }

  /** GET /results/crowd-state?runId=&assetSymbol= — per-step CrowdMetrics + recommendation (direction, strength, confidence, stability, explanation). */
  @Get("crowd-state")
  async getCrowdState(
    @Query("runId") runId: string | undefined,
    @Query("run_id") runIdAlias: string | undefined,
    @Query("assetSymbol") assetSymbol: string | undefined,
  ) {
    const validRunId = validateRunId(runId ?? runIdAlias);
    const sym = (assetSymbol ?? "RUN").trim() || "RUN";
    return this.resultsService.getCrowdState(validRunId, sym);
  }

  /** GET /results/crowd-summary?run_id= — crowd metrics. Add assetSymbol=RUN for AgentDecision aggregation + recommendation. */
  @Get("crowd-summary")
  async getCrowdSummary(
    @Query("run_id") runId: string | undefined,
    @Query("runId") runIdAlt: string | undefined,
    @Query("assetSymbol") assetSymbol: string | undefined,
  ) {
    const validRunId = validateRunId(runId ?? runIdAlt);
    return this.resultsService.getCrowdSummary(validRunId, assetSymbol?.trim() || undefined);
  }

  /** GET /results/step-summary?run_id=&step= — per-step crowd snapshot. */
  @Get("step-summary")
  async getStepSummary(
    @Query("run_id") runId: string | undefined,
    @Query("step") stepParam: string | undefined,
  ) {
    const validRunId = validateRunId(runId);
    const step = parseInt(stepParam ?? "", 10);
    if (!Number.isFinite(step) || step < 0) {
      throw new BadRequestException("step must be a non-negative integer");
    }
    return this.resultsService.getStepSummary(validRunId, step);
  }

  /** GET /results/agent/:id/decisions?run_id= — agent decisions (AgentExperience) for run. */
  @Get("agent/:id/decisions")
  async getAgentDecisions(
    @Param("id") agentId: string,
    @Query("run_id") runId: string | undefined,
  ) {
    const s = agentId?.trim() ?? "";
    if (s === "" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
      throw new BadRequestException("agent id must be a UUID");
    }
    const validRunId = validateRunId(runId);
    return this.resultsService.getAgentDecisions(s, validRunId);
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

  /** GET /results/agent-state?runId=&assetSymbol=&agentId=&historyLimit= — latest learning state + last N steps (AgentState). historyLimit default 10, max 100. */
  @Get("agent-state")
  async getAgentState(
    @Query("runId") runId: string | undefined,
    @Query("run_id") runIdAlt: string | undefined,
    @Query("assetSymbol") assetSymbol: string | undefined,
    @Query("agentId") agentId: string | undefined,
    @Query("historyLimit") historyLimitParam: string | undefined,
  ) {
    const validRunId = validateRunId(runId ?? runIdAlt);
    const sym = (assetSymbol ?? "RUN").trim() || "RUN";
    const validAgentId = validateAgentId(agentId);
    const historyLimit = parseHistoryLimit(historyLimitParam);
    return this.resultsService.getAgentState(validRunId, sym, validAgentId, historyLimit);
  }

  /** GET /results/agent-rewards?runId=&assetSymbol=&agentId=&fromStep=&toStep= — reward rows (AgentReward). */
  @Get("agent-rewards")
  async getAgentRewards(
    @Query("runId") runId: string | undefined,
    @Query("run_id") runIdAlt: string | undefined,
    @Query("assetSymbol") assetSymbol: string | undefined,
    @Query("agentId") agentId: string | undefined,
    @Query("fromStep") fromStepParam: string | undefined,
    @Query("toStep") toStepParam: string | undefined,
  ) {
    const validRunId = validateRunId(runId ?? runIdAlt);
    const sym = (assetSymbol ?? "RUN").trim() || "RUN";
    const fromStep = fromStepParam != null ? parseInt(fromStepParam, 10) : undefined;
    const toStep = toStepParam != null ? parseInt(toStepParam, 10) : undefined;
    return this.resultsService.getAgentRewards(validRunId, sym, agentId?.trim() || undefined, Number.isFinite(fromStep) ? fromStep : undefined, Number.isFinite(toStep) ? toStep : undefined);
  }

  /** GET /results/backtests?assetSymbol=SPY&limit=50 — list BacktestResult (per-seed backtest v0). parseLimit(value) only; default 50, max 200 in parse-query. */
  @Get("backtests")
  async getBacktests(
    @Query("assetSymbol") assetSymbol: string | undefined,
    @Query("limit") limitParam: string | undefined,
  ) {
    const limit = parseLimit(limitParam);
    return this.resultsService.getBacktests(
      assetSymbol?.trim() ?? "SPY",
      limit,
    );
  }

  /** GET /results/backtest?symbol=SPY&limit=50 — list backtest window results for a symbol. */
  @Get("backtest")
  async getBacktest(
    @Query("symbol") symbol: string | undefined,
    @Query("limit") limitParam: string | undefined,
  ) {
    const limit = parseLimit(limitParam);
    return this.resultsService.getBacktestResults(
      symbol?.trim() ?? "SPY",
      limit,
    );
  }

  /** GET /results/run-debug-counts?runId=&assetSymbol= — debug counts (decisions, infoState, experiences, crowdMetrics). Only when NODE_ENV !== 'production' or X-Debug: true. */
  @Get("run-debug-counts")
  async getRunDebugCounts(
    @Query("runId") runId: string | undefined,
    @Query("run_id") runIdAlt: string | undefined,
    @Query("assetSymbol") assetSymbol: string | undefined,
    @Headers("x-debug") xDebug: string | undefined,
  ) {
    const isProd = process.env.NODE_ENV === "production";
    const hasDebugHeader = xDebug?.toLowerCase() === "true" || xDebug === "1";
    if (isProd && !hasDebugHeader) {
      throw new UnauthorizedException(
        "run-debug-counts requires NODE_ENV !== 'production' or X-Debug: true",
      );
    }
    const validRunId = validateRunId(runId ?? runIdAlt);
    const sym = (assetSymbol ?? "RUN").trim() || "RUN";
    return this.resultsService.getRunDebugCounts(validRunId, sym);
  }
}
