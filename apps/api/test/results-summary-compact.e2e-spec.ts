import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("GET /results/summary-compact (e2e)", () => {
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

  it("a) no run_id => 400", () => {
    return request(app.getHttpServer())
      .get("/results/summary-compact")
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toBe("run_id is required");
      });
  });

  it("b) run_id=not-a-uuid => 400", () => {
    return request(app.getHttpServer())
      .get("/results/summary-compact?run_id=not-a-uuid")
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toBe("run_id must be a UUID");
      });
  });

  it("c) run_id=00000000-0000-0000-0000-000000000000 => 404", () => {
    return request(app.getHttpServer())
      .get("/results/summary-compact?run_id=00000000-0000-0000-0000-000000000000")
      .expect(404)
      .expect((res) => {
        expect(res.body.message).toMatch(/Run not found/);
      });
  });

  it("d) valid run_id => 200 and metrics.totalSteps is number > 0", async () => {
    const runsRes = await request(app.getHttpServer()).get("/results/runs?limit=1");
    const runId = runsRes.body?.items?.[0]?.id;
    if (!runId) {
      console.warn("Skipping test d: no runs in DB");
      return;
    }
    const res = await request(app.getHttpServer())
      .get(`/results/summary-compact?run_id=${runId}`)
      .expect(200);
    expect(typeof res.body.metrics?.totalSteps).toBe("number");
    expect(res.body.metrics.totalSteps).toBeGreaterThan(0);
  });

  it("e) when prePersistHistogram exists, it must equal persistedHistogram", async () => {
    const runsRes = await request(app.getHttpServer()).get("/results/runs?limit=1");
    const runId = runsRes.body?.items?.[0]?.id;
    if (!runId) {
      console.warn("Skipping test e: no runs in DB");
      return;
    }
    const res = await request(app.getHttpServer())
      .get(`/results/summary-compact?run_id=${runId}`)
      .expect(200);
    const pre = res.body.debug?.prePersistHistogram;
    const pers = res.body.debug?.persistedHistogram;
    if (pre == null) {
      console.warn("Skipping test e: prePersistHistogram is null (run may predate RunDebug table)");
      return;
    }
    expect(pers).toBeDefined();
    expect(pre.BUY).toBe(pers.BUY);
    expect(pre.SELL).toBe(pers.SELL);
    expect(pre.HOLD).toBe(pers.HOLD);
    expect(pre.OTHER).toBe(pers.OTHER);
  });
});
