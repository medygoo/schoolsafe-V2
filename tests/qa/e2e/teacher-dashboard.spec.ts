import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

test.describe("Phase D1 — tableau de bord Enseignant", () => {
  test("affiche uniquement les classes et matières affectées", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");

    const portal = page.locator("#teacherPedagogyPortal");
    await expect(portal).toBeVisible();
    await expect(portal).toContainText("Mon espace pédagogique");
    await expect(portal.locator('[data-assigned-class="demo-class-1"]')).toContainText("6e A");
    await expect(portal.locator('[data-assigned-subject="demo-subject-math"]')).toContainText("Mathématiques");
    await expect(portal).not.toContainText("3e Maternelle");
    await expect(portal).not.toContainText("1re Secondaire B");
    await expect(portal).not.toContainText("Sciences physiques");

    const fixtureNames = await page.evaluate(() => {
      const academic = (window as any).SchoolSafeAcademicStructure.getClasses();
      const teaching = (window as any).SchoolSafeTeacherPedagogy.CLASSES;
      return ["demo-class-1", "demo-class-2"].map((id) => ({
        academic: academic.find((item: any) => item.id === id)?.name,
        teaching: teaching.find((item: any) => item.id === id)?.name,
      }));
    });
    expect(fixtureNames.every((item) => item.academic === item.teaching)).toBe(true);
  });

  test("dérive les priorités de la projection d’une seule classe", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await page.evaluate(() => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      const base = (window as any).SchoolSafeAppContext.getCurrentUser();
      api.render("teacherPedagogyPortal", {
        ...base,
        assignedClassIds: ["demo-class-1"],
        assignedSubjectIds: ["demo-subject-math"],
      });
    });

    const schedule = page.locator('[data-teacher-open="schedule"]');
    await expect(schedule).toContainText("6e A");
    await expect(schedule).not.toContainText("5e A");
  });

  test("exclut les élèves en brouillon et refuse un scope de classe incorrect", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");

    await expect(page.locator("#teacherPedagogyPortal")).not.toContainText("Amina Mbuyi");

    await page.evaluate(() => {
      (window as any).SchoolSafeTeacherPedagogy.render("teacherPedagogyPortal", {
        permissions: ["school.class.read", "school.student.read", "pedagogy.subject.read"],
        assignedClassIds: ["demo-class-3"],
        assignedSubjectIds: ["demo-subject-physics"],
        scopes: [
          { permission: "school.class.read", type: "school" },
          { permission: "school.student.read", type: "school" },
          { permission: "pedagogy.subject.read", type: "school" },
        ],
      });
    });

    await expect(page.locator("#teacherPedagogyPortal")).toContainText("Accès pédagogique refusé");
    await expect(page.locator("#teacherPedagogyPortal")).not.toContainText("3e Maternelle");
  });
});
