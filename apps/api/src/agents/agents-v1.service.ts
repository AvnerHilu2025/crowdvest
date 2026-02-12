/**
 * Agents v1 – diverse virtual investors.
 * RunAgent + RunAgentTrait model. No decision engine.
 * Deterministic agent IDs: same (datasetVersion, assetSymbol, seed, index) => same id across runs.
 */
import { createHash } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Deterministic UUID from name (sha256 first 16 bytes, UUID v4 form). Same inputs => same id. */
function uuidFromName(name: string): string {
  const hex = createHash("sha256").update(name).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Seeded RNG – mulberry32. */
function createSeededRng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sample value in [min, max] (inclusive) using uniform RNG. */
function uniform(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

export interface GenerateV1Body {
  count: number;
  seed?: number;
  assetSymbol?: string;
  preset?: "default";
  overwrite?: boolean;
}

export interface GenerateV1Result {
  runId: string;
  createdCount: number;
  existingCount: number;
  total: number;
  overwritten: boolean;
}

const MODEL_VERSION = "stage1";
const SCHEMA_VERSION = "v1";

@Injectable()
export class AgentsV1Service {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a minimal SimulationRun when runId not provided (e.g. smoke tests). */
  async ensureRun(): Promise<string> {
    const latest = await this.prisma.simulationRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: { datasetVersion: true },
    });
    const datasetVersion = latest?.datasetVersion ?? "default";
    const importRun = await this.prisma.importRun.findFirst({
      where: { type: "archetypes" },
      orderBy: { startedAt: "desc" },
      select: { sourceHash: true },
    });
    const dv = importRun?.sourceHash ?? datasetVersion;
    const name = `agents-v1-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const run = await this.prisma.simulationRun.create({
      data: {
        name: `${name}-${dv.slice(0, 8)}`,
        status: "PENDING",
        seed: Math.floor(Math.random() * 0x7fffffff),
        modelVersion: MODEL_VERSION,
        datasetVersion: dv,
        schemaVersion: SCHEMA_VERSION,
        startedAt: new Date(),
      },
    });
    return run.id;
  }

  /** Create N agents for a run with default traits. overwrite=false: no-op if agents exist; overwrite=true: delete and replace. Deterministic: same (runId, datasetVersion, assetSymbol, seed, count) => same agent ids. */
  async generate(runId: string, body: GenerateV1Body): Promise<GenerateV1Result> {
    const count = Math.min(Math.max(1, Math.floor(body.count ?? 100)), 500);
    const seed =
      typeof body.seed === "number" && Number.isFinite(body.seed)
        ? Math.floor(body.seed)
        : Math.floor(Math.random() * 0x7fffffff);
    const assetSymbol = (body.assetSymbol ?? "RUN").trim() || "RUN";
    const overwrite = body.overwrite === true;

    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true, datasetVersion: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);
    const datasetVersion = run.datasetVersion ?? "default";

    const existingCount = await this.prisma.runAgent.count({ where: { runId } });
    if (!overwrite && existingCount > 0) {
      return {
        runId,
        createdCount: 0,
        existingCount,
        total: existingCount,
        overwritten: false,
      };
    }

    const rng = createSeededRng(seed);
    const pad = String(count).length;

    await this.prisma.$transaction(async (tx) => {
      if (overwrite && existingCount > 0) {
        await tx.runAgent.deleteMany({ where: { runId } });
      }

      for (let i = 0; i < count; i++) {
        const herding = uniform(rng, 0, 1);
        const lossAversion = uniform(rng, 0, 1);
        const overconfidence = uniform(rng, 0, 1);
        const recencyBias = uniform(rng, 0, 1);
        const confirmationBias = uniform(rng, 0, 1);
        const fomo = uniform(rng, 0, 1);
        const anchoring = uniform(rng, 0, 1);
        const attentionLevel = uniform(rng, 0.3, 0.95);
        const emotionalVolatility = uniform(rng, 0, 1);
        const fatigue = uniform(rng, 0, 0.2);

        const deterministicName = `${runId}:${datasetVersion}:${assetSymbol}:${seed}:${i}`;
        const agentId = uuidFromName(deterministicName);
        const name = `Agent ${String(i + 1).padStart(pad, "0")}`;
        const agent = await tx.runAgent.create({
          data: {
            id: agentId,
            runId,
            name,
            archetype: null,
            biases: {
              herding,
              lossAversion,
              overconfidence,
              recencyBias,
              confirmationBias,
              fomo,
              anchoring,
            },
            humanState: {
              attentionLevel,
              emotionalVolatility,
              fatigue,
            },
          },
        });

        const traits: { agentId: string; key: string; valueNum: number | null; valueStr: string | null }[] = [];

        const age = Math.round(uniform(rng, 18, 75));
        traits.push({ agentId: agent.id, key: "age", valueNum: age, valueStr: null });

        const gender = pick(rng, ["M", "F", "X"]);
        traits.push({ agentId: agent.id, key: "gender", valueNum: null, valueStr: gender });

        traits.push({ agentId: agent.id, key: "riskTolerance", valueNum: uniform(rng, 0, 1), valueStr: null });
        traits.push({ agentId: agent.id, key: "confidence", valueNum: uniform(rng, 0, 1), valueStr: null });
        traits.push({ agentId: agent.id, key: "hesitation", valueNum: uniform(rng, 0, 1), valueStr: null });
        traits.push({ agentId: agent.id, key: "impulsivity", valueNum: uniform(rng, 0, 1), valueStr: null });
        traits.push({ agentId: agent.id, key: "patience", valueNum: uniform(rng, 0, 1), valueStr: null });
        traits.push({ agentId: agent.id, key: "lossAversion", valueNum: lossAversion, valueStr: null });
        traits.push({ agentId: agent.id, key: "herding", valueNum: herding, valueStr: null });
        traits.push({ agentId: agent.id, key: "contrarian", valueNum: uniform(rng, 0, 1), valueStr: null });
        traits.push({ agentId: agent.id, key: "overconfidence", valueNum: overconfidence, valueStr: null });
        traits.push({ agentId: agent.id, key: "recencyBias", valueNum: recencyBias, valueStr: null });
        traits.push({ agentId: agent.id, key: "confirmationBias", valueNum: confirmationBias, valueStr: null });
        traits.push({ agentId: agent.id, key: "fomo", valueNum: fomo, valueStr: null });
        traits.push({ agentId: agent.id, key: "anchoring", valueNum: anchoring, valueStr: null });
        traits.push({ agentId: agent.id, key: "attentionLevel", valueNum: attentionLevel, valueStr: null });
        traits.push({ agentId: agent.id, key: "emotionalVolatility", valueNum: emotionalVolatility, valueStr: null });
        traits.push({ agentId: agent.id, key: "fatigue", valueNum: fatigue, valueStr: null });

        const timeHorizonDays = Math.round(uniform(rng, 7, 3650));
        traits.push({ agentId: agent.id, key: "timeHorizonDays", valueNum: timeHorizonDays, valueStr: null });

        traits.push({ agentId: agent.id, key: "newsSensitivity", valueNum: uniform(rng, 0, 1), valueStr: null });

        await tx.runAgentTrait.createMany({ data: traits });
      }
    });

    return {
      runId,
      createdCount: count,
      existingCount: overwrite ? 0 : existingCount,
      total: count,
      overwritten: overwrite,
    };
  }

  /** List agents for a run with trait summary (age, riskTolerance, confidence). */
  async list(
    runId: string,
    limit: number,
    offset: number,
  ): Promise<{ items: ListAgentItem[]; total: number }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);

    const [agents, total] = await Promise.all([
      this.prisma.runAgent.findMany({
        where: { runId },
        take: limit,
        skip: offset,
        orderBy: { name: "asc" },
        include: {
          traits: {
            where: { key: { in: ["age", "riskTolerance", "confidence"] } },
          },
        },
      }),
      this.prisma.runAgent.count({ where: { runId } }),
    ]);

    const items: ListAgentItem[] = agents.map((a) => {
      const traitMap = new Map(a.traits.map((t) => [t.key, t.valueNum ?? t.valueStr]));
      const num = (k: string): number | undefined => {
        const v = traitMap.get(k);
        return typeof v === "number" ? v : undefined;
      };
      return {
        id: a.id,
        name: a.name,
        archetype: a.archetype,
        biases: a.biases as BiasesJson | null,
        humanState: a.humanState as HumanStateJson | null,
        traitSummary: {
          age: num("age"),
          riskTolerance: num("riskTolerance"),
          confidence: num("confidence"),
        },
      };
    });

    return { items, total };
  }

  /** Get agent by id with all traits. */
  async findOne(agentId: string): Promise<AgentWithTraits> {
    const agent = await this.prisma.runAgent.findUnique({
      where: { id: agentId },
      include: { traits: true },
    });
    if (!agent) throw new NotFoundException(`Agent not found: ${agentId}`);

    const traits = agent.traits.map((t) => ({
      key: t.key,
      valueNum: t.valueNum,
      valueStr: t.valueStr,
    }));

    return {
      id: agent.id,
      runId: agent.runId,
      name: agent.name,
      archetype: agent.archetype,
      biases: agent.biases as BiasesJson | null,
      humanState: agent.humanState as HumanStateJson | null,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      traits,
    };
  }
}

export interface BiasesJson {
  herding: number;
  lossAversion: number;
  overconfidence: number;
  recencyBias: number;
  confirmationBias: number;
  fomo: number;
  anchoring: number;
}

export interface HumanStateJson {
  attentionLevel: number;
  emotionalVolatility: number;
  fatigue: number;
}

export interface ListAgentItem {
  id: string;
  name: string;
  archetype: string | null;
  biases: BiasesJson | null;
  humanState: HumanStateJson | null;
  traitSummary: {
    age?: number;
    riskTolerance?: number;
    confidence?: number;
  };
}

export interface AgentWithTraits {
  id: string;
  runId: string;
  name: string;
  archetype: string | null;
  biases: BiasesJson | null;
  humanState: HumanStateJson | null;
  createdAt: Date;
  updatedAt: Date;
  traits: { key: string; valueNum: number | null; valueStr: string | null }[];
}
