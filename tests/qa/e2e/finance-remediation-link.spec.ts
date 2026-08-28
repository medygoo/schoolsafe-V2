import { test, expect, Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function prepareTeacherRemediation(page: Page) {
  await enterDemoWorkspace(page, "teacher");
  await page.locator('[data-teacher-open="remediation"]').click();
  const form = page.locator("#teacherRemediationForm");
  await form.locator('[name="classId"]').selectOption("demo-class-1");
  await form.locator('[name="subjectId"]').selectOption("demo-subject-math");
  await form.locator('[name="studentId"]').selectOption("demo-student-lucas");
  await form.locator('[name="difficulty"]').fill("Fractions à consolider.");
  await form.locator('[name="objective"]').fill("Comparer les fractions.");
  await form.locator('[name="plannedSessions"]').fill("3");
  await form.locator('[name="calendar"]').fill("2026-09-15, 2026-09-18");
  await form.locator('[name="status"]').selectOption("PLANIFIÉ");
  await form.locator('button[type="submit"]').click();
}

async function renderRemediationFinance(page: Page, permissions = ["finance.fee.manage"], deniedPermissions: string[] = []) {
  await page.evaluate(({ granted, denied }) => {
    const finance = (window as any).SchoolSafeFinanceModule;
    finance.setRole("finance");
    finance.setSession({
      permissions: granted,
      deniedPermissions: denied,
      scopes: granted.map((permission: string) => ({ permission, type: "school" })),
    });
    (document.getElementById("teacherPedagogyPortal") as HTMLElement).hidden = true;
    (document.getElementById("financeModule") as HTMLElement).hidden = false;
    finance.render("financeModule", { tab: "remediation-finance" });
  }, { granted: permissions, denied: deniedPermissions });
}

test.describe("F7-FE — liaison financière du rattrapage D6", () => {
  test("lit la projection D6 sans modifier la pédagogie", async ({ page }) => {
    await prepareTeacherRemediation(page);
    const before = await page.evaluate(() => localStorage.getItem("schoolsafe-v2-teacher-remediation-drafts"));
    await renderRemediationFinance(page);
    const view = page.locator("[data-remediation-finance]");
    await expect(view).toContainText("Lucas Martin");
    await expect(view).toContainText("6e A");
    await expect(view).toContainText("Mathématiques");
    await expect(view).toContainText("PLANIFIÉ");
    const after = await page.evaluate(() => localStorage.getItem("schoolsafe-v2-teacher-remediation-drafts"));
    expect(after).toBe(before);
  });

  test("exclut toujours l’élève draft de la projection financière", async ({ page }) => {
    await prepareTeacherRemediation(page);
    await page.evaluate(() => {
      const key = "schoolsafe-v2-teacher-remediation-drafts";
      const rows = JSON.parse(localStorage.getItem(key) || "[]");
      rows.push({ id: "draft-remediation", studentId: "demo-student-amina", classId: "demo-class-1", subjectId: "demo-subject-math", status: "PLANIFIÉ", local: true });
      localStorage.setItem(key, JSON.stringify(rows));
    });
    await renderRemediationFinance(page);
    await expect(page.locator("[data-remediation-finance]")).not.toContainText("Amina Mbuyi");
    await expect(page.locator('#financeRemediationDraft option')).not.toContainText("Amina Mbuyi");
  });

  test("exige une répartition exactement égale à 100 sans valeur imposée", async ({ page }) => {
    await prepareTeacherRemediation(page);
    await renderRemediationFinance(page);
    const view = page.locator("[data-remediation-finance]");
    await expect(view).not.toContainText("40 %");
    await expect(view).not.toContainText("60 %");
    const form = page.locator("#financeRemediationLinkForm");
    await form.locator('[name="school_share"]').fill("55");
    await form.locator('[name="other_share"]').fill("35");
    await form.locator('[name="other_destination"]').fill("Soutien enseignant déclaré");
    await form.locator('button[type="submit"]').click();
    await expect(page.locator("[data-remediation-finance-error]")).toContainText("100 %");
    await expect(page.locator("[data-remediation-finance-draft]")).toHaveCount(0);
  });

  test("prépare une affectation financière locale distincte et persistante", async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET" && request.url().includes("/finance/")) writes.push(`${request.method()} ${request.url()}`);
    });
    await prepareTeacherRemediation(page);
    const pedagogyBefore = await page.evaluate(() => localStorage.getItem("schoolsafe-v2-teacher-remediation-drafts"));
    await renderRemediationFinance(page);
    const before = await page.evaluate(() => {
      const state = (window as any).SchoolSafeFinanceModule._state;
      return { feeTypes: state.feeTypes.length, studentFees: state.studentFees.length };
    });
    const form = page.locator("#financeRemediationLinkForm");
    await form.locator('[name="fee_structure_id"]').selectOption("demo-6");
    await form.locator('[name="school_share"]').fill("65");
    await form.locator('[name="other_share"]').fill("35");
    await form.locator('[name="other_destination"]').fill("Soutien enseignant déclaré");
    await form.locator('button[type="submit"]').click();
    const draft = page.locator("[data-remediation-finance-draft]").first();
    await expect(draft).toContainText("FRONTEND CONFIG");
    await expect(draft).toContainText("BACKEND_LATER");
    await expect(draft).toContainText("Part école · 65 %");
    await expect(draft).toContainText("Soutien enseignant déclaré · 35 %");
    await expect(draft).toContainText("Total · 100 %");
    await expect(draft).toContainText("student_fee non créé");
    const after = await page.evaluate(() => {
      const state = (window as any).SchoolSafeFinanceModule._state;
      return { feeTypes: state.feeTypes.length, studentFees: state.studentFees.length };
    });
    expect(after).toEqual(before);
    expect(await page.evaluate(() => localStorage.getItem("schoolsafe-v2-teacher-remediation-drafts"))).toBe(pedagogyBefore);
    await page.evaluate(() => (window as any).SchoolSafeFinanceModule.render("financeModule", { tab: "remediation-finance" }));
    await expect(page.locator("[data-remediation-finance-draft]").first()).toContainText("Soutien enseignant déclaré");
    expect(writes).toEqual([]);
  });

  test("reste gardé par finance.fee.manage avec DENY prioritaire", async ({ page }) => {
    await prepareTeacherRemediation(page);
    await renderRemediationFinance(page, ["finance.fee.read"]);
    await expect(page.locator('#financeTabs [data-finance-tab="remediation-finance"]')).toBeHidden();
    await expect(page.locator("[data-remediation-finance]")).toHaveCount(0);
    await renderRemediationFinance(page, ["finance.fee.manage"], ["finance.fee.manage"]);
    await expect(page.locator('#financeTabs [data-finance-tab="remediation-finance"]')).toBeHidden();
    await expect(page.locator("#financeContent")).toContainText("non autorisé");
  });
});
