import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("G6-FE — rapprochement et anomalies", () => {
  test("explique la chaîne visible et signale les anomalies démontrables sans corriger", async ({ page }) => {
    await enterDemoWorkspace(page, "accountant");
    await page.evaluate(() => {
      const state = (window as any).SchoolSafeFinanceModule._state;
      state.transactions.push(
        { id: "duplicate-receipt", receipt: "REC-2026-0587", date: "15 août 2026 · 11:00", amount: 1, currency: "CDF", status: "Validé", studentFeeId: "demo-sf-lucas-school" },
        { id: "missing-reference", date: "15 août 2026 · 11:10", amount: 5, currency: "CDF", status: "Validé" },
      );
      state.expenses.push({ date: "15 août 2026", label: "Dépense sans référence", amount: 20, currency: "CDF", status: "Validée" });
      state.receipts = [
        { reference: "REC-ORPHAN-1", amount: 10, currency: "CDF" },
        { reference: "REC-2026-0587", amount: 999, currency: "CDF" },
      ];
    });
    await openAction(page, "Journal comptable");
    await page.locator('[data-accounting-tab="reconciliation"]').click();

    const reconciliation = page.locator("[data-accounting-reconciliation]");
    await expect(reconciliation).toContainText("Paiement → student_fee → reçu / référence → journal → caisse → écart / anomalie");
    for (const anomaly of [
      "Lien student_fee absent",
      "Référence de transaction absente",
      "Reçu sans transaction",
      "Référence dupliquée",
      "Montant incohérent",
      "Devise manquante",
      "Dépense sans référence",
    ]) {
      await expect(reconciliation).toContainText(anomaly);
    }
    await expect(reconciliation).toContainText("LECTURE SEULE");
    await expect(reconciliation.locator('button:has-text("Corriger")')).toHaveCount(0);
    await expect(reconciliation.locator('button:has-text("Supprimer")')).toHaveCount(0);
  });

  test("signale l’écart du brouillon de clôture sans modifier la caisse", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    await openAction(page, "Journal comptable");
    await page.locator('[data-accounting-tab="closing"]').click();
    await page.locator("#closingDate").fill("2026-08-15");
    await page.locator("#closingTill").fill("Caisse principale");
    await page.locator("#closingExpected").fill("1000");
    await page.locator("#closingCounted").fill("950");
    await page.locator("#closingPrepare").click();
    await page.locator('[data-accounting-tab="reconciliation"]').click();

    const reconciliation = page.locator("[data-accounting-reconciliation]");
    await expect(reconciliation).toContainText("Écart de clôture");
    await expect(reconciliation).toContainText("-50 CDF");
    await expect(reconciliation).toContainText("AUCUNE CORRECTION AUTOMATIQUE");
  });
});
