import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("G7-FE — rapports financiers frontend", () => {
  test("présente les synthèses autorisées sans produire de comptabilité légale", async ({ page }) => {
    await enterDemoWorkspace(page, "accountant");
    await page.evaluate(() => {
      (window as any).SchoolSafeFinanceModule._state.transactions.push({ id: "report-usd", receipt: "REC-USD-R1", date: "15 août 2026 · 12:00", amount: 40, currency: "USD", status: "Validé", studentFeeId: "demo-sf-lucas-transport" });
    });
    await openAction(page, "Journal comptable");
    await page.locator('[data-accounting-open="reports"]').click();

    const reports = page.locator("[data-accounting-reports]");
    await expect(reports).toContainText("SYNTHÈSE DE TRÉSORERIE");
    await expect(reports).toContainText("RAPPORT FINANCIER FRONTEND");
    await expect(reports).toContainText("BACKEND_LATER");
    for (const section of [
      "Journal du jour",
      "Recettes / dépenses",
      "Trésorerie par période",
      "Mouvements par devise",
      "Anomalies visibles",
      "Écarts de caisse",
      "Statut de clôture",
    ]) {
      await expect(reports).toContainText(section);
    }
    await expect(reports.locator('[data-report-currency="CDF"]')).toBeVisible();
    await expect(reports.locator('[data-report-currency="USD"]')).toContainText("40 USD");
    await expect(reports).toContainText("AUCUNE CONVERSION");
    await expect(reports).not.toContainText("Total général");
    await expect(reports).not.toContainText("Grand livre");
    await expect(reports).not.toContainText("Compte de résultat");
    await expect(reports).not.toContainText("Bilan légal");
    await expect(reports.locator('button:has-text("PDF")')).toHaveCount(0);
  });

  test("autorise finance.report.read school et refuse une session sans permission de rapport", async ({ page }) => {
    await enterDemoWorkspace(page, "accountant");
    await page.evaluate(() => {
      const accounting = (window as any).SchoolSafeAccountingTreasury;
      accounting.setSession({ permissions: ["finance.report.read"], scopes: [{ permission: "finance.report.read", type: "school" }] });
      accounting.render("accountingModule");
    });
    await page.locator('[data-accounting-open="reports"]').click();
    await expect(page.locator("[data-accounting-reports]")).toBeVisible();

    await page.evaluate(() => {
      const accounting = (window as any).SchoolSafeAccountingTreasury;
      accounting.setSession({ permissions: ["finance.status.read"], scopes: [{ permission: "finance.status.read", type: "school" }] });
      accounting.render("accountingModule");
    });
    await expect(page.locator("#accountingContent")).toContainText("Comptabilité / Trésorerie non autorisée");
    await expect(page.locator("[data-accounting-reports]")).toHaveCount(0);
  });
});
