import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

test.describe("Phase D5 — objectifs mensuels et difficultés", () => {
  test("ajoute des suivis mensuels sans supprimer l’historique", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await page.locator('[data-teacher-open="difficulties"]').click();

    const form = page.locator("#teacherMonthlyTrackingForm");
    await expect(form).toBeVisible();
    await expect(form.locator('[name="studentId"] option')).toHaveText(["Suivi collectif", "Lucas Martin", "Chloé Bernard"]);
    await expect(form).not.toContainText("Amina Mbuyi");
    await expect(form).not.toContainText("Noah Kasongo");

    await form.locator('[name="month"]').fill("2026-09");
    await form.locator('[name="classId"]').selectOption("demo-class-1");
    await form.locator('[name="subjectId"]').selectOption("demo-subject-math");
    await form.locator('[name="objectives"]').fill("Maîtriser la comparaison de fractions.");
    await form.locator('[name="progress"]').fill("60");
    await form.locator('[name="skills"]').fill("Comparer, simplifier, justifier.");
    await form.locator('[name="collectiveDifficulty"]').fill("Passage au dénominateur commun.");
    await form.locator('[name="studentId"]').selectOption("demo-student-lucas");
    await form.locator('[name="individualDifficulty"]').fill("Justification des étapes.");
    await form.locator('[name="actions"]').fill("Exercices gradués et binôme de verbalisation.");
    await form.locator('[name="observation"]').fill("Suivi septembre — première observation.");
    await form.locator('[name="status"]').selectOption("EN COURS");
    await form.locator('button[type="submit"]').click();

    await expect(page.locator('[data-monthly-timeline]')).toContainText("Suivi septembre — première observation.");
    await expect(page.locator('[data-monthly-timeline]')).toContainText("Lucas Martin");
    await expect(page.locator('[data-monthly-timeline] [data-delete-tracking]')).toHaveCount(0);

    await page.evaluate(() => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      api.render("teacherPedagogyPortal", (window as any).SchoolSafeAppContext.getCurrentUser());
      api.open("difficulties");
    });
    await expect(page.locator('[data-monthly-timeline]')).toContainText("Suivi septembre — première observation.");

    await page.locator('#teacherMonthlyTrackingForm [name="classId"]').selectOption("demo-class-2");
    await expect(page.locator('#teacherMonthlyTrackingForm [name="studentId"] option')).toHaveText(["Suivi collectif", "Ethan Leroy"]);
  });

  test("un DENY empêche la préparation mais conserve la chronologie en lecture", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await page.evaluate(() => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      api.render("teacherPedagogyPortal", {
        permissions: ["school.class.read", "school.student.read", "pedagogy.subject.read", "pedagogy.lesson-plan.read", "pedagogy.lesson-plan.manage"],
        deniedPermissions: ["pedagogy.lesson-plan.manage"],
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
      api.open("difficulties");
    });

    await expect(page.locator("#teacherMonthlyTrackingForm")).toHaveCount(0);
    await expect(page.locator("#teacherPedagogyPortal")).toContainText("Préparation du suivi refusée");
    await expect(page.locator('[data-monthly-timeline]')).toBeVisible();
  });
});
