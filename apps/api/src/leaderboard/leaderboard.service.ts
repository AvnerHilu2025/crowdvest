import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type BetRow = { id: string; userId: string; runId: string; direction: string; stake: number };
type SettledBetRow = { userId: string; pnl: number | null };
type PnlRow = { runId: string; totalPnl: number };

type WithDisplayName<T> = T & { displayName: string };

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** UserIds that have a UserProfile (presentation filter: exclude legacy demo-user etc.). */
  private async getUserIdsWithProfile(): Promise<Set<string>> {
    const profiles = await this.prisma.userProfile.findMany({
      select: { userId: true },
    });
    return new Set(profiles.map((p) => p.userId));
  }

  /** Enrich userIds with displayName from UserProfile; fallback to userId. */
  private async enrichWithDisplayName(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const profiles = await this.prisma.userProfile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, displayName: true },
    });
    const map = new Map<string, string>();
    for (const u of userIds) {
      map.set(u, profiles.find((p) => p.userId === u)?.displayName ?? u);
    }
    return map;
  }

  /** Get totalPnl per runId from AgentExperience (same as /runs metrics.totalPnl). */
  private async getRunPnlMap(): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<PnlRow[]>`
      SELECT "runId", COALESCE(SUM(pnl)::float, 0) AS "totalPnl"
      FROM "AgentExperience"
      GROUP BY "runId"
    `;
    return new Map(rows.map((r) => [r.runId, Number(r.totalPnl)]));
  }

  /** Wallet scoring: sum of settled bet pnl only; PENDING bets ignored. */
  async getWalletLeaderboard(limit: number): Promise<
    WithDisplayName<{ rank: number; userId: string; wallet: number; betsCount: number }>[]
  > {
    const bets = await this.prisma.bet.findMany({
      where: { status: "SETTLED" },
      select: { userId: true, pnl: true },
    });

    const byUser = new Map<string, { wallet: number; betsCount: number }>();
    for (const b of bets as SettledBetRow[]) {
      const pnl = b.pnl ?? 0;
      if (!byUser.has(b.userId)) {
        byUser.set(b.userId, { wallet: 0, betsCount: 0 });
      }
      const u = byUser.get(b.userId)!;
      u.wallet += pnl;
      u.betsCount += 1;
    }

    const userIdsWithProfile = await this.getUserIdsWithProfile();
    const sorted = [...byUser.entries()]
      .map(([userId, data]) => ({ userId, ...data }))
      .filter((r) => userIdsWithProfile.has(r.userId))
      .sort((a, b) => b.wallet - a.wallet)
      .slice(0, limit);

    const userIds = sorted.map((r) => r.userId);
    const displayNames = await this.enrichWithDisplayName(userIds);

    return sorted.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      displayName: displayNames.get(r.userId) ?? r.userId,
      wallet: Math.round(r.wallet * 1e6) / 1e6,
      betsCount: r.betsCount,
    }));
  }

  /** Accuracy: correct if (runPnl>0 and BUY) or (runPnl<0 and SELL). Only BUY/SELL count. */
  async getAccuracyLeaderboard(limit: number): Promise<
    WithDisplayName<{
      rank: number;
      userId: string;
      accuracy: number;
      evaluatedBets: number;
      betsCount: number;
    }>[]
  > {
    const bets = await this.prisma.bet.findMany({
      select: { id: true, userId: true, runId: true, direction: true },
    });

    const runPnl = await this.getRunPnlMap();

    const byUser = new Map<string, { correct: number; evaluated: number; total: number }>();
    for (const b of bets as BetRow[]) {
      if (!byUser.has(b.userId)) {
        byUser.set(b.userId, { correct: 0, evaluated: 0, total: 0 });
      }
      const u = byUser.get(b.userId)!;
      u.total += 1;

      if (b.direction !== "BUY" && b.direction !== "SELL") continue;
      u.evaluated += 1;
      const pnl = runPnl.get(b.runId) ?? 0;
      const correct =
        (pnl > 0 && b.direction === "BUY") || (pnl < 0 && b.direction === "SELL");
      if (correct) u.correct += 1;
    }

    const userIdsWithProfile = await this.getUserIdsWithProfile();
    const sorted = [...byUser.entries()]
      .filter(([, d]) => d.evaluated > 0)
      .map(([userId, data]) => ({
        userId,
        accuracy: data.correct / data.evaluated,
        evaluatedBets: data.evaluated,
        betsCount: data.total,
      }))
      .filter((r) => userIdsWithProfile.has(r.userId))
      .sort((a, b) => {
        if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
        return b.evaluatedBets - a.evaluatedBets;
      })
      .slice(0, limit);

    const userIds = sorted.map((r) => r.userId);
    const displayNames = await this.enrichWithDisplayName(userIds);

    return sorted.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      displayName: displayNames.get(r.userId) ?? r.userId,
      accuracy: Math.round(r.accuracy * 10000) / 100,
      evaluatedBets: r.evaluatedBets,
      betsCount: r.betsCount,
    }));
  }
}
