import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, expectBranches } from "./helpers";

test.describe("Profil responsable RH", () => {
  test("affiche la branche Personnel avec actions RH", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await expectBranches(page, "hr");
    await expect(page.locator('[data-action="Personnel"]')).toBeVisible();
    await expect(page.locator('[data-action="Contrats"]')).toBeVisible();
    await expect(page.locator('[data-action="Absences"]')).toBeVisible();
    await expect(page.locator('[data-action="Salaires"]')).toBeVisible();
  });

  test("ne voit pas les branches élèves, finance, sécurité", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await expect(page.locator("#branch-school")).toHaveCount(0);
    await expect(page.locator("#branch-finance")).toHaveCount(0);
    await expect(page.locator("#branch-security")).toHaveCount(0);
    await expect(page.locator("#branch-pedagogy")).toHaveCount(0);
  });
});
