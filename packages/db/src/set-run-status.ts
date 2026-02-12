import type { PrismaClient } from "../generated/prisma";

export type RunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type SetRunStatusResult = {
  id: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  lastError: string | null;
};

export type SetRunStatusOutput = {
  run: SetRunStatusResult | null;
  count: number;
};

/**
 * Central helper for run status transitions.
 * Invariant: COMPLETED => completedAt != null
 *
 * - RUNNING: startedAt = now only if currently null; clear completedAt/failedAt/lastError
 * - COMPLETED: completedAt = now (always), failedAt=null, lastError=null; defensive startedAt if null
 * - FAILED: failedAt = now (always), lastError = provided or "unknown error"; defensive startedAt if null
 */
export async function setRunStatus(
  prisma: Pick<PrismaClient, "simulationRun">,
  runId: string,
  status: RunStatus,
  lastError?: string | null,
): Promise<SetRunStatusOutput> {
  const now = new Date();

  const existing = await prisma.simulationRun.findUnique({
    where: { id: runId },
    select: { id: true, status: true, startedAt: true },
  });
  if (!existing) return { run: null, count: 0 };

  let count = 0;

  if (status === "PENDING") {
    const res = await prisma.simulationRun.updateMany({
      where: { id: runId },
      data: {
        status: "PENDING",
        startedAt: null,
        completedAt: null,
        failedAt: null,
        lastError: null,
      },
    });
    count = res.count;
  } else if (status === "RUNNING") {
    // Set startedAt only if currently null; do not overwrite existing
    const startedAt = existing.startedAt ?? now;
    const res = await prisma.simulationRun.updateMany({
      where: { id: runId, status: { in: ["PENDING", "RUNNING"] } },
      data: {
        status: "RUNNING",
        startedAt,
        completedAt: null,
        failedAt: null,
        lastError: null,
      },
    });
    count = res.count;
  } else if (status === "COMPLETED") {
    // Invariant: COMPLETED => completedAt != null
    const startedAt = existing.startedAt ?? now;
    const res = await prisma.simulationRun.updateMany({
      where: { id: runId, status: { in: ["PENDING", "RUNNING"] } },
      data: {
        status: "COMPLETED",
        finishedAt: now,
        completedAt: now,
        startedAt,
        failedAt: null,
        lastError: null,
      },
    });
    count = res.count;
  } else if (status === "FAILED") {
    const startedAt = existing.startedAt ?? now;
    const res = await prisma.simulationRun.updateMany({
      where: { id: runId },
      data: {
        status: "FAILED",
        failedAt: now,
        lastError: (lastError ?? "unknown error").slice(0, 1000),
        startedAt,
      },
    });
    count = res.count;
  } else {
    throw new Error(`Unknown status: ${status}`);
  }

  const run = await prisma.simulationRun.findUnique({
    where: { id: runId },
    select: { id: true, status: true, startedAt: true, completedAt: true, failedAt: true, lastError: true },
  });
  return { run: run as SetRunStatusResult, count };
}
