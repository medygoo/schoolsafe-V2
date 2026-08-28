import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

async function openExpenses(page: import("@playwright/test").Page) {
  await enterDemoWorkspace(page, "accountant");
  await openAction(page, "Journal comptable");
  await page.locator('[data-accounting-tab="expenses"]').click();
  await expect(page.locator("[data-accounting-expenses]")).toBeVisible();
}

test.describe("G3-FE — registre des dépenses borné", () => {
  test("affiche uniquement les dépenses Finance déjà visibles", async ({ page }) => {
    await openExpenses(page);

    const register = page.locator("[data-accounting-expenses]");
    await expect(register).toContainText("DEP-2026-011");
    await expect(register).toContainText("Fournitures administratives");
    await expect(register).toContainText("Validée");
    await expect(register).toContainText("DEP-2026-012");
    await expect(register).toContainText("DEVISE MANQUANTE");
    await expect(register.locator("tbody tr")).toHaveCount(2);
  });

  test("montre le contrat futur sans permettre ni persister une dépense", async ({ page }) => {
    await openExpenses(page);

    const register = page.locator("[data-accounting-expenses]");
    for (const field of ["expenseFutureDate", "expenseFutureLabel", "expenseFutureAmount", "expenseFutureCurrency", "expenseFutureCategory", "expenseFutureReference", "expenseFutureReceipt"]) {
      await expect(register.locator(`#${field}`)).toBeVisible();
    }
    await expect(register).toContainText("PERMISSION D’ÉCRITURE REQUISE");
    await expect(register).toContainText("BACKEND_LATER");
    await expect(register.locator("#expenseFutureSubmit")).toBeDisabled();

    await register.locator("#expenseFutureLabel").fill("Dépense qui ne doit pas exister");
    const storageBefore = await page.evaluate(() => Object.keys(localStorage).filter((key) => /expense|depense/i.test(key)));
    await page.locator('[data-accounting-tab="dashboard"]').click();
    await page.locator('[data-accounting-tab="expenses"]').click();
    await expect(page.locator("[data-accounting-expenses] tbody tr")).toHaveCount(2);
    await expect(page.locator("[data-accounting-expenses]")).not.toContainText("Dépense qui ne doit pas exister");
    const storageAfter = await page.evaluate(() => Object.keys(localStorage).filter((key) => /expense|depense/i.test(key)));
    expect(storageAfter).toEqual(storageBefore);
  });
});
