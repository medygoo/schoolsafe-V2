import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, expectBranches } from "./helpers";

test.describe("Profil responsable communication et site", () => {
  test("affiche la branche Messages et publications", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await expectBranches(page, "communication");
    await expect(page.locator('[data-action="Messages"]')).toBeVisible();
    await expect(page.locator('[data-action="Annonces"]')).toBeVisible();
    await expect(page.locator('[data-action="Site public"]')).toBeVisible();
    await expect(page.locator('[data-action="Événements"]')).toBeVisible();
  });

  test("ne voit pas les branches finance, sécurité, pédagogie", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await expect(page.locator("#branch-finance")).toHaveCount(0);
    await expect(page.locator("#branch-security")).toHaveCount(0);
    await expect(page.locator("#branch-pedagogy")).toHaveCount(0);
    await expect(page.locator("#branch-school")).toHaveCount(0);
  });
});
