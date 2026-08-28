import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("I6-FE — réceptions et anomalies", () => {
  test("rapproche commande et réception avec tous les états contrôlés", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAction(page, "Réceptions");
    const receipts = page.locator("[data-inventory-receipts]");
    for (const label of ["COMMANDE", "RÉCEPTION", "COMPLET", "PARTIEL", "MANQUANT", "SURPLUS", "ENDOMMAGÉ", "À CONTRÔLER", "Quantité commandée", "Quantité reçue", "Écart", "Observation", "Anomalie"]) await expect(receipts).toContainText(label);
    await expect(receipts).toContainText("Aucune entrée Stock automatique");
    await expect(receipts).toContainText("Aucune dépense Finance automatique");
    await expect(receipts).toContainText("reçu financier ≠ réception de marchandises");
    await expect(receipts.locator("[data-auto-stock-entry], [data-auto-finance-expense]")).toHaveCount(0);
  });

  test("prépare une réception partielle distincte et persistante", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAction(page, "Réceptions");
    const form = page.locator("[data-inventory-receipt-form]");
    await form.locator("input[name=order]").fill("CMD-QA-77");
    await form.locator("input[name=item]").fill("Papier A4 QA");
    await form.locator("input[name=ordered]").fill("20");
    await form.locator("input[name=received]").fill("12");
    await form.locator("select[name=condition]").selectOption("CONFORME");
    await form.locator("textarea[name=observation]").fill("Huit unités manquantes QA");
    await form.locator("button[type=submit]").click();
    const draft = page.locator("[data-inventory-receipt-draft]");
    await expect(draft).toContainText("CMD-QA-77");
    await expect(draft).toContainText("PARTIEL");
    await expect(draft).toContainText("-8");
    await expect(draft).toContainText("BROUILLON LOCAL");
    await page.evaluate(() => { (window as any).SchoolSafeInventoryDemo.render("inventoryModule"); (window as any).SchoolSafeInventoryDemo.open("receipts"); });
    await expect(page.locator("[data-inventory-receipt-draft]")).toContainText("Huit unités manquantes QA");
  });

  test("interdit les réceptions détaillées en live", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.evaluate(() => {
      const inventory = (window as any).SchoolSafeInventoryDemo;
      inventory.setSession({ token: "qa", permissions: ["reports.operational.read"], scopes: [{ permission: "reports.operational.read", type: "school" }] });
      inventory.render("inventoryModule"); inventory.open("receipts");
    });
    await expect(page.locator("#inventoryModule")).toContainText("Stock non autorisé");
    await expect(page.locator("[data-inventory-receipts], [data-inventory-receipt-form]")).toHaveCount(0);
  });
});
