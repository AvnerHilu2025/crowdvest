/**
 * Settlement v1 worker script.
 * CLI: pnpm -C apps/worker run settle -- --runId <uuid> --closeStep <int> [--force]
 *
 * 1) Finds OPEN bets for runId with openStep <= closeStep.
 * 2) closePrice from RunTimeSeries (same market truth as sim/API: AgentExperience + CrowdSnapshot → linear curve).
 * 3) Updates bets to SETTLED with closePrice, closeStep, pnl.
 * 4) Idempotent: default = only OPEN bets processed; SETTLED are skipped. --force = also recompute SETTLED (forcedCount).
 *    CANCELLED bets are never changed.
 * 5) Exits non-zero on invalid args, missing run, or missing market data.
 * 6) Summary log: settledCount, skippedCount, forcedCount, totalPnl.
 *
 * Uses Prisma via packages/db (@crowdvest/db).
 */
import path from "path";
import fs from "fs";
import { PrismaClient } from "@crowdvest/db";

const DATABASE_URL_MISSING =
  "DATABASE_URL is not set. Create a .env at the repository root with DATABASE_URL=postgresql://...";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    // ignore
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

function parseArgv(): { runId: string; closeStep: number; force: boolean } {
  const args = process.argv.slice(2);
  let runId = "";
  let closeStep = NaN;
  let force = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--runId" && args[i + 1]) {
      runId = String(args[++i]).trim();
    } else if (args[i] === "--closeStep" && args[i + 1]) {
      closeStep = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--force") {
      force = true;
    }
  }
  if (!runId) throw new Error("Missing required --runId <uuid>");
  if (!Number.isInteger(closeStep) || closeStep < 0) {
    throw new Error("--closeStep must be a non-negative integer");
  }
  return { runId, closeStep, force };
}

type PnlRow = { totalPnl: number };

/**
 * Same market truth source as simulation results and API: RunTimeSeries.
 * If RunTimeSeries is missing, build linear curve from AgentExperience totalPnl and CrowdSnapshot count
 * (same formula as sim-run and API TimeseriesService). Throws if run has no crowd snapshots.
 */
async function getValueAtStep(
  prisma: PrismaClient,
  runId: string,
  step: number,
): Promise<number> {
  let points = await prisma.runTimeSeries.findMany({
    where: { runId },
    select: { step: true, value: true },
    orderBy: { step: "asc" },
  });

  if (points.length === 0) {
    const run = await prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true, _count: { select: { crowdSnapshots: true } } },
    });
    if (!run) throw new Error(`Run not found: ${runId}`);
    const steps = run._count.crowdSnapshots;
    if (steps < 1) {
      throw new Error(
        `Missing market truth data: run ${runId} has no steps (no crowd snapshots). Run simulation first or ensure RunTimeSeries exists.`,
      );
    }

    const pnlRows = await prisma.$queryRaw<PnlRow[]>`
      SELECT COALESCE(SUM(pnl)::float, 0) AS "totalPnl"
      FROM "AgentExperience"
      WHERE "runId" = ${runId}::uuid
    `;
    const totalPnl = pnlRows[0] ? Number(pnlRows[0].totalPnl) : 0;
    const N = steps;
    const timeseriesData = Array.from({ length: N + 1 }, (_, s) => ({
      runId,
      step: s,
      value: (s / N) * totalPnl,
    }));
    await prisma.runTimeSeries.createMany({
      data: timeseriesData,
      skipDuplicates: true,
    });
    points = timeseriesData.map((p) => ({ step: p.step, value: p.value }));
  }

  const valueByStep = new Map(points.map((p) => [p.step, Number(p.value)]));
  const lastStep = points.length > 0 ? Math.max(...points.map((p) => p.step)) : 0;

  const v = valueByStep.get(step);
  if (v != null) return v;
  if (step <= 0) return valueByStep.get(0) ?? 0;
  if (step >= lastStep) return valueByStep.get(lastStep) ?? 0;
  const lo = Math.floor(step);
  const hi = Math.ceil(step);
  const vLo = valueByStep.get(lo) ?? 0;
  const vHi = valueByStep.get(hi) ?? vLo;
  return vLo + ((step - lo) / (hi - lo || 1)) * (vHi - vLo);
}

function log(msg: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

async function main(): Promise<void> {
  loadEnv();

  const argv = parseArgv();
  if (!UUID_REGEX.test(argv.runId)) {
    throw new Error("runId must be a valid UUID");
  }

  const prisma = new PrismaClient();

  try {
    log(`settle runId=${argv.runId} closeStep=${argv.closeStep} force=${argv.force}`);

    const run = await prisma.simulationRun.findUnique({
      where: { id: argv.runId },
      select: { id: true },
    });
    if (!run) {
      throw new Error(`Run not found: ${argv.runId}`);
    }

    const closePrice = await getValueAtStep(prisma, argv.runId, argv.closeStep);
    log(`closePrice at step ${argv.closeStep} = ${closePrice}`);

    // Fetch all candidate bets (openStep <= closeStep); we'll filter by status so default is idempotent (skip SETTLED).
    const candidates = await prisma.bet.findMany({
      where: {
        runId: argv.runId,
        openStep: { lte: argv.closeStep },
      },
      select: {
        id: true,
        userId: true,
        status: true,
        direction: true,
        amount: true,
        openPrice: true,
        openStep: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Counts: eligible OPEN found; already SETTLED (skipped unless --force); CANCELLED/other (never touched).
    const openFoundCount = candidates.filter((b) => b.status === "OPEN").length;
    const alreadySettledCount = candidates.filter((b) => b.status === "SETTLED" && !argv.force).length;
    const skippedCount = candidates.filter((b) => b.status === "CANCELLED" || (b.status !== "OPEN" && b.status !== "SETTLED")).length;

    // Default: only OPEN. --force: also re-settle SETTLED. Never touch CANCELLED.
    const toSettle = candidates.filter(
      (b) => b.status === "OPEN" || (argv.force && b.status === "SETTLED"),
    );
    const forcedCount = argv.force ? toSettle.filter((b) => b.status === "SETTLED").length : 0;

    let settledCount = 0;
    let totalPnl = 0;

    await prisma.$transaction(async (tx) => {
      for (const bet of toSettle) {
        const openPrice = bet.openPrice;
        const amount = bet.amount;
        const divisor = openPrice !== 0 ? openPrice : 1;
        let pnl: number;
        if (bet.direction === "BUY") {
          pnl = (closePrice - openPrice) * (amount / divisor);
        } else if (bet.direction === "SELL") {
          pnl = (openPrice - closePrice) * (amount / divisor);
        } else {
          pnl = 0;
        }

        await tx.bet.update({
          where: { id: bet.id },
          data: {
            status: "SETTLED",
            closePrice,
            closeStep: argv.closeStep,
            pnl,
            updatedAt: new Date(),
          },
        });

        // Credit wallet only on first-time settlement (OPEN -> SETTLED). Idempotent: do not re-credit when --force re-settles.
        // Skip wallet/ledger when credit is exactly 0 (full loss).
        if (bet.status === "OPEN") {
          const credit = amount + pnl;
          if (credit !== 0) {
            await tx.userWallet.upsert({
              where: { userId: bet.userId },
              create: { userId: bet.userId, balance: credit },
              update: { balance: { increment: credit }, updatedAt: new Date() },
            });
            await tx.userWalletTransaction.create({
              data: {
                userId: bet.userId,
                type: "BET_CREDIT",
                amount: credit,
                betId: bet.id,
                runId: argv.runId,
              },
            });
          }
        }

        settledCount++;
        totalPnl += pnl;
      }
    });

    log(
      `Settlement summary: openFoundCount=${openFoundCount} alreadySettledCount=${alreadySettledCount} settledCount=${settledCount} skippedCount=${skippedCount} forcedCount=${forcedCount} totalPnl=${totalPnl}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("settle failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
