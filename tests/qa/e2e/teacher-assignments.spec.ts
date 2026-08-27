import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

test.describe("Phase D2 — devoirs et travaux", () => {
  test("prépare et conserve un devoir local dans le périmètre affecté", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await page.locator('[data-teacher-open="assignments"]').click();

    const form = page.locator("#teacherAssignmentForm");
    await expect(form).toBeVisible();
    await expect(form.locator('[name="classId"] option')).toHaveText(["1re A", "2e B"]);
    await expect(form.locator('[name="subjectId"] option')).toHaveText(["Mathématiques", "Français"]);
    await expect(form).not.toContainText("3e C");
    await expect(form).not.toContainText("Sciences physiques");

    await form.locator('[name="title"]').fill("Fractions — consolidation");
    await form.locator('[name="classId"]').selectOption("demo-class-1");
    await form.locator('[name="subjectId"]').selectOption("demo-subject-math");
    await form.locator('[name="instructions"]').fill("Résoudre les exercices 1 à 4 et détailler les étapes.");
    await form.locator('[name="publishOn"]').fill("2026-09-03");
    await form.locator('[name="dueOn"]').fill("2026-09-10");
    await form.locator('[name="workType"]').selectOption("Devoir");
    await form.locator('[name="status"]').selectOption("À PUBLIER");
    await form.locator('button[type="submit"]').click();

    const prepared = page.locator('[data-assignment-list] article').filter({ hasText: "Fractions — consolidation" });
    await expect(prepared).toContainText("À PUBLIER");
    await expect(prepared).toContainText("BROUILLON LOCAL");
    await expect(prepared).toContainText("BACKEND_LATER");

    await page.evaluate(() => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      const user = (window as any).SchoolSafeAppContext.getCurrentUser();
      api.render("teacherPedagogyPortal", user);
      api.open("assignments");
    });
    await expect(page.locator('[data-assignment-list]')).toContainText("Fractions — consolidation");
  });

  test("n’invente aucune remise serveur et applique le DENY sur la préparation", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await page.locator('[data-teacher-open="assignments"]').click();
    await expect(page.locator('[data-submissions-state]')).toContainText("BACKEND_LATER");
    await expect(page.locator('[data-submissions-state]')).toContainText("Aucune remise serveur inventée");

    await page.evaluate(() => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      api.render("teacherPedagogyPortal", {
        permissions: ["school.class.read", "school.student.read", "pedagogy.subject.read", "pedagogy.assignment.read", "pedagogy.assignment.manage"],
        deniedPermissions: ["pedagogy.assignment.manage"],
        assignedClassIds: ["demo-class-1"],
        assignedSubjectIds: ["demo-subject-math"],
        scopes: [
          { permission: "school.class.read", type: "assigned_classes" },
          { permission: "school.student.read", type: "assigned_classes" },
          { permission: "pedagogy.subject.read", type: "assigned_subjects" },
          { permission: "pedagogy.assignment.read", type: "assigned_classes" },
          { permission: "pedagogy.assignment.manage", type: "assigned_classes" },
        ],
      });
      api.open("assignments");
    });

    await expect(page.locator("#teacherAssignmentForm")).toHaveCount(0);
    await expect(page.locator("#teacherPedagogyPortal")).toContainText("Préparation non autorisée");
  });
});
