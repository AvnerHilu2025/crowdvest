import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@crowdvest/db";

const DATABASE_URL_MISSING =
  "DATABASE_URL is not set. Create a .env file at the repository root (or in apps/api) with DATABASE_URL. Example: DATABASE_URL=postgresql://user:password@localhost:5432/crowdvest";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    const url = process.env.DATABASE_URL;
    if (!url || url.trim() === "") {
      const cwd = process.cwd();
      throw new Error(`${DATABASE_URL_MISSING} (process.cwd(): ${cwd})`);
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
