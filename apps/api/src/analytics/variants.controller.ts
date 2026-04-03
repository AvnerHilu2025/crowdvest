import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ForecastService } from "../forecast/forecast.service";
import { ResultsService } from "../results/results.service";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller("variants")
export class VariantsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecastService: ForecastService,
    private readonly resultsService: ResultsService,
  ) {}

  /**
   * GET /variants/stepwise-comparison?runId=&labelA=&labelB=&assetSymbol=SPY&seed=1
   * Read-only diagnostic: per-step CrowdMetrics, consensus, majority vs next-step return (CV-VAL-011).
   */
  /**
   * GET /variants/aggregation-test?runId=&labelA=scale_5000_agents&labelB=scale_10000_agents
   * CV-VAL-014: plurality vs weightedSignal vs thresholded accuracy on stored decisions only.
   */
  @Get("aggregation-test")
  async aggregationTest(
    @Query("runId") runId: string,
    @Query("labelA") labelA: string,
    @Query("labelB") labelB: string,
    @Query("assetSymbol") assetSymbol?: string,
    @Query("seed") seed?: string,
  ) {
    const id = runId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) {
      throw new BadRequestException("runId must be a UUID");
    }
    const sym = (assetSymbol ?? "SPY").trim() || "SPY";
    const seedNum =
      seed != null && seed !== "" && Number.isFinite(Number(seed)) ? Number(seed) : 1;
    const la = (labelA ?? "").trim();
    const lb = (labelB ?? "").trim();
    if (!la || !lb) {
      throw new BadRequestException("labelA and labelB are required");
    }
    const [va, vb] = await Promise.all([
      this.prisma.runVariant.findUnique({
        where: {
          runId_assetSymbol_seed_label: { runId: id, assetSymbol: sym, seed: seedNum, label: la },
        },
        select: { id: true },
      }),
      this.prisma.runVariant.findUnique({
        where: {
          runId_assetSymbol_seed_label: { runId: id, assetSymbol: sym, seed: seedNum, label: lb },
        },
        select: { id: true },
      }),
    ]);
    if (!va) {
      throw new BadRequestException(`RunVariant not found for labelA=${la}`);
    }
    if (!vb) {
      throw new BadRequestException(`RunVariant not found for labelB=${lb}`);
    }
    const [a, b] = await Promise.all([
      this.forecastService.computeVariantAggregationAccuracyTest(va.id),
      this.forecastService.computeVariantAggregationAccuracyTest(vb.id),
    ]);
    return { assetSymbol: sym, seed: seedNum, variants: [a, b] };
  }

  @Get("stepwise-comparison")
  async stepwiseComparison(
    @Query("runId") runId: string,
    @Query("labelA") labelA: string,
    @Query("labelB") labelB: string,
    @Query("assetSymbol") assetSymbol?: string,
    @Query("seed") seed?: string,
  ) {
    const id = runId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) {
      throw new BadRequestException("runId must be a UUID");
    }
    const seedNum =
      seed != null && seed !== "" && Number.isFinite(Number(seed)) ? Number(seed) : 1;
    return this.resultsService.getVariantStepwiseComparison(id, labelA ?? "", labelB ?? "", {
      assetSymbol: assetSymbol?.trim() || undefined,
      seed: seedNum,
    });
  }

  /**
   * GET /variants?runId=<uuid>
   * Run-scoped A/B rows; accuracy and baseline are computed per runVariantId (no cross-variant mixing).
   */
  @Get()
  async compare(@Query("runId") runId: string) {
    const id = runId?.trim() ?? "";
    if (id === "" || !UUID_REGEX.test(id)) {
      throw new BadRequestException("runId query parameter must be a UUID");
    }

    const rows = await this.prisma.runVariant.findMany({
      where: { runId: id },
      orderBy: [{ assetSymbol: "asc" }, { seed: "asc" }, { label: "asc" }],
      select: {
        id: true,
        name: true,
        label: true,
        assetSymbol: true,
        agents: true,
        pnl: true,
      },
    });

    const variantIds = rows.map((r) => r.id);
    const crowdAgg =
      variantIds.length > 0
        ? await this.prisma.crowdMetrics.groupBy({
            by: ["runVariantId"],
            where: { runId: id, runVariantId: { in: variantIds } },
            _avg: {
              herdingIndex: true,
              diversityIndex: true,
              independenceIndex: true,
              wisdomScore: true,
            },
          })
        : [];
    const crowdByVariant = new Map(
      crowdAgg
        .filter((a) => a.runVariantId != null)
        .map((a) => [a.runVariantId!, a._avg]),
    );

    const computed = await Promise.all(
      rows.map(async (r) => {
        try {
          return await this.forecastService.computeVariantAccuracy(r.id);
        } catch {
          return null;
        }
      }),
    );

    return rows.map((r, i) => {
      const name = r.name.trim() !== "" ? r.name : (r.label ?? "").trim() !== "" ? r.label! : "variant";
      const vac = computed[i];
      const items =
        vac && vac.items.length > 0
          ? vac.items
          : null;
      const primary =
        items?.find((it) => it.assetSymbol === r.assetSymbol) ?? items?.[0] ?? null;
      const accuracy = primary != null ? primary.accuracyRate : null;
      const baseline =
        vac != null && vac.items.length > 0
          ? { buy: vac.baseline.buy, sell: vac.baseline.sell, hold: vac.baseline.hold }
          : null;

      const cm = crowdByVariant.get(r.id);
      const num = (v: number | null | undefined) =>
        v != null && Number.isFinite(v) ? v : null;

      return {
        name,
        agents: r.agents,
        accuracy,
        baseline,
        pnl: r.pnl,
        herdingIndex: num(cm?.herdingIndex ?? null),
        diversityIndex: num(cm?.diversityIndex ?? null),
        independenceIndex: num(cm?.independenceIndex ?? null),
        wisdomScore: num(cm?.wisdomScore ?? null),
      };
    });
  }
}
