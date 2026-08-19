const { test, expect } = require("@playwright/test");
const { enterDemoWorkspace, expectBranches, expectNoBranch, openAction } = require("./helpers");

test.describe("Profil parent", () => {
  test("affiche les branches école, finance et communication", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    await expectBranches(page, "parent");
    await expectNoBranch(page, "security");
    await expectNoBranch(page, "pilotage");
    await expectNoBranch(page, "pedagogy");
  });

  test("ne voit que ses propres enfants dans la situation familiale", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    await openAction(page, "Frais scolaires");
    await expect(page.locator("#financeModule")).toBeVisible();
    await expect(page.locator('#financeTabs [data-finance-tab="family"].active')).toBeVisible();
    await expect(page.locator('#financeTabs [data-finance-tab="cash"]')).toBeHidden();

    const options = await page.locator("#familyFinanceStudent").innerText();
    expect(options).toContain("Lucas Martin");
    expect(options).toContain("Emma Martin");
    expect(options).toContain("Aline Martin");
    expect(options).not.toContain("Ethan Leroy");
    expect(options).not.toContain("Chloé Bernard");
  });

  test("a un accès certificatif restreint à son enfant", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    await openAction(page, "Épreuves certificatives");
    await expect(page.locator("#pedagogyModule")).toBeVisible();
    await page.locator('[data-cert-exam="EXETAT"]').click();
    await expect(page.locator('[data-cert-view="stages"]')).toBeVisible();
    await expect(page.locator('[data-cert-view="parent"]')).toBeVisible();
    await expect(page.locator('[data-cert-view="candidates"]')).toHaveCount(0);
    await expect(page.locator('[data-cert-view="results"]')).toHaveCount(0);
    await expect(page.locator('[data-cert-view="preparation"]')).toHaveCount(0);
  });
});
