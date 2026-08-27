import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

test.describe("Phase D6 — rattrapage pédagogique", () => {
  test("prépare et conserve un parcours de rattrapage pour un élève affecté", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await page.locator('[data-teacher-open="remediation"]').click();

    const form = page.locator("#teacherRemediationForm");
    await expect(form).toBeVisible();
    await expect(form.locator('[name="studentId"] option')).toHaveText(["Lucas Martin", "Chloé Bernard"]);
    await expect(form).not.toContainText("Amina Mbuyi");
    await expect(form).not.toContainText("Noah Kasongo");

    await form.locator('[name="classId"]').selectOption("demo-class-1");
    await form.locator('[name="subjectId"]').selectOption("demo-subject-math");
    await form.locator('[name="studentId"]').selectOption("demo-student-lucas");
    await form.locator('[name="difficulty"]').fill("Comparer des fractions de dénominateurs différents.");
    await form.locator('[name="objective"]').fill("Choisir une stratégie de comparaison adaptée.");
    await form.locator('[name="plannedSessions"]').fill("3");
    await form.locator('[name="calendar"]').fill("2026-09-15, 2026-09-18, 2026-09-22");
    await form.locator('[name="progress"]').fill("25");
    await form.locator('[name="observations"]').fill("Plan individualisé préparé avec exercices gradués.");
    await form.locator('[name="result"]').fill("À observer après la première séance.");
    await form.locator('[name="status"]').selectOption("PLANIFIÉ");
    await form.locator('button[type="submit"]').click();

    const prepared = page.locator('[data-remediation-list] article').filter({ hasText: "Comparer des fractions" });
    await expect(prepared).toContainText("Lucas Martin");
    await expect(prepared).toContainText("PLANIFIÉ");
    await expect(prepared).toContainText("BROUILLON LOCAL");

    await page.evaluate(() => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      api.render("teacherPedagogyPortal", (window as any).SchoolSafeAppContext.getCurrentUser());
      api.open("remediation");
    });
    await expect(page.locator('[data-remediation-list]')).toContainText("Plan individualisé préparé");
  });

  test("reste sans finance et limite dynamiquement élèves et matières à la classe", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await page.locator('[data-teacher-open="remediation"]').click();

    const form = page.locator("#teacherRemediationForm");
    await form.locator('[name="classId"]').selectOption("demo-class-2");
    await expect(form.locator('[name="studentId"] option')).toHaveText(["Ethan Leroy"]);
    await expect(form.locator('[name="subjectId"] option')).toHaveText(["Français"]);
    await expect(form.locator('[name="status"] option')).toHaveText(["À ÉVALUER", "PROPOSÉ", "PLANIFIÉ", "EN COURS", "TERMINÉ", "ANNULÉ"]);

    const portal = page.locator("#teacherPedagogyPortal");
    await expect(portal).not.toContainText("40 %");
    await expect(portal).not.toContainText("60 %");
    await expect(portal).not.toContainText("CDF");
    await expect(form.locator('[name="amount"], [name="payment"], [name="fee"]')).toHaveCount(0);
    await expect(portal).toContainText("Aucune inscription financière");
  });

  test("exige les permissions dédiées et applique ALLOW puis DENY individuel", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    const renderWith = async (permissionExceptions: any[]) => page.evaluate((exceptions) => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      api.render("teacherPedagogyPortal", {
        permissions: ["school.class.read", "school.student.read", "pedagogy.subject.read", "pedagogy.lesson-plan.read", "pedagogy.lesson-plan.manage"],
        permissionExceptions: exceptions,
        assignedClassIds: ["demo-class-1"],
        assignedSubjectIds: ["demo-subject-math"],
        scopes: [
          { permission: "school.class.read", type: "assigned_classes" },
          { permission: "school.student.read", type: "assigned_classes" },
          { permission: "pedagogy.subject.read", type: "assigned_subjects" },
          { permission: "pedagogy.lesson-plan.read", type: "assigned_classes" },
          { permission: "pedagogy.lesson-plan.manage", type: "assigned_classes" },
        ],
      });
      api.open("remediation");
    }, permissionExceptions);

    await renderWith([]);
    await expect(page.locator("#teacherRemediationForm")).toHaveCount(0);

    await renderWith([
      { permission: "pedagogy.remediation.manage", effect: "allow", scope: { type: "assigned_classes" } },
    ]);
    await expect(page.locator("#teacherRemediationForm")).toBeVisible();

    await renderWith([
      { permission: "pedagogy.remediation.manage", effect: "allow", scope: "assigned_classes" },
      { permission: "pedagogy.remediation.manage", effect: "deny", scope: "assigned_classes" },
    ]);
    await expect(page.locator("#teacherRemediationForm")).toHaveCount(0);
    await expect(page.locator("#teacherPedagogyPortal")).toContainText("Accès pédagogique refusé");
  });
});
