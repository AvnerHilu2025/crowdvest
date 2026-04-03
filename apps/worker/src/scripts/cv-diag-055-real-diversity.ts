/**
 * CV-055: Pairwise action agreement between agents (empirical diversity proxy).
 * Uses at most 300 agent pairs (deterministic sample) to avoid O(n²) blowups.
 * Loads AgentDecision in batches to limit peak fetch memory and log progress.
 *
 * Env: RUN_ID (required). Optional: RUN_VARIANT_ID — scope decisions to one variant.
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

const MAX_SAMPLE_PAIRS = 300;
const BATCH_SIZE = 5000;

function loadEnv(): void {
  const repoRoot = path.resolve(__dirname, "../../../../.env");
  try {
    if (!fs.existsSync(repoRoot)) return;
    const content = fs.readFileSync(repoRoot, "utf8");
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

type Row = {
  agentId: string;
  step: number;
  action: "BUY" | "SELL" | "HOLD";
};

/** Lexicographic pair index on sorted agent list: 0=(0,1), …, P-1=(n-2,n-1). */
function pairIndexToIj(p: number, n: number): [number, number] {
  let i = 0;
  let rem = p;
  while (i < n) {
    const rowLen = n - 1 - i;
    if (rem < rowLen) return [i, i + 1 + rem];
    rem -= rowLen;
    i++;
  }
  return [Math.max(0, n - 2), n - 1];
}

/** Assumes each row list is sorted by `step` ascending. */
function similarityAlignedByIndex(a: Row[], b: Row[]) {
  const total = Math.min(a.length, b.length);
  if (total === 0) return NaN;
  let same = 0;
  for (let i = 0; i < total; i++) {
    if (a[i]!.action === b[i]!.action) same++;
  }
  return same / total;
}

async function main(): Promise<void> {
  loadEnv();
  const runId = process.env.RUN_ID?.trim();
  if (!runId) {
    throw new Error("RUN_ID is required");
  }

  const variantId = process.env.RUN_VARIANT_ID?.trim();

  const prisma = new PrismaClient();
  const byAgent: Record<string, Row[]> = {};

  let offset = 0;
  let totalProcessed = 0;

  while (true) {
    const rows = await prisma.agentDecision.findMany({
      where: {
        runId,
        ...(variantId ? { runVariantId: variantId } : {}),
      },
      skip: offset,
      take: BATCH_SIZE,
      orderBy: { id: "asc" },
      select: {
        agentId: true,
        action: true,
        step: true,
      },
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      let list = byAgent[row.agentId];
      if (!list) {
        list = [];
        byAgent[row.agentId] = list;
      }
      list.push({
        agentId: row.agentId,
        step: row.step,
        action: row.action,
      });
    }

    totalProcessed += rows.length;
    offset += BATCH_SIZE;
    console.log(`Processed ${totalProcessed} rows...`);
  }

  const sortedAgentIds = Object.keys(byAgent).sort();
  const n = sortedAgentIds.length;
  const pSpace = n >= 2 ? (n * (n - 1)) / 2 : 0;
  const sampleTarget = Math.min(MAX_SAMPLE_PAIRS, pSpace);

  for (const id of sortedAgentIds) {
    byAgent[id]!.sort((a, b) => a.step - b.step);
  }

  let totalSim = 0;
  let sampledPairCount = 0;

  if (sampleTarget > 0 && n >= 2) {
    const addPair = (p: number) => {
      const [ii, jj] = pairIndexToIj(p, n);
      const sim = similarityAlignedByIndex(byAgent[sortedAgentIds[ii]!]!, byAgent[sortedAgentIds[jj]!]!);
      if (Number.isFinite(sim)) {
        totalSim += sim;
        sampledPairCount++;
      }
    };

    if (sampleTarget === pSpace) {
      for (let p = 0; p < pSpace; p++) addPair(p);
    } else if (sampleTarget === 1) {
      addPair(0);
    } else {
      for (let s = 0; s < sampleTarget; s++) {
        const p = Math.floor((s * (pSpace - 1)) / (sampleTarget - 1));
        addPair(p);
      }
    }
  }

  await prisma.$disconnect();

  console.log("\n=== REAL DIVERSITY ===\n");
  if (sampledPairCount === 0) {
    console.log("avg_similarity: —");
  } else {
    console.log("avg_similarity:", (totalSim / sampledPairCount).toFixed(4));
  }
  console.log("agent_count:", n);
  console.log("sampled_pair_count:", sampledPairCount);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
