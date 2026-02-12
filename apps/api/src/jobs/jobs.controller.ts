import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { RunQueueService } from "./run-queue.service";

const DEFAULT_SPY29_PAYLOAD = {
  assetSymbol: "SPY",
  steps: 29,
  agents: 50,
  seedStart: 1,
  seeds: [1, 2] as number[],
};

function isDevOrAdmin(req?: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const token = req?.headers?.["x-admin-token"] as string | undefined;
  return token === process.env.ADMIN_TOKEN;
}

@Controller("jobs")
export class JobsController {
  constructor(private readonly runQueue: RunQueueService) {}

  /** GET /jobs/queue — queue health and recent events. */
  @Get("queue")
  getQueue() {
    return this.runQueue.getQueueHealth();
  }

  /** POST /jobs/enqueue — enqueue runId for backtest (default spy29 payload). Body: { runId }. Dev-only or X-Admin-Token. For dedup + retry testing. */
  @Post("enqueue")
  async enqueue(@Body() body: { runId?: string }, @Req() req?: Request) {
    if (!isDevOrAdmin(req)) {
      throw new ForbiddenException("Enqueue endpoint is dev-only or requires X-Admin-Token");
    }
    const runId = (body?.runId ?? "").trim();
    if (!runId) {
      return { ok: false, reason: "runId_required" };
    }
    return this.runQueue.enqueueBacktest(runId, { ...DEFAULT_SPY29_PAYLOAD });
  }
}
