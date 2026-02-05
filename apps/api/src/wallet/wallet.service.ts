import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const INITIAL_BALANCE = 100;

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  /** Get or create wallet for userId. Creates with balance=100 if not exists. */
  async getOrCreateWallet(userId: string): Promise<{ userId: string; balance: number }> {
    let wallet = await this.prisma.userWallet.findUnique({
      where: { userId },
    });
    if (!wallet) {
      wallet = await this.prisma.userWallet.create({
        data: { userId, balance: INITIAL_BALANCE },
      });
    }
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
