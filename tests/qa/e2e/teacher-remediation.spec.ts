import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

test.describe("Phase D6 — rattrapage pédagogique", () => {
  test("prépare et conserve une proposition issue d'une difficulté D5, sans inscription officielle", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await page.locator('[data-teacher-open="remediation"]').click();

    const form = page.locator("#teacherRemediationForm");
    await expect(form).toBeVisible();
    await expect(form).toContainText("DÉTECTION / PROPOSITION");
    await expect(form).toContainText("VALIDATION PÉDAGOGIQUE");
    await expect(form).toContainText("BACKEND_LATER");
    await expect(form.locator('[name="sourceId"] option')).toHaveText([
      "Août 2026 · 6e A · Mathématiques · difficulté collective",
    ]);
    await expect(form.locator('[name="studentId"] option')).toHaveText(["Lucas Martin", "Chloé Bernard"]);
    await expect(form).not.toContainText("Amina Mbuyi");
    await expect(form).not.toContainText("Noah Kasongo");
    await expect(form.locator('[name="classId"], [name="subjectId"], [name="status"], [name="plannedSessions"], [name="calendar"], [name="progress"], [name="result"]')).toHaveCount(0);
    await expect(form.locator('[data-remediation-source-summary]')).toContainText("Alignement des décimales");
    await expect(form.locator('[data-remediation-source-summary]')).toContainText("Atelier de correction guidée");

    await form.locator('[name="studentId"]').selectOption("demo-student-lucas");
    await form.locator('[name="objective"]').fill("Proposer des exercices gradués sur l'alignement des décimales.");
    await form.locator('[name="observations"]').fill("Proposition à examiner par la direction pédagogique.");
    await form.locator('button[type="submit"]').click();

    const prepared = page.locator('[data-remediation-list] article').filter({ hasText: "Proposer des exercices gradués" });
    await expect(prepared).toContainText("Lucas Martin");
    await expect(prepared).toContainText("Alignement des décimales");
    await expect(prepared).toContainText("Atelier de correction guidée");
    await expect(prepared).toContainText("PROPOSITION À VALIDER");
    await expect(prepared).toContainText("BROUILLON LOCAL");
    await expect(prepared).toContainText("AUCUNE INSCRIPTION OFFICIELLE");
    await expect(page.locator("#teacherPedagogyPortal")).toContainText("BACKEND_LATER");
    await expect(page.locator("#teacherPedagogyPortal")).toContainText("PÉDAGOGIE UNIQUEMENT");

    await page.evaluate(() => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      api.render("teacherPedagogyPortal", (window as any).SchoolSafeAppContext.getCurrentUser());
      api.open("remediation");
    });
    await expect(page.locator('[data-remediation-list]')).toContainText("Proposition à examiner par la direction pédagogique");
    const drafts = await page.evaluate(() => (window as any).SchoolSafeTeacherPedagogy.readRemediationProposals());
    expect(drafts[0]).toMatchObject({
      proposal: true,
      officialEnrollment: false,
      sourceId: "demo-tracking-august",
      validationStatus: "BACKEND_LATER",
      plannedSessions: 0,
      progress: 0,
      result: "NON ÉVALUÉ",
    });
  });

  test("reste strictement pédagogique et réserve plan, calendrier et résultat à la validation future", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await page.locator('[data-teacher-open="remediation"]').click();

    const form = page.locator("#teacherRemediationForm");
    await expect(form).toContainText("Le plan, les séances, le calendrier, la progression et le résultat seront ouverts après validation pédagogique");
    await expect(form).toContainText("aucune inscription officielle locale");

    const portal = page.locator("#teacherPedagogyPortal");
    await expect(portal).not.toContainText("40 %");
    await expect(portal).not.toContainText("60 %");
    await expect(portal).not.toContainText("CDF");
    await expect(form.locator('[name="amount"], [name="payment"], [name="fee"]')).toHaveCount(0);
    await expect(portal).toContainText("Aucune inscription financière");
  });

  test("utilise lesson-plan.manage avec assigned_classes et donne priorité au DENY", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    const renderWith = async ({ manage = true, permissionExceptions = [] }: { manage?: boolean; permissionExceptions?: any[] }) => page.evaluate(({ hasManage, exceptions }) => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      api.render("teacherPedagogyPortal", {
        permissions: ["school.class.read", "school.student.read", "pedagogy.subject.read", "pedagogy.lesson-plan.read"].concat(hasManage ? ["pedagogy.lesson-plan.manage"] : []),
        permissionExceptions: exceptions,
        assignedClassIds: ["demo-class-1"],
        assignedSubjectIds: ["demo-subject-math"],
        scopes: [
          { permission: "school.class.read", type: "assigned_classes" },
          { permission: "school.student.read", type: "assigned_classes" },
          { permission: "pedagogy.subject.read", type: "assigned_subjects" },
          { permission: "pedagogy.lesson-plan.read", type: "assigned_classes" },
        ].concat(hasManage ? [{ permission: "pedagogy.lesson-plan.manage", type: "assigned_classes" }] : []),
      });
      api.open("remediation");
    }, { hasManage: manage, exceptions: permissionExceptions });

    await renderWith({ manage: true });
    await expect(page.locator("#teacherRemediationForm")).toBeVisible();

    await renderWith({ manage: false, permissionExceptions: [
      { permission: "pedagogy.lesson-plan.manage", effect: "allow", scope: { type: "assigned_classes" } },
    ] });
    await expect(page.locator("#teacherRemediationForm")).toBeVisible();

    await renderWith({ manage: true, permissionExceptions: [
      { permission: "pedagogy.lesson-plan.manage", effect: "deny", scope: "assigned_classes" },
    ] });
    await expect(page.locator("#teacherRemediationForm")).toHaveCount(0);
    await expect(page.locator("#teacherPedagogyPortal")).toContainText("Accès pédagogique refusé");
  });
});
