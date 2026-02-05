import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBetDto } from "./create-bet.dto";

const DEMO_USER_ID = "demo-user";
const INITIAL_BALANCE = 100;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVAL_VERSION_V1 = "v1";

type PnlRow = { totalPnl: number };

@Injectable()
export class BetsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Run totalPnl from AgentExperience (same source as /runs). */
  private async getRunTotalPnl(runId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<PnlRow[]>`
      SELECT COALESCE(SUM(pnl)::float, 0) AS "totalPnl"
      FROM "AgentExperience"
      WHERE "runId" = ${runId}::uuid
    `;
    return rows[0] ? Number(rows[0].totalPnl) : 0;
  }

  async create(dto: CreateBetDto) {
    const runId = dto.runId?.trim() ?? "";
    if (!runId || !UUID_REGEX.test(runId)) {
      throw new BadRequestException("runId must be a valid UUID");
    }
    const conf = Number(dto.confidence);
    if (!Number.isInteger(conf) || conf < 0 || conf > 100) {
      throw new BadRequestException("confidence must be an integer 0-100");
    }
    const stake = Number(dto.stake);
    if (!Number.isFinite(stake) || stake <= 0) {
      throw new BadRequestException("stake must be greater than 0");
    }

    const userId = dto.userId?.trim() || DEMO_USER_ID;

    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) {
      throw new NotFoundException(`Run not found: ${runId}`);
    }

    const bet = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.userWallet.upsert({
        where: { userId },
        create: { userId, balance: INITIAL_BALANCE },
        update: {},
      });
      if (wallet.balance < stake) {
        throw new BadRequestException("INSUFFICIENT_BALANCE");
      }
      const newBet = await tx.bet.create({
        data: {
          userId,
          runId,
          direction: dto.direction,
          confidence: conf,
          stake,
          thesis: dto.thesis ?? null,
        },
      });
      await tx.userWallet.update({
        where: { userId },
        data: { balance: { decrement: stake } },
      });
      return newBet;
    });

    return {
      id: bet.id,
      userId: bet.userId,
      runId: bet.runId,
      direction: bet.direction,
      confidence: bet.confidence,
      stake: bet.stake,
      thesis: bet.thesis,
      status: bet.status,
      evalVersion: bet.evalVersion,
      isCorrect: bet.isCorrect,
      pnl: bet.pnl,
      settledAt: bet.settledAt?.toISOString() ?? null,
      createdAt: bet.createdAt.toISOString(),
    };
  }

  /** Settle all PENDING bets for a run. Outcome v1: BUY/SELL correct => stake*|runPnl|, wrong => -stake; HOLD => 0. */
  async settleRun(runId: string): Promise<{ runId: string; settledCount: number }> {
    const rId = runId?.trim() ?? "";
    if (!rId || !UUID_REGEX.test(rId)) {
      throw new BadRequestException("runId must be a valid UUID");
    }
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: rId },
      select: { id: true },
    });
    if (!run) {
      throw new NotFoundException(`Run not found: ${rId}`);
    }

    const runTotalPnl = await this.getRunTotalPnl(rId);
    const pendingBets = await this.prisma.bet.findMany({
      where: { runId: rId, status: "PENDING" },
      select: { id: true, userId: true, direction: true, stake: true },
    });

    if (pendingBets.length === 0) {
      return { runId: rId, settledCount: 0 };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const bet of pendingBets) {
        let isCorrect: boolean | null = null;
        let pnl: number = 0;
        if (bet.direction === "BUY") {
          isCorrect = runTotalPnl > 0;
          pnl = isCorrect ? bet.stake * Math.abs(runTotalPnl) : -bet.stake;
        } else if (bet.direction === "SELL") {
          isCorrect = runTotalPnl < 0;
          pnl = isCorrect ? bet.stake * Math.abs(runTotalPnl) : -bet.stake;
        }
        const settledAt = new Date();
        await tx.bet.update({
          where: { id: bet.id },
          data: {
            status: "SETTLED",
            evalVersion: EVAL_VERSION_V1,
            isCorrect,
            pnl,
            settledAt,
          },
        });
        await tx.userWallet.upsert({
          where: { userId: bet.userId },
          create: { userId: bet.userId, balance: INITIAL_BALANCE + pnl },
          update: { balance: { increment: pnl } },
        });
      }
    });

    return { runId: rId, settledCount: pendingBets.length };
  }

  /** Settle the latest run (by createdAt desc). */
  async settleLatest(): Promise<{ runId: string; settledCount: number }> {
    const latest = await this.prisma.simulationRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!latest) {
      throw new NotFoundException("No run found");
    }
    return this.settleRun(latest.id);
  }

  async findAll(opts: { userId?: string; runId?: string; limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
    const offset = Math.max(0, opts.offset ?? 0);

    const where: { userId?: string; runId?: string } = {};
    if (opts.userId != null && opts.userId.trim() !== "") {
      where.userId = opts.userId.trim();
    }
    if (opts.runId != null && opts.runId.trim() !== "" && UUID_REGEX.test(opts.runId.trim())) {
      where.runId = opts.runId.trim();
    }

    const [items, total] = await Promise.all([
      this.prisma.bet.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          userId: true,
          runId: true,
          direction: true,
          confidence: true,
          stake: true,
          thesis: true,
          status: true,
          evalVersion: true,
          isCorrect: true,
          pnl: true,
          settledAt: true,
          createdAt: true,
          run: { select: { name: true } },
        },
      }),
      this.prisma.bet.count({ where }),
    ]);

    return {
      items: items.map((b) => ({
        id: b.id,
        userId: b.userId,
        runId: b.runId,
        runName: b.run.name,
        direction: b.direction,
        confidence: b.confidence,
        stake: b.stake,
        thesis: b.thesis,
        status: b.status,
        evalVersion: b.evalVersion,
        isCorrect: b.isCorrect,
        pnl: b.pnl,
        settledAt: b.settledAt?.toISOString() ?? null,
        createdAt: b.createdAt.toISOString(),
      })),
      total,
    };
  }
}
