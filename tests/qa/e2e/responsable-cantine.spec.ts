import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, expectBranches } from "./helpers";

test.describe("Profil responsable cantine", () => {
  test("affiche la branche Service de cantine", async ({ page }) => {
    await enterDemoWorkspace(page, "canteen");
    await expectBranches(page, "canteen");
    await expect(page.locator('[data-action="Présences repas"]')).toBeVisible();
    await expect(page.locator('[data-action="Menus"]')).toBeVisible();
    await expect(page.locator('[data-action="Bénéficiaires"]')).toBeVisible();
  });

  test("ne voit pas les branches finance, pédagogie, sécurité", async ({ page }) => {
    await enterDemoWorkspace(page, "canteen");
    await expect(page.locator("#branch-finance")).toHaveCount(0);
    await expect(page.locator("#branch-pedagogy")).toHaveCount(0);
    await expect(page.locator("#branch-security")).toHaveCount(0);
    await expect(page.locator("#branch-school")).toHaveCount(0);
  });
});
