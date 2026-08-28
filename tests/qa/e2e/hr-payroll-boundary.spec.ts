import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("H6-FE — frontière Paie et rémunération", () => {
  test("présente uniquement le contrat frontend futur sans montant ni mutation", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await openAction(page, "Salaires");

    const payroll = page.locator("[data-hr-payroll]");
    await expect(payroll).toBeVisible();
    await expect(payroll).toContainText("PAIE — CONTRAT FRONTEND FUTUR");
    await expect(payroll).toContainText("FEATURE_LATER");
    await expect(payroll).toContainText("BACKEND_LATER");
    await expect(payroll).toContainText("PERMISSION PAIE DÉDIÉE REQUISE");
    for (const label of ["Salaire de base", "Primes", "Avances", "Retenues", "Net à payer", "Période", "Statut", "Historique", "Bulletin de paie"]) {
      await expect(payroll).toContainText(label);
    }
    await expect(payroll.locator("[data-hr-payroll-value]")).toHaveCount(9);
    for (const value of await payroll.locator("[data-hr-payroll-value]").allTextContents()) expect(value).toContain("Non disponible");
    await expect(payroll.locator("form, input, select, textarea, button")).toHaveCount(0);
    await expect(payroll).not.toContainText(/\b\d[\d\s.]*\s?(CDF|USD)\b/);
  });

  test("staff.manage ne devient jamais une permission Paie", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await page.evaluate(() => {
      const hr = (window as any).SchoolSafeHrDemo;
      hr.setSession({ permissions: ["staff.manage"], scopes: [{ permission: "staff.manage", type: "school" }] });
      hr.render("hrModule");
      hr.open("payroll");
    });
    await expect(page.locator("[data-hr-payroll]")).toHaveCount(0);
    await expect(page.locator("#hrContent")).toContainText("Paie non autorisée");
  });

  test("finance.payment.record ne permet ni salaire ni paiement du personnel", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await page.evaluate(() => {
      const hr = (window as any).SchoolSafeHrDemo;
      hr.setSession({ permissions: ["finance.payment.record"], scopes: [{ permission: "finance.payment.record", type: "school" }] });
      hr.render("hrModule");
      hr.open("payroll");
    });
    await expect(page.locator("[data-hr-payroll]")).toHaveCount(0);
    await expect(page.locator("#hrContent")).toContainText("Paie non autorisée");
    await expect(page.getByRole("button", { name: /payer|bulletin|avance|prime|retenue/i })).toHaveCount(0);
  });
});
