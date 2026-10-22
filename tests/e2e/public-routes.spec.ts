import { expect, test } from "@playwright/test";

test.describe("public product routes", () => {
  test("home exposes the responsive product navigation", async ({ page }, testInfo) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Worldview/i);
    await expect(page.getByRole("banner")).toBeVisible();

    if (testInfo.project.name === "mobile-chromium") {
      await expect(async () => {
        const menuButton = page.getByRole("button", { name: "Open menu" });
        if (await menuButton.isVisible()) await menuButton.click();
        await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible({ timeout: 1_000 });
      }).toPass();
    }

    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  });

  test("quiz catalog and Atlas remain reachable", async ({ page }) => {
    await page.goto("/quiz");
    await expect(page.getByRole("main")).toBeVisible();

    await page.goto("/atlas");
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("Atlas entries render rich and sparse records", async ({ page }) => {
    await page.goto("/atlas/philosophies/groyper");
    await expect(page.getByRole("heading", { level: 1, name: "Groyper movement" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Activity and influence" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Entry sections" })).toBeVisible();

    await page.goto("/atlas/philosophies/national-anarchism");
    await expect(page.getByRole("heading", { level: 1, name: "National anarchism" })).toBeVisible();
  });

  test("compare workspace filters axes by domain", async ({ page }) => {
    await page.goto("/atlas/compare?ids=groyper,clerical-fascism,white-nationalism");
    await expect(page.getByRole("heading", { level: 1, name: "Compare traditions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Positions on every axis" })).toBeVisible();
    await page.getByRole("group", { name: "Domain" }).getByRole("button", { name: "Economy" }).click();
    await expect(page.getByRole("img", { name: /^Trade,/ }).first()).toBeVisible();
    await expect(page.getByRole("img", { name: /^Federalism,/ })).toHaveCount(0);

    await page.goto("/atlas/compare");
    await expect(page.getByRole("combobox", { name: "Add a tradition to compare" })).toBeVisible();
  });
});
