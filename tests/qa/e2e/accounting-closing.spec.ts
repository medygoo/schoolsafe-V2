import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("G5-FE — préparation locale de clôture", () => {
  test("prépare un comptage local avec écart sans déclarer une clôture officielle", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    await openAction(page, "Journal comptable");
    await page.locator('[data-accounting-tab="closing"]').click();

    const closing = page.locator("[data-accounting-closing]");
    await expect(closing).toBeVisible();
    await closing.locator("#closingDate").fill("2026-08-15");
    await closing.locator("#closingTill").fill("Caisse principale");
    await closing.locator("#closingCurrency").selectOption("CDF");
    await closing.locator("#closingExpected").fill("1000");
    await closing.locator("#closingCounted").fill("900");
    await closing.locator("#closingObservation").fill("Comptage à revérifier");
    await closing.locator("#closingPrepare").click();

    await expect(closing).toContainText("BROUILLON LOCAL");
    await expect(closing).toContainText("ÉCART À CONTRÔLER");
    await expect(closing).toContainText("-100 CDF");
    await expect(closing).toContainText("CLÔTURE OFFICIELLE — BACKEND_LATER");
    await expect(closing).not.toContainText("Caisse officiellement clôturée");

    await page.locator('[data-accounting-tab="dashboard"]').click();
    await page.locator('[data-accounting-tab="closing"]').click();
    await expect(page.locator("[data-accounting-closing]")).toContainText("Comptage à revérifier");
  });

  test("masque et refuse la clôture sans permission ou avec DENY explicite", async ({ page }) => {
    await enterDemoWorkspace(page, "accountant");
    await openAction(page, "Journal comptable");
    await expect(page.locator('[data-accounting-tab="closing"]')).toBeHidden();
    await expect(page.locator("[data-accounting-closing]")).toHaveCount(0);

    await page.evaluate(() => {
      const accounting = (window as any).SchoolSafeAccountingTreasury;
      accounting.setSession({
        permissions: ["reports.financial.read", "finance.cash_register.close"],
        deniedPermissions: ["finance.cash_register.close"],
        scopes: [
          { permission: "reports.financial.read", type: "school" },
          { permission: "finance.cash_register.close", type: "school" },
        ],
      });
      accounting.render("accountingModule");
    });
    await expect(page.locator('[data-accounting-tab="closing"]')).toBeHidden();
    await expect(page.locator("#closingPrepare")).toHaveCount(0);
  });
});
