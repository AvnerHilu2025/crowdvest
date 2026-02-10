import {
  IsString,
  IsNumber,
  IsOptional,
  IsInt,
  Min,
  Max,
} from "class-validator";

/**
 * POST /info-events body. Accepts both new (impact, type) and legacy (reach, topic) fields.
 * Constraints: sentiment [-1..1], impact/reach [0..1], credibility [0..1].
 */
export class CreateInfoEventDto {
  @IsString()
  runId!: string;

  @IsString()
  @IsOptional()
  assetSymbol?: string;

  @IsInt()
  @Min(0)
  step!: number;

  /** Legacy: used as topic if type missing. */
  @IsString()
  @IsOptional()
  topic?: string;

  /** Preferred: used as topic if topic missing (stored as topic in DB). */
  @IsString()
  @IsOptional()
  type?: string;

  @IsNumber()
  @Min(-1)
  @Max(1)
  sentiment!: number;

  /** [0..1]. If missing, default 0.5 in service. */
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  credibility?: number;

  /** Preferred [0..1]. If missing, normalized from reach. */
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  impact?: number;

  /** Legacy [0..1]. If missing, normalized from impact. */
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  reach?: number;

  @IsNumber()
  @IsOptional()
  volatilityImpact?: number;

  @IsString()
  @IsOptional()
  source?: string | null;
}
