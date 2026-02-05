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
});
