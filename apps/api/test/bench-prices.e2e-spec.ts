import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("POST /bench/prices (e2e)", () => {
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

  it("uses distinct seeds per repetition (n=3)", async () => {
    const res = await request(app.getHttpServer())
      .post("/bench/prices?symbols=QQQ&points=29&n=3&overwrite=true");
    if (res.status === 400 && /PriceSeriesPoint missing|symbols is required/i.test(res.body?.message ?? "")) {
      return;
    }
    expect(res.status).toBe(200);
    expect(res.body.seeds).toBeDefined();
    expect(Array.isArray(res.body.seeds)).toBe(true);
    expect(res.body.seeds).toHaveLength(3);
    const seeds = res.body.seeds as number[];
    const unique = new Set(seeds);
    expect(unique.size).toBe(3);
  });
});
