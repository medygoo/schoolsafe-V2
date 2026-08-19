const { test, expect } = require("@playwright/test");
const { enterDemoWorkspace, expectBranches, expectNoBranch, openAction } = require("./helpers");

test.describe("Profil chef d’établissement", () => {
  test("affiche les branches stratégiques sans administration ni comptabilité", async ({ page }) => {
    await enterDemoWorkspace(page, "school_head");
    await expectBranches(page, "school_head");
    await expectNoBranch(page, "administration");
    await expectNoBranch(page, "accounting");
    await expectNoBranch(page, "people");
    await expectNoBranch(page, "communication");
  });

  test("peut consulter les approbations", async ({ page }) => {
    await enterDemoWorkspace(page, "school_head");
    await openAction(page, "Approbations");
    await expect(page.locator("#pilotageModule")).toBeVisible();
    await expect(page.locator('[data-pilotage-tab="alerts"].active')).toBeVisible();
  });

  test("a une vue financière en lecture seule", async ({ page }) => {
    await enterDemoWorkspace(page, "school_head");
    await openAction(page, "Recettes");
    await expect(page.locator("#financeModule")).toBeVisible();
    await expect(page.locator('#financeTabs [data-finance-tab="cash"]')).toBeHidden();
    await expect(page.locator('#financeTabs [data-finance-tab="fees"]')).toBeHidden();
    await expect(page.locator("#paymentForm")).toHaveCount(0);
  });
});
