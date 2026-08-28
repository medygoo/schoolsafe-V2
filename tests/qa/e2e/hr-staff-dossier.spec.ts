import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("H2-FE — dossier personnel et cycle de vie", () => {
  test("filtre la liste et consulte une fiche RH fictive non sensible", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await openAction(page, "Personnel");

    const surface = page.locator("[data-hr-staff]");
    await expect(surface).toBeVisible();
    await expect(surface).toContainText("DÉMONSTRATION");
    await surface.locator('[data-hr-staff-filter="search"]').fill("Kalala");
    await expect(surface.locator("[data-hr-staff-row]")) .toHaveCount(1);
    await surface.locator("[data-hr-staff-row]").click();

    const dossier = surface.locator("[data-hr-staff-dossier]");
    await expect(dossier).toContainText("HR-DEM-001");
    await expect(dossier).toContainText("Aline Kalala");
    await expect(dossier).toContainText("Enseignante");
    await expect(dossier).toContainText("aline.kalala@example.test");
    await expect(dossier).toContainText("ACTIF");
    await expect(dossier).toContainText("Historique synthétique");
  });

  test("prépare et persiste une modification locale distincte de la fiche originale", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await openAction(page, "Personnel");
    const surface = page.locator("[data-hr-staff]");
    await surface.locator('[data-hr-staff-row="hr-demo-1"]').click();

    const original = surface.locator('[data-hr-staff-original="hr-demo-1"]');
    await expect(original).toContainText("ACTIF");
    await expect(original).toContainText("Primaire");

    const form = surface.locator("[data-hr-staff-form]");
    await form.locator('[name="service"]').selectOption("Administration");
    await form.locator('[name="status"]').selectOption("SUSPENDU ADMINISTRATIVEMENT — simulation");
    await form.locator('[name="observation"]').fill("Réaffectation à examiner");
    await form.locator('button[type="submit"]').click();

    const draft = surface.locator('[data-hr-staff-draft="hr-demo-1"]');
    await expect(draft).toContainText("BROUILLON LOCAL");
    await expect(draft).toContainText("BACKEND_LATER");
    await expect(draft).toContainText("Administration");
    await expect(draft).toContainText("SUSPENDU ADMINISTRATIVEMENT — simulation");
    await expect(original).toContainText("ACTIF");
    await expect(original).toContainText("Primaire");

    await page.evaluate(() => (window as any).SchoolSafeHrDemo.open("staff"));
    await expect(surface.locator('[data-hr-staff-draft="hr-demo-1"]')).toContainText("Réaffectation à examiner");
    await expect(surface.locator('[data-hr-staff-original="hr-demo-1"]')).toContainText("Historique synthétique");
  });

  test("staff.manage ne contourne pas un DENY explicite sur staff.read", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await page.evaluate(() => {
      const hr = (window as any).SchoolSafeHrDemo;
      hr.setSession({
        role: "hr",
        permissions: ["staff.read", "staff.manage"],
        deniedPermissions: ["staff.read"],
        scopes: [
          { permission: "staff.read", type: "school" },
          { permission: "staff.manage", type: "school" },
        ],
      });
      hr.render("hrModule");
      hr.open("staff");
    });

    await expect(page.locator("#hrContent")).toContainText("Dossier personnel non autorisé");
    await expect(page.locator("#hrContent")).toContainText("DENY explicite prioritaire");
    await expect(page.locator("[data-hr-staff-row]")).toHaveCount(0);
  });
});
