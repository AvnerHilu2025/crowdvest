/**
 * InfoEvents – CRUD-lite for InfoEvent (news/rumors per run+asset+step).
 * Accepts both new (impact, type) and legacy (reach, topic); normalizes to DB shape.
 */
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Normalized payload for Prisma (topic, reach always set). */
export interface NormalizedInfoEventPayload {
  assetSymbol: string;
  step: number;
  topic: string;
  sentiment: number;
  credibility: number;
  reach: number;
  volatilityImpact?: number;
  source?: string | null;
}

/** Raw input: impact/reach, topic/type, credibility optional (defaults in normalizer). */
export interface CreateInfoEventInput {
  assetSymbol?: string;
  step: number;
  topic?: string;
  type?: string;
  sentiment: number;
  credibility?: number;
  impact?: number;
  reach?: number;
  volatilityImpact?: number;
  source?: string | null;
}

const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));

/**
 * Normalize create payload: impact/reach, topic/type, credibility.
 * - topic = topic ?? type ?? 'general'
 * - impact used if present, else reach; store as reach in DB
 * - credibility missing → 0.5
 */
export function normalizeCreatePayload(
  raw: CreateInfoEventInput,
): NormalizedInfoEventPayload {
  const impactOrReach = raw.impact ?? raw.reach ?? 0.5;
  const reach = clamp(impactOrReach, 0, 1);
  const topic =
    (raw.topic ?? raw.type ?? "general").toString().trim() || "general";
  const sentiment = clamp(raw.sentiment, -1, 1);
  const credibility = clamp(raw.credibility ?? 0.5, 0, 1);

  return {
    assetSymbol: (raw.assetSymbol ?? "RUN").trim() || "RUN",
    step: raw.step,
    topic,
    sentiment,
    credibility,
    reach,
    volatilityImpact: raw.volatilityImpact,
    source: raw.source ?? null,
  };
}

@Injectable()
export class InfoEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    runId: string,
    dto: NormalizedInfoEventPayload,
  ): Promise<{
    id: string;
    runId: string;
    assetSymbol: string;
    step: number;
    topic: string;
    type: string;
    sentiment: number;
    credibility: number;
    reach: number;
    impact: number;
    volatilityImpact: number | null;
    source: string | null;
    createdAt: Date;
  }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);

    const event = await this.prisma.infoEvent.create({
      data: {
        runId,
        assetSymbol: dto.assetSymbol,
        step: dto.step,
        topic: dto.topic,
        sentiment: dto.sentiment,
        credibility: dto.credibility,
        reach: dto.reach,
        volatilityImpact: dto.volatilityImpact ?? null,
        source: dto.source ?? null,
      },
    });

    return {
      id: event.id,
      runId: event.runId,
      assetSymbol: event.assetSymbol,
      step: event.step,
      topic: event.topic,
      type: event.topic,
      sentiment: event.sentiment,
      credibility: event.credibility,
      reach: event.reach,
      impact: event.reach,
      volatilityImpact: event.volatilityImpact,
      source: event.source,
      createdAt: event.createdAt,
    };
  }

  async list(
    runId: string,
    assetSymbol: string,
    fromStep: number | undefined,
    toStep: number | undefined,
  ): Promise<
    Array<{
      id: string;
      runId: string;
      assetSymbol: string;
      step: number;
      topic: string;
      sentiment: number;
      credibility: number;
      reach: number;
      impact: number;
      volatilityImpact: number | null;
      source: string | null;
      createdAt: Date;
    }>
  > {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);

    const sym = (assetSymbol ?? "RUN").trim() || "RUN";
    const where: { runId: string; assetSymbol: string; step?: { gte?: number; lte?: number } } = {
      runId,
      assetSymbol: sym,
    };
    if (fromStep != null || toStep != null) {
      where.step = {};
      if (fromStep != null) where.step.gte = fromStep;
      if (toStep != null) where.step.lte = toStep;
    }

    const events = await this.prisma.infoEvent.findMany({
      where,
      orderBy: { step: "asc" },
    });

    return events.map((e) => ({
      id: e.id,
      runId: e.runId,
      assetSymbol: e.assetSymbol,
      step: e.step,
      topic: e.topic,
      type: e.topic,
      sentiment: e.sentiment,
      credibility: e.credibility,
      reach: e.reach,
      impact: e.reach,
      volatilityImpact: e.volatilityImpact,
      source: e.source,
      createdAt: e.createdAt,
    }));
  }

  async deleteAll(runId: string, assetSymbol?: string): Promise<{ deleted: number }> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);

    const where: { runId: string; assetSymbol?: string } = { runId };
    if (assetSymbol != null && assetSymbol.trim() !== "") {
      where.assetSymbol = assetSymbol.trim();
    }

    const result = await this.prisma.infoEvent.deleteMany({ where });
    return { deleted: result.count };
  }
}
