import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import * as path from "path";
import { AppConfigModule } from "./config/config.module";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { AgentsModule } from "./agents/agents.module";
import { ArchetypesModule } from "./archetypes/archetypes.module";
import { TraitsModule } from "./traits/traits.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { RunsModule } from "./runs/runs.module";
import { ImportRunsModule } from "./import-runs/import-runs.module";
import { DatasetsModule } from "./datasets/datasets.module";
import { ResultsModule } from "./results/results.module";
import { BetsModule } from "./bets/bets.module";
import { LeaderboardModule } from "./leaderboard/leaderboard.module";
import { MeModule } from "./me/me.module";
import { TimeseriesModule } from "./timeseries/timeseries.module";
import { WalletModule } from "./wallet/wallet.module";
import { InfoEventsModule } from "./info-events/info-events.module";
import { JobsModule } from "./jobs/jobs.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { BenchModule } from "./bench/bench.module";
import { LaunchPlanModule } from "./launch-plan/launch-plan.module";
import { MarketDataModule } from "./market-data/market-data.module";
import { DebugModule } from "./debug/debug.module";
import { SignalsModule } from "./signals/signals.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.join(process.cwd(), "..", ".env"),
        path.join(process.cwd(), ".env"),
        "apps/api/.env",
      ],
    }),
    AppConfigModule,
    PrismaModule,
    HealthModule,
    DatasetsModule,
    AgentsModule,
    ArchetypesModule,
    TraitsModule,
    ProfilesModule,
    RunsModule,
    ImportRunsModule,
    ResultsModule,
    BetsModule,
    LeaderboardModule,
    MeModule,
    TimeseriesModule,
    WalletModule,
    InfoEventsModule,
    JobsModule,
    DashboardModule,
    BenchModule,
    LaunchPlanModule,
    MarketDataModule,
    DebugModule,
    SignalsModule,
  ],
})
export class AppModule {}
