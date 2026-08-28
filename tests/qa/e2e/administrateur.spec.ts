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

  test("ouvre la branche Administration Phase L avec les permissions démo explicites", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const entry = page.locator('button[data-branch="administration"]:visible').first();
    await expect(entry).toBeVisible();
    await entry.evaluate((element: HTMLElement) => element.click());
    await expect(page.locator("#administrationModule")).toBeVisible();
    await expect(page.locator("#administrationModule").getByText("8 domaines autorisés sur 8")).toBeVisible();
  });
});
