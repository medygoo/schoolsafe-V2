const { test, expect } = require("@playwright/test");
const { enterDemoWorkspace, expectBranches, expectNoBranch, openAction } = require("./helpers");

test.describe("Profil agent de caisse", () => {
  test("affiche uniquement la branche finance", async ({ page }) => {
    await enterDemoWorkspace(page, "cashier");
    await expectBranches(page, "cashier");
    await expectNoBranch(page, "pedagogy");
    await expectNoBranch(page, "security");
    await expectNoBranch(page, "pilotage");
  });

  test("peut enregistrer un paiement et obtenir un numéro de reçu", async ({ page }) => {
    await enterDemoWorkspace(page, "cashier");
    await openAction(page, "Enregistrer un paiement");
    await expect(page.locator("#financeModule")).toBeVisible();
    await expect(page.locator('#financeTabs [data-finance-tab="cash"].active')).toBeVisible();
    await expect(page.locator("#paymentForm")).toBeVisible();

    await page.locator("#financeStudentSelect").selectOption("0");
    await page.locator('#paymentForm select[name="fee"]').selectOption({ index: 0 });
    await page.locator('#paymentForm input[name="amount"]').fill("50000");
    await page.locator('#paymentForm input[name="reference"]').fill("Troisième tranche de démonstration");
    await page.locator('#paymentForm button[type="submit"]').click();

    // The demo local-sync adapter confirms the operation and generates a receipt number.
    await page.getByText("REC-2026-0588", { exact: true }).waitFor({ timeout: 15000 });
    await expect(page.getByText("REC-2026-0588", { exact: true })).toBeVisible();
  });

  test("n’a pas accès au paramétrage des frais", async ({ page }) => {
    await enterDemoWorkspace(page, "cashier");
    await openAction(page, "Rapport de caisse");
    await expect(page.locator("#financeModule")).toBeVisible();
    await expect(page.locator('#financeTabs [data-finance-tab="fees"]')).toBeHidden();
    await expect(page.locator("#closeCashRegister")).toBeVisible();
  });
});
