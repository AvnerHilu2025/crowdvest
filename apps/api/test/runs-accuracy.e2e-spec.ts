import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("GET /runs/:id/accuracy (e2e)", () => {
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

  it("returns 200 with items array; each item has accuracyRate in [0,1]", async () => {
    const runsRes = await request(app.getHttpServer()).get("/results/runs?limit=20");
    const runId = runsRes.body?.items?.find((r: { status?: number }) => r.status === 2)?.id;
    if (!runId) return;

    const res = await request(app.getHttpServer())
      .get(`/runs/${runId}/accuracy`)
      .expect(200);

    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
    for (const item of res.body.items) {
      expect(item).toHaveProperty("accuracyRate");
      expect(typeof item.accuracyRate).toBe("number");
      expect(item.accuracyRate).toBeGreaterThanOrEqual(0);
      expect(item.accuracyRate).toBeLessThanOrEqual(1);
    }
  });

  it("returns 404 for non-existent run", () => {
    return request(app.getHttpServer())
      .get("/runs/00000000-0000-0000-0000-000000000000/accuracy")
      .expect(404);
  });

  it("returns 400 for invalid UUID", () => {
    return request(app.getHttpServer())
      .get("/runs/not-a-uuid/accuracy")
      .expect(400);
  });
});
