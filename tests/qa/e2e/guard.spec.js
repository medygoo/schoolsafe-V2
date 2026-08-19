const { test, expect } = require("@playwright/test");
const { enterDemoWorkspace, expectBranches, expectNoBranch, openAction } = require("./helpers");

test.describe("Profil agent de sécurité", () => {
  test("affiche uniquement la branche sécurité", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    await expectBranches(page, "guard");
    await expectNoBranch(page, "finance");
    await expectNoBranch(page, "pedagogy");
    await expectNoBranch(page, "pilotage");
  });

  test("peut ouvrir le scanner QR", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    await openAction(page, "Scanner un QR");
    await expect(page.locator("#securityModule")).toBeVisible();
    await expect(page.locator("#qrPayloadInput")).toBeVisible();
    await expect(page.locator('[data-event-type="entry"]')).toBeVisible();
    await expect(page.locator('[data-event-type="exit"]')).toBeVisible();
  });
});
