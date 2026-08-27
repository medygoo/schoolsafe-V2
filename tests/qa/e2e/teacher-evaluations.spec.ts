import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

test.describe("Phase D3 — évaluations et notes", () => {
  test("prépare une évaluation et sauvegarde localement les notes des élèves actifs", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await page.locator('[data-teacher-open="evaluations"]').click();

    const form = page.locator("#teacherEvaluationForm");
    await expect(form).toBeVisible();
    await form.locator('[name="title"]').fill("Interrogation — fractions");
    await form.locator('[name="classId"]').selectOption("demo-class-1");
    await form.locator('[name="subjectId"]').selectOption("demo-subject-math");
    await form.locator('[name="type"]').selectOption("interrogation");
    await form.locator('[name="date"]').fill("2026-09-12");
    await form.locator('[name="scale"]').fill("20");
    await form.locator('[name="coefficient"]').fill("1");
    await form.locator('[name="instructions"]').fill("Évaluer la comparaison et la simplification des fractions.");
    await form.locator('button[type="submit"]').click();

    const evaluation = page.locator('[data-evaluation-list] article').filter({ hasText: "Interrogation — fractions" });
    await expect(evaluation).toContainText("BROUILLON LOCAL");
    await expect(evaluation).toContainText("BACKEND_LATER");

    const gradebook = page.locator("#teacherGradebookForm");
    await expect(gradebook).toContainText("Lucas Martin");
    await expect(gradebook).toContainText("Chloé Bernard");
    await expect(gradebook).not.toContainText("Amina Mbuyi");
    await expect(gradebook).not.toContainText("Ethan Leroy");

    await gradebook.locator('[data-grade-value="demo-student-lucas"]').fill("15");
    await gradebook.locator('[data-grade-observation="demo-student-lucas"]').fill("Méthode bien structurée");
    await gradebook.locator('[data-grade-absent="demo-student-chloe"]').check();
    await gradebook.locator('button[type="submit"]').click();

    await page.evaluate(() => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      api.render("teacherPedagogyPortal", (window as any).SchoolSafeAppContext.getCurrentUser());
      api.open("evaluations");
    });
    await expect(page.locator('[data-grade-value="demo-student-lucas"]')).toHaveValue("15");
    await expect(page.locator('[data-grade-observation="demo-student-lucas"]')).toHaveValue("Méthode bien structurée");
    await expect(page.locator('[data-grade-absent="demo-student-chloe"]')).toBeChecked();
  });

  test("le DENY explicite bloque préparation et modification des notes", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await page.evaluate(() => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      api.render("teacherPedagogyPortal", {
        permissions: ["school.class.read", "school.student.read", "pedagogy.subject.read", "pedagogy.grade.read", "pedagogy.grade.manage"],
        deniedPermissions: ["pedagogy.grade.manage"],
        assignedClassIds: ["demo-class-1"],
        assignedSubjectIds: ["demo-subject-math"],
        scopes: [
          { permission: "school.class.read", type: "assigned_classes" },
          { permission: "school.student.read", type: "assigned_classes" },
          { permission: "pedagogy.subject.read", type: "assigned_subjects" },
          { permission: "pedagogy.grade.read", type: "assigned_classes" },
          { permission: "pedagogy.grade.manage", type: "assigned_classes" },
        ],
      });
      api.open("evaluations");
    });

    await expect(page.locator("#teacherEvaluationForm")).toHaveCount(0);
    await expect(page.locator("#teacherGradebookForm")).toHaveCount(0);
    await expect(page.locator("#teacherPedagogyPortal")).toContainText("Modification des notes refusée");
  });

  test("refuse atomiquement une valeur hors barème sans effacer le brouillon", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await page.locator('[data-teacher-open="evaluations"]').click();
    const gradebook = page.locator("#teacherGradebookForm");
    const lucas = gradebook.locator('[data-grade-value="demo-student-lucas"]');
    await lucas.fill("8");
    await gradebook.locator('button[type="submit"]').click();

    await page.evaluate(() => {
      const input = document.querySelector('[data-grade-value="demo-student-lucas"]') as HTMLInputElement;
      input.value = "99";
      input.form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    const stored = await page.evaluate(() => (window as any).SchoolSafeTeacherPedagogy.readGradeDrafts()["demo-evaluation-calcul"]["demo-student-lucas"].value);
    expect(stored).toBe(8);
  });
});
