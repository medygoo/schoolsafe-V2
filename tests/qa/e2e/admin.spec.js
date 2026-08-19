const { test, expect } = require("@playwright/test");
const { enterDemoWorkspace, expectBranches, openAction, domClick } = require("./helpers");

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
});
