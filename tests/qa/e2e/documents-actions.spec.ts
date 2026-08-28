import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const canonicalPermissions = JSON.parse(readFileSync(path.resolve(process.cwd(), "shared/permissions.json"), "utf8"));

test.describe("J7 — Actions documentaires universelles", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/index.html");
    await page.waitForFunction(() => Boolean((window as any).SchoolSafeAccess && (window as any).SchoolSafeDocumentCenter));
  });

  test("fait passer un PDF autorisé par DocumentRequest, AccessGate et Document Engine", async ({ page }) => {
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
      const originalCreateObjectUrl = URL.createObjectURL;
      URL.createObjectURL = () => "blob://document-action";

      try {
        const center = (window as any).SchoolSafeDocumentCenter;
        center.clearRegistry();
        center.register({
          id: "assignment-action", type: "assignment-action", label: "Devoir de mathématiques",
          sourceModule: "pedagogy", nature: "DOCUMENT", permission: "pedagogy.assignment.read",
          scope: "assigned_classes", context: { classId: "class-1", subjectId: "math", title: "Devoir de mathématiques" },
          formats: ["pdf"], actions: ["preview", "pdf", "print", "download"],
        });

        const { createUniversalDocumentActions } = await import("/modules/document-engine/document-actions.js");
        const { createUniversalDocumentTemplate } = await import("/modules/document-engine/index.js");
        const actions = createUniversalDocumentActions({
          documentCenter: center,
          templateResolver: async () => createUniversalDocumentTemplate({
            type: "assignment-action", label: "Devoir de mathématiques", sourceModule: "pedagogy",
            kind: "report", permissions: ["pedagogy.assignment.read"],
          }),
          schoolIdentityProvider: { load: async () => ({
            name: "École Test", primaryColor: "#071a3d", accentColor: "#e9a515",
            documentFooter: "SchoolSafe · aperçu frontend", currency: "CDF", activeAcademicYear: { id: "y1", label: "2026-2027" },
          }) },
          schoolSafeIdentityProvider: { load: async () => ({ name: "SchoolSafe", legalMention: "Document généré par SchoolSafe" }) },
          permissionsLoader: async () => [{ code: "pedagogy.assignment.read", scope: "assigned_classes" }],
        });
        const user = {
          userId: "teacher-1", schoolId: "school-1", role: "teacher", name: "Mme Test",
          permissions: ["pedagogy.assignment.read"], assignedClassIds: ["class-1"],
          scopes: [{ permission: "pedagogy.assignment.read", type: "assigned_classes" }],
        };
        const response = await actions.executeById({ descriptorId: "assignment-action", action: "preview", user, applyEffect: false });
        return {
          ok: response.ok,
          action: response.request && response.request.action,
          authority: response.result && response.result.model && response.result.model.meta.authority,
          generatedBy: response.result && response.result.model && response.result.model.meta.generatedBy,
          format: response.output && response.output.format,
          pages: response.output && response.output.pages,
          text: textLog.join(" | "),
        };
      } finally {
        URL.createObjectURL = originalCreateObjectUrl;
      }
    });

    expect(result).toMatchObject({
      ok: true,
      action: "preview",
      authority: "preview",
      generatedBy: "frontend",
      format: "pdf",
      pages: 1,
    });
    expect(result.text).toContain("BROUILLON");
    expect(result.text).not.toContain("OFFICIEL");
  });

  test("refuse l’enfant ou la classe hors portée et fait primer DENY", async ({ page }) => {
    const decisions = await page.evaluate(async () => {
      const center = (window as any).SchoolSafeDocumentCenter;
      center.clearRegistry();
      center.registerMany([
        {
          id: "family-document", type: "family-document", label: "Document familial",
          sourceModule: "finance", nature: "DOCUMENT", permission: "finance.receipt.read",
          scope: "own_children", context: { childId: "child-1" }, formats: ["pdf"],
        },
        {
          id: "class-document", type: "class-document", label: "Document de classe",
          sourceModule: "pedagogy", nature: "DOCUMENT", permission: "pedagogy.assignment.read",
          scope: "assigned_classes", context: { classId: "class-1" }, formats: ["pdf"],
        },
      ]);

      const { createUniversalDocumentActions } = await import("/modules/document-engine/document-actions.js");
      const actions = createUniversalDocumentActions({
        documentCenter: center,
        templateResolver: async () => { throw new Error("Le template ne doit pas être résolu après un refus"); },
        schoolIdentityProvider: { load: async () => ({}) },
        schoolSafeIdentityProvider: { load: async () => ({}) },
        permissionsLoader: async () => [],
      });
      const parent = {
        userId: "parent-1", permissions: ["finance.receipt.read"], childIds: ["child-2"],
        scopes: [{ permission: "finance.receipt.read", type: "own_children" }],
      };
      const teacher = {
        userId: "teacher-1", permissions: ["pedagogy.assignment.read"], assignedClassIds: ["class-2"],
        scopes: [{ permission: "pedagogy.assignment.read", type: "assigned_classes" }],
      };
      const deniedTeacher = { ...teacher, assignedClassIds: ["class-1"], deniedPermissions: ["pedagogy.assignment.read"] };

      return {
        otherChild: await actions.executeById({ descriptorId: "family-document", action: "preview", user: parent, applyEffect: false }),
        otherClass: await actions.executeById({ descriptorId: "class-document", action: "preview", user: teacher, applyEffect: false }),
        explicitDeny: await actions.executeById({ descriptorId: "class-document", action: "preview", user: deniedTeacher, applyEffect: false }),
      };
    });

    expect(decisions.otherChild).toMatchObject({ ok: false, error: "Access denied" });
    expect(decisions.otherClass).toMatchObject({ ok: false, error: "Access denied" });
    expect(decisions.explicitDeny).toMatchObject({ ok: false, error: "Access denied" });
  });

  test("accepte une portée école explicitement accordée sans bypass de rôle", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { createAccessGate } = await import("/modules/document-engine/access-gate.js");
      const gate = createAccessGate({
        access: (window as any).SchoolSafeAccess,
        permissionsLoader: async () => [{ code: "finance.receipt.read", scope: "own_children" }],
      });
      return gate.check({
        action: "preview",
        requestedBy: {
          userId: "finance-1", schoolId: "school-1", role: "finance",
          permissions: ["finance.receipt.read"],
          scopes: [{ permission: "finance.receipt.read", type: "school" }],
        },
        context: { schoolId: "school-1" },
      }, { permissions: ["finance.receipt.read"] });
    });

    expect(result).toMatchObject({ allowed: true, permission: "finance.receipt.read", scope: "school" });
  });

  test("connecte réellement un adaptateur métier au moteur PDF", async ({ page }) => {
    const result = await page.evaluate(async (catalog) => {
      const actions = await (window as any).SchoolSafeDocumentActionsReady;
      const user = {
        userId: "demo-parent-1", schoolId: "demo-school-1", role: "parent", name: "Parent Démo",
        permissions: ["finance.receipt.read"], childIds: ["demo-parent-child-lucas"],
        scopes: [{ permission: "finance.receipt.read", type: "own_children" }],
      };
      (window as any).SchoolSafeAccess.loadPermissions = async () => catalog;
      await (window as any).SchoolSafeDocumentRuntime.bindContext({ user, mode: "demo" });
      const response = await actions.executeById({
        descriptorId: "finance-receipt-family", action: "preview", user, applyEffect: false,
      });
      return {
        ok: response.ok,
        error: response.error || "",
        descriptorId: response.descriptor && response.descriptor.id,
        documentType: response.request && response.request.documentType,
        authority: response.result && response.result.model && response.result.model.meta.authority,
        generatedBy: response.result && response.result.model && response.result.model.meta.generatedBy,
        output: response.output && {
          format: response.output.format,
          pages: response.output.pages,
          size: response.output.size,
        },
      };
    }, canonicalPermissions);

    expect(result).toMatchObject({
      ok: true,
      descriptorId: "finance-receipt-family",
      documentType: "receipt",
      authority: "preview",
      generatedBy: "frontend",
      output: { format: "pdf", pages: 1 },
    });
    expect(result.output!.size).toBeGreaterThan(0);
  });
});
