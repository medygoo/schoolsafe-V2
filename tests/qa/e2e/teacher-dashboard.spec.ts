import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

test.describe("Phase D1 — tableau de bord Enseignant", () => {
  test("affiche uniquement les classes et matières affectées", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");

    const portal = page.locator("#teacherPedagogyPortal");
    await expect(portal).toBeVisible();
    await expect(portal).toContainText("Mon espace pédagogique");
    await expect(portal.locator('[data-assigned-class="demo-class-1"]')).toContainText("1re A");
    await expect(portal.locator('[data-assigned-subject="demo-subject-math"]')).toContainText("Mathématiques");
    await expect(portal).not.toContainText("3e C");
    await expect(portal).not.toContainText("Sciences physiques");
  });

  test("exclut les élèves en brouillon et refuse un scope de classe incorrect", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");

    await expect(page.locator("#teacherPedagogyPortal")).not.toContainText("Amina Mbuyi");

    await page.evaluate(() => {
      (window as any).SchoolSafeTeacherPedagogy.render("teacherPedagogyPortal", {
        permissions: ["school.class.read", "school.student.read", "pedagogy.subject.read"],
        assignedClassIds: ["demo-class-foreign"],
        assignedSubjectIds: ["demo-subject-physics"],
        scopes: [
          { permission: "school.class.read", type: "school" },
          { permission: "school.student.read", type: "school" },
          { permission: "pedagogy.subject.read", type: "school" },
        ],
      });
    });

    await expect(page.locator("#teacherPedagogyPortal")).toContainText("Accès pédagogique refusé");
    await expect(page.locator("#teacherPedagogyPortal")).not.toContainText("3e C");
  });
});
