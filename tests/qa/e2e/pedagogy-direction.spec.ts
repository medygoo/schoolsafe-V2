import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("Phase D7 — Direction pédagogique", () => {
  test("pilote uniquement les classes et matières réellement projetées", async ({ page }) => {
    await enterDemoWorkspace(page, "pedagogy");
    await openAction(page, "Pilotage pédagogique");

    const workspace = page.locator('[data-direction-workspace]');
    await expect(workspace).toBeVisible();
    await expect(page.locator("#pedagogyModule")).toBeHidden();
    await expect(workspace).toContainText("6e A");
    await expect(workspace).toContainText("5e A");
    await expect(workspace).toContainText("Mathématiques");
    await expect(workspace).toContainText("Français");
    await expect(workspace).not.toContainText("3e Maternelle");
    await expect(workspace).not.toContainText("1re Secondaire B");
    await expect(workspace).not.toContainText("Sciences physiques");

    for (const label of ["Classes", "Enseignants", "Devoirs", "Évaluations", "Couverture des notes", "Objectifs mensuels", "Difficultés", "Rattrapages", "Bulletins en préparation", "Palmarès", "Alertes pédagogiques"]) {
      await expect(workspace).toContainText(label);
    }
    await expect(workspace).toContainText("VALIDATION BACKEND_LATER");

    const review = page.locator("#pedagogyDirectionReviewForm");
    await review.locator('[name="subject"]').selectOption("Devoirs");
    await review.locator('[name="status"]').selectOption("EN REVUE");
    await review.locator('[name="observation"]').fill("Vérifier la couverture de la classe 6e A.");
    await review.locator('button[type="submit"]').click();
    await expect(page.locator('[data-direction-reviews]')).toContainText("Vérifier la couverture");
    await expect(page.locator('[data-direction-reviews]')).toContainText("EN REVUE");
    await expect(workspace.getByRole("button", { name: /valider officiellement/i })).toHaveCount(0);
  });

  test("le DENY de rapport masque toutes les données de pilotage", async ({ page }) => {
    await enterDemoWorkspace(page, "pedagogy");
    await page.evaluate(() => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      api.render("teacherPedagogyPortal", {
        permissions: ["school.class.read", "school.student.read", "pedagogy.subject.read", "pedagogy.report.read"],
        deniedPermissions: ["pedagogy.report.read"],
        assignedClassIds: ["demo-class-1"],
        assignedSubjectIds: ["demo-subject-math"],
        scopes: [
          { permission: "school.class.read", type: "assigned_classes" },
          { permission: "school.student.read", type: "assigned_classes" },
          { permission: "pedagogy.subject.read", type: "assigned_subjects" },
          { permission: "pedagogy.report.read", type: "assigned_classes" },
        ],
      });
      api.open("direction");
    });

    await expect(page.locator("#teacherPedagogyPortal")).toContainText("Accès pédagogique refusé");
    await expect(page.locator('[data-direction-workspace]')).toHaveCount(0);
  });

  test("accepte un scope school uniquement lorsqu’il est explicitement projeté", async ({ page }) => {
    await enterDemoWorkspace(page, "pedagogy");
    await page.evaluate(() => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      api.render("teacherPedagogyPortal", {
        permissions: ["school.class.read", "school.student.read", "pedagogy.subject.read", "pedagogy.report.read"],
        assignedClassIds: [],
        assignedSubjectIds: [],
        scopes: [
          { permission: "school.class.read", type: "school" },
          { permission: "school.student.read", type: "school" },
          { permission: "pedagogy.subject.read", type: "school" },
          { permission: "pedagogy.report.read", type: "school" },
        ],
      });
      api.open("direction");
    });

    const workspace = page.locator('[data-direction-workspace]');
    await expect(workspace).toBeVisible();
    await expect(workspace).toContainText("3e Maternelle");
    await expect(workspace).toContainText("1re Secondaire B");
    await expect(workspace).toContainText("Sciences physiques");
  });

  test("filtre métriques et revues locales selon la projection courante", async ({ page }) => {
    await enterDemoWorkspace(page, "pedagogy");
    await openAction(page, "Pilotage pédagogique");
    const review = page.locator("#pedagogyDirectionReviewForm");
    await review.locator('[name="observation"]').fill("Revue couvrant les deux classes affectées.");
    await review.locator('button[type="submit"]').click();
    await page.evaluate(() => {
      localStorage.setItem("schoolsafe-v2-teacher-appreciation-drafts", JSON.stringify([
        { id: "foreign-appreciation", studentId: "demo-student-ethan", studentName: "Ethan Leroy", classId: "demo-class-2", text: "Hors projection courante" },
      ]));
      const api = (window as any).SchoolSafeTeacherPedagogy;
      const base = (window as any).SchoolSafeAppContext.getCurrentUser();
      api.render("teacherPedagogyPortal", { ...base, assignedClassIds: ["demo-class-1"], assignedSubjectIds: ["demo-subject-math"] });
      api.open("direction");
    });

    const workspace = page.locator('[data-direction-workspace]');
    await expect(workspace.locator('[data-direction-reviews]')).not.toContainText("deux classes");
    await expect(workspace).toContainText("82 %");
    await expect(workspace).not.toContainText("79 %");
    const bulletin = workspace.locator(".teacher-direction-metric").filter({ hasText: "Bulletins en préparation" });
    await expect(bulletin).toContainText("0");
  });
});
