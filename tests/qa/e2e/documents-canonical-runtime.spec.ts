import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const canonicalPermissions = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "shared/permissions.json"), "utf8"),
);

async function openRuntime(page: any) {
  await page.goto("/index.html");
  await page.waitForFunction(() => Boolean(
    (window as any).SchoolSafeAccess &&
    (window as any).SchoolSafeDocumentRuntime &&
    (window as any).SchoolSafeDocumentActionsReady,
  ));
  await page.evaluate((catalog) => {
    (window as any).SchoolSafeAccess.loadPermissions = async () => catalog;
  }, canonicalPermissions);
}

async function bindContext(page: any, user: any, mode = "live", selectedContext: any = {}) {
  return page.evaluate(async ({ user, mode, selectedContext }) => {
    await (window as any).SchoolSafeDocumentRuntime.bindContext({ user, mode, selectedContext });
    const center = (window as any).SchoolSafeDocumentCenter;
    return center.listRegistered().map((item: any) => center.getAuthorizedDescriptor(item.id, user, "preview"));
  }, { user, mode, selectedContext });
}

test.describe("Correctif Phase J — contexte documentaire canonique", () => {
  test.beforeEach(async ({ page }) => {
    await openRuntime(page);
  });

  test("isole strictement les documents de l’école A et de l’école B", async ({ page }) => {
    const schoolUser = (schoolId: string) => ({
      userId: `director-${schoolId}`,
      schoolId,
      permissions: ["finance.report.read", "pedagogy.report.read", "reports.operational.read"],
      scopes: [
        { permission: "finance.report.read", type: "school" },
        { permission: "pedagogy.report.read", type: "school" },
        { permission: "reports.operational.read", type: "school" },
      ],
    });

    const schoolA = await bindContext(page, schoolUser("school-a"));
    expect(schoolA.length).toBeGreaterThan(0);
    expect(schoolA.every((item: any) => item.context.schoolId === "school-a")).toBe(true);

    const schoolB = await bindContext(page, schoolUser("school-b"));
    expect(schoolB.length).toBeGreaterThan(0);
    expect(schoolB.every((item: any) => item.context.schoolId === "school-b")).toBe(true);
    expect(JSON.stringify(schoolB)).not.toContain("school-a");
  });

  test("construit les descripteurs depuis les enfants, classes et matières réels avec leurs scopes exacts", async ({ page }) => {
    const documents = await bindContext(page, {
      userId: "profile-real-1",
      schoolId: "school-real-1",
      childIds: ["child-real-1", "child-real-2"],
      assignedClassIds: ["class-real-1", "class-real-2"],
      assignedSubjectIds: ["subject-real-1"],
      permissions: [
        "finance.receipt.read",
        "finance.status.read",
        "pedagogy.assignment.read",
        "pedagogy.report.read",
        "school.student.read",
        "school.class.read",
        "pedagogy.subject.read",
      ],
      scopes: [
        { permission: "finance.receipt.read", type: "own_children" },
        { permission: "finance.status.read", type: "assigned_classes" },
        { permission: "pedagogy.assignment.read", type: "assigned_classes" },
        { permission: "pedagogy.report.read", type: "school" },
        { permission: "school.student.read", type: "assigned_classes" },
        { permission: "school.class.read", type: "assigned_classes" },
        { permission: "pedagogy.subject.read", type: "assigned_subjects" },
      ],
    });

    const byPermission = (permission: string) => documents.filter((item: any) => item.permission === permission);
    expect(byPermission("finance.receipt.read").map((item: any) => item.context.childId).sort())
      .toEqual(["child-real-1", "child-real-2"]);
    expect(byPermission("finance.receipt.read").every((item: any) => item.scope === "own_children")).toBe(true);
    expect(byPermission("finance.status.read").map((item: any) => item.context.classId).sort())
      .toEqual(["class-real-1", "class-real-2"]);
    expect(byPermission("finance.status.read").every((item: any) => item.scope === "assigned_classes")).toBe(true);
    expect(byPermission("pedagogy.report.read")).toEqual([
      expect.objectContaining({ scope: "school", context: expect.objectContaining({ schoolId: "school-real-1" }) }),
    ]);
    expect(byPermission("school.student.read").every((item: any) => item.scope === "assigned_classes")).toBe(true);
    expect(byPermission("pedagogy.subject.read").map((item: any) => item.context.subjectId))
      .toEqual(["subject-real-1"]);
    expect(JSON.stringify(documents)).not.toMatch(/demo-school-1|demo-parent-child-lucas|demo-class-1|demo-subject-math|demo-active-student-1/);
  });

  test("fait primer DENY et n’invente aucun scope manquant", async ({ page }) => {
    const denied = await bindContext(page, {
      userId: "teacher-denied",
      schoolId: "school-real-1",
      assignedClassIds: ["class-real-1"],
      permissions: ["pedagogy.assignment.read", "school.student.read"],
      deniedPermissions: ["pedagogy.assignment.read"],
      scopes: [
        { permission: "pedagogy.assignment.read", type: "assigned_classes" },
      ],
    });

    expect(denied.some((item: any) => item.permission === "pedagogy.assignment.read")).toBe(false);
    expect(denied.some((item: any) => item.permission === "school.student.read")).toBe(false);
  });

  test("échoue fermé si le catalogue canonique est indisponible", async ({ page }) => {
    const result = await page.evaluate(async () => {
      (window as any).SchoolSafeAccess.loadPermissions = async () => [];
      const user = {
        userId: "director-real-1", schoolId: "school-real-1",
        permissions: ["finance.report.read"],
        scopes: [{ permission: "finance.report.read", type: "school" }],
      };
      let error = "";
      try {
        await (window as any).SchoolSafeDocumentRuntime.bindContext({ user, mode: "live" });
      } catch (caught: any) {
        error = caught && caught.message ? caught.message : String(caught);
      }
      return {
        error,
        registered: (window as any).SchoolSafeDocumentCenter.listRegistered().length,
        state: (window as any).SchoolSafeDocumentRuntime.getState(),
      };
    });

    expect(result.error).toMatch(/catalogue Access_Law indisponible/i);
    expect(result.registered).toBe(0);
    expect(result.state).toMatchObject({ mode: "unbound", catalogueSize: 0 });
  });

  test("charge l’identité réelle via SchoolSafeSchoolAPI et garde le PDF en brouillon d’aperçu", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const textLog: string[] = [];
      class FakeDoc {
        pages = 1;
        internal = { getNumberOfPages: () => this.pages };
        setFillColor() {}
        setDrawColor() {}
        setTextColor() {}
        setFontSize() {}
        setFont() {}
        setLineDash() {}
        rect() {}
        line() {}
        text(value: string) { textLog.push(String(value)); }
        addImage() {}
        addPage() { this.pages += 1; }
        setPage() {}
        setProperties() {}
        output() { return new Blob(["pdf"], { type: "application/pdf" }); }
      }
      (window as any).jspdf = { jsPDF: FakeDoc };
      (window as any).SchoolSafeSchoolAPI = {
        getSettings: async () => ({
          identity: { name: "Institut Réel A", legal_name: "Institut Réel A ASBL", currency: "CDF" },
          contact: { address: "12 avenue réelle", city: "Goma", country: "RDC", phone: "+243 811 222 333", email: "contact@institut-a.cd", website_url: "https://institut-a.cd" },
          brand: { primary_color: "#123456", accent_color: "#f0b429", document_footer: "Institut Réel A" },
          academic_years: [{ id: "year-real-1", label: "2026-2027", is_active: true }],
          cycles: [],
        }),
      };
      const user = {
        userId: "finance-real-1", schoolId: "school-real-1",
        permissions: ["finance.report.read"],
        scopes: [{ permission: "finance.report.read", type: "school" }],
      };
      await (window as any).SchoolSafeDocumentRuntime.bindContext({ user, mode: "live" });
      const actions = await (window as any).SchoolSafeDocumentActionsReady;
      const response = await actions.executeById({
        descriptorId: "finance-cash-report", action: "preview", user, applyEffect: false,
      });
      return {
        ok: response.ok,
        school: response.result && response.result.model && response.result.model.school,
        status: response.result && response.result.model && response.result.model.meta.status,
        authority: response.result && response.result.model && response.result.model.meta.authority,
        text: textLog.join(" | "),
      };
    });

    expect(result).toMatchObject({
      ok: true,
      school: {
        name: "Institut Réel A",
        legalName: "Institut Réel A ASBL",
        address: "12 avenue réelle",
        city: "Goma",
        phone: "+243 811 222 333",
        email: "contact@institut-a.cd",
        website: "https://institut-a.cd",
      },
      status: "generated",
      authority: "preview",
    });
    expect(result.text).toContain("BROUILLON");
  });

  test("échoue fermé si l’identité live est indisponible et n’autorise les fixtures qu’en démo explicite", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const user = {
        userId: "finance-real-1", schoolId: "school-real-1",
        permissions: ["finance.report.read"],
        scopes: [{ permission: "finance.report.read", type: "school" }],
      };
      (window as any).SchoolSafeSchoolAPI = { getSettings: async () => ({ identity: {}, contact: {}, brand: {}, academic_years: [], cycles: [] }) };
      await (window as any).SchoolSafeDocumentRuntime.bindContext({ user, mode: "live" });
      const actions = await (window as any).SchoolSafeDocumentActionsReady;
      const live = await actions.executeById({ descriptorId: "finance-cash-report", action: "preview", user, applyEffect: false });

      const demoUser = {
        userId: "demo-admin-1", schoolId: "demo-school-1",
        permissions: ["finance.report.read"],
        scopes: [{ permission: "finance.report.read", type: "school" }],
      };
      await (window as any).SchoolSafeDocumentRuntime.bindContext({ user: demoUser, mode: "demo" });
      const demo = (window as any).SchoolSafeDocumentCenter.listRegistered();
      return { live: { ok: live.ok, error: live.error }, demo };
    });

    expect(result.live.ok).toBe(false);
    expect(result.live.error).toMatch(/identité école indisponible/i);
    expect(result.demo.length).toBeGreaterThan(0);
    expect(result.demo.every((item: any) => item.description.includes("DÉMONSTRATION"))).toBe(true);
  });
});
