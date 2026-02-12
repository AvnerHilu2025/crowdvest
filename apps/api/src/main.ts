import express from "express";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { requestIdMiddleware } from "./common/request-id.middleware";
import { GlobalExceptionFilter } from "./common/global-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const http = app.getHttpAdapter().getInstance();
  http.use(express.json({ limit: "1mb" }));
  http.use(requestIdMiddleware);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableCors({ origin: true });
  const port = Number(process.env.PORT) || 4001;
  await app.listen(port);
  console.log(`API: http://localhost:${port}`);
}

void bootstrap();
