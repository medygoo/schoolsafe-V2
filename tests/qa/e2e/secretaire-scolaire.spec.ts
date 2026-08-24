import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, expectBranches } from "./helpers";

test.describe("Profil secrétaire scolaire", () => {
  test("affiche la branche communication avec messages et annonces", async ({ page }) => {
    await enterDemoWorkspace(page, "secretary");
    await expectBranches(page, "secretary");
    await expect(page.locator('[data-action="Messages"]')).toBeVisible();
    await expect(page.locator('[data-action="Annonces"]')).toBeVisible();
    await expect(page.locator('[data-action="Rendez-vous"]')).toBeVisible();
  });

  test("documente que la branche administration est masquée en mode démo", async ({ page }) => {
    await enterDemoWorkspace(page, "secretary");
    // En mode démo sans session live, la branche administration (Attestations, Certificats)
    // est masquée car elle exige school.manage/staff.manage.
    await expect(page.locator("#branch-administration")).toHaveCount(0);
    await expect(page.locator('[data-action="Attestations"]')).toHaveCount(0);
  });

  test("ne voit pas les branches finance, sécurité, pédagogie", async ({ page }) => {
    await enterDemoWorkspace(page, "secretary");
    await expect(page.locator("#branch-finance")).toHaveCount(0);
    await expect(page.locator("#branch-security")).toHaveCount(0);
    await expect(page.locator("#branch-pedagogy")).toHaveCount(0);
  });
});
