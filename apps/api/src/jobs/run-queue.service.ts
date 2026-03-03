import { Injectable, OnModuleInit } from "@nestjs/common";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { setRunStatus } from "@crowdvest/db";
import { PrismaService } from "../prisma/prisma.service";

export interface BacktestPayload {
  assetSymbol: string;
  /** When provided (length > 1), spawn worker once for all symbols; omit --assetSymbol, pass --symbols. */
  symbols?: string[];
  steps: number;
  agents: number;
  seedStart: number;
  seeds: number[];
}

export type QueueEventType = "ENQUEUE" | "START" | "DONE" | "FAIL" | "SKIP";

export interface QueueEvent {
  ts: string;
  type: QueueEventType;
  runId?: string;
  msg?: string;
}

export interface EnqueueResult {
  ok: boolean;
  enqueued?: boolean;
  reason?: string;
  status?: string;
}

interface QueuedJob {
  runId: string;
  payload: BacktestPayload;
}

const LAST_EVENTS_SIZE = 50;

@Injectable()
export class RunQueueService implements OnModuleInit {
  private readonly queue: QueuedJob[] = [];
  private readonly activeRunIds = new Set<string>();
  private readonly activeJobKeys = new Set<string>();
  private processing = false;
  private runningRunId: string | null = null;
  private readonly lastEvents: QueueEvent[] = [];

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.processLoop();
  }

  private pushEvent(type: QueueEventType, runId?: string, msg?: string): void {
    const event: QueueEvent = {
      ts: new Date().toISOString(),
      type,
      ...(runId != null && { runId }),
      ...(msg != null && { msg }),
    };
    this.lastEvents.push(event);
    if (this.lastEvents.length > LAST_EVENTS_SIZE) {
      this.lastEvents.shift();
    }
  }

  /** Enqueue backtest. Returns {ok, enqueued} or {ok:false, reason, status}. Dedup: skip if (runId,assetSymbol) or runId (multi-asset) in queue/running or status != PENDING. */
  async enqueueBacktest(runId: string, payload: BacktestPayload): Promise<EnqueueResult> {
    const jobKey = payload.symbols && payload.symbols.length > 1 ? runId : `${runId}:${payload.assetSymbol}`;
    if (this.activeJobKeys.has(jobKey)) {
      this.pushEvent("SKIP", runId, "already_queued_or_running");
      console.log(`[RunQueue] enqueue skipped (already queued/running) runId=${runId} asset=${payload.symbols?.join(",") ?? payload.assetSymbol}`);
      return { ok: false, reason: "already_queued_or_running" };
    }

    let run: { status: string } | null;
    try {
      run = await this.prisma.simulationRun.findUnique({
        where: { id: runId },
        select: { status: true },
      });
    } catch (e) {
      this.pushEvent("SKIP", runId, "db_error");
      console.error(`[RunQueue] enqueue check failed runId=${runId}`, e);
      return { ok: false, reason: "db_error" };
    }

    if (!run) {
      this.pushEvent("SKIP", runId, "run_not_found");
      return { ok: false, reason: "run_not_found" };
    }

    if (run.status !== "PENDING") {
      this.pushEvent("SKIP", runId, "status_not_pending");
      console.log(`[RunQueue] enqueue skipped (status=${run.status}) runId=${runId}`);
      return { ok: false, reason: "status_not_pending", status: run.status };
    }

    this.activeRunIds.add(runId);
    this.activeJobKeys.add(jobKey);
    this.queue.push({ runId, payload });
    this.pushEvent("ENQUEUE", runId);
    console.log(`[RunQueue] enqueued runId=${runId} queueLen=${this.queue.length}`);
    return { ok: true, enqueued: true };
  }

  getQueueHealth(): {
    queueLen: number;
    runningRunId: string | null;
    lastEvents: QueueEvent[];
  } {
    return {
      queueLen: this.queue.length,
      runningRunId: this.runningRunId,
      lastEvents: [...this.lastEvents],
    };
  }

  private processLoop(): void {
    const processNext = () => {
      if (this.processing || this.queue.length === 0) return;
      const job = this.queue.shift();
      if (!job) return;

      this.processing = true;
      this.runningRunId = job.runId;
      const { runId, payload } = job;
      const jobKey = payload.symbols && payload.symbols.length > 1 ? runId : `${runId}:${payload.assetSymbol}`;
      this.pushEvent("START", runId);
      console.log(`[RunQueue] start runId=${runId}`);

      const repoRoot = this.getRepoRoot();
      const args = [
        "--filter",
        "worker",
        "run",
        "backtest-v0",
        "--",
        "--runId",
        runId,
        "--steps",
        String(payload.steps),
        "--agents",
        String(payload.agents),
        "--seedStart",
        String(payload.seedStart),
        "--seeds",
        String(payload.seeds.length),
      ];
      if (payload.symbols && payload.symbols.length > 1) {
        args.push("--symbols", payload.symbols.join(","));
      } else {
        args.push("--assetSymbol", payload.assetSymbol || "SPY");
      }

      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        this.activeRunIds.delete(runId);
        this.activeJobKeys.delete(jobKey);
        this.runningRunId = null;
        this.processing = false;
        if (code === 0) {
          this.pushEvent("DONE", runId);
          console.log(`[RunQueue] done runId=${runId}`);
        } else {
          const errMsg = `worker exit code ${code ?? signal ?? "unknown"}`;
          this.pushEvent("FAIL", runId, errMsg);
          setRunStatus(this.prisma, runId, "FAILED", errMsg)
            .then((r) => {
              if (r.count > 0) {
                console.error(`[RunQueue] failed runId=${runId} exitCode=${code ?? signal}`);
              }
            })
            .catch((e) => {
              console.error(`[RunQueue] failed runId=${runId} exitCode=${code ?? signal}`, e);
            });
        }
        setImmediate(() => this.processLoop());
      };

      setRunStatus(this.prisma, runId, "RUNNING")
        .then(() => {
          const child = spawn("pnpm", args, {
            stdio: ["ignore", "pipe", "pipe"],
            cwd: repoRoot,
          });
          child.unref();

          child.stdout?.on("data", (chunk: Buffer) => process.stdout.write(chunk));
          child.stderr?.on("data", (chunk: Buffer) => process.stderr.write(chunk));

          child.on("exit", onExit);
          child.on("error", (err) => {
            console.error(`[RunQueue] spawn error runId=${runId}`, err);
            this.pushEvent("FAIL", runId, "spawn_error");
            onExit(null, null);
          });
        })
        .catch((e) => {
          console.error(`[RunQueue] RUNNING update failed runId=${runId}`, e);
          this.pushEvent("FAIL", runId, "status_update_failed");
          this.activeRunIds.delete(runId);
          this.activeJobKeys.delete(jobKey);
          this.runningRunId = null;
          this.processing = false;
          setImmediate(() => this.processLoop());
        });
    };

    const poll = () => {
      processNext();
      setTimeout(poll, 500);
    };
    poll();
  }

  private getRepoRoot(): string {
    const cwd = process.cwd();
    const candidates = [
      path.resolve(cwd, "..", ".."),
      path.resolve(cwd, ".."),
      cwd,
    ];
    const found = candidates.find((p) =>
      fs.existsSync(path.join(p, "apps", "worker", "package.json")),
    );
    return found ?? cwd;
  }
}
