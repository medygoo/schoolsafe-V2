import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, expectBranches, openAction, domClick } from "./helpers";

test.describe("Profil responsable pédagogique", () => {
  test("affiche les branches pédagogie, finance (statut) et rapports", async ({ page }) => {
    await enterDemoWorkspace(page, "pedagogy");
    await expectBranches(page, "pedagogy");
    await expect(page.locator('[data-action="Voir les élèves en ordre ou à régulariser"]')).toBeVisible();
  });

  test("peut ouvrir le module pédagogie et le palmarès", async ({ page }) => {
    await enterDemoWorkspace(page, "pedagogy");

    await openAction(page, "Devoirs et corrections");
    await expect(page.locator("#pedagogyModule")).toBeVisible();
    await expect(page.locator("#workspaceTitle")).toHaveText("Devoirs et activités");
    await domClick(page, "#closePedagogyModule");
    await expect(page.locator("#pedagogyModule")).toBeHidden();

    await openAction(page, "Palmarès");
    await expect(page.locator("#palmaresModule")).toBeVisible();
    await expect(page.locator(".palmares-header")).toContainText("Palmarès");
    await domClick(page, "#closePalmaresModule");
    await expect(page.locator("#palmaresModule")).toBeHidden();
  });

  test("ne voit pas les branches sécurité, caisse ou administration", async ({ page }) => {
    await enterDemoWorkspace(page, "pedagogy");
    await expect(page.locator("#branch-security")).toHaveCount(0);
    await expect(page.locator("#branch-finance")).toBeVisible();
    await expect(page.locator('[data-action="Structure des frais"]')).toHaveCount(0);
    await expect(page.locator('[data-action="Scanner un QR"]')).toHaveCount(0);
  });
});
