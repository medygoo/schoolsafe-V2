import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, expectBranches, expectNoBranch, openAction } from "./helpers";

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

  test("saisit un QR, déclenche un scan et affiche le résultat", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    await openAction(page, "Scanner un QR");
    await expect(page.locator("#securityModule")).toBeVisible();

    await page.locator("#qrPayloadInput").fill("schoolsafe://card/123/abc");
    await page.locator('[data-event-type="entry"]').click();

    await expect(page.locator("#scanResult")).toBeVisible();
    await expect(page.locator("#scanResult")).toContainText("AUTORISÉ");
    await expect(page.locator("#scanResult")).toContainText("Lucas Martin");
  });
});
