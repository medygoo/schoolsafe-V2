import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("G4-FE — position de trésorerie par devise", () => {
  test("calcule chaque devise indépendamment sans inventer de solde d’ouverture", async ({ page }) => {
    await enterDemoWorkspace(page, "accountant");
    await page.evaluate(() => {
      const finance = (window as any).SchoolSafeFinanceModule;
      finance._state.transactions.push({ id: "usd-in", receipt: "REC-USD-10", date: "15 août 2026 · 09:00", amount: 100, currency: "USD", status: "Validé" });
      finance._state.expenses.push({ reference: "DEP-USD-10", date: "15 août 2026", label: "Sortie USD", amount: 30, currency: "USD", status: "Validée" });
    });
    await openAction(page, "Journal comptable");
    await page.locator('[data-accounting-tab="treasury"]').click();

    const treasury = page.locator("[data-accounting-treasury]");
    const cdf = treasury.locator('[data-treasury-currency="CDF"]');
    const usd = treasury.locator('[data-treasury-currency="USD"]');
    await expect(cdf).toBeVisible();
    await expect(usd).toBeVisible();
    await expect(usd).toContainText("Entrées 100 USD");
    await expect(usd).toContainText("Sorties 30 USD");
    await expect(usd).toContainText("Mouvements nets 70 USD");
    await expect(usd).toContainText("SOLDE D’OUVERTURE NON DISPONIBLE");
    await expect(usd).toContainText("BACKEND_LATER");
    await expect(treasury).not.toContainText("Total général");
    await expect(treasury).toContainText("AUCUNE CONVERSION");
  });

  test("ajoute dynamiquement une devise visible et isole les mouvements sans devise", async ({ page }) => {
    await enterDemoWorkspace(page, "accountant");
    await page.evaluate(() => {
      (window as any).SchoolSafeFinanceModule._state.transactions.push({ id: "eur-in", receipt: "REC-EUR-1", date: "15 août 2026 · 10:00", amount: 50, currency: "EUR", status: "Validé" });
    });
    await openAction(page, "Journal comptable");
    await page.locator('[data-accounting-tab="treasury"]').click();

    const treasury = page.locator("[data-accounting-treasury]");
    await expect(treasury.locator('[data-treasury-currency="EUR"]')).toContainText("50 EUR");
    await expect(treasury).toContainText("MOUVEMENTS SANS DEVISE EXCLUS");
    await expect(treasury).toContainText("2 mouvements à qualifier");
  });
});
