import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, expectBranches, expectNoBranch, openAction } from "./helpers";

test.describe("F4-FE — caisse, paiements constatés et reçus", () => {
  test("conserve le profil Caisse dans sa seule branche métier", async ({ page }) => {
    await enterDemoWorkspace(page, "cashier");
    await expectBranches(page, "cashier");
    await expectNoBranch(page, "pedagogy");
    await expectNoBranch(page, "security");
    await expectNoBranch(page, "pilotage");
  });

  test("prépare puis confirme localement un paiement sur un student_fee exact", async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET" && request.url().includes("/finance/")) writes.push(`${request.method()} ${request.url()}`);
    });
    await enterDemoWorkspace(page, "cashier");
    await openAction(page, "Enregistrer un paiement");

    const before = await page.evaluate(() => {
      const fee = (window as any).SchoolSafeFinanceModule._state.studentFees.find((item: any) => item.id === "demo-sf-lucas-school");
      return { ...fee };
    });
    const form = page.locator("#paymentForm");
    await expect(form).toBeVisible();
    await expect(page.locator("#financeCashStudent")).not.toContainText("Amina Mbuyi");
    await page.locator("#financeCashStudent").selectOption("demo-s1");
    await page.locator("#financeCashStudentFee").selectOption("demo-sf-lucas-school");
    await form.locator('[name="amount"]').fill("50000");
    await form.locator('[name="mode"]').selectOption("cash");
    await form.locator('[name="reference"]').fill("Troisième tranche constatée");
    await form.locator('button[type="submit"]').click();

    const prepared = page.locator("[data-payment-confirmation]");
    await expect(prepared).toContainText("demo-sf-lucas-school");
    await expect(prepared).toContainText("50 000 CDF");
    await expect(prepared).toContainText("PAIEMENT CONSTATÉ");
    const afterPrepare = await page.evaluate(() => {
      const fee = (window as any).SchoolSafeFinanceModule._state.studentFees.find((item: any) => item.id === "demo-sf-lucas-school");
      return { ...fee };
    });
    expect(afterPrepare).toEqual(before);

    await prepared.locator("[data-confirm-demo-payment]").click();
    const afterConfirm = await page.evaluate(() => {
      const fee = (window as any).SchoolSafeFinanceModule._state.studentFees.find((item: any) => item.id === "demo-sf-lucas-school");
      return { ...fee };
    });
    expect(afterConfirm.amount_paid).toBe(before.amount_paid + 50000);
    expect(afterConfirm.amount_remaining).toBe(before.amount_remaining - 50000);
    await expect(page.locator("[data-receipt-preview]")).toContainText("APERÇU DE REÇU");
    await expect(page.locator("[data-receipt-preview]")).toContainText("DÉMONSTRATION · NON OFFICIEL");
    await expect(page.locator("[data-receipt-preview]")).toContainText("demo-sf-lucas-school");
    expect(writes).toEqual([]);
  });

  test("ne propose ni paiement en ligne ni moteur PDF Phase F", async ({ page }) => {
    await enterDemoWorkspace(page, "cashier");
    await openAction(page, "Enregistrer un paiement");
    const module = page.locator("#financeModule");
    await expect(module.getByText(/PAYER EN LIGNE/i)).toHaveCount(0);
    await expect(module.getByRole("button", { name: /PDF|télécharger|imprimer/i })).toHaveCount(0);
    await expect(module).toContainText("Paiement constaté");
  });

  test("masque le paramétrage et toute annulation sans permission dédiée", async ({ page }) => {
    await enterDemoWorkspace(page, "cashier");
    await openAction(page, "Produire un reçu PDF");
    await expect(page.locator('#financeTabs [data-finance-tab="fees"]')).toBeHidden();
    await expect(page.locator("[data-cancel-payment-id]")).toHaveCount(0);
    await expect(page.locator("#financeContent")).toContainText("Aperçus de reçus");
  });

  test("autorise uniquement la préparation d’annulation avec finance.payment.cancel", async ({ page }) => {
    await enterDemoWorkspace(page, "cashier");
    await page.evaluate(() => {
      const finance = (window as any).SchoolSafeFinanceModule;
      finance.setSession({
        permissions: ["finance.receipt.read", "finance.payment.cancel"],
        scopes: [
          { permission: "finance.receipt.read", type: "school" },
          { permission: "finance.payment.cancel", type: "school" },
        ],
      });
      finance.render("financeModule", { tab: "receipts" });
    });
    const cancel = page.locator("[data-cancel-payment-id]").first();
    await expect(cancel).toBeVisible();
    await cancel.click();
    const form = page.locator("#cancelPaymentForm");
    await form.locator('[name="reason"]').fill("Erreur de référence constatée.");
    await form.locator('button[type="submit"]').click();
    await expect(page.locator("[data-cancellation-draft]").first()).toContainText("ANNULATION PRÉPARÉE");
    await expect(page.locator("[data-cancellation-draft]").first()).toContainText("BACKEND_LATER");
  });
});
