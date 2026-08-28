import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

async function openFinanceTab(page: any, tab: string) {
  await openAction(page, "Tableau financier");
  await page.locator(`[data-finance-tab="${tab}"]`).click();
  return page.locator("#financeContent");
}

test.describe("F2-FE — types, affectations et obligations", () => {
  test("prépare un type de frais générique local sans écriture serveur", async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET" && request.url().includes("/finance/")) writes.push(`${request.method()} ${request.url()}`);
    });
    await enterDemoWorkspace(page, "finance");
    const content = await openFinanceTab(page, "fees");
    const form = content.locator("#financeFeeForm");

    await form.locator('[name="label"]').fill("Activité culturelle");
    await form.locator('[name="cycle_key"]').selectOption("primary");
    await form.locator('[name="amount"]').fill("25000");
    await form.locator('[name="currency"]').selectOption("CDF");
    await form.locator('[name="frequency"]').fill("Une fois par activité");
    await form.locator('[name="due_date"]').fill("2026-10-15");
    await form.locator('button[type="submit"]').click();

    const row = content.locator("tr", { hasText: "Activité culturelle" });
    await expect(row).toContainText("25 000 CDF");
    await expect(row).toContainText("Une fois par activité");
    await expect(row).toContainText("BROUILLON LOCAL");
    await expect(content).toContainText("BACKEND_LATER");
    expect(writes).toEqual([]);

    await page.evaluate(() => (window as any).SchoolSafeFinanceModule.render("financeModule", { tab: "fees" }));
    await expect(page.locator("#financeContent tr", { hasText: "Activité culturelle" })).toContainText("BROUILLON LOCAL");
  });

  test("prépare une affectation de classe sans créer d’obligation officielle", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    const content = await openFinanceTab(page, "assignments");
    const before = await page.evaluate(() => (window as any).SchoolSafeFinanceModule._state.studentFees.length);
    const form = content.locator("#financeFeeAssignmentForm");

    await expect(content).toContainText("TYPE DE FRAIS");
    await expect(content).toContainText("AFFECTATION");
    await expect(content).toContainText("OBLIGATION ÉLÈVE");
    await form.locator('[name="targeting_mode"]').selectOption("class");
    await form.locator('[name="target_ids"]').selectOption("6e A");
    await form.locator('button[type="submit"]').click();

    const prepared = content.locator("[data-finance-assignment-draft]").first();
    await expect(prepared).toContainText("6e A");
    await expect(prepared).toContainText("BROUILLON LOCAL");
    await expect(prepared).toContainText("BACKEND_LATER");
    await expect(prepared).toContainText("student_fee non créé");
    const after = await page.evaluate(() => (window as any).SchoolSafeFinanceModule._state.studentFees.length);
    expect(after).toBe(before);
  });

  test("cible uniquement des élèves actifs et conserve le brouillon après rerender", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    const content = await openFinanceTab(page, "assignments");
    const form = content.locator("#financeFeeAssignmentForm");
    await form.locator('[name="targeting_mode"]').selectOption("students");

    const options = form.locator('[name="target_ids"] option');
    await expect(options).toContainText(["Lucas Martin", "Emma Martin", "Ethan Leroy", "Chloé Bernard", "Aline Martin", "Noah Ilunga"]);
    await expect(form).not.toContainText("Amina Mbuyi");
    await form.locator('[name="target_ids"]').selectOption(["demo-s1", "demo-s2"]);
    await form.locator('button[type="submit"]').click();
    await expect(content.locator("[data-finance-assignment-draft]").first()).toContainText("2 élève(s) actif(s)");

    await page.evaluate(() => (window as any).SchoolSafeFinanceModule.render("financeModule", { tab: "assignments" }));
    await expect(page.locator("[data-finance-assignment-draft]").first()).toContainText("2 élève(s) actif(s)");
  });

  test("présente les cinq statuts d’obligation sans les confondre avec un paiement", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    const content = await openFinanceTab(page, "assignments");
    for (const status of ["paid", "partial", "pending", "exempted", "anomaly"]) {
      await expect(content.locator(`[data-obligation-status="${status}"]`)).toBeVisible();
    }
    await expect(content).toContainText("Aucune obligation officielle n’est créée");
  });
});
