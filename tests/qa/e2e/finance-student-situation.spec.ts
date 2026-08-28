import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

async function openTab(page: any, tab: string) {
  await openAction(page, "Tableau financier");
  await page.locator(`[data-finance-tab="${tab}"]`).click();
  return page.locator("#financeContent");
}

test.describe("F3-FE — situation financière élève et exemptions", () => {
  test("relie obligations, transactions et reçus à l’élève sélectionné", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    const content = await openTab(page, "balances");

    await content.locator("#financeFinancialStudent").selectOption("demo-s1");
    const situation = content.locator("[data-student-financial-situation]");
    await expect(situation).toContainText("Lucas Martin");
    await expect(situation.locator('[data-student-fee-id="demo-sf-lucas-school"]')).toContainText("Paiement partiel");
    await expect(situation.locator('[data-student-fee-id="demo-sf-lucas-transport"]')).toContainText("À payer");
    await expect(situation.getByRole("heading", { name: "Transactions liées" })).toBeVisible();
    await expect(situation).toContainText("REC-2026-0586");
    await expect(situation.getByRole("heading", { name: "Reçus disponibles" })).toBeVisible();
  });

  test("affiche une incohérence comme anomalie à examiner", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    const content = await openTab(page, "balances");
    await content.locator("#financeFinancialStudent").selectOption("demo-student-no-fee");
    const situation = content.locator("[data-student-financial-situation]");
    await expect(situation).toContainText("Noah Ilunga");
    await expect(situation).toContainText("Anomalie à examiner");
    await expect(situation).toContainText("Type de frais indisponible");
  });

  test("prépare une exemption totale persistante sans modifier le student_fee", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    const before = await page.evaluate(() => {
      const state = (window as any).SchoolSafeFinanceModule._state;
      const fee = state.studentFees.find((item: any) => item.id === "demo-sf-lucas-transport");
      return { fee: { ...fee }, transactions: state.transactions.length };
    });
    const content = await openTab(page, "exemptions");
    const form = content.locator("#financeExemptionForm");
    await form.locator('[name="exemption_type"]').selectOption("total");
    await form.locator('[name="reason"]').fill("Bourse sociale validée pour préparation locale.");
    await form.locator('button[type="submit"]').click();

    const draft = content.locator("[data-finance-exemption-draft]").first();
    await expect(draft).toContainText("Exemption totale");
    await expect(draft).toContainText("Bourse sociale");
    await expect(draft).toContainText("BROUILLON LOCAL");
    await expect(draft).toContainText("BACKEND_LATER");

    const after = await page.evaluate(() => {
      const state = (window as any).SchoolSafeFinanceModule._state;
      const fee = state.studentFees.find((item: any) => item.id === "demo-sf-lucas-transport");
      return { fee: { ...fee }, transactions: state.transactions.length };
    });
    expect(after).toEqual(before);

    await page.evaluate(() => (window as any).SchoolSafeFinanceModule.render("financeModule", { tab: "exemptions" }));
    await expect(page.locator("[data-finance-exemption-draft]").first()).toContainText("Bourse sociale");
  });

  test("prépare une exemption partielle bornée au restant", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    const content = await openTab(page, "exemptions");
    await content.locator("#financeExemptionType").selectOption("partial");
    const form = content.locator("#financeExemptionForm");
    await form.locator('[name="amount"]').fill("25000");
    await form.locator('[name="reason"]').fill("Prise en charge partielle préparée.");
    await form.locator('button[type="submit"]').click();

    const draft = content.locator("[data-finance-exemption-draft]").first();
    await expect(draft).toContainText("Exemption partielle");
    await expect(draft).toContainText("25 000 USD");
    await expect(draft).toContainText("Aucune exemption appliquée");
  });

  test("refuse la préparation quand finance.fee.manage est explicitement niée", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    await page.evaluate(() => {
      const finance = (window as any).SchoolSafeFinanceModule;
      finance.setSession({
        permissions: ["finance.fee.read", "finance.fee.manage"],
        deniedPermissions: ["finance.fee.manage"],
        scopes: [
          { permission: "finance.fee.read", type: "school" },
          { permission: "finance.fee.manage", type: "school" },
        ],
      });
      finance.render("financeModule", { tab: "exemptions" });
    });
    await expect(page.locator('#financeTabs [data-finance-tab="exemptions"]')).toBeHidden();
    await expect(page.locator("#financeContent")).not.toContainText("Préparer une demande");
  });
});
