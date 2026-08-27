import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

test.describe("Phase D4 — résultats, bulletins et palmarès", () => {
  test("présente les résultats affectés sans inventer de bulletin officiel", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await page.locator('[data-teacher-open="results"]').click();

    const portal = page.locator("#teacherPedagogyPortal");
    await expect(portal).toContainText("Résultats et moyennes");
    await expect(portal).toContainText("Mathématiques");
    await expect(portal).toContainText("Français");
    await expect(portal).toContainText("DONNÉES DE DÉMONSTRATION");
    await expect(portal).not.toContainText("3e Maternelle");
    await expect(portal.locator('[data-ranking-scope="class"]')).toHaveCount(2);
    await expect(portal.locator('[data-ranking-class="demo-class-1"]')).toContainText("Lucas Martin");
    await expect(portal.locator('[data-ranking-class="demo-class-1"]')).not.toContainText("Ethan Leroy");
    await expect(portal.locator('[data-ranking-class="demo-class-2"]')).toContainText("Ethan Leroy");
    await expect(portal.locator('[data-ranking-class="demo-class-2"]')).not.toContainText("Lucas Martin");
    await expect(portal.locator('[data-ranking-scope="school"]')).toHaveCount(0);
    await expect(portal).not.toContainText("Modifier le classement");
    await expect(portal.locator('[data-bulletin-preview]')).toContainText("Bulletin officiel");
    await expect(portal.locator('[data-bulletin-preview]')).toContainText("BACKEND_LATER");

    const appreciation = page.locator("#teacherAppreciationForm");
    await appreciation.locator('[name="studentId"]').selectOption("demo-student-lucas");
    await appreciation.locator('[name="text"]').fill("Travail sérieux, poursuivre les efforts de justification.");
    await appreciation.locator('button[type="submit"]').click();
    await expect(portal.locator('[data-appreciation-list]')).toContainText("Travail sérieux");

    await page.evaluate(() => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      api.render("teacherPedagogyPortal", (window as any).SchoolSafeAppContext.getCurrentUser());
      api.open("results");
    });
    await expect(page.locator('[data-appreciation-list]')).toContainText("Travail sérieux");
  });

  test("le Top école exige une permission school réelle et respecte le DENY", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    const renderWith = async (deniedPermissions: string[]) => page.evaluate((denied) => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      api.render("teacherPedagogyPortal", {
        permissions: ["school.class.read", "school.student.read", "pedagogy.subject.read", "pedagogy.grade.read", "pedagogy.grade.manage", "palmarques.read"],
        deniedPermissions: denied,
        assignedClassIds: ["demo-class-1"],
        assignedSubjectIds: ["demo-subject-math"],
        scopes: [
          { permission: "school.class.read", type: "assigned_classes" },
          { permission: "school.student.read", type: "assigned_classes" },
          { permission: "pedagogy.subject.read", type: "assigned_subjects" },
          { permission: "pedagogy.grade.read", type: "assigned_classes" },
          { permission: "pedagogy.grade.manage", type: "assigned_classes" },
          { permission: "palmarques.read", type: "school" },
        ],
      });
      api.open("results");
    }, deniedPermissions);

    await renderWith([]);
    await expect(page.locator('[data-ranking-scope="school"]')).toContainText("Top 10 école");

    await renderWith(["palmarques.read"]);
    await expect(page.locator('[data-ranking-scope="school"]')).toHaveCount(0);
    await expect(page.locator("#teacherPedagogyPortal")).toContainText("Top école non autorisé");
  });
});
