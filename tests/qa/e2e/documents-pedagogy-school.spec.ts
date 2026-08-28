import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openDocumentsCenter } from "./helpers";

test.describe("J5 — Documents École et Pédagogie", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
  });

  test("réutilise les templates devoir et feuille de réponses", async ({ page }) => {
    const infos = await page.evaluate(async () => {
      const connector = (window as any).SchoolSafeSchoolPedagogyDocuments;
      const assignment = await connector.getTemplate("pedagogy-assignment");
      const answerSheet = await connector.getTemplate("pedagogy-answer-sheet");
      return [assignment.info, answerSheet.info];
    });
    expect(infos[0]).toMatchObject({ type: "assignment", defaultLayout: "a4-portrait" });
    expect(infos[1]).toMatchObject({ type: "answer-sheet", defaultLayout: "a4-portrait" });
  });

  test("borne enseignant à assigned_classes et assigned_subjects", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const center = (window as any).SchoolSafeDocumentCenter;
      const teacher = {
        userId: "teacher-1", schoolId: "school-real-1", assignedClassIds: ["class-real-1"], assignedSubjectIds: ["subject-real-1"],
        permissions: ["pedagogy.assignment.read", "pedagogy.report.read", "pedagogy.subject.read", "school.student.read", "school.class.read"],
        scopes: [
          { permission: "pedagogy.assignment.read", type: "assigned_classes" },
          { permission: "pedagogy.report.read", type: "school" },
          { permission: "pedagogy.subject.read", type: "assigned_subjects" },
          { permission: "school.student.read", type: "assigned_classes" },
          { permission: "school.class.read", type: "assigned_classes" },
        ],
      };
      const denied = { ...teacher, deniedPermissions: ["pedagogy.assignment.read"] };
      await (window as any).SchoolSafeDocumentRuntime.bindContext({ user: teacher, mode: "live" });
      const ids = center.visibleDocuments(teacher).map((item: any) => item.id);
      await (window as any).SchoolSafeDocumentRuntime.bindContext({ user: denied, mode: "live" });
      return {
        ids,
        deniedIds: center.visibleDocuments(denied).map((item: any) => item.id),
      };
    });
    expect(result.ids).toEqual(expect.arrayContaining(["pedagogy-assignment", "pedagogy-answer-sheet", "pedagogy-report-school", "school-student-summary-class", "school-class-register", "pedagogy-subject-register"]));
    expect(result.deniedIds).not.toContain("pedagogy-assignment");
    expect(result.deniedIds).not.toContain("pedagogy-answer-sheet");

    const outsideSubject = await page.evaluate(async () => {
      const center = (window as any).SchoolSafeDocumentCenter;
      const user = {
        userId: "teacher-2", assignedSubjectIds: ["subject-real-1"], permissions: ["pedagogy.subject.read"],
        scopes: [{ permission: "pedagogy.subject.read", type: "assigned_subjects" }],
      };
      await (window as any).SchoolSafeDocumentRuntime.bindContext({ user, mode: "live" });
      return center.visibleDocuments({ ...user, assignedSubjectIds: ["other-subject"] }).map((item: any) => item.id);
    });
    expect(outsideSubject).not.toContain("pedagogy-subject-register");
  });

  test("ne réinterprète pas school.student.read ou pedagogy.report.read en own_children et exclut tout élève brouillon", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const center = (window as any).SchoolSafeDocumentCenter;
      const parent = {
        userId: "parent-1", schoolId: "demo-school-1", childIds: ["demo-parent-child-lucas"],
        permissions: ["school.student.read", "pedagogy.report.read"],
        scopes: [
          { permission: "school.student.read", type: "own_children" },
          { permission: "pedagogy.report.read", type: "own_children" },
        ],
      };
      await (window as any).SchoolSafeDocumentRuntime.bindContext({ user: parent, mode: "demo" });
      const registered = center.listRegistered();
      return { parent: center.visibleDocuments(parent).map((item: any) => item.id), registered };
    });
    expect(result.parent).toHaveLength(0);
    expect(JSON.stringify(result.registered)).not.toContain("demo-draft-student");
  });

  test("affiche les documents de la classe affectée dans le Centre", async ({ page }) => {
    await openDocumentsCenter(page);
    await expect(page.locator("[data-document-id='pedagogy-assignment']")).toBeVisible();
    await expect(page.locator("[data-document-id='school-student-summary-class']")).toBeVisible();
    await expect(page.locator("[data-document-id='school-student-summary-school']")).toHaveCount(0);
  });
});
