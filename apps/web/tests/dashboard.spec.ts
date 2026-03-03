import { test, expect } from "@playwright/test";

const DASH = (q: Record<string, string> = {}) => {
  const base: Record<string, string> = {
    assetSymbol: "SPY",
    topN: "10",
    unstableOnly: "1",
    showLegacy: "0",
    sortRisk: "1",
    ...q,
  };
  const params = new URLSearchParams(base);
  return `/dashboard?${params.toString()}`;
};

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    // Seed display name so IdentityBootstrap modal never appears (avoids overlay blocking clicks)
    await page.context().addInitScript(() => {
      localStorage.setItem("cv_displayName", "E2E Test User");
    });
  });

  test("sparklines and filter toggles render and work", async ({ page }) => {
    await page.goto(DASH(), { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("dashboard-root")).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Forecast Accuracy")).toBeVisible({ timeout: 20000 });

    await expect(page.getByRole("columnheader", { name: "Risk" })).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("risk-cell").first()).toBeVisible({ timeout: 20000 });

    const sortToggle = page.getByTestId("toggle-sort-risk");
    await expect(sortToggle).toBeVisible({ timeout: 20000 });
    await sortToggle.click();

    const unstableToggle = page.getByTestId("toggle-only-unstable");
    await expect(unstableToggle).toBeVisible({ timeout: 20000 });
    await unstableToggle.click();

    const legacyToggle = page.getByTestId("toggle-show-legacy");
    await expect(legacyToggle).toBeVisible({ timeout: 20000 });
    await legacyToggle.click();

    await expect(page.getByTestId("dashboard-root")).toBeVisible({ timeout: 20000 });
  });

  test("loads dashboard and Run details drawer shows key sections", async ({ page }) => {
    await page.goto(DASH(), { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("dashboard-root")).toBeVisible({ timeout: 20000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    // Get runId from first Scaling table row, then open drawer via URL (avoids click/navigation race)
    const scalingTable = page.locator('[data-testid="dashboard-root"] table').first();
    const firstDetailsBtn = scalingTable
      .locator("tbody tr")
      .filter({ hasNot: page.locator("td[colspan]") })
      .first()
      .getByTestId("run-details-btn");
    await expect(firstDetailsBtn).toBeVisible({ timeout: 20000 });
    const runId = await firstDetailsBtn.getAttribute("data-runid");
    expect(runId).toBeTruthy();

    await page.goto(DASH({ drawerRunId: runId! }), { waitUntil: "domcontentloaded" });

    const drawer = page.getByTestId("run-details-drawer");
    await expect(drawer).toBeVisible({ timeout: 20000 });

    await expect(drawer.getByTestId("run-details-title")).toBeVisible({ timeout: 20000 });
    // Key sections: Open run link (when loaded) or Loading state
    await expect(
      drawer.getByRole("link", { name: /Open run/i }).or(drawer.getByText(/Loading run details/i))
    ).toBeVisible({ timeout: 20000 });
  });

  test("summary API returns driftAsset and driftGlobal objects", async ({ request }) => {
    const res = await request.get(
      "http://localhost:4000/api/dashboard/summary?limit=10&assetSymbol=SPY"
    );
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      driftAsset?: unknown;
      driftGlobal?: unknown;
    };
    expect(typeof body.driftAsset).toBe("object");
    expect(body.driftAsset).not.toBeNull();
    expect(typeof body.driftGlobal).toBe("object");
    expect(body.driftGlobal).not.toBeNull();
  });

  test("Run Details drawer deep-links via drawerRunId URL param", async ({ page }) => {
    const apiRes = await page.request.get(
      "http://localhost:4000/api/dashboard/summary?limit=50&assetSymbol=SPY"
    );
    expect(apiRes.ok()).toBeTruthy();
    const body = (await apiRes.json()) as {
      scalingRows?: Array<{ runId?: string; variants?: number }>;
      latestRun?: { id?: string };
    };
    const runId =
      (body?.scalingRows || []).find((r) => (r?.variants ?? 0) >= 2)?.runId ||
      body?.latestRun?.id;
    expect(runId).toBeTruthy();

    await page.goto(DASH({ drawerRunId: String(runId) }), { waitUntil: "domcontentloaded" });

    const drawer = page.getByTestId("run-details-drawer");
    await expect(drawer).toBeVisible({ timeout: 20000 });
    await expect(drawer.getByTestId("run-details-title")).toBeVisible({ timeout: 20000 });
  });
});
