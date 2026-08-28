import { test, expect, Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function renderFinance(page: Page, permissions: string[], deniedPermissions: string[] = []) {
  await page.evaluate(({ granted, denied }) => {
    const finance = (window as any).SchoolSafeFinanceModule;
    finance.setRole("canteen");
    finance.setSession({
      permissions: granted,
      deniedPermissions: denied,
      scopes: granted.map((permission: string) => ({ permission, type: "school" })),
    });
    finance.render("financeModule", { tab: "canteen" });
  }, { granted: permissions, denied: deniedPermissions });
}

test.describe("F6-FE — intégration financière de la cantine", () => {
  test("ouvre la liaison financière depuis le seul espace Cantine", async ({ page }) => {
    await enterDemoWorkspace(page, "canteen");
    const branch = page.locator('[data-branch="care"]:visible').first();
    await expect(branch).toBeVisible();
    await branch.evaluate((element: HTMLElement) => element.click());
    await expect(page.locator("#financeModule")).toBeVisible();
    await expect(page.locator('#financeTabs [data-finance-tab="canteen"]')).toBeVisible();
    await expect(page.locator('#financeTabs [data-finance-tab="fees"]')).toBeHidden();
    await expect(page.locator('#financeTabs [data-finance-tab="cash"]')).toBeHidden();
  });

  test("réutilise la chaîne type de frais vers affectation puis student_fee", async ({ page }) => {
    await enterDemoWorkspace(page, "canteen");
    await renderFinance(page, ["canteen.manage"]);
    const view = page.locator("[data-finance-canteen]");
    await expect(view).toContainText("TYPE DE FRAIS");
    await expect(view).toContainText("AFFECTATION");
    await expect(view).toContainText("STUDENT_FEE");
    await expect(view).toContainText("Frais de cantine");
    await expect(page.locator("#financeCanteenLinkForm")).toBeVisible();
  });

  test("prépare une liaison locale persistante sans créer d’obligation", async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET" && request.url().includes("/finance/")) writes.push(`${request.method()} ${request.url()}`);
    });
    await enterDemoWorkspace(page, "canteen");
    await renderFinance(page, ["canteen.manage"]);
    const before = await page.evaluate(() => {
      const state = (window as any).SchoolSafeFinanceModule._state;
      return { studentFees: state.studentFees.length, feeTypes: state.feeTypes.length };
    });
    const form = page.locator("#financeCanteenLinkForm");
    await form.locator('[name="service_label"]').fill("Service cantine primaire");
    await form.locator('[name="fee_structure_id"]').selectOption("demo-5");
    await form.locator('[name="targeting_mode"]').selectOption("active_students");
    await form.locator('button[type="submit"]').click();
    const draft = page.locator("[data-finance-canteen-draft]").first();
    await expect(draft).toContainText("BROUILLON LOCAL");
    await expect(draft).toContainText("BACKEND_LATER");
    await expect(draft).toContainText("student_fee non créé");
    const after = await page.evaluate(() => {
      const state = (window as any).SchoolSafeFinanceModule._state;
      return { studentFees: state.studentFees.length, feeTypes: state.feeTypes.length };
    });
    expect(after).toEqual(before);
    await page.evaluate(() => (window as any).SchoolSafeFinanceModule.render("financeModule", { tab: "canteen" }));
    await expect(page.locator("[data-finance-canteen-draft]").first()).toContainText("Service cantine primaire");
    expect(writes).toEqual([]);
  });

  test("ne déduit jamais canteen.manage d’un droit Finance", async ({ page }) => {
    await enterDemoWorkspace(page, "canteen");
    await renderFinance(page, ["finance.fee.manage", "finance.payment.record"]);
    await expect(page.locator('#financeTabs [data-finance-tab="canteen"]')).toBeHidden();
    await expect(page.locator("[data-finance-canteen]")).toHaveCount(0);
    await renderFinance(page, ["canteen.manage"], ["canteen.manage"]);
    await expect(page.locator('#financeTabs [data-finance-tab="canteen"]')).toBeHidden();
    await expect(page.locator("#financeContent")).toContainText("non autorisé");
  });

  test("laisse repas, menus, stocks et présences hors Phase F", async ({ page }) => {
    await enterDemoWorkspace(page, "canteen");
    await renderFinance(page, ["canteen.manage"]);
    const view = page.locator("[data-finance-canteen]");
    await expect(view).toContainText("FEATURE_LATER");
    await expect(view.getByRole("button", { name: /repas|menu|stock|présence/i })).toHaveCount(0);
    await expect(view.locator('[name*="meal"], [name*="menu"], [name*="stock"], [name*="attendance"]')).toHaveCount(0);
    await expect(view).not.toContainText("Amina Mbuyi");
  });
});
