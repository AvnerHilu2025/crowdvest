/**
 * CLI: pnpm --filter worker sim:run -- --name "test-run" --agents 200 --steps 30 [--datasetVersion <hash>]
 * Runs a simulation: creates SimulationRun, RunAgents, AgentExperience per step, CrowdSnapshot per step.
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";
import {
  runStep,
  createSeededRng,
  sampleMarketReturn,
  buildTraitValues,
  getSellConfig,
  type AgentInSim,
  type SimConfig,
} from "@crowdvest/sim-core";

const DATABASE_URL_MISSING =
  "DATABASE_URL is not set. Create a .env at the repository root with DATABASE_URL=postgresql://...";

function loadEnvFile(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    // ignore read errors
  }
}

function loadEnv(): void {
  const cwd = process.cwd();
  const paths = [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, "..", ".env"),
    path.resolve(cwd, "..", "..", ".env"),
    path.resolve(__dirname, "..", "..", "..", ".env"),
  ];
  for (const p of paths) loadEnvFile(p);
  const url = process.env.DATABASE_URL;
  if (!url || String(url).trim() === "") {
    throw new Error(`${DATABASE_URL_MISSING} (process.cwd(): ${process.cwd()})`);
  }
}

function parseArgv(): { name: string; agents: number; steps: number; datasetVersion?: string } {
  const args = process.argv.slice(2);
  let name = "test-run";
  let agents = 200;
  let steps = 30;
  let datasetVersion: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--name" && args[i + 1]) {
      name = args[++i];
    } else if (args[i] === "--agents" && args[i + 1]) {
      agents = parseInt(args[++i], 10);
    } else if (args[i] === "--steps" && args[i + 1]) {
      steps = parseInt(args[++i], 10);
    } else if (args[i] === "--datasetVersion" && args[i + 1]) {
      datasetVersion = args[++i];
    }
  }
  if (!Number.isFinite(agents) || agents < 1) agents = 200;
  if (!Number.isFinite(steps) || steps < 1) steps = 30;
  return { name, agents, steps, datasetVersion };
}

/**
 * Resolve datasetVersion: if provided use it; else use latest SimulationRun.datasetVersion
 * (canonical "current dataset" for runs); if no runs exist, fall back to latest archetype
 * ImportRun.sourceHash. This matches the API notion of "latest" dataset.
 */
async function resolveDatasetVersion(
  prisma: PrismaClient,
  provided?: string,
): Promise<string> {
  if (provided && provided.trim() !== "") {
    return provided.trim();
  }
  const latestRun = await prisma.simulationRun.findFirst({
    orderBy: { createdAt: "desc" },
    select: { datasetVersion: true },
  });
  if (latestRun) {
    return latestRun.datasetVersion;
  }
  const latestImport = await prisma.importRun.findFirst({
    where: { type: "archetypes" },
    orderBy: { startedAt: "desc" },
    select: { sourceHash: true },
  });
  if (latestImport) {
    return latestImport.sourceHash;
  }
  throw new Error(
    "No datasetVersion provided and no SimulationRun or archetype ImportRun in DB. Run seed first or pass --datasetVersion.",
  );
}

const STARTING_CASH = 10_000;
const MODEL_VERSION = "stage1";
const SCHEMA_VERSION = "v1";

function log(msg: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

async function main(): Promise<void> {
  loadEnv();
  const argv = parseArgv();
  log(`sim:run name=${argv.name} agents=${argv.agents} steps=${argv.steps}`);

  const prisma = new PrismaClient();

  const datasetVersion = await resolveDatasetVersion(prisma, argv.datasetVersion);
  log(`datasetVersion=${datasetVersion}`);

  const archetypes = await prisma.archetype.findMany({
    include: {
      traitProfiles: {
        include: { traitDefinition: { select: { key: true } } },
      },
    },
  });
  if (archetypes.length === 0) {
    throw new Error("No archetypes in DB. Run seed first.");
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

  const runSeed = Math.abs(
    argv.name.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0),
  );

  const run = await prisma.simulationRun.create({
    data: {
      name: argv.name,
      status: "PENDING",
      seed: runSeed,
      modelVersion: MODEL_VERSION,
      datasetVersion,
      schemaVersion: SCHEMA_VERSION,
      startedAt: new Date(),
    },
  });
  const runId = run.id;
  log(`Created SimulationRun id=${runId}`);

  const pad = String(argv.agents).length;
  const runAgentPayloads = [];
  for (let i = 0; i < argv.agents; i++) {
    const archetype = archetypes[i % archetypes.length];
    runAgentPayloads.push({
      runId,
      name: `Agent ${String(i + 1).padStart(pad, "0")}`,
      archetype: archetype.name,
    });
  }
  const createdRunAgents = await prisma.runAgent.createManyAndReturn({
    data: runAgentPayloads,
    select: { id: true, archetype: true, name: true },
  });
  type RunAgentRow = { id: string; archetype: string | null; name: string };
  createdRunAgents.sort((a: RunAgentRow, b: RunAgentRow) =>
    (a.name ?? "").localeCompare(b.name ?? "", undefined, { numeric: true }),
  );
  log(`Created ${argv.agents} RunAgents`);
  const archetypeByName = new Map(archetypes.map((a) => [a.name, a.id]));
  const agentsForSim: AgentInSim[] = (createdRunAgents as RunAgentRow[]).map((a) => {
    const archetypeId = archetypeByName.get(a.archetype ?? "") ?? archetypes[0]!.id;
    const traits = profileByArchetype.get(archetypeId) ?? {};
    const traitValues = buildTraitValues(traits);
    const wallet = STARTING_CASH;
    return {
      agentId: a.id,
      archetypeId,
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
  });

  const config: SimConfig = {
    seed: runSeed,
    steps: argv.steps,
    startingCash: STARTING_CASH,
  };

  const uniform = createSeededRng(config.seed);
  const MARKET_MEAN = 0.002;
  const MARKET_STDEV = 0.01;
  const sellConfig = getSellConfig(config);
  const decisionHistogram = { BUY: 0, SELL: 0, HOLD: 0, OTHER: 0 };
  const sampleDecisions: { agentId: string; step: number; action: string }[] = [];
  const prePersistHistogram = { BUY: 0, SELL: 0, HOLD: 0, OTHER: 0 };
  const samplePrePersistActions: { agentId: string; step: number; action: string }[] = [];

  for (let stepIndex = 0; stepIndex < config.steps; stepIndex++) {
    const marketReturn = sampleMarketReturn(MARKET_MEAN, MARKET_STDEV, uniform);
    const ts = new Date();
    const result = runStep(agentsForSim, marketReturn, stepIndex, ts, sellConfig);
    const { experiences, snapshot } = result;

    for (const e of experiences) {
      const action = String(e.action).toLowerCase();
      const key = action === "buy" ? "BUY" : action === "sell" ? "SELL" : action === "hold" ? "HOLD" : "OTHER";
      decisionHistogram[key]++;
      if (sampleDecisions.length < 10) {
        sampleDecisions.push({ agentId: e.agentId, step: snapshot.stepIndex, action: key });
      }
    }

    const data = experiences.map((e) => ({
      runId,
      runAgentId: e.agentId,
      step: snapshot.stepIndex,
      ts,
      actionJson: { action: e.action },
      reward: e.reward,
      pnl: e.pnl,
      drawdown: e.drawdown,
      stateAfterJson: { wallet: e.walletAfter },
      learningMetaJson: e.meta as object,
    }));

    for (const d of data) {
      const action = ((d.actionJson as { action?: string })?.action ?? "hold").toLowerCase();
      const key = action === "buy" ? "BUY" : action === "sell" ? "SELL" : action === "hold" ? "HOLD" : "OTHER";
      prePersistHistogram[key]++;
      if (samplePrePersistActions.length < 10) {
        samplePrePersistActions.push({ agentId: d.runAgentId, step: d.step, action: key });
      }
    }

    await prisma.agentExperience.createMany({ data });

    await prisma.crowdSnapshot.create({
      data: {
        runId,
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

    // runStep mutates agentsForSim (wallet, peakWallet) in-place

    if (stepIndex % 5 === 0 || stepIndex === config.steps - 1) {
      log(`Step ${stepIndex} persisted (${experiences.length} experiences)`);
    }
  }

  const experienceCount = await prisma.agentExperience.count({ where: { runId } });
  const snapshotCount = await prisma.crowdSnapshot.count({ where: { runId } });
  log(`Persisted ${experienceCount} experiences, ${snapshotCount} snapshots`);

  const prePersistJson = JSON.stringify(prePersistHistogram);
  const sampleJson = JSON.stringify(samplePrePersistActions);
  await prisma.$transaction([
    prisma.simulationRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        configJson: { decisionHistogram, sampleDecisions } as object,
      },
    }),
    prisma.$executeRaw`
      INSERT INTO "RunDebug" ("runId", "prePersistHistogram", "samplePrePersistActions")
      VALUES (${runId}::uuid, ${prePersistJson}::jsonb, ${sampleJson}::jsonb)
      ON CONFLICT ("runId") DO UPDATE SET
        "prePersistHistogram" = EXCLUDED."prePersistHistogram",
        "samplePrePersistActions" = EXCLUDED."samplePrePersistActions"
    `,
  ]);
  log(`Run ${runId} completed.`);

  // Populate RunTimeSeries (linear curve for v2 settlement)
  const pnlRows = await prisma.$queryRaw<{ totalPnl: number }[]>`
    SELECT COALESCE(SUM(pnl)::float, 0) AS "totalPnl"
    FROM "AgentExperience"
    WHERE "runId" = ${runId}::uuid
  `;
  const totalPnl = pnlRows[0] ? Number(pnlRows[0].totalPnl) : 0;
  const N = config.steps;
  const timeseriesData = Array.from({ length: N + 1 }, (_, step) => ({
    runId,
    step,
    value: (step / N) * totalPnl,
  }));
  await prisma.runTimeSeries.createMany({
    data: timeseriesData,
    skipDuplicates: true,
  });
  log(`RunTimeSeries populated (${timeseriesData.length} points).`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("sim:run failed:", err);
  process.exit(1);
});
