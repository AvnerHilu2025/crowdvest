/**
 * Same behavior as apps/api AgentsV1Service.generate — for worker scripts without HTTP.
 */
import { createHash } from "crypto";
import type { PrismaClient } from "@crowdvest/db";

function uuidFromName(name: string): string {
  const hex = createHash("sha256").update(name).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function createSeededRng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uniform(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

export async function generateAgentsV1ForRun(
  prisma: PrismaClient,
  runId: string,
  opts: { count: number; seed: number; assetSymbol?: string; overwrite?: boolean },
): Promise<{ runId: string; createdCount: number; total: number; overwritten: boolean }> {
  const count = Math.min(Math.max(1, Math.floor(opts.count)), 10_000);
  const seed = Math.floor(opts.seed);
  const assetSymbol = (opts.assetSymbol ?? "RUN").trim() || "RUN";
  const overwrite = opts.overwrite !== false;

  const run = await prisma.simulationRun.findUnique({
    where: { id: runId },
    select: { id: true, datasetVersion: true },
  });
  if (!run) throw new Error(`Run not found: ${runId}`);
  const datasetVersion = run.datasetVersion ?? "default";

  const existingCount = await prisma.runAgent.count({ where: { runId } });
  if (!overwrite && existingCount > 0) {
    return { runId, createdCount: 0, total: existingCount, overwritten: false };
  }

  const rng = createSeededRng(seed);
  const pad = String(count).length;

  const archetypes = await prisma.archetype.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });

  await prisma.$transaction(
    async (tx) => {
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
        const rot = archetypes.length > 0 ? archetypes[i % archetypes.length]! : null;
        const agent = await tx.runAgent.create({
          data: {
            id: agentId,
            runId,
            name,
            archetype: rot?.name ?? null,
            archetypeId: rot?.id ?? null,
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

        traits.push({ agentId: agent.id, key: "age", valueNum: Math.round(uniform(rng, 18, 75)), valueStr: null });
        traits.push({ agentId: agent.id, key: "gender", valueNum: null, valueStr: pick(rng, ["M", "F", "X"]) });
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
        traits.push({
          agentId: agent.id,
          key: "timeHorizonDays",
          valueNum: Math.round(uniform(rng, 7, 3650)),
          valueStr: null,
        });
        traits.push({ agentId: agent.id, key: "newsSensitivity", valueNum: uniform(rng, 0, 1), valueStr: null });

        await tx.runAgentTrait.createMany({ data: traits });
      }
    },
    { timeout: 300_000, maxWait: 60_000 },
  );

  return {
    runId,
    createdCount: count,
    total: count,
    overwritten: overwrite && existingCount > 0,
  };
}
