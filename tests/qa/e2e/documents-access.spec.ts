import { test, expect } from "@playwright/test";

const catalog = [
  { code: "finance.receipt.read", scope: "own_children" },
  { code: "reports.financial.read", scope: "school" },
  { code: "pedagogy.assignment.read", scope: "assigned_classes" },
  { code: "pedagogy.subject.read", scope: "assigned_subjects" },
];

async function checkAccess(page: any, request: any, templateInfo: any) {
  return page.evaluate(async ({ request, templateInfo, catalog }) => {
    const { createAccessGate } = await import("/modules/document-engine/access-gate.js");
    const gate = createAccessGate({
      access: (window as any).SchoolSafeAccess,
      permissionsLoader: async () => catalog,
    });
    return gate.check(request, templateInfo);
  }, { request, templateInfo, catalog });
}

test.describe("J1 — Access_Law documentaire", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/index.html");
    await page.waitForFunction(() => Boolean((window as any).SchoolSafeAccess));
  });

  test("refuse un administrateur sans permission explicite", async ({ page }) => {
    const result = await checkAccess(page, {
      action: "download",
      requestedBy: { role: "admin", userId: "admin-1", schoolId: "school-1", permissions: [], scopes: [] },
      context: { childId: "child-1" },
    }, { permissions: ["finance.receipt.read"] });
    expect(result).toMatchObject({ allowed: false, scope: "none" });
    expect(result.reason).toContain("Missing permission");
  });

  test("autorise uniquement permission, portée et enfant liés", async ({ page }) => {
    const templateInfo = { permissions: ["finance.receipt.read"] };
    const baseUser = {
      role: "parent", userId: "parent-1", schoolId: "school-1",
      permissions: ["finance.receipt.read"], childIds: ["child-1"],
      scopes: [{ permission: "finance.receipt.read", type: "own_children" }],
    };
    const allowed = await checkAccess(page, { action: "download", requestedBy: baseUser, context: { childId: "child-1" } }, templateInfo);
    const otherChild = await checkAccess(page, { action: "download", requestedBy: baseUser, context: { childId: "child-2" } }, templateInfo);
    const wrongScope = await checkAccess(page, {
      action: "download", requestedBy: { ...baseUser, scopes: [{ permission: "finance.receipt.read", type: "unsupported" }] }, context: { childId: "child-1" },
    }, templateInfo);
    expect(allowed).toMatchObject({ allowed: true, permission: "finance.receipt.read", scope: "own_children" });
    expect(otherChild).toMatchObject({ allowed: false });
    expect(otherChild.reason).toContain("Scope context mismatch");
    expect(wrongScope).toMatchObject({ allowed: false });
  });

  test("fait primer un DENY explicite", async ({ page }) => {
    const result = await checkAccess(page, {
      action: "preview",
      requestedBy: {
        userId: "accountant-1", schoolId: "school-1",
        permissions: ["reports.financial.read"], deniedPermissions: ["reports.financial.read"],
        scopes: [{ permission: "reports.financial.read", type: "school" }],
      }, context: { schoolId: "school-1" },
    }, { permissions: ["reports.financial.read"] });
    expect(result).toMatchObject({ allowed: false });
    expect(result.reason).toContain("Explicit DENY");
  });

  test("ignore toute permission injectée dans DocumentRequest", async ({ page }) => {
    const result = await checkAccess(page, {
      action: "download", permission: "reports.financial.read",
      requestedBy: {
        userId: "accountant-1", schoolId: "school-1", permissions: ["reports.financial.read"],
        scopes: [{ permission: "reports.financial.read", type: "school" }],
      }, context: { schoolId: "school-1" },
    }, { permissions: ["finance.receipt.read"] });
    expect(result).toMatchObject({ allowed: false });
    expect(result.reason).toContain("Missing permission finance.receipt.read");
  });

  test("échoue fermé sans permission, portée ou contexte compatible", async ({ page }) => {
    const noTemplatePermission = await checkAccess(page, { action: "preview", requestedBy: { userId: "u1" }, context: {} }, { permissions: [] });
    const noClassContext = await checkAccess(page, {
      action: "preview",
      requestedBy: {
        userId: "teacher-1", permissions: ["pedagogy.assignment.read"], assignedClassIds: ["class-1"],
        scopes: [{ permission: "pedagogy.assignment.read", type: "assigned_classes" }],
      }, context: {},
    }, { permissions: ["pedagogy.assignment.read"] });
    expect(noTemplatePermission).toMatchObject({ allowed: false });
    expect(noClassContext).toMatchObject({ allowed: false });
    expect(noClassContext.reason).toContain("Scope context mismatch");
  });
});
