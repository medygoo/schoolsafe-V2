import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

async function openJournal(page: import("@playwright/test").Page) {
  await enterDemoWorkspace(page, "accountant");
  await openAction(page, "Journal comptable");
  await page.locator('[data-accounting-open="journal"]').click();
  await expect(page.locator("[data-accounting-journal]")).toBeVisible();
}

test.describe("G2-FE — journal de trésorerie en lecture seule", () => {
  test("projette les paiements et dépenses Finance avec leurs liens et leurs bornes", async ({ page }) => {
    await openJournal(page);

    const journal = page.locator("[data-accounting-journal]");
    await expect(journal).toContainText("REC-2026-0586");
    await expect(journal).toContainText("demo-sf-lucas-school");
    await expect(journal).toContainText("DEP-2026-011");
    await expect(journal.locator('[data-journal-direction="in"]')).not.toHaveCount(0);
    await expect(journal.locator('[data-journal-direction="out"]')).not.toHaveCount(0);
    await expect(journal).toContainText("DEVISE MANQUANTE");
    await expect(journal).toContainText("LECTURE SEULE");
    await expect(journal.locator("form")).toHaveCount(0);
    await expect(journal.locator('button:has-text("Enregistrer")')).toHaveCount(0);
  });

  test("sépare strictement CDF et USD et filtre le journal visible", async ({ page }) => {
    await enterDemoWorkspace(page, "accountant");
    await page.evaluate(() => {
      const finance = (window as any).SchoolSafeFinanceModule;
      finance._state.transactions.push({
        id: "demo-usd-1",
        receipt: "REC-USD-0001",
        date: "14 août 2026 · 12:10",
        day: "14 août 2026",
        student: "Lucas Martin",
        fee: "Transport scolaire",
        amount: 25,
        currency: "USD",
        mode: "Espèces",
        reference: "Transport août",
        status: "Validé",
        studentFeeId: "demo-sf-lucas-transport",
      });
    });
    await openAction(page, "Journal comptable");
    await page.locator('[data-accounting-open="journal"]').click();

    const journal = page.locator("[data-accounting-journal]");
    await expect(journal.locator('[data-journal-currency-summary="CDF"]')).toBeVisible();
    await expect(journal.locator('[data-journal-currency-summary="USD"]')).toContainText("25 USD");
    await expect(journal).not.toContainText("Total général");
    await expect(journal).toContainText("AUCUNE CONVERSION");

    await journal.locator("#journalCurrency").selectOption("USD");
    await expect(journal.locator("tbody tr")).toHaveCount(1);
    await expect(journal.locator("tbody")).toContainText("REC-USD-0001");

    await journal.locator("#journalSearch").fill("absente");
    await expect(journal).toContainText("Aucun mouvement visible");
  });
});
