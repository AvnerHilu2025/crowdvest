import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Parse DATABASE_URL and return host/port/db (mask password). Safe for dev diagnostics. */
function parseDbUrl(url: string | undefined): { dbHost: string; dbPort: string; dbName: string } {
  if (!url || typeof url !== "string") {
    return { dbHost: "?", dbPort: "?", dbName: "?" };
  }
  try {
    const u = new URL(url);
    return {
      dbHost: u.hostname || "?",
      dbPort: u.port || (u.protocol === "postgresql:" ? "5432" : "?"),
      dbName: u.pathname?.replace(/^\//, "") || "?",
    };
  } catch {
    return { dbHost: "?", dbPort: "?", dbName: "?" };
  }
}

@Controller("debug")
export class DebugController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /debug/prices?symbols=SPY,QQQ — dev-only: DB connection info + PriceSeriesPoint counts per symbol. */
  @Get("prices")
  async prices(@Query("symbols") symbolsStr?: string) {
    const symbols = (symbolsStr ?? "SPY")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, 20);

    const url = process.env.DATABASE_URL;
    const { dbHost, dbPort, dbName } = parseDbUrl(url);

    const counts: Record<string, number> = {};
    for (const symbol of symbols.length > 0 ? symbols : ["SPY", "QQQ", "IWM"]) {
      const count = await this.prisma.priceSeriesPoint.count({
        where: { symbol },
      });
      counts[symbol] = count;
    }

    return { dbHost, dbPort, dbName, counts };
  }

  /** GET /debug/prices-sample?symbols=SPY,QQQ,IWM&limit=5 — first/last PriceSeriesPoint rows per symbol. */
  @Get("prices-sample")
  async pricesSample(
    @Query("symbols") symbolsStr?: string,
    @Query("limit") limitStr?: string,
  ) {
    const symbols = (symbolsStr ?? "SPY,QQQ,IWM")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, 20);
    if (symbols.length === 0) throw new BadRequestException("symbols is required");
    const limit = Math.min(Math.max(1, parseInt(limitStr ?? "5", 10) || 5), 100);

    const result: Record<
      string,
      {
        count: number;
        first: Array<{ date: string; close: number }>;
        last: Array<{ date: string; close: number }>;
      }
    > = {};

    for (const symbol of symbols) {
      const count = await this.prisma.priceSeriesPoint.count({
        where: { symbol },
      });
      const firstRows = await this.prisma.priceSeriesPoint.findMany({
        where: { symbol },
        orderBy: { date: "asc" },
        take: limit,
        select: { date: true, close: true },
      });
      const lastRows = await this.prisma.priceSeriesPoint.findMany({
        where: { symbol },
        orderBy: { date: "desc" },
        take: limit,
        select: { date: true, close: true },
      });
      result[symbol] = {
        count,
        first: firstRows,
        last: [...lastRows].reverse(),
      };
    }
    return result;
  }
}
