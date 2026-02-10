import { IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { Type } from "class-transformer";

export const OPEN_BET_DIRECTIONS = ["BUY", "SELL"] as const;
export type OpenBetDirection = (typeof OPEN_BET_DIRECTIONS)[number];

// v1: bets are placed on RUN outcome, not real assets; extend array for real symbols later.
export const ALLOWED_ASSET_SYMBOLS = ["RUN"] as const;

export class CreateOpenBetDto {
  @IsUUID(undefined, { message: "userId must be a valid UUID" })
  userId!: string;

  @IsUUID(undefined, { message: "runId must be a valid UUID" })
  runId!: string;

  @IsOptional()
  @IsUUID(undefined, { message: "agentId must be a valid UUID when provided" })
  agentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: "decisionStep must be a non-negative integer" })
  decisionStep?: number;

  @IsNotEmpty({ message: "assetSymbol is required" })
  @IsString()
  @IsIn(ALLOWED_ASSET_SYMBOLS, { message: "assetSymbol must be RUN (v1: bets are on run outcome)" })
  assetSymbol!: string;

  @IsEnum(OPEN_BET_DIRECTIONS, { message: "direction must be BUY or SELL" })
  direction!: OpenBetDirection;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001, { message: "amount must be greater than 0" })
  amount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  openPrice?: number;

  @Type(() => Number)
  @IsNumber()
  @IsInt()
  @Min(0, { message: "openStep must be a non-negative integer" })
  openStep!: number;
}
