import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type Direction = "BUY" | "SELL" | "HOLD";

/** Majority vote: max wins, ties => HOLD (same as ForecastService). */
function majorityDirection(buy: number, sell: number, hold: number): Direction {
  const max = Math.max(buy, sell, hold);
  if (buy === max && buy > sell && buy > hold) return "BUY";
  if (sell === max && sell > buy && sell > hold) return "SELL";
  return "HOLD";
}

/** Ground truth from next-step return (`return_next` in task terms). */
function actualFromReturn(returnNext: number): Direction {
  if (returnNext > 0) return "BUY";
  if (returnNext < 0) return "SELL";
  return "HOLD";
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h = h | 0;
  }
  return (h >>> 0) & 0x7fffffff;
}

/** Seeded RNG for deterministic random baseline (same pattern as bench). */
function createSeededRng(seed: number) {
  let s = (seed >>> 0) | 0;
  return function () {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s = (s + 0x6d2b79f5) | 0;
    return (s >>> 0) / 4294967296;
  };
}

export interface PredictionValidationResult {
  accuracy: number;
  baseline: {
    buy: number;
    sell: number;
    random: number;
  };
  rolling: {
    last5: number;
    last10: number;
  };
  /** Same denominator as `accuracy` (evaluable steps with finite next return). */
  total: number;
  correct: number;
}

@Injectable()
export class AccuracyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Real prediction validation: crowd majority vs next-step return direction.
   * Baselines and rolling metrics use the same ordered step sequence (asset ASC, step ASC).
   */
  async computePredictionValidation(runId: string): Promise<PredictionValidationResult> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true, status: true },
    });
    if (!run) {
      throw new NotFoundException("Run not found");
    }
    if (run.status !== "COMPLETED") {
      throw new BadRequestException("Run must be COMPLETED to validate predictions");
    }

    const decisions = await this.prisma.agentDecision.findMany({
      where: { runId },
      select: { assetSymbol: true, step: true, action: true },
    });

    const returns = await this.prisma.assetStepReturn.findMany({
      where: { runId },
      select: { assetSymbol: true, step: true, stepReturn: true },
    });

    const returnByKey = new Map<string, number>();
    for (const r of returns) {
      returnByKey.set(`${r.assetSymbol}:${r.step}`, r.stepReturn);
    }

    const countsByKey = new Map<string, { BUY: number; SELL: number; HOLD: number }>();
    for (const d of decisions) {
      const key = `${d.assetSymbol}:${d.step}`;
      let c = countsByKey.get(key);
      if (!c) {
        c = { BUY: 0, SELL: 0, HOLD: 0 };
        countsByKey.set(key, c);
      }
      if (d.action in c) (c as Record<string, number>)[d.action]++;
    }

    type Row = {
      assetSymbol: string;
      step: number;
      prediction: Direction;
      actual: Direction;
      isCorrect: boolean;
    };

    const rows: Row[] = [];

    for (const [key, counts] of countsByKey) {
      const [assetSymbol, stepStr] = key.split(":");
      const step = parseInt(stepStr!, 10);
      const returnNext = returnByKey.get(`${assetSymbol}:${step + 1}`);
      if (returnNext == null || !Number.isFinite(returnNext)) continue;

      const totalVotes = counts.BUY + counts.SELL + counts.HOLD;
      if (totalVotes === 0) continue;

      const prediction = majorityDirection(counts.BUY, counts.SELL, counts.HOLD);
      const actual = actualFromReturn(returnNext);
      const isCorrect = prediction === actual;

      rows.push({ assetSymbol: assetSymbol!, step, prediction, actual, isCorrect });
    }

    rows.sort((a, b) => {
      const cmp = a.assetSymbol.localeCompare(b.assetSymbol);
      if (cmp !== 0) return cmp;
      return a.step - b.step;
    });

    const total = rows.length;
    const correct = rows.reduce((s, r) => s + (r.isCorrect ? 1 : 0), 0);
    const accuracy = total > 0 ? correct / total : 0;

    let buyCorrect = 0;
    let sellCorrect = 0;
    let randomCorrect = 0;
    const seed = simpleHash(runId);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      if (r.actual === "BUY") buyCorrect++;
      if (r.actual === "SELL") sellCorrect++;

      const rng = createSeededRng(seed * 100_000 + i);
      const u = rng();
      const guess: Direction = u < 1 / 3 ? "BUY" : u < 2 / 3 ? "SELL" : "HOLD";
      if (guess === r.actual) randomCorrect++;
    }

    const alwaysBuyAccuracy = total > 0 ? buyCorrect / total : 0;
    const alwaysSellAccuracy = total > 0 ? sellCorrect / total : 0;
    const randomAccuracy = total > 0 ? randomCorrect / total : 0;

    const flags = rows.map((r) => r.isCorrect);
    const lastNAcc = (n: number) => {
      const slice = flags.slice(-n);
      if (slice.length === 0) return 0;
      return slice.filter(Boolean).length / slice.length;
    };

    return {
      accuracy,
      baseline: {
        buy: alwaysBuyAccuracy,
        sell: alwaysSellAccuracy,
        random: randomAccuracy,
      },
      rolling: {
        last5: lastNAcc(5),
        last10: lastNAcc(10),
      },
      total,
      correct,
    };
  }
}
