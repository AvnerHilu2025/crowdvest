import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Response } from "express";
import { BenchService } from "./bench.service";
import { TagSnapshotDto } from "./dto/tag-snapshot.dto";

@Controller("bench/windows/snapshots")
export class BenchWindowsSnapshotsController {
  constructor(private readonly benchService: BenchService) {}

  /** GET /bench/windows/snapshots — list latest bench window snapshots. Query: limit (default 20, max 100). */
  @Get()
  async list(@Query("limit") limitStr?: string) {
    const limit = Math.min(
      Math.max(1, parseInt(limitStr ?? "20", 10) || 20),
      100,
    );
    return this.benchService.listBenchWindowSnapshots(limit);
  }

  /** GET /bench/windows/snapshots/latest — latest snapshot matching symbols and windows. Query: symbols (required), windows (required), n (optional). */
  @Get("latest")
  async getLatest(
    @Query("symbols") symbolsStr?: string,
    @Query("windows") windowsStr?: string,
    @Query("n") nStr?: string,
  ) {
    const symbols = (symbolsStr ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .sort()
      .join(",");
    if (!symbols) {
      throw new BadRequestException("symbols is required (e.g. symbols=SPY,QQQ)");
    }
    const windowsRaw = (windowsStr ?? "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((v) => Number.isFinite(v) && v >= 2 && v <= 365);
    if (windowsRaw.length === 0) {
      throw new BadRequestException("windows is required (e.g. windows=29,60,120)");
    }
    const windows = [...new Set(windowsRaw)].sort((a, b) => a - b).map(String).join(",");
    const n = nStr != null ? parseInt(nStr, 10) : undefined;
    const snapshot = await this.benchService.getLatestBenchWindowSnapshot(
      symbols,
      windows,
      Number.isFinite(n) ? n : undefined,
    );
    if (!snapshot) {
      throw new NotFoundException(
        `No snapshot found for symbols=${symbols} windows=${windows}`,
      );
    }
    return snapshot;
  }

  /** GET /bench/windows/snapshots/by-tag/:tag — get snapshot by tag. */
  @Get("by-tag/:tag")
  async getByTag(@Param("tag") tag: string) {
    return this.benchService.getBenchWindowSnapshotByTag(tag);
  }

  /** GET /bench/windows/snapshots/baseline — get baseline snapshot by tag. Query: tag (required). */
  @Get("baseline")
  async getBaseline(@Query("tag") tag?: string) {
    const snapshot = await this.benchService.getBaselineByTag(tag ?? "");
    if (!snapshot) {
      throw new NotFoundException(
        `No baseline snapshot found for tag=${tag ?? ""}`,
      );
    }
    return snapshot;
  }

  /** GET /bench/windows/snapshots/find — latest matching snapshot metadata (for debugging cache hits). Query: symbols (required), windows (required), n (required), datasetVersion (optional), modelVersion (optional). */
  @Get("find")
  async find(
    @Query("symbols") symbolsStr?: string,
    @Query("windows") windowsStr?: string,
    @Query("n") nStr?: string,
    @Query("datasetVersion") datasetVersion?: string,
    @Query("modelVersion") modelVersion?: string,
  ) {
    const symbols = (symbolsStr ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, 10);
    if (symbols.length === 0) {
      throw new BadRequestException("symbols is required (e.g. symbols=SPY,QQQ)");
    }
    const windowsRaw = (windowsStr ?? "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((v) => Number.isFinite(v) && v >= 2 && v <= 365);
    if (windowsRaw.length === 0) {
      throw new BadRequestException(
        "windows is required (e.g. windows=29,60,120)",
      );
    }
    const windows = [...new Set(windowsRaw)].slice(0, 5);
    const n = parseInt(nStr ?? "", 10);
    if (!Number.isFinite(n) || n < 1) {
      throw new BadRequestException("n is required and must be a positive number");
    }

    const snapshot = await this.benchService.findMatchingBenchWindowSnapshot({
      symbols,
      windows,
      n,
      datasetVersion: datasetVersion?.trim() || undefined,
      modelVersion: modelVersion?.trim() || undefined,
    });
    if (!snapshot) {
      throw new NotFoundException(
        `No snapshot found for symbols=${symbols.join(",")} windows=${windows.join(",")} n=${n}`,
      );
    }
    return snapshot;
  }

  /** GET /bench/windows/snapshots/:id/diff — diff current snapshot vs baseline. Query: against (required, baseline snapshot id). */
  @Get(":id/diff")
  async diff(
    @Param("id") id: string,
    @Query("against") againstId?: string,
  ) {
    if (!againstId?.trim()) {
      throw new BadRequestException("against query param is required (baseline snapshot id)");
    }
    return this.benchService.getBenchWindowSnapshotDiff(id.trim(), againstId.trim());
  }

  /** POST /bench/windows/snapshots/:id/tag — tag snapshot as baseline. Body: { tag: "baseline-v1", overwrite?: boolean }. Query: overwrite (default false) to move tag from another snapshot. Returns 201 when write occurred, 200 when idempotent. */
  @Post(":id/tag")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async tag(
    @Param("id") id: string,
    @Body() body: TagSnapshotDto,
    @Res() res: Response,
    @Query("overwrite") overwriteQ?: string,
  ) {
    const overwrite =
      body.overwrite ?? (overwriteQ === "true" || overwriteQ === "1");

    const { created, snapshot } =
      await this.benchService.tagBenchWindowSnapshot(
        id.trim(),
        body.tag,
        overwrite,
      );

    return res.status(created ? 201 : 200).json(snapshot);
  }

  /** GET /bench/windows/snapshots/:id — full snapshot including payload (parsed from payloadJson). */
  @Get(":id")
  async getById(@Param("id") id: string) {
    const snapshot = await this.benchService.getBenchWindowSnapshot(id);
    if (!snapshot) {
      throw new NotFoundException(`Snapshot ${id} not found`);
    }
    return snapshot;
  }
}
