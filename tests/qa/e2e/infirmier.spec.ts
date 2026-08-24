import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, expectBranches } from "./helpers";

test.describe("Profil infirmier", () => {
  test("affiche la branche Santé et urgences", async ({ page }) => {
    await enterDemoWorkspace(page, "nurse");
    await expectBranches(page, "nurse");
    await expect(page.locator('[data-action="Enregistrer un passage"]')).toBeVisible();
    await expect(page.locator('[data-action="Dossiers santé"]')).toBeVisible();
    await expect(page.locator('[data-action="Allergies"]')).toBeVisible();
  });

  test("ne voit pas les branches finance, pédagogie, sécurité", async ({ page }) => {
    await enterDemoWorkspace(page, "nurse");
    await expect(page.locator("#branch-finance")).toHaveCount(0);
    await expect(page.locator("#branch-pedagogy")).toHaveCount(0);
    await expect(page.locator("#branch-security")).toHaveCount(0);
    await expect(page.locator("#branch-school")).toHaveCount(0);
  });
});
