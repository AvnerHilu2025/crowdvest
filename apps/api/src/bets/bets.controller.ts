import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { BetsService } from "./bets.service";
import { CreateBetDto } from "./create-bet.dto";
import { ListBetsQueryDto } from "./list-bets-query.dto";
import { parseLimit, parseOffset } from "../common/parse-query";

@Controller("bets")
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class BetsController {
  constructor(private readonly betsService: BetsService) {}

  @Post()
  async create(@Body() dto: CreateBetDto) {
    return this.betsService.create(dto);
  }

  @Post("settle")
  async settleRun(@Query("runId") runId?: string) {
    return this.betsService.settleRun(runId ?? "");
  }

  @Post("settle-latest")
  async settleLatest() {
    return this.betsService.settleLatest();
  }

  @Get()
  async findAll(
    @Query() query: ListBetsQueryDto,
    @Query("limit") limitStr?: string,
    @Query("offset") offsetStr?: string,
  ) {
    return this.betsService.findAll({
      userId: query.userId || undefined,
      runId: query.runId || undefined,
      limit: query.limit ?? parseLimit(limitStr),
      offset: query.offset ?? parseOffset(offsetStr),
    });
  }
}
