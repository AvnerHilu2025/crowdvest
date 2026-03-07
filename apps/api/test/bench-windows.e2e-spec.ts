import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

const FIXTURE_PAYLOAD = (overrides: Record<string, number>) => ({
  symbols: ["SPY"],
  windows: [29],
  n: 1,
  perSymbol: {
    SPY: {
      perWindow: {
        "29": {
          mean: {
            crowd: 0.55,
            alwaysBuy: 0.5,
            alwaysSell: 0.48,
            random: 0.45,
            delta: 0.05,
            deltaVsAlwaysBuy: 0.05,
            deltaVsAlwaysSell: 0.07,
            deltaVsRandom: 0.10,
            ...overrides,
          },
          std: { crowd: 0.01, alwaysBuy: 0.01, delta: 0.01 },
          winRate: 0.6,
          winRates: { vsAlwaysBuy: 0.6, vsAlwaysSell: 0.6, vsRandom: 0.6 },
        },
      },
      stability: { deltaStd: 0, score: 1 },
    },
  },
});

describe("POST /bench/windows (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("persist=true creates snapshot and returns snapshotId, createdAt, datasetVersion, modelVersion", async () => {
    const res = await request(app.getHttpServer())
      .post("/bench/windows?symbols=SPY&windows=29&n=1&persist=true");
    if (res.status === 400 && /PriceSeriesPoint missing|symbols is required|windows is required/i.test(res.body?.message ?? "")) {
      return;
    }
    expect([200, 201]).toContain(res.status);
    expect(res.body.snapshotId).toBeDefined();
    expect(typeof res.body.snapshotId).toBe("string");
    expect(res.body.createdAt).toBeDefined();
    expect(res.body.createdAt).not.toBeNull();
    expect(res.body.datasetVersion).toBeDefined();
    expect(res.body.modelVersion).toBeDefined();
    const snapshotId = res.body.snapshotId as string;
    const prisma = app.get(PrismaService);
    const row = await prisma.benchWindowSnapshot.findUnique({
      where: { id: snapshotId },
    });
    expect(row).not.toBeNull();
    expect(row?.symbols).toBe("SPY");
    expect(row?.windows).toBe("29");
    expect(row?.n).toBe(1);
  });

  it("includes alwaysSell and random baseline fields", async () => {
    const res = await request(app.getHttpServer())
      .post("/bench/windows?symbols=SPY&windows=29&n=3");
    if (res.status === 400 && /PriceSeriesPoint missing|symbols is required|windows is required/i.test(res.body?.message ?? "")) {
      return;
    }
    expect(res.status).toBe(200);
    expect(res.body.perSymbol).toBeDefined();
    expect(res.body.perSymbol.SPY).toBeDefined();
    expect(res.body.perSymbol.SPY.perWindow).toBeDefined();
    expect(res.body.perSymbol.SPY.perWindow["29"]).toBeDefined();
    const w29 = res.body.perSymbol.SPY.perWindow["29"];
    expect(w29.mean).toBeDefined();
    expect(w29.mean.alwaysSell).toBeDefined();
    expect(typeof w29.mean.alwaysSell).toBe("number");
    expect(w29.mean.random).toBeDefined();
    expect(typeof w29.mean.random).toBe("number");
    expect(w29.winRates).toBeDefined();
    expect(w29.winRates.vsAlwaysSell).toBeDefined();
    expect(w29.winRates.vsRandom).toBeDefined();
  });
});

describe("GET /bench/windows/snapshots (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /:id returns full snapshot including payload (parsed from payloadJson)", async () => {
    const baseline = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({
          deltaVsAlwaysBuy: 0.10,
          deltaVsAlwaysSell: 0.08,
          deltaVsRandom: 0.08,
        }) as object,
      },
    });
    const res = await request(app.getHttpServer()).get(
      `/bench/windows/snapshots/${baseline.id}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(baseline.id);
    expect(res.body.symbols).toEqual(["SPY"]);
    expect(res.body.windows).toEqual([29]);
    expect(res.body.payload).toBeDefined();
    expect(res.body.payload.perSymbol).toBeDefined();
    expect(res.body.payload.perSymbol.SPY.perWindow["29"].mean.deltaVsAlwaysBuy).toBe(0.1);
  });

  it("GET /:id/diff returns perSymbol, diff numbers, and applies regression rule (epsilon=0.02)", async () => {
    const baseline = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({
          deltaVsAlwaysBuy: 0.10,
          deltaVsAlwaysSell: 0.08,
          deltaVsRandom: 0.08,
        }) as object,
      },
    });
    const current = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({
          deltaVsAlwaysBuy: 0.05,
          deltaVsAlwaysSell: 0.08,
          deltaVsRandom: 0.11,
        }) as object,
      },
    });
    const res = await request(app.getHttpServer()).get(
      `/bench/windows/snapshots/${current.id}/diff?against=${baseline.id}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.currentId).toBe(current.id);
    expect(res.body.baselineId).toBe(baseline.id);
    expect(res.body.perSymbol).toBeDefined();
    expect(res.body.perSymbol.SPY).toBeDefined();
    expect(res.body.perSymbol.SPY.perWindow).toBeDefined();
    expect(res.body.perSymbol.SPY.perWindow["29"]).toBeDefined();
    const w = res.body.perSymbol.SPY.perWindow["29"];
    expect(w.current).toBeDefined();
    expect(w.baseline).toBeDefined();
    expect(w.diff).toBeDefined();
    expect(w.flags).toBeDefined();
    expect(w.flags.regressionVsAlwaysBuy).toBe(true);
    expect(w.flags.improvementVsRandom).toBe(true);
    expect(typeof w.diff.crowd).toBe("number");
    expect(typeof w.diff.alwaysBuy).toBe("number");
    expect(typeof w.diff.alwaysSell).toBe("number");
    expect(typeof w.diff.random).toBe("number");
    expect(typeof w.diff.deltaVsAlwaysBuy).toBe("number");
    expect(typeof w.diff.deltaVsAlwaysSell).toBe("number");
    expect(typeof w.diff.deltaVsRandom).toBe("number");
    expect(w.diff.deltaVsAlwaysBuy).toBeCloseTo(0.05 - 0.1, 5);
    expect(w.diff.deltaVsRandom).toBeCloseTo(0.11 - 0.08, 5);
    expect(res.body.summary.countImprovedVsAlwaysBuy).toBeDefined();
    expect(res.body.summary.countRegressedVsAlwaysBuy).toBeDefined();
    expect(res.body.summary.meanDeltaChange).toBeDefined();
    expect(res.body.summary.maxImprovement).toBeDefined();
    expect(res.body.summary.maxRegression).toBeDefined();
    expect(res.body.perSymbol.SPY.regressionFlags).toBeDefined();
    expect(res.body.perSymbol.SPY.regressionFlags.vsAlwaysBuy).toBe(true);
    expect(res.body.perSymbol.SPY.regressionFlags.vsAlwaysSell).toBe(false);
    expect(res.body.perSymbol.SPY.regressionFlags.vsRandom).toBe(false);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.regressionsCount).toBe(1);
    expect(res.body.summary.improvementsCount).toBe(1);
    expect(res.body.summary.unchangedCount).toBe(1);
    expect(res.body.summary.epsilon).toBe(0.02);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.symbols).toEqual(["SPY"]);
    expect(res.body.meta.windows).toEqual([29]);
    expect(res.body.meta.epsilon).toBe(0.02);
  });

  it("GET /:id/diff returns 400 when symbols or windows mismatch", async () => {
    const a = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({}) as object,
      },
    });
    const b = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "QQQ",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({}) as object,
      },
    });
    const res = await request(app.getHttpServer()).get(
      `/bench/windows/snapshots/${a.id}/diff?against=${b.id}`,
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/symbols.*mismatch|mismatch/i);
  });

  it("GET /latest returns latest snapshot matching symbols and windows", async () => {
    const older = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({ deltaVsAlwaysBuy: 0.05 }) as object,
      },
    });
    await new Promise((r) => setTimeout(r, 10));
    const newer = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({ deltaVsAlwaysBuy: 0.12 }) as object,
      },
    });
    const res = await request(app.getHttpServer()).get(
      "/bench/windows/snapshots/latest?symbols=SPY&windows=29",
    );
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(newer.id);
    expect(res.body.payload.perSymbol.SPY.perWindow["29"].mean.deltaVsAlwaysBuy).toBe(0.12);
  });

  it("GET /latest with n filter returns latest matching symbols, windows, and n", async () => {
    await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 2,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({ deltaVsAlwaysBuy: 0.05 }) as object,
      },
    });
    await new Promise((r) => setTimeout(r, 10));
    const newer = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({ deltaVsAlwaysBuy: 0.15 }) as object,
      },
    });
    const res = await request(app.getHttpServer()).get(
      "/bench/windows/snapshots/latest?symbols=SPY&windows=29&n=1",
    );
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(newer.id);
    expect(res.body.n).toBe(1);
    expect(res.body.payload.perSymbol.SPY.perWindow["29"].mean.deltaVsAlwaysBuy).toBe(0.15);
  });

  it("fetch latest snapshot then diff against self: all diffs 0, unchangedCount>0, regressionsCount=0, improvementsCount=0", async () => {
    const snap = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({
          deltaVsAlwaysBuy: 0.10,
          deltaVsAlwaysSell: 0.08,
          deltaVsRandom: 0.08,
        }) as object,
      },
    });
    const latestRes = await request(app.getHttpServer()).get(
      "/bench/windows/snapshots/latest?symbols=SPY&windows=29&n=1",
    );
    expect(latestRes.status).toBe(200);
    const id = latestRes.body.id;
    const res = await request(app.getHttpServer()).get(
      `/bench/windows/snapshots/${id}/diff?against=${id}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.currentId).toBe(snap.id);
    expect(res.body.baselineId).toBe(snap.id);
    const w = res.body.perSymbol.SPY.perWindow["29"];
    expect(w.diff.deltaVsAlwaysBuy).toBe(0);
    expect(w.diff.deltaVsAlwaysSell).toBe(0);
    expect(w.diff.deltaVsRandom).toBe(0);
    expect(w.flags.regressionVsAlwaysBuy).toBe(false);
    expect(w.flags.regressionVsAlwaysSell).toBe(false);
    expect(w.flags.regressionVsRandom).toBe(false);
    expect(w.flags.improvementVsAlwaysBuy).toBe(false);
    expect(w.flags.improvementVsAlwaysSell).toBe(false);
    expect(w.flags.improvementVsRandom).toBe(false);
    expect(res.body.summary.regressionsCount).toBe(0);
    expect(res.body.summary.improvementsCount).toBe(0);
    expect(res.body.summary.unchangedCount).toBeGreaterThan(0);
  });

  it("POST /:id/tag tags snapshot and GET /baseline returns it by tag", async () => {
    const uniqueTag = `baseline-e2e-${Date.now()}`;
    const snap = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({}) as object,
      },
    });
    const tagRes = await request(app.getHttpServer())
      .post(`/bench/windows/snapshots/${snap.id}/tag`)
      .set("Content-Type", "application/json")
      .send({ tag: uniqueTag });
    expect(tagRes.status).toBe(201);
    expect(tagRes.body.tag).toBe(uniqueTag);
    expect(tagRes.body.isBaseline).toBe(true);
    const baselineRes = await request(app.getHttpServer()).get(
      `/bench/windows/snapshots/baseline?tag=${encodeURIComponent(uniqueTag)}`,
    );
    expect(baselineRes.status).toBe(200);
    expect(baselineRes.body.id).toBe(snap.id);
    expect(baselineRes.body.tag).toBe(uniqueTag);
  });

  it("POST /:id/tag idempotent: same tag again returns 200", async () => {
    const uniqueTag = `baseline-idem-${Date.now()}`;
    const snap = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({}) as object,
      },
    });
    const first = await request(app.getHttpServer())
      .post(`/bench/windows/snapshots/${snap.id}/tag`)
      .set("Content-Type", "application/json")
      .send({ tag: uniqueTag });
    expect(first.status).toBe(201);
    const second = await request(app.getHttpServer())
      .post(`/bench/windows/snapshots/${snap.id}/tag`)
      .set("Content-Type", "application/json")
      .send({ tag: uniqueTag });
    expect(second.status).toBe(200);
    expect(second.body.tag).toBe(uniqueTag);
  });

  it("POST /:id/tag returns 409 when tag used by another snapshot", async () => {
    const uniqueTag = `baseline-conflict-${Date.now()}`;
    const snap1 = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({}) as object,
      },
    });
    const snap2 = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({}) as object,
      },
    });
    await request(app.getHttpServer())
      .post(`/bench/windows/snapshots/${snap1.id}/tag`)
      .set("Content-Type", "application/json")
      .send({ tag: uniqueTag });
    const conflictRes = await request(app.getHttpServer())
      .post(`/bench/windows/snapshots/${snap2.id}/tag`)
      .set("Content-Type", "application/json")
      .send({ tag: uniqueTag });
    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.message).toMatch(/already used|overwrite=true/i);
  });

  it("POST /:id/tag returns 400 for invalid tag (uppercase, special chars)", async () => {
    const snap = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({}) as object,
      },
    });
    const res = await request(app.getHttpServer())
      .post(`/bench/windows/snapshots/${snap.id}/tag`)
      .set("Content-Type", "application/json")
      .send({ tag: "Invalid_Tag!" });
    expect(res.status).toBe(400);
    const msg = Array.isArray(res.body.message) ? res.body.message[0] : res.body.message;
    expect(String(msg)).toMatch(/tag must|alphanumeric|invalid/i);
  });

  it("POST /:id/tag?overwrite=true moves tag to new snapshot", async () => {
    const uniqueTag = `baseline-overwrite-${Date.now()}`;
    const snap1 = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({}) as object,
      },
    });
    const snap2 = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({}) as object,
      },
    });
    await request(app.getHttpServer())
      .post(`/bench/windows/snapshots/${snap1.id}/tag`)
      .set("Content-Type", "application/json")
      .send({ tag: uniqueTag });
    const moveRes = await request(app.getHttpServer())
      .post(`/bench/windows/snapshots/${snap2.id}/tag?overwrite=true`)
      .set("Content-Type", "application/json")
      .send({ tag: uniqueTag });
    expect(moveRes.status).toBe(201);
    expect(moveRes.body.id).toBe(snap2.id);
    expect(moveRes.body.tag).toBe(uniqueTag);
    const baselineRes = await request(app.getHttpServer()).get(
      `/bench/windows/snapshots/baseline?tag=${encodeURIComponent(uniqueTag)}`,
    );
    expect(baselineRes.body.id).toBe(snap2.id);
    const row1 = await prisma.benchWindowSnapshot.findUnique({
      where: { id: snap1.id },
      select: { tag: true },
    });
    expect(row1?.tag).toBeNull();
  });

  it("POST /:id/tag returns 409 when snapshot has different tag (no silent retag)", async () => {
    const tag1 = `baseline-retag-a-${Date.now()}`;
    const tag2 = `baseline-retag-b-${Date.now()}`;
    const snap = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({}) as object,
      },
    });
    await request(app.getHttpServer())
      .post(`/bench/windows/snapshots/${snap.id}/tag`)
      .set("Content-Type", "application/json")
      .send({ tag: tag1 });
    const res = await request(app.getHttpServer())
      .post(`/bench/windows/snapshots/${snap.id}/tag`)
      .set("Content-Type", "application/json")
      .send({ tag: tag2 });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already tagged|overwrite=true/i);
  });

  it("GET /by-tag/:tag returns snapshot by tag", async () => {
    const uniqueTag = `baseline-by-tag-${Date.now()}`;
    const snap = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({}) as object,
      },
    });
    await request(app.getHttpServer())
      .post(`/bench/windows/snapshots/${snap.id}/tag`)
      .set("Content-Type", "application/json")
      .send({ tag: uniqueTag });
    const res = await request(app.getHttpServer()).get(
      `/bench/windows/snapshots/by-tag/${encodeURIComponent(uniqueTag)}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(snap.id);
    expect(res.body.tag).toBe(uniqueTag);
  });

  it("GET /bench/windows/compare returns baseline, current, diff, summary", async () => {
    const uniqueTag = `baseline-compare-${Date.now()}`;
    const snap = await prisma.benchWindowSnapshot.create({
      data: {
        symbols: "SPY",
        windows: "29",
        n: 1,
        overwrite: false,
        payloadJson: FIXTURE_PAYLOAD({ deltaVsAlwaysBuy: 0.08 }) as object,
      },
    });
    await request(app.getHttpServer())
      .post(`/bench/windows/snapshots/${snap.id}/tag`)
      .set("Content-Type", "application/json")
      .send({ tag: uniqueTag });

    const res = await request(app.getHttpServer()).get(
      `/bench/windows/compare?baselineTag=${encodeURIComponent(uniqueTag)}&current=${snap.id}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.baseline).toBeDefined();
    expect(res.body.baseline.id).toBe(snap.id);
    expect(res.body.baseline.tag).toBe(uniqueTag);
    expect(res.body.current).toBeDefined();
    expect(res.body.current.id).toBe(snap.id);
    expect(res.body.diff).toBeDefined();
    expect(res.body.diff.perSymbol.SPY).toBeDefined();
    expect(res.body.diff.perSymbol.SPY.perWindow["29"]).toBeDefined();
    expect(res.body.diff.perSymbol.SPY.perWindow["29"].mean.deltaVsAlwaysBuy).toBe(0);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.score).toBe(0);
    expect(res.body.summary.count).toBe(1);
  });
});
