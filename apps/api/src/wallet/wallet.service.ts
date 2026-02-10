import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const INITIAL_BALANCE = 100;

export type WalletSummaryResponse = {
  available: number;
  locked: number;
  total: number;
};

export type WalletTransactionItem = {
  id: string;
  userId: string;
  type: string;
  amount: number;
  betId: string | null;
  runId: string | null;
  note: string | null;
  createdAt: string;
};

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  /** Wallet v3: balance breakdown (available / locked / total). Read-only. */
  async getWalletSummary(userId: string): Promise<WalletSummaryResponse> {
    const wallet = await this.getOrCreateWallet(userId);
    const openAgg = await this.prisma.bet.aggregate({
      where: { userId, status: "OPEN" },
      _sum: { amount: true },
    });
    const locked = openAgg._sum.amount ?? 0;
    const available = wallet.balance;
    const total = available + locked;
    return { available, locked, total };
  }

  /** Get or create wallet for userId. Creates with balance=100 if not exists. Inserts SEED transaction when creating. */
  async getOrCreateWallet(userId: string): Promise<{ userId: string; balance: number }> {
    const existing = await this.prisma.userWallet.findUnique({
      where: { userId },
    });
    if (existing) {
      return { userId: existing.userId, balance: existing.balance };
    }
    const wallet = await this.prisma.$transaction(async (tx) => {
      const created = await tx.userWallet.create({
        data: { userId, balance: INITIAL_BALANCE },
      });
      await tx.userWalletTransaction.create({
        data: {
          userId,
          type: "SEED",
          amount: INITIAL_BALANCE,
          note: "initial balance",
        },
      });
      return created;
    });
    return { userId: wallet.userId, balance: wallet.balance };
  }

  /** List transactions for userId, ordered by createdAt desc. Lazy backfills SEED for pre-ledger wallets. */
  async listTransactions(
    userId: string,
    limit: number,
  ): Promise<{ items: WalletTransactionItem[]; total: number }> {
    const take = Math.min(Math.max(1, limit), 200);
    const seedExists = await this.prisma.userWalletTransaction.findFirst({
      where: { userId, type: "SEED" },
    });
    if (!seedExists) {
      await this.backfillPreLedgerSeed(userId);
    }

    const [items, totalAfter] = await Promise.all([
      this.prisma.userWalletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take,
      }),
      this.prisma.userWalletTransaction.count({ where: { userId } }),
    ]);
    return {
      items: items.map((t) => ({
        id: t.id,
        userId: t.userId,
        type: t.type,
        amount: t.amount,
        betId: t.betId,
        runId: t.runId,
        note: t.note,
        createdAt: t.createdAt.toISOString(),
      })),
      total: totalAfter,
    };
  }

  /** Backfill one SEED transaction for pre-ledger wallet. Atomic; idempotent (unique on userId where type=SEED). */
  private async backfillPreLedgerSeed(userId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.userWalletTransaction.findFirst({
          where: { userId, type: "SEED" },
        });
        if (existing) return;

        const wallet = await tx.userWallet.findUnique({ where: { userId } });
        if (!wallet || wallet.balance === 0) return;

        await tx.userWalletTransaction.create({
          data: {
            userId,
            type: "SEED",
            amount: wallet.balance,
            note: "backfill seed from pre-ledger wallet",
            betId: null,
            runId: null,
          },
        });
      });
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === "P2002") {
        return;
      }
      throw e;
    }
  }

  /** Admin/dev: adjust balance by amount and insert ADJUSTMENT transaction. Atomic. */
  async adjust(userId: string, amount: number, note?: string | null): Promise<{ userId: string; balance: number }> {
    const wallet = await this.prisma.$transaction(async (tx) => {
      await tx.userWallet.upsert({
        where: { userId },
        create: { userId, balance: amount },
        update: { balance: { increment: amount }, updatedAt: new Date() },
      });
      await tx.userWalletTransaction.create({
        data: {
          userId,
          type: "ADJUSTMENT",
          amount,
          note: note ?? null,
        },
      });
      return tx.userWallet.findUniqueOrThrow({ where: { userId } });
    });
    return { userId: wallet.userId, balance: wallet.balance };
  }

  /** Dev-only: reset wallet to given balance. Can be removed later. */
  async resetWallet(userId: string, balance: number): Promise<{ userId: string; balance: number }> {
    const wallet = await this.prisma.userWallet.upsert({
      where: { userId },
      create: { userId, balance },
      update: { balance },
    });
    return { userId: wallet.userId, balance: wallet.balance };
  }

  /** Update balance by delta. Caller must ensure sufficient balance for negative deltas. */
  async updateBalance(userId: string, delta: number): Promise<{ userId: string; balance: number }> {
    const wallet = await this.prisma.userWallet.upsert({
      where: { userId },
      create: { userId, balance: INITIAL_BALANCE + delta },
      update: { balance: { increment: delta } },
    });
    return { userId: wallet.userId, balance: wallet.balance };
  }
}
