import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { Transform, Type } from "class-transformer";

export class ListBetsQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    const s = typeof value === "string" ? value.trim() : value;
    return s === "" ? undefined : s;
  })
  userId?: string;

  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => {
    const s = typeof value === "string" ? value.trim() : value;
    return s === "" ? undefined : s;
  })
  runId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
