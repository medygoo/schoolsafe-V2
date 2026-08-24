import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, expectBranches } from "./helpers";

test.describe("Profil comptable", () => {
  test("affiche uniquement la branche comptabilité", async ({ page }) => {
    await enterDemoWorkspace(page, "accountant");
    await expectBranches(page, "accountant");
    await expect(page.locator('[data-action="Plan comptable"]')).toBeVisible();
    await expect(page.locator('[data-action="Journal comptable"]')).toBeVisible();
    await expect(page.locator('[data-action="Balance"]')).toBeVisible();
    await expect(page.locator('[data-action="Rapports SYSCOHADA"]')).toBeVisible();
  });

  test("ne voit pas les autres branches", async ({ page }) => {
    await enterDemoWorkspace(page, "accountant");
    await expect(page.locator("#branch-finance")).toHaveCount(0);
    await expect(page.locator("#branch-pedagogy")).toHaveCount(0);
    await expect(page.locator("#branch-security")).toHaveCount(0);
    await expect(page.locator("#branch-school")).toHaveCount(0);
  });
});
