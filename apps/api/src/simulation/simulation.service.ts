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
  sensitivityOverrides?: Record<string, number>;
};

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
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
  }

  async injectEvent(dto: InjectSimulationEventDto): Promise<{
    injectedEventId: string;
    affectedRunId: string;
    runVariantId: string;
    recalculationStatus: "completed" | "failed" | "skipped";
    recalculationDetail?: string;
    affectedArchetypesSummary: string[];
  }> {
    this.validateInjectDto(dto);
    const runId = dto.runId.trim();
    const assetSymbol = dto.assetSymbol.trim();

    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);

    const explicitVariantId = dto.runVariantId?.trim();
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
    if (dto.step >= variant.steps) {
      throw new BadRequestException(`step must be < variant.steps (${variant.steps})`);
    }

    const meta = {
      sourceType: dto.sourceType.trim().toLowerCase(),
      sourceName: dto.sourceName.trim(),
      title: dto.title.trim(),
      targetArchetypes: dto.targetArchetypes?.map((t) => String(t).trim()).filter(Boolean),
      sensitivityOverrides: dto.sensitivityOverrides,
    };
    const source = `${LIVE_INFO_JSON_PREFIX}${JSON.stringify(meta)}`;
    const reach = clamp(dto.reach * dto.relevance, 0, 1);
    const credibility = clamp(dto.credibility * dto.confidence, 0, 1);
    const volatilityImpact = clamp(dto.urgency, 0, 1);

    const created = await this.prisma.infoEvent.create({
      data: {
        runId,
        assetSymbol,
        step: dto.step,
        topic: dto.title.trim(),
        sentiment: clamp(dto.sentiment, -1, 1),
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

    let recalculationStatus: "completed" | "failed" | "skipped" = "skipped";
    let recalculationDetail: string | undefined;

    if (process.env.SIMULATION_INJECT_SKIP_RERUN === "1" || process.env.SIMULATION_INJECT_SKIP_RERUN === "true") {
      recalculationDetail = "SIMULATION_INJECT_SKIP_RERUN=1 — decide not executed";
    } else {
      const repoRoot = resolveRepoRoot();
      const workerDir = path.join(repoRoot, "apps", "worker");
      if (!fs.existsSync(path.join(workerDir, "package.json"))) {
        recalculationStatus = "skipped";
        recalculationDetail = `worker package not found under ${workerDir}`;
      } else {
        try {
          // Touch the variant whenever a rerun is triggered so active-scenario ordering stays stable.
          await this.prisma.runVariant.update({
            where: { id: variant.id },
            data: { completedAt: new Date() },
          });
          await execFileAsync(
            "pnpm",
            ["-C", workerDir, "run", "decide", "--", "--runVariantId", variant.id, "--overwrite"],
            {
              cwd: repoRoot,
              maxBuffer: 64 * 1024 * 1024,
              timeout: 15 * 60 * 1000,
              env: { ...process.env },
            },
          );
          recalculationStatus = "completed";
        } catch (e: unknown) {
          recalculationStatus = "failed";
          const err = e as { stderr?: Buffer; message?: string };
          recalculationDetail = (err.stderr?.toString() ?? err.message ?? String(e)).slice(0, 2000);
        }
      }
    }

    return {
      injectedEventId: created.id,
      affectedRunId: runId,
      runVariantId: variant.id,
      recalculationStatus,
      recalculationDetail,
      affectedArchetypesSummary,
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
}
