import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("G1-FE — dashboard Comptabilité / Trésorerie", () => {
  test("ouvre une synthèse de trésorerie bornée pour le Comptable", async ({ page }) => {
    await enterDemoWorkspace(page, "accountant");
    await openAction(page, "Journal comptable");

    const dashboard = page.locator("[data-accounting-dashboard]");
    await expect(dashboard).toBeVisible();
    await expect(dashboard).toContainText("DÉMONSTRATION");
    await expect(dashboard).toContainText("BACKEND_LATER");

    for (const label of [
      "Position de trésorerie",
      "Recettes visibles",
      "Sorties visibles",
      "Caisses",
      "Clôtures",
      "Écarts",
      "Anomalies",
      "Rapports",
    ]) {
      await expect(dashboard.locator(".accounting-dashboard-metric small", { hasText: label })).toBeVisible();
    }

    await expect(dashboard.locator('[data-accounting-open="journal"]')).toBeVisible();
    await expect(dashboard.locator('[data-accounting-open="treasury"]')).toBeVisible();
    await expect(dashboard.locator('[data-accounting-open="reconciliation"]')).toBeVisible();
    await expect(dashboard.locator('[data-accounting-open="reports"]')).toBeVisible();
    await expect(dashboard.locator('[data-accounting-open="closing"]')).toHaveCount(0);
  });

  test("affiche la préparation de clôture uniquement avec finance.cash_register.close school", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    await openAction(page, "Journal comptable");

    await expect(page.locator('[data-accounting-open="closing"]')).toBeVisible();
  });

  test("fait primer un DENY explicite sur reports.financial.read", async ({ page }) => {
    await enterDemoWorkspace(page, "accountant");
    await page.evaluate(() => {
      const accounting = (window as any).SchoolSafeAccountingTreasury;
      accounting.setSession({
        permissions: ["reports.financial.read"],
        deniedPermissions: ["reports.financial.read"],
        scopes: [{ permission: "reports.financial.read", type: "school" }],
      });
      accounting.render("accountingModule");
    });

    const content = page.locator("#accountingContent");
    await expect(content).toContainText("Comptabilité / Trésorerie non autorisée");
    await expect(content).toContainText("DENY explicite prioritaire");
    await expect(content.locator("[data-accounting-dashboard]")).toHaveCount(0);
  });
});
