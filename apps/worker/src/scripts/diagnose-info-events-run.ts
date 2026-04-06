/**
 * CLI: pnpm -C apps/worker run diagnose:info-events -- <runId> [--steps N] [--assetSymbol SYM]
 * Or: RUN_ID=<uuid> pnpm -C apps/worker run diagnose:info-events
 *
 * Reports InfoEvent row counts for a SimulationRun (diagnosis only).
 */
import { PrismaClient } from "@crowdvest/db";

function parseArgs(argv: string[]): {
  runId: string;
  steps: number | null;
  assetSymbol: string | null;
} {
  const rest = argv.slice(2);
  let runId = "";
  let steps: number | null = null;
  let assetSymbol: string | null = null;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--" || a === "") continue;
    if (a === "--steps" && rest[i + 1]) {
      steps = parseInt(rest[++i]!, 10);
      if (Number.isNaN(steps)) steps = null;
    } else if (a === "--assetSymbol" && rest[i + 1]) {
      assetSymbol = rest[++i]!;
    } else if (!a.startsWith("-") && !runId) {
      runId = a;
    }
  }
  if (!runId) runId = process.env.RUN_ID ?? "";
  return { runId, steps, assetSymbol };
}

async function main(): Promise<void> {
  const { runId, steps: stepsArg, assetSymbol } = parseArgs(process.argv);
  if (!runId) {
    console.error(
      "Usage: tsx src/scripts/diagnose-info-events-run.ts <runId> [--steps N] [--assetSymbol SYM]\n" +
        "   or: RUN_ID=<uuid> tsx ...",
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const whereBase = { runId } as const;
    const whereAsset = assetSymbol
      ? { ...whereBase, assetSymbol }
      : whereBase;

    const total = await prisma.infoEvent.count({ where: whereAsset });

    const byStep = await prisma.infoEvent.groupBy({
      by: ["step"],
      where: whereAsset,
      _count: { _all: true },
      orderBy: { step: "asc" },
    });

    const stepsWithEvents = byStep.map((r) => r.step);
    const countPerStep = byStep.map((r) => ({ step: r.step, count: r._count._all }));

    let maxStepInclusive = -1;
    if (stepsArg != null && stepsArg > 0) {
      maxStepInclusive = stepsArg - 1;
    } else if (stepsWithEvents.length > 0) {
      maxStepInclusive = Math.max(...stepsWithEvents);
    } else {
      const maxRow = await prisma.infoEvent.findFirst({
        where: whereAsset,
        orderBy: { step: "desc" },
        select: { step: true },
      });
      if (maxRow) maxStepInclusive = maxRow.step;
    }

    const stepRange =
      maxStepInclusive >= 0
        ? Array.from({ length: maxStepInclusive + 1 }, (_, i) => i)
        : [];
    const setWith = new Set(stepsWithEvents);
    const stepsWithout = stepRange.filter((s) => !setWith.has(s));

    console.log("--- InfoEvent diagnosis ---");
    console.log(`runId: ${runId}`);
    if (assetSymbol) console.log(`assetSymbol filter: ${assetSymbol}`);
    console.log(`total InfoEvent rows: ${total}`);
    console.log(`distinct steps with ≥1 row: ${stepsWithEvents.length}`);
    console.log(`per-step counts: ${JSON.stringify(countPerStep)}`);
    if (stepRange.length > 0) {
      console.log(
        `steps in range [0..${maxStepInclusive}] with events: ${stepsWithEvents.filter((s) => s <= maxStepInclusive).join(",") || "(none)"}`,
      );
      console.log(`steps in range [0..${maxStepInclusive}] without events: ${stepsWithout.join(",") || "(none)"}`);
    } else {
      console.log("steps with events: (none)");
      console.log("steps without events: (no step range inferred; pass --steps N to compare 0..N-1)");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
