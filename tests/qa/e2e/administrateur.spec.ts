import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, expectBranches, openAction, domClick, openPermissionsConsole } from "./helpers";

test.describe("Profil administrateur principal", () => {
  test("affiche les branches métier et la gestion des droits", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await expectBranches(page, "admin");
    await expect(page.locator("#permissionsNav")).toBeVisible();
    await expect(page.locator("#cardsProtected")).toBeVisible();
  });

  test("peut ouvrir pilotage, sécurité et finance", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");

    await openAction(page, "Tableau de bord");
    await expect(page.locator("#pilotageModule")).toBeVisible();
    await expect(page.locator("#workspaceTitle")).toHaveText("Tableau de bord");
    await domClick(page, "#closePilotageModule");
    await expect(page.locator("#pilotageModule")).toBeHidden();

    await openAction(page, "Scanner un QR");
    await expect(page.locator("#securityModule")).toBeVisible();
    await expect(page.locator("#qrPayloadInput")).toBeVisible();
    await domClick(page, "#closeSecurityModule");
    await expect(page.locator("#securityModule")).toBeHidden();

    await openAction(page, "Structure des frais");
    await expect(page.locator("#financeModule")).toBeVisible();
    await expect(page.locator('#financeTabs [data-finance-tab="fees"].active')).toBeVisible();
  });

  test("peut ouvrir la console rôles et accès", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openPermissionsConsole(page);
    await expect(page.locator("#accessConsole")).toBeVisible();
    await expect(page.locator("#staffList")).toBeVisible();
  });

  test("documente que la branche administration avancée est masquée en mode démo", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    // En mode démo sans session live, le filtre visibleBranches masque la branche
    // "administration" (actions École & Personnel / Comptes et droits).
    await expect(page.locator("#branch-administration")).toHaveCount(0);
    await expect(page.locator('[data-action="Comptes et droits"]')).toHaveCount(0);
    await expect(page.locator('[data-action="École & Personnel"]')).toHaveCount(0);
  });
});
