import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, expectBranches, openAction } from "./helpers";

test.describe("Profil responsable administratif et admissions", () => {
  test("affiche la branche École avec les actions admissions", async ({ page }) => {
    await enterDemoWorkspace(page, "admissions");
    await expectBranches(page, "admissions");
    await expect(page.locator('[data-action="Préinscriptions"]')).toBeVisible();
    await expect(page.locator('[data-action="Créer l’élève"]')).toBeVisible();
    await expect(page.locator('[data-action="Parents et tuteurs"]')).toBeVisible();
    await expect(page.locator('[data-action="Importer des dossiers"]')).toBeVisible();
  });

  test("documente que la branche administration est masquée en mode démo", async ({ page }) => {
    await enterDemoWorkspace(page, "admissions");
    // En mode démo sans session live, la branche administration (Attestations, Archives)
    // est masquée car elle exige school.manage/staff.manage.
    await expect(page.locator("#branch-administration")).toHaveCount(0);
    await expect(page.locator('[data-action="Attestations"]')).toHaveCount(0);
  });

  test("ne voit pas les branches pédagogie, finance, sécurité", async ({ page }) => {
    await enterDemoWorkspace(page, "admissions");
    await expect(page.locator("#branch-pedagogy")).toHaveCount(0);
    await expect(page.locator("#branch-finance")).toHaveCount(0);
    await expect(page.locator("#branch-security")).toHaveCount(0);
  });
});
