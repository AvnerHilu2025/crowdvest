import { Body, Controller, Get, Param, Post, Query, UsePipes, ValidationPipe } from "@nestjs/common";
import { BetsService } from "./bets.service";
import { CreateOpenBetDto } from "./create-open-bet.dto";
import { ListBetsQueryDto } from "./list-bets-query.dto";

@Controller("bets")
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class BetsController {
  constructor(private readonly betsService: BetsService) {}

  /** POST /bets — create bet (status OPEN). Deducts amount from UserWallet; 400 if insufficient funds. Body: userId, runId, agentId?, decisionStep?, assetSymbol, direction, amount, openPrice?, openStep. */
  @Post()
  async create(@Body() dto: CreateOpenBetDto) {
    return this.betsService.createOpen(dto);
  }

  @Post("settle")
  async settleRun(@Query("runId") runId?: string, @Query("version") version?: string) {
    return this.betsService.settleRun(runId ?? "", version);
  }

  @Post("settle-latest")
  async settleLatest(@Query("version") version?: string) {
    return this.betsService.settleLatest(version);
  }

  @Post(":id/settle")
  async settleBet(@Param("id") id: string) {
    return this.betsService.settleBetById(id);
  }

  /** GET /bets?userId=<uuid>&limit=<n>&offset=<n>&status=<OPEN|SETTLED|CANCELLED>. Returns { items: Bet[], total }. */
  @Get()
  async findAll(@Query() query: ListBetsQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    return this.betsService.listByUser(query.userId, limit, offset, query.status);
  }
}
