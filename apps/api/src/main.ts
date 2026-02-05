import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });
  const port = Number(process.env.PORT) || 4001;
  await app.listen(port);
  console.log(`API: http://localhost:${port}`);
}

void bootstrap();
