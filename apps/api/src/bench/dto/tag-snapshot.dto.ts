import { IsBoolean, IsOptional, IsString, Matches } from "class-validator";

export class TagSnapshotDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9\-]*[a-z0-9]$/i, {
    message: "tag must be alphanumeric with optional dashes (no spaces)",
  })
  tag!: string;

  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}
