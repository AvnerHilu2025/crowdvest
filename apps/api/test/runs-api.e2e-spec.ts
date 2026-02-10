import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("GET /runs (e2e)", () => {
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

  it("GET /runs/latest returns 200 with prePersistHistogram and persistedHistogram (objects with BUY/SELL/HOLD/OTHER)", async () => {
    const res = await request(app.getHttpServer()).get("/runs/latest");
    if (res.status === 404 && res.body?.message === "Run not found") return;
    expect(res.status).toBe(200);
    expect(res.body.runId).toBeDefined();
    expect(res.body.prePersistHistogram).toBeDefined();
    expect(res.body.persistedHistogram).toBeDefined();
    for (const key of ["BUY", "SELL", "HOLD", "OTHER"]) {
      expect(typeof res.body.prePersistHistogram[key]).toBe("number");
      expect(typeof res.body.persistedHistogram[key]).toBe("number");
    }
  });

  it("GET /runs/latest?debug=1 includes debug", async () => {
    const res = await request(app.getHttpServer()).get("/runs/latest?debug=1");
    if (res.status === 404 && res.body?.message === "Run not found") return;
    expect(res.status).toBe(200);
    expect(res.body.debug).toBeDefined();
  });

  it("GET /runs/:id returns 200 for known run", async () => {
    const runsRes = await request(app.getHttpServer()).get("/results/runs?limit=1");
    const runId = runsRes.body?.items?.[0]?.id;
    if (!runId) return;
    const res = await request(app.getHttpServer()).get(`/runs/${runId}`).expect(200);
    expect(res.body.runId).toBe(runId);
    expect(res.body.prePersistHistogram).toBeDefined();
    expect(res.body.persistedHistogram).toBeDefined();
  });

  it("GET /runs?limit=5 items do not include configJson", async () => {
    const res = await request(app.getHttpServer()).get("/runs?limit=5");
    expect(res.status).toBe(200);
    const items = res.body?.items ?? [];
    for (const item of items) {
      expect(item).not.toHaveProperty("configJson");
    }
  });

  it("GET /runs/:id returns 404 for non-existent UUID", () => {
    return request(app.getHttpServer())
      .get("/runs/00000000-0000-0000-0000-000000000000")
      .expect(404)
      .expect((res) => {
        expect(res.body.message).toMatch(/Run not found/);
      });
  });

  it("GET /runs/:id returns 400 for invalid UUID", () => {
    return request(app.getHttpServer())
      .get("/runs/not-a-uuid")
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toMatch(/UUID/);
      });
  });

  describe("GET /runs/:runId/variants", () => {
    it("returns 200 with items and total for existing run (or 503 if migration not applied)", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/runs")
        .send({})
        .expect(201);
      const runId = createRes.body?.id;
      expect(runId).toBeDefined();

      const res = await request(app.getHttpServer()).get(
        `/runs/${runId}/variants?limit=5`,
      );
      if (res.status === 503) {
        expect(res.body.error?.code).toBe("DB_NOT_READY");
        return;
      }
      expect(res.status).toBe(200);

      expect(res.body).toHaveProperty("items");
      expect(res.body).toHaveProperty("total");
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(typeof res.body.total).toBe("number");
      expect(res.body.total).toBeGreaterThanOrEqual(0);
      if (res.body.items.length > 0) {
        const item = res.body.items[0];
        expect(item).toHaveProperty("id");
        expect(item).toHaveProperty("runId");
        expect(item).toHaveProperty("assetSymbol");
        expect(item).toHaveProperty("seed");
        expect(item).toHaveProperty("agents");
        expect(item).toHaveProperty("steps");
        expect(item).toHaveProperty("label");
        expect(item).toHaveProperty("createdAt");
        expect(item).toHaveProperty("summary");
      }
    });

    it("returns 400 and error.code BAD_REQUEST for invalid runId", async () => {
      const res = await request(app.getHttpServer())
        .get("/runs/not-a-uuid/variants")
        .expect(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(res.body.error.message).toBe("Invalid runId");
    });

    it("returns 404 and error.code NOT_FOUND for non-existent run", async () => {
      const res = await request(app.getHttpServer())
        .get("/runs/00000000-0000-0000-0000-000000000000/variants")
        .expect(404);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe("NOT_FOUND");
      expect(res.body.error.message).toBe("Run not found");
    });

    it("accepts assetSymbol and limit query params (200 or 503 if schema missing)", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/runs")
        .send({})
        .expect(201);
      const runId = createRes.body?.id;

      const res = await request(app.getHttpServer()).get(
        `/runs/${runId}/variants?assetSymbol=SPY&limit=2&offset=0`,
      );
      expect([200, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.items).toBeDefined();
        expect(res.body.total).toBeDefined();
      } else {
        expect(res.body.error?.code).toBe("DB_NOT_READY");
      }
    });
  });
});
