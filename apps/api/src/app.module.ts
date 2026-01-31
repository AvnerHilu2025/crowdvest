import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { ArchetypesModule } from "./archetypes/archetypes.module";
import { TraitsModule } from "./traits/traits.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { RunsModule } from "./runs/runs.module";
import { ImportRunsModule } from "./import-runs/import-runs.module";
import { DatasetsModule } from "./datasets/datasets.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../.env", ".env", "apps/api/.env","../../.env"],
    }),
    PrismaModule,
    HealthModule,
    DatasetsModule,
    ArchetypesModule,
    TraitsModule,
    ProfilesModule,
    RunsModule,
    ImportRunsModule,
  ],
})
export class AppModule {}
