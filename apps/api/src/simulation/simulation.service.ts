import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../prisma/prisma.service";

const execFileAsync = promisify(execFile);

/** Must match apps/worker/src/lib/db-info-event-to-input.ts */
const LIVE_INFO_JSON_PREFIX = "LIVE_JSON:";

export type InjectSimulationEventDto = {
  runId: string;
  assetSymbol: string;
  runVariantId?: string;
  sourceType: string;
  sourceName: string;
  title: string;
  sentiment: number;
  confidence: number;
  urgency: number;
  relevance: number;
  reach: number;
  credibility: number;
  step: number;
  targetArchetypes?: string[];
  /** Channel-only keys: `info`, `event` (matches worker `scenarioChannelMul`). */
  sensitivityOverrides?: Record<string, number>;
  simulationPlatform?: string;
  archetypeSentimentScale?: Record<string, number>;
  defaultArchetypeSentimentScale?: number;
};

const SIMULATION_PLATFORMS = new Set(["x", "facebook", "reddit", "sec", "newswire"]);

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Keep only `info` and `event` keys; values clamped to scenarioChannelMul range in worker. */
function sanitizeChannelSensitivityOnly(
  overrides: Record<string, number> | undefined,
): Record<string, number> | undefined {
  if (overrides == null || typeof overrides !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(overrides)) {
    const key = String(k).trim().toLowerCase();
    if (key !== "info" && key !== "event") continue;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    out[key] = clamp(v, 0.25, 1.75);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeArchetypeSentimentScale(
  raw: Record<string, number> | undefined,
): Record<string, number> | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const id = String(k).trim().toLowerCase();
    if (!id) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    out[id] = clamp(v, -5, 5);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export type InjectEventResponse = {
  injectedEventId: string;
  affectedRunId: string;
  runVariantId: string;
  recalculationStatus: "completed" | "failed" | "skipped";
  recalculationDetail?: string;
  affectedArchetypesSummary: string[];
  simulationPlatform?: string;
  targetArchetypeCount: number;
  archetypeScaleCount: number;
  mixedInterpretationActive: boolean;
  interpretationSummary?: string;
};

export type SimulationEventMutationResponse = {
  affectedRunId: string;
  runVariantId: string;
  assetSymbol: string;
  deletedCount: number;
  removedEventId?: string;
  recalculationStatus: "completed" | "failed" | "skipped";
  recalculationDetail?: string;
};

function buildInterpretationSummary(dto: InjectSimulationEventDto): {
  mixedInterpretationActive: boolean;
  interpretationSummary?: string;
  archetypeScaleCount: number;
} {
  const scale = dto.archetypeSentimentScale ?? {};
  const keys = Object.keys(scale);
  const archetypeScaleCount = keys.length;
  let amplified = 0;
  let contrarian = 0;
  let muted = 0;
  for (const v of Object.values(scale)) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (v > 1.05) amplified++;
    else if (v < -0.05) contrarian++;
    else if (v >= 0 && v < 0.45) muted++;
  }
  const vals = Object.values(scale).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  const hasPos = vals.some((v) => v > 0.05);
  const hasNeg = vals.some((v) => v < -0.05);
  const mixedInterpretationActive =
    archetypeScaleCount > 0 && ((hasPos && hasNeg) || (amplified > 0 && muted > 0) || contrarian > 0);
  const interpretationSummary =
    archetypeScaleCount > 0
      ? `Mixed interpretation active: ${amplified} amplified, ${contrarian} contrarian, ${muted} muted`
      : undefined;
  return { mixedInterpretationActive, interpretationSummary, archetypeScaleCount };
}

function resolveRepoRoot(): string {
  const env = process.env.CROWDVEST_REPO_ROOT?.trim();
  if (env && fs.existsSync(path.join(env, "pnpm-workspace.yaml"))) {
    return path.resolve(env);
  }
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, "pnpm-workspace.yaml"))) {
    return cwd;
  }
  const up2 = path.resolve(cwd, "..", "..");
  if (fs.existsSync(path.join(up2, "pnpm-workspace.yaml"))) {
    return up2;
  }
  return up2;
}

@Injectable()
export class SimulationService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveVariantScope(
    runIdRaw: string,
    runVariantIdRaw: string,
    assetSymbolRaw?: string,
  ): Promise<{ runId: string; runVariantId: string; assetSymbol: string; steps: number }> {
    const runId = runIdRaw.trim();
    const runVariantId = runVariantIdRaw.trim();
    if (!runId) throw new BadRequestException("runId is required");
    if (!runVariantId) throw new BadRequestException("runVariantId is required");
    const variant = await this.prisma.runVariant.findFirst({
      where: { id: runVariantId, runId },
      select: { id: true, runId: true, assetSymbol: true, steps: true },
    });
    if (!variant) {
      throw new BadRequestException(`runVariantId=${runVariantId} not found for runId=${runId}`);
    }
    const assetSymbol = variant.assetSymbol.trim();
    if (assetSymbolRaw != null && assetSymbolRaw.trim() !== "") {
      const requested = assetSymbolRaw.trim();
      if (requested !== assetSymbol) {
        throw new BadRequestException(
          `assetSymbol=${requested} does not match variant assetSymbol=${assetSymbol}`,
        );
      }
    }
    return { runId: variant.runId, runVariantId: variant.id, assetSymbol, steps: variant.steps };
  }

  private async rerunVariantPipelines(runVariantId: string): Promise<{
    recalculationStatus: "completed" | "failed" | "skipped";
    recalculationDetail?: string;
  }> {
    let recalculationStatus: "completed" | "failed" | "skipped" = "skipped";
    let recalculationDetail: string | undefined;
    if (process.env.SIMULATION_INJECT_SKIP_RERUN === "1" || process.env.SIMULATION_INJECT_SKIP_RERUN === "true") {
      return { recalculationStatus, recalculationDetail: "SIMULATION_INJECT_SKIP_RERUN=1 — pipelines not executed" };
    }
    const repoRoot = resolveRepoRoot();
    const workerDir = path.join(repoRoot, "apps", "worker");
    if (!fs.existsSync(path.join(workerDir, "package.json"))) {
      return { recalculationStatus, recalculationDetail: `worker package not found under ${workerDir}` };
    }
    try {
      await this.prisma.runVariant.update({
        where: { id: runVariantId },
        data: { completedAt: new Date() },
      });
      await execFileAsync(
        "pnpm",
        ["-C", workerDir, "run", "decide", "--", "--runVariantId", runVariantId, "--overwrite"],
        { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000, env: { ...process.env } },
      );
      await execFileAsync(
        "pnpm",
        ["-C", workerDir, "run", "compute-crowd-metrics", "--", "--runVariantId", runVariantId, "--overwrite"],
        { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000, env: { ...process.env } },
      );
      recalculationStatus = "completed";
    } catch (e: unknown) {
      recalculationStatus = "failed";
      const err = e as { stderr?: Buffer; message?: string };
      recalculationDetail = (err.stderr?.toString() ?? err.message ?? String(e)).slice(0, 2000);
    }
    return { recalculationStatus, recalculationDetail };
  }

  validateInjectDto(dto: InjectSimulationEventDto): void {
    if (!dto.runId?.trim()) throw new BadRequestException("runId is required");
    if (!dto.assetSymbol?.trim()) throw new BadRequestException("assetSymbol is required");
    const st = (dto.sourceType ?? "").trim().toLowerCase();
    const allowed = new Set(["news", "social", "macro", "rumor"]);
    if (!allowed.has(st)) {
      throw new BadRequestException(`sourceType must be one of: ${[...allowed].join(", ")}`);
    }
    if (!(dto.sourceName ?? "").trim()) throw new BadRequestException("sourceName is required");
    if (!(dto.title ?? "").trim()) throw new BadRequestException("title is required");
    if (typeof dto.step !== "number" || !Number.isFinite(dto.step) || dto.step < 0 || !Number.isInteger(dto.step)) {
      throw new BadRequestException("step must be a non-negative integer");
    }
    if (typeof dto.sentiment !== "number" || !Number.isFinite(dto.sentiment) || dto.sentiment < -1 || dto.sentiment > 1) {
      throw new BadRequestException("sentiment must be in [-1, 1]");
    }
    for (const [k, v] of [
      ["confidence", dto.confidence],
      ["urgency", dto.urgency],
      ["relevance", dto.relevance],
      ["reach", dto.reach],
      ["credibility", dto.credibility],
    ] as const) {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
        throw new BadRequestException(`${k} must be a number in [0, 1]`);
      }
    }
    if (dto.sensitivityOverrides != null && typeof dto.sensitivityOverrides !== "object") {
      throw new BadRequestException("sensitivityOverrides must be a JSON object");
    }
    if (dto.archetypeSentimentScale != null && typeof dto.archetypeSentimentScale !== "object") {
      throw new BadRequestException("archetypeSentimentScale must be a JSON object");
    }
    if (dto.simulationPlatform != null && dto.simulationPlatform !== "") {
      const p = String(dto.simulationPlatform).trim().toLowerCase();
      if (!SIMULATION_PLATFORMS.has(p)) {
        throw new BadRequestException(`simulationPlatform must be one of: ${[...SIMULATION_PLATFORMS].join(", ")}`);
      }
    }
    if (dto.defaultArchetypeSentimentScale != null) {
      const d = dto.defaultArchetypeSentimentScale;
      if (typeof d !== "number" || !Number.isFinite(d)) {
        throw new BadRequestException("defaultArchetypeSentimentScale must be a finite number");
      }
    }
  }

  normalizeInjectDto(dto: InjectSimulationEventDto): InjectSimulationEventDto {
    const def =
      dto.defaultArchetypeSentimentScale != null && Number.isFinite(dto.defaultArchetypeSentimentScale)
        ? clamp(dto.defaultArchetypeSentimentScale, -5, 5)
        : undefined;
    return {
      ...dto,
      sensitivityOverrides: sanitizeChannelSensitivityOnly(dto.sensitivityOverrides),
      archetypeSentimentScale: sanitizeArchetypeSentimentScale(dto.archetypeSentimentScale),
      defaultArchetypeSentimentScale: def,
    };
  }

  async injectEvent(dto: InjectSimulationEventDto): Promise<InjectEventResponse> {
    this.validateInjectDto(dto);
    const normalized = this.normalizeInjectDto(dto);
    const runId = normalized.runId.trim();
    const assetSymbol = normalized.assetSymbol.trim();

    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);

    const explicitVariantId = normalized.runVariantId?.trim();
    const variant = explicitVariantId
      ? await this.prisma.runVariant.findFirst({
          where: { id: explicitVariantId, runId, assetSymbol },
          select: { id: true, steps: true },
        })
      : await this.prisma.runVariant.findFirst({
          where: { runId, assetSymbol },
          orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
          select: { id: true, steps: true },
        });
    if (!variant) {
      if (explicitVariantId) {
        throw new BadRequestException(
          `runVariantId=${explicitVariantId} not found for runId=${runId} assetSymbol=${assetSymbol}`,
        );
      }
      throw new BadRequestException(`No RunVariant for runId=${runId} assetSymbol=${assetSymbol}`);
    }
    if (normalized.step >= variant.steps) {
      throw new BadRequestException(`step must be < variant.steps (${variant.steps})`);
    }

    const plat =
      normalized.simulationPlatform != null && String(normalized.simulationPlatform).trim() !== ""
        ? String(normalized.simulationPlatform).trim().toLowerCase()
        : undefined;
    const meta: Record<string, unknown> = {
      sourceType: normalized.sourceType.trim().toLowerCase(),
      sourceName: normalized.sourceName.trim(),
      title: normalized.title.trim(),
      targetArchetypes: normalized.targetArchetypes?.map((t) => String(t).trim()).filter(Boolean),
      sensitivityOverrides: normalized.sensitivityOverrides,
    };
    if (plat && SIMULATION_PLATFORMS.has(plat)) meta.simulationPlatform = plat;
    if (normalized.archetypeSentimentScale && Object.keys(normalized.archetypeSentimentScale).length > 0) {
      meta.archetypeSentimentScale = normalized.archetypeSentimentScale;
    }
    if (normalized.defaultArchetypeSentimentScale != null) {
      meta.defaultArchetypeSentimentScale = normalized.defaultArchetypeSentimentScale;
    }
    const source = `${LIVE_INFO_JSON_PREFIX}${JSON.stringify(meta)}`;
    const reach = clamp(normalized.reach * normalized.relevance, 0, 1);
    const credibility = clamp(normalized.credibility * normalized.confidence, 0, 1);
    const volatilityImpact = clamp(normalized.urgency, 0, 1);

    const created = await this.prisma.infoEvent.create({
      data: {
        runId,
        assetSymbol,
        step: normalized.step,
        topic: normalized.title.trim(),
        sentiment: clamp(normalized.sentiment, -1, 1),
        credibility,
        reach,
        volatilityImpact,
        source,
      },
    });

    const agentIds = await this.prisma.agentDecision.findMany({
      where: { runVariantId: variant.id },
      distinct: ["agentId"],
      select: { agentId: true },
      take: 2000,
    });
    const ids = agentIds.map((a) => a.agentId);
    const agents =
      ids.length > 0
        ? await this.prisma.runAgent.findMany({
            where: { id: { in: ids } },
            select: { archetype: true },
          })
        : [];
    const counts = new Map<string, number>();
    for (const a of agents) {
      const k = (a.archetype ?? "unknown").trim() || "unknown";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const affectedArchetypesSummary = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([name, n]) => `${name}:${n}`);

    const { recalculationStatus, recalculationDetail } = await this.rerunVariantPipelines(variant.id);

    const interp = buildInterpretationSummary(normalized);
    const targetArchetypeCount = normalized.targetArchetypes?.length ?? 0;

    return {
      injectedEventId: created.id,
      affectedRunId: runId,
      runVariantId: variant.id,
      recalculationStatus,
      recalculationDetail,
      affectedArchetypesSummary,
      simulationPlatform: plat && SIMULATION_PLATFORMS.has(plat) ? plat : undefined,
      targetArchetypeCount,
      archetypeScaleCount: interp.archetypeScaleCount,
      mixedInterpretationActive: interp.mixedInterpretationActive,
      interpretationSummary: interp.interpretationSummary,
    };
  }

  async listInjectedEvents(runId: string, limit: number): Promise<
    Array<{
      id: string;
      createdAt: string;
      title: string;
      sourceType: string;
      sentiment: number;
      step: number;
      assetSymbol: string;
    }>
  > {
    const rows = await this.prisma.infoEvent.findMany({
      where: {
        runId,
        source: { startsWith: LIVE_INFO_JSON_PREFIX },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
      select: {
        id: true,
        createdAt: true,
        topic: true,
        sentiment: true,
        step: true,
        assetSymbol: true,
        source: true,
      },
    });
    return rows.map((r) => {
      let sourceType = "live";
      try {
        const meta = JSON.parse((r.source ?? "").slice(LIVE_INFO_JSON_PREFIX.length)) as {
          sourceType?: string;
        };
        sourceType = meta.sourceType ?? "live";
      } catch {
        /* ignore */
      }
      return {
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        title: r.topic,
        sourceType,
        sentiment: r.sentiment,
        step: r.step,
        assetSymbol: r.assetSymbol,
      };
    });
  }

  async resetSimulationEvents(opts: {
    runId: string;
    runVariantId: string;
    assetSymbol?: string;
  }): Promise<SimulationEventMutationResponse> {
    const scope = await this.resolveVariantScope(opts.runId, opts.runVariantId, opts.assetSymbol);
    const deleted = await this.prisma.infoEvent.deleteMany({
      where: { runId: scope.runId, assetSymbol: scope.assetSymbol },
    });
    const { recalculationStatus, recalculationDetail } = await this.rerunVariantPipelines(scope.runVariantId);
    return {
      affectedRunId: scope.runId,
      runVariantId: scope.runVariantId,
      assetSymbol: scope.assetSymbol,
      deletedCount: deleted.count,
      recalculationStatus,
      recalculationDetail,
    };
  }

  async removeLastSimulationEvent(opts: {
    runId: string;
    runVariantId: string;
    assetSymbol?: string;
  }): Promise<SimulationEventMutationResponse> {
    const scope = await this.resolveVariantScope(opts.runId, opts.runVariantId, opts.assetSymbol);
    const last = await this.prisma.infoEvent.findFirst({
      where: { runId: scope.runId, assetSymbol: scope.assetSymbol },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    if (!last) {
      return {
        affectedRunId: scope.runId,
        runVariantId: scope.runVariantId,
        assetSymbol: scope.assetSymbol,
        deletedCount: 0,
        recalculationStatus: "skipped",
        recalculationDetail: "No InfoEvent rows to remove",
      };
    }
    await this.prisma.infoEvent.delete({ where: { id: last.id } });
    const { recalculationStatus, recalculationDetail } = await this.rerunVariantPipelines(scope.runVariantId);
    return {
      affectedRunId: scope.runId,
      runVariantId: scope.runVariantId,
      assetSymbol: scope.assetSymbol,
      deletedCount: 1,
      removedEventId: last.id,
      recalculationStatus,
      recalculationDetail,
    };
  }
}
