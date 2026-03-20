import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";

@Injectable()
export class ConfigService {
  constructor(private readonly nestConfig: NestConfigService) {}

  getAlphaVantageKey(): string | undefined {
    return this.nestConfig.get<string>("ALPHAVANTAGE_API_KEY");
  }
}
