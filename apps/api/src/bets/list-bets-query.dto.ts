import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { Transform, Type } from "class-transformer";

export const LIST_BETS_STATUSES = ["OPEN", "SETTLED", "CANCELLED"] as const;
export type ListBetsStatus = (typeof LIST_BETS_STATUSES)[number];

export class ListBetsQueryDto {
  @IsUUID(undefined, { message: "userId must be a valid UUID" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value) || undefined)
  userId!: string;

  @IsOptional()
  @IsEnum(LIST_BETS_STATUSES, { message: "status must be OPEN, SETTLED, or CANCELLED" })
  status?: ListBetsStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: "limit must be at least 1" })
  @Max(200, { message: "limit must be at most 200" })
  @Transform(({ value }) => (value === undefined || value === "" ? 50 : Number(value)))
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: "offset must be at least 0" })
  @Transform(({ value }) => (value === undefined || value === "" ? 0 : Number(value)))
  offset?: number;
}
