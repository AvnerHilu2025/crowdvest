import { IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export const BET_DIRECTIONS = ["BUY", "SELL", "HOLD"] as const;
export type BetDirection = (typeof BET_DIRECTIONS)[number];

export class CreateBetDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsUUID()
  runId!: string;

  @IsEnum(BET_DIRECTIONS)
  direction!: BetDirection;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  confidence!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001, { message: "stake must be greater than 0" })
  stake!: number;

  @IsOptional()
  @IsString()
  thesis?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  entryStep?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  exitStep?: number;

  @IsOptional()
  @IsIn(["v1", "v2"])
  settleVersion?: "v1" | "v2";
}
