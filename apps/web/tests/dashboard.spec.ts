import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("loads dashboard and Run details drawer shows key sections", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });

    await page.goto("/dashboard?assetSymbol=SPY&topN=10", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("dashboard-root")).toBeVisible();

    const firstDataRow = page
      .locator('[data-testid="dashboard-root"] table')
      .first()
      .locator("tbody tr")
      .filter({ hasNot: page.locator("td[colspan]") })
      .first();

    await expect(firstDataRow).toBeVisible();

    const rows = page
      .locator('[data-testid="dashboard-root"] table')
      .first()
      .locator("tbody tr")
      .filter({ hasNot: page.locator("td[colspan]") });

    const count = await rows.count();
    let runId: string | null = null;

    for (let i = 0; i < Math.min(count, 25); i++) {
      const row = rows.nth(i);
      const variantsText = await row.locator("td").nth(2).textContent();
      const variants = parseInt((variantsText ?? "").trim() || "0", 10);

      if (variants >= 2) {
        runId = await row.getByTestId("run-details-btn").getAttribute("data-runid");
        expect(runId).toBeTruthy();
        break;
      }
    }

    expect(runId).toBeTruthy();

    await page.goto(
      `/dashboard?assetSymbol=SPY&topN=10&drawerRunId=${runId}`,
      { waitUntil: "domcontentloaded" }
    );

    const drawer = page.getByTestId("run-details-drawer");
    await expect(drawer).toBeVisible({ timeout: 20000 });
    await expect(drawer.getByTestId("run-details-title")).toBeVisible({
      timeout: 20000,
    });

    await expect(drawer.getByText(/RUN ID/i)).toBeVisible({ timeout: 20000 });
    await expect(drawer.getByText(/Overhead breakdown/i)).toBeVisible({
      timeout: 20000,
    });
  });

  test("Run Details drawer deep-links via drawerRunId URL param", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });

    await page.goto("/dashboard?assetSymbol=SPY&topN=10", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("dashboard-root")).toBeVisible();

    const rows = page
      .locator('[data-testid="dashboard-root"] table')
      .first()
      .locator("tbody tr")
      .filter({ hasNot: page.locator("td[colspan]") });

    const count = await rows.count();
    let runId: string | null = null;

    for (let i = 0; i < Math.min(count, 25); i++) {
      const row = rows.nth(i);
      const variantsText = await row.locator("td").nth(2).textContent();
      const variants = parseInt((variantsText ?? "").trim() || "0", 10);

      if (variants >= 2) {
        const compareLink = row.getByRole("link", { name: /Compare seeds/i });
        const href = await compareLink.getAttribute("href");
        expect(href).toBeTruthy();
        const match = href!.match(/\/runs\/([^/]+)\/compare/);
        expect(match).toBeTruthy();
        runId = match![1];
        break;
      }
    }

    expect(runId).toBeTruthy();

    await page.goto(
      `/dashboard?assetSymbol=SPY&topN=10&drawerRunId=${runId}`,
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const drawer = page.getByTestId("run-details-drawer");
    await expect(drawer).toBeVisible({ timeout: 20000 });
    await expect(drawer.getByText(/Run details/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(drawer.getByText(/Run ID/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(
      drawer
        .getByRole("link", { name: /Compare seeds/i })
        .or(drawer.getByRole("button", { name: /Compare seeds/i }))
    ).toBeVisible({ timeout: 20000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const drawerAfterReload = page.getByTestId("run-details-drawer");
    await expect(drawerAfterReload).toBeVisible({ timeout: 20000 });

    const closeBtn = drawerAfterReload.getByRole("button", {
      name: /Close/i,
    });
    await closeBtn.evaluate((el) => (el as HTMLElement).click());

    await expect(page.getByTestId("run-details-drawer")).toBeHidden({
      timeout: 10000,
    });

    await page.waitForFunction(
      () => !window.location.href.includes("drawerRunId"),
      { timeout: 5000 }
    );
    expect(page.url()).not.toContain("drawerRunId");
  });
});
