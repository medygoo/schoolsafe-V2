import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, expectBranches, expectNoBranch, openAction } from "./helpers";

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

  test("sélectionne un enfant, consulte ses reçus, et ne peut pas accéder aux reçus d’un autre enfant", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    await openAction(page, "Frais scolaires");
    await expect(page.locator("#financeModule")).toBeVisible();

    // Sélectionne Lucas Martin (premier enfant) et vérifie ses reçus.
    await page.locator("#familyFinanceStudent").selectOption("0");
    await expect(page.locator(".family-receipts")).toContainText("REC-2026-0586");
    await expect(page.locator(".family-receipts")).toContainText("REC-2026-0584");

    // Passe à Emma Martin (deuxième enfant) : les reçus doivent se mettre à jour.
    await page.locator("#familyFinanceStudent").selectOption("1");
    await expect(page.locator(".family-receipts")).toContainText("REC-2026-0585");
    await expect(page.locator(".family-receipts")).not.toContainText("REC-2026-0586");

    // Vérifie qu’un enfant non rattaché n’apparaît pas dans le sélecteur.
    const options = await page.locator("#familyFinanceStudent").innerText();
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
