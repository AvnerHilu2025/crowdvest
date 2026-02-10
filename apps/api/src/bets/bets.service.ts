import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TimeseriesService } from "../timeseries/timeseries.service";
import { CreateBetDto } from "./create-bet.dto";
import { CreateOpenBetDto } from "./create-open-bet.dto";

const DEMO_USER_ID = "demo-user";
const INITIAL_BALANCE = 100;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Bet constraints v2: max OPEN bets per user per run */
const MAX_OPEN_BETS_PER_RUN = 5;
/** Bet constraints v2: max OPEN exposure (sum of amount) per user per run, in coins */
const MAX_OPEN_EXPOSURE_PER_RUN = 25;

type PnlRow = { totalPnl: number };

export type CreateOpenBetResponse = {
  id: string;
  userId: string;
  runId: string;
  agentId: string | null;
  decisionStep: number | null;
  assetSymbol: string;
  direction: string;
  amount: number;
  status: string;
  openPrice: number;
  openStep: number;
  closePrice: number | null;
  closeStep: number | null;
  pnl: number;
  createdAt: string;
  updatedAt: string;
};

/** Bet list item: optional fields omitted when null (no null in response). */
export type ListBetItem = {
  id: string;
  userId: string;
  runId: string;
  agentId?: string;
  decisionStep?: number;
  assetSymbol: string;
  direction: string;
  amount: number;
  status: string;
  openPrice: number;
  openStep: number;
  closePrice?: number;
  closeStep?: number;
  pnl: number;
  createdAt: string;
  updatedAt: string;
};

function toListBetItem(b: {
  id: string;
  userId: string;
  runId: string;
  agentId: string | null;
  decisionStep: number | null;
  assetSymbol: string;
  direction: string;
  amount: number;
  status: string;
  openPrice: number;
  openStep: number;
  closePrice: number | null;
  closeStep: number | null;
  pnl: number;
  createdAt: Date;
  updatedAt: Date;
}): ListBetItem {
  const item: ListBetItem = {
    id: b.id,
    userId: b.userId,
    runId: b.runId,
    assetSymbol: b.assetSymbol,
    direction: b.direction,
    amount: b.amount,
    status: b.status,
    openPrice: b.openPrice,
    openStep: b.openStep,
    pnl: b.pnl,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
  if (b.agentId != null) item.agentId = b.agentId;
  if (b.decisionStep != null) item.decisionStep = b.decisionStep;
  if (b.closePrice != null) item.closePrice = b.closePrice;
  if (b.closeStep != null) item.closeStep = b.closeStep;
  return item;
}

@Injectable()
export class BetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeseriesService: TimeseriesService,
  ) {}

  /** Create bet with status OPEN. userId must be provided in body; bet.userId always equals body.userId. No server-side userId generation. */
  async createOpen(dto: CreateOpenBetDto): Promise<CreateOpenBetResponse> {
    if (dto.userId == null || typeof dto.userId !== "string") {
      throw new BadRequestException("userId is required");
    }
    const requestUserId = dto.userId.trim();
    if (!requestUserId) {
      throw new BadRequestException("userId is required");
    }
    if (!UUID_REGEX.test(requestUserId)) {
      throw new BadRequestException("userId must be a valid UUID");
    }

    const runId = dto.runId?.trim() ?? "";
    if (!runId || !UUID_REGEX.test(runId)) {
      throw new BadRequestException("runId must be a valid UUID");
    }
    if (dto.agentId != null && dto.agentId.trim() !== "" && !UUID_REGEX.test(dto.agentId.trim())) {
      throw new BadRequestException("agentId must be a valid UUID when provided");
    }
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("amount must be greater than 0");
    }
    const openStep = Number(dto.openStep);
    if (!Number.isFinite(openStep) || openStep < 0) {
      throw new BadRequestException("openStep must be a non-negative integer");
    }
    let openPrice: number;
    if (typeof dto.openPrice === "number" && Number.isFinite(dto.openPrice)) {
      openPrice = dto.openPrice;
    } else {
      openPrice = await this.timeseriesService.getValueAtStep(runId, openStep);
    }
    const assetSymbol = dto.assetSymbol?.trim() ?? "";
    if (!assetSymbol) {
      throw new BadRequestException("assetSymbol is required");
    }
    if (dto.decisionStep != null) {
      const step = Number(dto.decisionStep);
      if (!Number.isInteger(step) || step < 0) {
        throw new BadRequestException("decisionStep must be a non-negative integer");
      }
    }

    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) {
      throw new NotFoundException(`Run not found: ${runId}`);
    }

    const bet = await this.prisma.$transaction(async (tx) => {
      const [openBetCount, openAgg] = await Promise.all([
        tx.bet.count({ where: { userId: requestUserId, runId, status: "OPEN" } }),
        tx.bet.aggregate({
          where: { userId: requestUserId, runId, status: "OPEN" },
          _sum: { amount: true },
        }),
      ]);
      const openExposure = openAgg._sum.amount ?? 0;
      if (openBetCount >= MAX_OPEN_BETS_PER_RUN) {
        throw new BadRequestException("max open bets exceeded for run");
      }
      if (openExposure + amount > MAX_OPEN_EXPOSURE_PER_RUN) {
        throw new BadRequestException("max open exposure exceeded for run");
      }

      let wallet = await tx.userWallet.findUnique({ where: { userId: requestUserId } });
      if (!wallet) {
        await tx.userWallet.create({
          data: { userId: requestUserId, balance: INITIAL_BALANCE },
        });
        await tx.userWalletTransaction.create({
          data: {
            userId: requestUserId,
            type: "SEED",
            amount: INITIAL_BALANCE,
            note: "initial balance",
          },
        });
        wallet = await tx.userWallet.findUniqueOrThrow({ where: { userId: requestUserId } });
      }
      if (wallet.balance < amount) {
        throw new BadRequestException("insufficient funds");
      }
      await tx.userWallet.update({
        where: { userId: requestUserId },
        data: { balance: { decrement: amount }, updatedAt: new Date() },
      });
      const newBet = await tx.bet.create({
        data: {
          userId: requestUserId,
          runId,
          agentId: dto.agentId?.trim() || null,
          decisionStep: dto.decisionStep ?? null,
          assetSymbol,
          direction: dto.direction,
          amount,
          status: "OPEN",
          openPrice,
          openStep,
          closePrice: null,
          closeStep: null,
          pnl: 0,
          updatedAt: new Date(),
        },
      });
      await tx.userWalletTransaction.create({
        data: {
          userId: requestUserId,
          type: "BET_DEBIT",
          amount: -amount,
          betId: newBet.id,
          runId,
        },
      });
      return newBet;
    });

    if (bet.userId !== requestUserId) {
      throw new InternalServerErrorException(
        `userId mismatch: saved bet.userId (${bet.userId}) !== body.userId (${requestUserId})`,
      );
    }

    return {
      id: bet.id,
      userId: bet.userId,
      runId: bet.runId,
      agentId: bet.agentId ?? null,
      decisionStep: bet.decisionStep ?? null,
      assetSymbol: bet.assetSymbol,
      direction: bet.direction,
      amount: bet.amount,
      status: bet.status,
      openPrice: bet.openPrice,
      openStep: bet.openStep,
      closePrice: bet.closePrice ?? null,
      closeStep: bet.closeStep ?? null,
      pnl: bet.pnl,
      createdAt: bet.createdAt.toISOString(),
      updatedAt: bet.updatedAt.toISOString(),
    };
  }

  /** Run totalPnl from AgentExperience (same source as /runs). */
  private async getRunTotalPnl(runId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<PnlRow[]>`
      SELECT COALESCE(SUM(pnl)::float, 0) AS "totalPnl"
      FROM "AgentExperience"
      WHERE "runId" = ${runId}::uuid
    `;
    return rows[0] ? Number(rows[0].totalPnl) : 0;
  }

  /** Legacy create: maps CreateBetDto to Bet v1 schema. direction HOLD mapped to BUY. */
  async create(dto: CreateBetDto) {
    const runId = dto.runId?.trim() ?? "";
    if (!runId || !UUID_REGEX.test(runId)) {
      throw new BadRequestException("runId must be a valid UUID");
    }
    const amount = Number(dto.stake);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("stake must be greater than 0");
    }
    const direction = dto.direction === "HOLD" ? "BUY" : dto.direction;
    const userId = dto.userId?.trim() || DEMO_USER_ID;

    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true, status: true },
    });
    if (!run) {
      throw new NotFoundException(`Run not found: ${runId}`);
    }

    const openStep = dto.entryStep ?? 0;
    const exitStep = dto.exitStep ?? null;

    const bet = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.userWallet.upsert({
        where: { userId },
        create: { userId, balance: INITIAL_BALANCE },
        update: {},
      });
      if (wallet.balance < amount) {
        throw new BadRequestException("INSUFFICIENT_BALANCE");
      }
      const newBet = await tx.bet.create({
        data: {
          userId,
          runId,
          assetSymbol: "RUN",
          direction: direction as "BUY" | "SELL",
          amount,
          status: "OPEN",
          openPrice: 0,
          openStep,
          closePrice: null,
          closeStep: exitStep,
          pnl: 0,
          updatedAt: new Date(),
        },
      });
      await tx.userWallet.update({
        where: { userId },
        data: { balance: { decrement: amount } },
      });
      return newBet;
    });

    const useV2 =
      run.status === "COMPLETED" &&
      (dto.settleVersion === "v2" || dto.entryStep != null || dto.exitStep != null);
    const finalBet =
      run.status === "COMPLETED"
        ? useV2
          ? await this.settleBetByIdV2(bet.id)
          : await this.settleBetById(bet.id)
        : this.formatBetResponseV1(bet);

    return finalBet;
  }

  private formatBetResponseV1(bet: {
    id: string;
    userId: string;
    runId: string;
    direction: string;
    amount: number;
    status: string;
    openStep: number;
    closeStep: number | null;
    openPrice: number;
    closePrice: number | null;
    pnl: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: bet.id,
      userId: bet.userId,
      runId: bet.runId,
      direction: bet.direction,
      amount: bet.amount,
      status: bet.status,
      openStep: bet.openStep,
      closeStep: bet.closeStep ?? null,
      openPrice: bet.openPrice,
      closePrice: bet.closePrice ?? null,
      pnl: bet.pnl,
      createdAt: bet.createdAt.toISOString(),
      updatedAt: bet.updatedAt.toISOString(),
    };
  }

  /** Settle exactly one OPEN bet by id. Same v1 rules. Returns updated bet. */
  async settleBetById(betId: string): Promise<ReturnType<typeof this.formatBetResponseV1>> {
    const bid = betId?.trim() ?? "";
    if (!bid || !UUID_REGEX.test(bid)) {
      throw new BadRequestException("bet id must be a valid UUID");
    }
    const bet = await this.prisma.bet.findUnique({
      where: { id: bid },
      select: { id: true, userId: true, runId: true, direction: true, amount: true, status: true, openStep: true, closeStep: true },
    });
    if (!bet) {
      throw new NotFoundException(`Bet not found: ${bid}`);
    }
    if (bet.status !== "OPEN") {
      throw new BadRequestException(`Bet ${bid} is not OPEN`);
    }

    const runTotalPnl = await this.getRunTotalPnl(bet.runId);
    let pnl: number = 0;
    if (bet.direction === "BUY") {
      pnl = runTotalPnl > 0 ? bet.amount * Math.abs(runTotalPnl) : -bet.amount;
    } else if (bet.direction === "SELL") {
      pnl = runTotalPnl < 0 ? bet.amount * Math.abs(runTotalPnl) : -bet.amount;
    }

    const credit = bet.amount + pnl;
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.bet.update({
        where: { id: bid },
        data: {
          status: "SETTLED",
          pnl,
          closePrice: null,
          closeStep: bet.closeStep ?? bet.openStep,
          updatedAt: new Date(),
        },
      });
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
            betId: bid,
            runId: bet.runId,
          },
        });
      }
      return tx.bet.findUniqueOrThrow({
        where: { id: bid },
        select: {
          id: true,
          userId: true,
          runId: true,
          direction: true,
          amount: true,
          status: true,
          openStep: true,
          closeStep: true,
          openPrice: true,
          closePrice: true,
          pnl: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
    return this.formatBetResponseV1(updated);
  }

  /** Settle exactly one OPEN bet by id using v2 (timeseries curve delta). */
  async settleBetByIdV2(betId: string): Promise<ReturnType<typeof this.formatBetResponseV1>> {
    const bid = betId?.trim() ?? "";
    if (!bid || !UUID_REGEX.test(bid)) {
      throw new BadRequestException("bet id must be a valid UUID");
    }
    const bet = await this.prisma.bet.findUnique({
      where: { id: bid },
      select: { id: true, userId: true, runId: true, direction: true, amount: true, status: true, openStep: true, closeStep: true },
    });
    if (!bet) {
      throw new NotFoundException(`Bet not found: ${bid}`);
    }
    if (bet.status !== "OPEN") {
      throw new BadRequestException(`Bet ${bid} is not OPEN`);
    }

    const { points, steps: lastStep } = await this.timeseriesService.getTimeseries(bet.runId);
    const valueByStep = new Map(points.map((p) => [p.step, p.value]));
    const getValue = (step: number): number => {
      const v = valueByStep.get(step);
      if (v != null) return v;
      if (step <= 0) return valueByStep.get(0) ?? 0;
      if (step >= lastStep) return valueByStep.get(lastStep) ?? 0;
      const lo = Math.floor(step);
      const hi = Math.ceil(step);
      const vLo = valueByStep.get(lo) ?? 0;
      const vHi = valueByStep.get(hi) ?? vLo;
      return vLo + ((step - lo) / (hi - lo || 1)) * (vHi - vLo);
    };

    const openStep = bet.openStep;
    const closeStep = bet.closeStep ?? lastStep;
    const start = getValue(openStep);
    const end = getValue(closeStep);
    const delta = end - start;

    let pnl = 0;
    if (bet.direction === "BUY") {
      pnl = bet.amount * delta;
    } else if (bet.direction === "SELL") {
      pnl = bet.amount * -delta;
    }

    const credit = bet.amount + pnl;
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.bet.update({
        where: { id: bid },
        data: {
          status: "SETTLED",
          pnl,
          closePrice: end,
          closeStep,
          updatedAt: new Date(),
        },
      });
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
            betId: bid,
            runId: bet.runId,
          },
        });
      }
      return tx.bet.findUniqueOrThrow({
        where: { id: bid },
        select: {
          id: true,
          userId: true,
          runId: true,
          direction: true,
          amount: true,
          status: true,
          openStep: true,
          closeStep: true,
          openPrice: true,
          closePrice: true,
          pnl: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
    return this.formatBetResponseV1(updated);
  }

  /** Settle all PENDING bets for a run. version=v2 uses curve delta; default v1. */
  async settleRun(
    runId: string,
    version?: string,
  ): Promise<{ runId: string; settledCount: number }> {
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

    if (version === "v2") {
      return this.settleRunV2(rId);
    }

    const runTotalPnl = await this.getRunTotalPnl(rId);
    const pendingBets = await this.prisma.bet.findMany({
      where: { runId: rId, status: "OPEN" },
      select: { id: true, userId: true, direction: true, amount: true },
    });

    if (pendingBets.length === 0) {
      return { runId: rId, settledCount: 0 };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const bet of pendingBets) {
        let pnl: number = 0;
        if (bet.direction === "BUY") {
          pnl = runTotalPnl > 0 ? bet.amount * Math.abs(runTotalPnl) : -bet.amount;
        } else if (bet.direction === "SELL") {
          pnl = runTotalPnl < 0 ? bet.amount * Math.abs(runTotalPnl) : -bet.amount;
        }
        const credit = bet.amount + pnl;
        await tx.bet.update({
          where: { id: bet.id },
          data: {
            status: "SETTLED",
            pnl,
            closePrice: null,
            updatedAt: new Date(),
          },
        });
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
              runId: rId,
            },
          });
        }
      }
    });

    return { runId: rId, settledCount: pendingBets.length };
  }

  /** v2: Settle using timeseries curve delta. */
  private async settleRunV2(runId: string): Promise<{ runId: string; settledCount: number }> {
    const { points, steps: lastStep } = await this.timeseriesService.getTimeseries(runId);
    const valueByStep = new Map(points.map((p) => [p.step, p.value]));

    const pendingBets = await this.prisma.bet.findMany({
      where: { runId, status: "OPEN" },
      select: { id: true, userId: true, direction: true, amount: true, openStep: true, closeStep: true },
    });

    if (pendingBets.length === 0) {
      return { runId, settledCount: 0 };
    }

    const getValue = (step: number): number => {
      const v = valueByStep.get(step);
      if (v != null) return v;
      if (step <= 0) return valueByStep.get(0) ?? 0;
      if (step >= lastStep) return valueByStep.get(lastStep) ?? 0;
      const lo = Math.floor(step);
      const hi = Math.ceil(step);
      const vLo = valueByStep.get(lo) ?? 0;
      const vHi = valueByStep.get(hi) ?? vLo;
      return vLo + ((step - lo) / (hi - lo || 1)) * (vHi - vLo);
    };

    await this.prisma.$transaction(async (tx) => {
      for (const bet of pendingBets) {
        const openStep = bet.openStep;
        const closeStep = bet.closeStep ?? lastStep;
        const start = getValue(openStep);
        const end = getValue(closeStep);
        const delta = end - start;

        let pnl = 0;
        if (bet.direction === "BUY") {
          pnl = bet.amount * delta;
        } else if (bet.direction === "SELL") {
          pnl = bet.amount * -delta;
        }
        const credit = bet.amount + pnl;

        await tx.bet.update({
          where: { id: bet.id },
          data: {
            status: "SETTLED",
            pnl,
            closePrice: end,
            closeStep,
            updatedAt: new Date(),
          },
        });
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
              runId,
            },
          });
        }
      }
    });

    return { runId, settledCount: pendingBets.length };
  }

  /** Settle the latest run (by createdAt desc). */
  async settleLatest(version?: string): Promise<{ runId: string; settledCount: number }> {
    const latest = await this.prisma.simulationRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!latest) {
      throw new NotFoundException("No run found");
    }
    return this.settleRun(latest.id, version);
  }

  /** GET /bets?userId=&limit=&offset=&status=. Filters strictly by userId. Returns { items: Bet[], total }. Empty list when none. */
  async listByUser(
    userId: string,
    limit: number,
    offset: number,
    status?: "OPEN" | "SETTLED" | "CANCELLED",
  ): Promise<{ items: ListBetItem[]; total: number }> {
    const uid = userId?.trim() ?? "";
    if (!uid || !UUID_REGEX.test(uid)) {
      throw new BadRequestException("userId must be a valid UUID");
    }
    const take = Math.min(Math.max(1, limit ?? 50), 200);
    const skip = Math.max(0, offset ?? 0);
    const where: { userId: string; status?: "OPEN" | "SETTLED" | "CANCELLED" } = { userId: uid };
    if (status) where.status = status;

    const [rows, total] = await Promise.all([
      this.prisma.bet.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        select: {
          id: true,
          userId: true,
          runId: true,
          agentId: true,
          decisionStep: true,
          assetSymbol: true,
          direction: true,
          amount: true,
          status: true,
          openPrice: true,
          openStep: true,
          closePrice: true,
          closeStep: true,
          pnl: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.bet.count({ where }),
    ]);

    return {
      items: rows.map((b) => toListBetItem(b)),
      total,
    };
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
          amount: true,
          status: true,
          openStep: true,
          closeStep: true,
          openPrice: true,
          closePrice: true,
          pnl: true,
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
        amount: b.amount,
        status: b.status,
        openStep: b.openStep,
        closeStep: b.closeStep ?? null,
        openPrice: b.openPrice,
        closePrice: b.closePrice ?? null,
        pnl: b.pnl ?? null,
        createdAt: b.createdAt.toISOString(),
      })),
      total,
    };
  }
}
