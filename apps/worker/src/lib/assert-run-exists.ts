import type { PrismaClient } from "@crowdvest/db";

/**
 * Preflight: ensure run exists via DB before heavy work.
 * Throws with a clear message if run was deleted (e.g. after db:reset).
 * No HTTP dependency — worker uses Prisma directly.
 */
export async function assertRunExists(prisma: PrismaClient, runId: string): Promise<void> {
  const run = await prisma.simulationRun.findUnique({
    where: { id: runId },
    select: { id: true },
  });
  if (!run) {
    throw new Error(`Run ${runId} not found. Create/import dataset first.`);
  }
}
