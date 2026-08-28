import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("F1-FE — dashboard Finance consolidé", () => {
  test("présente les synthèses et uniquement les raccourcis autorisés au responsable Finance", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    await openAction(page, "Tableau financier");

    const dashboard = page.locator("[data-finance-dashboard]");
    await expect(dashboard).toBeVisible();
    await expect(dashboard).toContainText("DÉMONSTRATION");

    for (const label of [
      "Situation financière",
      "Types de frais actifs",
      "Obligations élèves",
      "Paiements enregistrés",
      "Opérations récentes",
      "Exemptions",
      "Caisse",
      "Contrôles de frais",
      "Rapports",
      "Alertes et anomalies",
    ]) {
      await expect(dashboard.locator(".finance-dashboard-metric small", { hasText: label })).toBeVisible();
    }

    await expect(dashboard.locator('[data-finance-open="fees"]')).toBeVisible();
    await expect(dashboard.locator('[data-finance-open="assignments"]')).toBeVisible();
    await expect(dashboard.locator('[data-finance-open="reports"]')).toBeVisible();
    await expect(dashboard.locator('[data-finance-open="cash-register"]')).toBeVisible();
    await expect(dashboard.locator('[data-finance-open="cash"]')).toHaveCount(0);
  });

  test("n’ouvre jamais Finance générale avec finance.control.scan seul", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    await page.evaluate(() => {
      const finance = (window as any).SchoolSafeFinanceModule;
      finance.setSession({
        permissions: ["finance.control.scan"],
        scopes: [{ permission: "finance.control.scan", type: "assigned_classes" }],
        assignedClassIds: ["demo-class-1"],
      });
      finance.render("financeModule", { tab: "overview" });
    });

    const content = page.locator("#financeContent");
    await expect(content).toContainText("Finance générale non autorisée");
    await expect(content).toContainText("Contrôle des frais");
    await expect(content.locator("[data-finance-dashboard]")).toHaveCount(0);
    await expect(page.locator("#financeTabs button:visible")).toHaveCount(0);
  });

  test("fait primer le DENY explicite et masque l’action concernée", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    await page.evaluate(() => {
      const finance = (window as any).SchoolSafeFinanceModule;
      finance.setSession({
        permissions: ["finance.fee.read", "finance.fee.manage", "finance.report.read"],
        deniedPermissions: ["finance.fee.manage"],
        scopes: [
          { permission: "finance.fee.read", type: "school" },
          { permission: "finance.fee.manage", type: "school" },
          { permission: "finance.report.read", type: "school" },
        ],
      });
      finance.render("financeModule", { tab: "overview" });
    });

    const dashboard = page.locator("[data-finance-dashboard]");
    await expect(dashboard).toBeVisible();
    await expect(dashboard.locator('[data-finance-open="reports"]')).toBeVisible();
    await expect(dashboard.locator('[data-finance-open="assignments"]')).toHaveCount(0);
    await expect(page.locator('#financeTabs [data-finance-tab="assignments"]')).toBeHidden();
  });
});
