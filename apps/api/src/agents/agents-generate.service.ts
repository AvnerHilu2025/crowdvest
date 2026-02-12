/**
 * Generate run + N agents + run simulation in-process.
 * Mirrors apps/worker sim-run logic for use by POST /agents/generate.
 */
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { setRunStatus } from "@crowdvest/db";
import { PrismaService } from "../prisma/prisma.service";
import {
  runStep,
  createSeededRng,
  sampleMarketReturn,
  buildTraitValues,
  getSellConfig,
  type AgentInSim,
  type SimConfig,
} from "@crowdvest/sim-core";

const STARTING_CASH = 10_000;
const MODEL_VERSION = "stage1";
const SCHEMA_VERSION = "v1";
const MARKET_MEAN = 0.002;
const MARKET_STDEV = 0.01;

const MAX_AGENTS = 200;
const MAX_STEPS = 50;
const DEFAULT_AGENTS = 100;
const DEFAULT_STEPS = 20;

export interface GenerateBody {
  count?: number;
  steps?: number;
  seed?: number;
  name?: string;
  distributionPreset?: string;
}

export interface GenerateResult {
  runId: string;
  agentCount: number;
  stepCount: number;
  status: string;
}

@Injectable()
export class AgentsGenerateService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveDatasetVersion(provided?: string): Promise<string> {
    if (provided && provided.trim() !== "") {
      return provided.trim();
    }
    const latestRun = await this.prisma.simulationRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: { datasetVersion: true },
    });
    if (latestRun) return latestRun.datasetVersion;
    const latestImport = await this.prisma.importRun.findFirst({
      where: { type: "archetypes" },
      orderBy: { startedAt: "desc" },
      select: { sourceHash: true },
    });
    if (latestImport) return latestImport.sourceHash;
    throw new BadRequestException(
      "No datasetVersion. Run seed first or pass datasetVersion.",
    );
  }

  async generate(runId: string | undefined, body: GenerateBody): Promise<GenerateResult> {
    const count = Math.min(
      Math.max(1, Math.floor(body.count ?? DEFAULT_AGENTS)),
      MAX_AGENTS,
    );
    const steps = Math.min(
      Math.max(1, Math.floor(body.steps ?? DEFAULT_STEPS)),
      MAX_STEPS,
    );
    const seed =
      typeof body.seed === "number" && Number.isFinite(body.seed)
        ? Math.floor(body.seed)
        : Math.floor(Math.random() * 0x7fffffff);
    const baseName =
      (body.name && String(body.name).trim()) ||
      `generate-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const datasetVersion = await this.resolveDatasetVersion();

    const archetypes = await this.prisma.archetype.findMany({
      include: {
        traitProfiles: {
          include: { traitDefinition: { select: { key: true } } },
        },
      },
    });
    if (archetypes.length === 0) {
      throw new BadRequestException("No archetypes in DB. Run seed first.");
    }

    const profileByArchetype = new Map<string, Record<string, number>>();
    for (const a of archetypes) {
      const traits: Record<string, number> = {};
      for (const p of a.traitProfiles) {
        const key = p.traitDefinition?.key;
        if (key && typeof p.baselineValue === "number") {
          traits[key] = p.baselineValue;
        }
      }
      profileByArchetype.set(a.id, traits);
    }

    let run: { id: string };
    if (runId && runId.trim() !== "") {
      const existing = await this.prisma.simulationRun.findUnique({
        where: { id: runId.trim() },
      });
      if (!existing) throw new NotFoundException(`Run not found: ${runId}`);
      if (existing.status !== "PENDING") {
        throw new BadRequestException(
          `Run ${runId} is not PENDING (status: ${existing.status})`,
        );
      }
      run = { id: existing.id };
    } else {
      const uniqueName = `${baseName}-${datasetVersion.slice(0, 8)}`;
      run = await this.prisma.simulationRun.create({
        data: {
          name: uniqueName,
          status: "PENDING",
          seed,
          modelVersion: MODEL_VERSION,
          datasetVersion,
          schemaVersion: SCHEMA_VERSION,
          startedAt: new Date(),
        },
      });
    }

    const pad = String(count).length;
    const agentPayloads = Array.from({ length: count }, (_, i) => {
      const archetype = archetypes[i % archetypes.length];
      return {
        displayName: `Agent ${String(i + 1).padStart(pad, "0")}`,
        archetypeId: archetype.id,
        stateJson: { wallet: STARTING_CASH },
      };
    });

    const createdAgents = await this.prisma.agent.createManyAndReturn({
      data: agentPayloads,
      select: { id: true, archetypeId: true, stateJson: true, displayName: true },
    });

    type AgentRow = {
      id: string;
      archetypeId: string;
      stateJson: unknown;
      displayName: string | null;
    };
    (createdAgents as AgentRow[]).sort((a, b) =>
      (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, {
        numeric: true,
      }),
    );

    // Create RunAgent records for each Agent and build agentId -> runAgentId map
    const runAgentPayloads = (createdAgents as AgentRow[]).map((a) => ({
      runId: run.id,
      name: a.displayName ?? `Agent ${a.id.slice(0, 8)}`,
    }));
    const createdRunAgents = await this.prisma.runAgent.createManyAndReturn({
      data: runAgentPayloads,
      select: { id: true },
    });
    const agentIdToRunAgentId = new Map<string, string>();
    for (let i = 0; i < (createdAgents as AgentRow[]).length; i++) {
      agentIdToRunAgentId.set(
        (createdAgents as AgentRow[])[i]!.id,
        createdRunAgents[i]!.id,
      );
    }

    const agentsForSim: AgentInSim[] = (createdAgents as AgentRow[]).map(
      (a) => {
        const state = (a.stateJson as { wallet?: number } | null) ?? {};
        const wallet =
          typeof state.wallet === "number" ? state.wallet : STARTING_CASH;
        const traits = profileByArchetype.get(a.archetypeId) ?? {};
        const traitValues = buildTraitValues(traits);
        return {
          agentId: a.id,
          archetypeId: a.archetypeId,
          wallet,
          peakWallet: wallet,
          traitValues,
          positionOpen: false,
          entryWallet: 0,
          entryStep: 0,
          holdingSteps: 0,
          hasBought: false,
          hasSoldAfterBuy: false,
        };
      },
    );

    const config: SimConfig = {
      seed,
      steps,
      startingCash: STARTING_CASH,
    };
    const sellConfig = getSellConfig(config);
    const uniform = createSeededRng(config.seed);
    const decisionHistogram = { BUY: 0, SELL: 0, HOLD: 0, OTHER: 0 };
    const sampleDecisions: { agentId: string; step: number; action: string }[] =
      [];

    for (let stepIndex = 0; stepIndex < steps; stepIndex++) {
      const marketReturn = sampleMarketReturn(
        MARKET_MEAN,
        MARKET_STDEV,
        uniform,
      );
      const ts = new Date();
      const result = runStep(
        agentsForSim,
        marketReturn,
        stepIndex,
        ts,
        sellConfig,
      );
      const { experiences, snapshot } = result;

      for (const e of experiences) {
        const action = String(e.action).toLowerCase();
        const key =
          action === "buy"
            ? "BUY"
            : action === "sell"
              ? "SELL"
              : action === "hold"
                ? "HOLD"
                : "OTHER";
        decisionHistogram[key]++;
        if (sampleDecisions.length < 10) {
          sampleDecisions.push({
            agentId: e.agentId,
            step: snapshot.stepIndex,
            action: key,
          });
        }
      }

      const data = experiences.map((e) => {
        const runAgentId = agentIdToRunAgentId.get(e.agentId);
        if (!runAgentId) {
          throw new Error(`No RunAgent found for agentId: ${e.agentId}`);
        }
        return {
          runId: run.id,
          runAgentId,
          step: snapshot.stepIndex,
          ts,
          actionJson: { action: e.action },
          reward: e.reward,
          pnl: e.pnl,
          drawdown: e.drawdown,
          stateAfterJson: { wallet: e.walletAfter },
          learningMetaJson: e.meta as object,
        };
      });

      await this.prisma.agentExperience.createMany({ data });

      await this.prisma.crowdSnapshot.create({
        data: {
          runId: run.id,
          step: snapshot.stepIndex,
          ts,
          aggregationJson: {
            avgReward: snapshot.avgReward,
            actionCounts: snapshot.actionCounts,
            avgWallet: snapshot.avgWallet,
            marketReturn: snapshot.marketReturn,
          },
        },
      });
    }

    const prePersistHistogram = { ...decisionHistogram };
    const sampleJson = JSON.stringify(sampleDecisions);

    await setRunStatus(this.prisma, run.id, "COMPLETED");
    await this.prisma.$transaction([
      this.prisma.simulationRun.update({
        where: { id: run.id },
        data: {
          configJson: {
            decisionHistogram,
            sampleDecisions,
          } as object,
        },
      }),
      this.prisma.$executeRaw`
        INSERT INTO "RunDebug" ("runId", "prePersistHistogram", "samplePrePersistActions")
        VALUES (${run.id}::uuid, ${JSON.stringify(prePersistHistogram)}::jsonb, ${sampleJson}::jsonb)
        ON CONFLICT ("runId") DO UPDATE SET
          "prePersistHistogram" = EXCLUDED."prePersistHistogram",
          "samplePrePersistActions" = EXCLUDED."samplePrePersistActions"
      `,
    ]);

    const pnlRows = await this.prisma.$queryRaw<{ totalPnl: number }[]>`
      SELECT COALESCE(SUM(pnl)::float, 0) AS "totalPnl"
      FROM "AgentExperience"
      WHERE "runId" = ${run.id}::uuid
    `;
    const totalPnl = pnlRows[0] ? Number(pnlRows[0].totalPnl) : 0;
    const timeseriesData = Array.from({ length: steps + 1 }, (_, step) => ({
      runId: run.id,
      step,
      value: (step / steps) * totalPnl,
    }));
    await this.prisma.runTimeSeries.createMany({
      data: timeseriesData,
      skipDuplicates: true,
    });

    return {
      runId: run.id,
      agentCount: count,
      stepCount: steps,
      status: "COMPLETED",
    };
  }
}
