import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("PATCH /runs/:runId/status (e2e)", () => {
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

  async function createRun(): Promise<string> {
    const res = await request(app.getHttpServer()).post("/runs").send({}).expect(201);
    expect(res.body?.id).toBeDefined();
    return res.body.id;
  }

  it("1) PATCH COMPLETED twice keeps same completedAt", async () => {
    const runId = await createRun();

    const first = await request(app.getHttpServer())
      .patch(`/runs/${runId}/status`)
      .send({ status: "COMPLETED" })
      .expect(200);
    expect(first.body.status).toBe("COMPLETED");
    expect(first.body.finishedAt).toBeDefined();

    const second = await request(app.getHttpServer())
      .patch(`/runs/${runId}/status`)
      .send({ status: "COMPLETED" })
      .expect(200);
    expect(second.body.status).toBe("COMPLETED");
    expect(second.body.finishedAt).toBe(first.body.finishedAt);

    const get = await request(app.getHttpServer()).get(`/runs/${runId}`).expect(200);
    expect(get.body.status).toBe("COMPLETED");
    expect(get.body.completedAt).toBe(first.body.finishedAt);
  });

  it("2) PATCH COMPLETED then PATCH FAILED returns 409", async () => {
    const runId = await createRun();

    await request(app.getHttpServer())
      .patch(`/runs/${runId}/status`)
      .send({ status: "COMPLETED" })
      .expect(200);

    const res = await request(app.getHttpServer())
      .patch(`/runs/${runId}/status`)
      .send({ status: "FAILED", lastError: "blocked" })
      .expect(409);
    expect(res.body.message).toMatch(/Invalid status transition.*COMPLETED.*FAILED/);

    const get = await request(app.getHttpServer()).get(`/runs/${runId}`).expect(200);
    expect(get.body.status).toBe("COMPLETED");
  });

  it("3) PATCH FAILED then PATCH COMPLETED is allowed and clears failedAt + lastError and sets completedAt", async () => {
    const runId = await createRun();

    await request(app.getHttpServer())
      .patch(`/runs/${runId}/status`)
      .send({ status: "FAILED", lastError: "test-error" })
      .expect(200);

    let get = await request(app.getHttpServer()).get(`/runs/${runId}`).expect(200);
    expect(get.body.status).toBe("FAILED");
    expect(get.body.failedAt).toBeDefined();
    expect(get.body.lastError).toBe("test-error");

    await request(app.getHttpServer())
      .patch(`/runs/${runId}/status`)
      .send({ status: "COMPLETED" })
      .expect(200);

    get = await request(app.getHttpServer()).get(`/runs/${runId}`).expect(200);
    expect(get.body.status).toBe("COMPLETED");
    expect(get.body.completedAt).toBeDefined();
    expect(get.body.failedAt).toBeNull();
    expect(get.body.lastError).toBeNull();
  });

  it("4) PATCH FAILED twice keeps same failedAt and lastError preserved unless provided", async () => {
    const runId = await createRun();

    const first = await request(app.getHttpServer())
      .patch(`/runs/${runId}/status`)
      .send({ status: "FAILED", lastError: "original-error" })
      .expect(200);
    expect(first.body.status).toBe("FAILED");
    expect(first.body.finishedAt).toBeDefined();

    const second = await request(app.getHttpServer())
      .patch(`/runs/${runId}/status`)
      .send({ status: "FAILED" })
      .expect(200);
    expect(second.body.status).toBe("FAILED");
    expect(second.body.finishedAt).toBe(first.body.finishedAt);

    const get = await request(app.getHttpServer()).get(`/runs/${runId}`).expect(200);
    expect(get.body.status).toBe("FAILED");
    expect(get.body.failedAt).toBe(first.body.finishedAt);
    expect(get.body.lastError).toBe("original-error");
  });
});
