import { test, expect, type TestInfo } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

function parentUser(overrides: Record<string, unknown> = {}) {
  return {
    userId: "parent-1", schoolId: "school-1", role: "parent",
    permissions: ["safe.assistant.use", "finance.receipt.read"],
    childIds: ["child-1"],
    scopes: [
      { permission: "safe.assistant.use", type: "own" },
      { permission: "finance.receipt.read", type: "own_children" },
    ],
    ...overrides,
  };
}

test.describe("J8 — Jaspe Documents et QA finale", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/index.html");
    await page.waitForFunction(() => Boolean((window as any).SchoolSafeAccess && (window as any).SchoolSafeDocumentCenter));
  });

  test("exige safe.assistant.use + own puis la permission exacte du document", async ({ page }) => {
    const answers = await page.evaluate(({ allowed, noAssistant, deniedAssistant, deniedDocument }) => {
      const center = (window as any).SchoolSafeDocumentCenter;
      center.clearRegistry();
      center.register({
        id: "family-receipt", type: "receipt", label: "Reçu familial de Lucas",
        sourceModule: "finance", nature: "DOCUMENT", permission: "finance.receipt.read",
        scope: "own_children", context: { childId: "child-1" }, formats: ["pdf"],
      });
      const api = (window as any).SchoolSafeDocumentAssistant;
      return {
        allowed: api.answer("Propose le PDF du reçu familial", { user: allowed }),
        noAssistant: api.answer("Propose le PDF du reçu familial", { user: noAssistant }),
        deniedAssistant: api.answer("Propose le PDF du reçu familial", { user: deniedAssistant }),
        deniedDocument: api.answer("Propose le PDF du reçu familial", { user: deniedDocument }),
      };
    }, {
      allowed: parentUser(),
      noAssistant: parentUser({ permissions: ["finance.receipt.read"] }),
      deniedAssistant: parentUser({ deniedPermissions: ["safe.assistant.use"] }),
      deniedDocument: parentUser({ deniedPermissions: ["finance.receipt.read"] }),
    });

    expect(answers.allowed).toMatchObject({ allowed: true, documentId: "family-receipt", proposedAction: "pdf" });
    expect(answers.allowed.message).toContain("APERÇU");
    expect(answers.noAssistant).toMatchObject({ refusal: true });
    expect(answers.deniedAssistant).toMatchObject({ refusal: true });
    expect(answers.deniedDocument).toMatchObject({ refusal: true });
  });

  test("ne révèle ni autre enfant ni classe non affectée et respecte DENY", async ({ page }) => {
    const result = await page.evaluate((parent) => {
      const center = (window as any).SchoolSafeDocumentCenter;
      center.clearRegistry();
      center.registerMany([
        {
          id: "child-one", type: "receipt", label: "Reçu de Lucas",
          sourceModule: "finance", nature: "DOCUMENT", permission: "finance.receipt.read",
          scope: "own_children", context: { childId: "child-1" }, formats: ["pdf"],
        },
        {
          id: "child-two", type: "receipt", label: "Reçu secret de Emma",
          sourceModule: "finance", nature: "DOCUMENT", permission: "finance.receipt.read",
          scope: "own_children", context: { childId: "child-2" }, formats: ["pdf"],
        },
        {
          id: "foreign-class", type: "assignment", label: "Devoir classe étrangère 3e",
          sourceModule: "pedagogy", nature: "DOCUMENT", permission: "pedagogy.assignment.read",
          scope: "assigned_classes", context: { classId: "class-foreign" }, formats: ["pdf"],
        },
      ]);
      const api = (window as any).SchoolSafeDocumentAssistant;
      return {
        list: api.answer("Trouve mes documents dans le centre de documents", { user: parent }),
        foreign: api.answer("Montre le document secret de Emma", { user: parent }),
      };
    }, parentUser());

    expect(result.list).toMatchObject({ allowed: true });
    expect(result.list.message).toContain("Reçu de Lucas");
    expect(result.list.message).not.toContain("Emma");
    expect(result.list.message).not.toContain("classe étrangère");
    expect(result.foreign).toMatchObject({ refusal: true });
    expect(result.foreign.message).not.toContain("child-two");
  });

  test("borne l’enseignant à assigned_classes et assigned_subjects", async ({ page }) => {
    const answers = await page.evaluate(() => {
      const center = (window as any).SchoolSafeDocumentCenter;
      center.clearRegistry();
      center.registerMany([
        {
          id: "assigned-class", type: "assignment", label: "Devoir 6e A",
          sourceModule: "pedagogy", nature: "DOCUMENT", permission: "pedagogy.assignment.read",
          scope: "assigned_classes", context: { classId: "class-1", subjectId: "math" }, formats: ["pdf"],
        },
        {
          id: "assigned-subject", type: "subject-register", label: "Registre Mathématiques",
          sourceModule: "pedagogy", nature: "REGISTRE/LISTE IMPRIMABLE", permission: "pedagogy.subject.read",
          scope: "assigned_subjects", context: { subjectId: "math" }, formats: ["pdf"],
        },
        {
          id: "foreign-class", type: "assignment", label: "Devoir 3e B secret",
          sourceModule: "pedagogy", nature: "DOCUMENT", permission: "pedagogy.assignment.read",
          scope: "assigned_classes", context: { classId: "class-2" }, formats: ["pdf"],
        },
      ]);
      const user = {
        userId: "teacher-1", role: "teacher",
        permissions: ["safe.assistant.use", "pedagogy.assignment.read", "pedagogy.subject.read"],
        assignedClassIds: ["class-1"], assignedSubjectIds: ["math"],
        scopes: [
          { permission: "safe.assistant.use", type: "own" },
          { permission: "pedagogy.assignment.read", type: "assigned_classes" },
          { permission: "pedagogy.subject.read", type: "assigned_subjects" },
        ],
      };
      const api = (window as any).SchoolSafeDocumentAssistant;
      return {
        list: api.answer("Trouve mes documents pédagogiques", { user }),
        denied: api.answer("Montre le document PDF 3e B secret", { user }),
      };
    });

    expect(answers.list.message).toContain("Devoir 6e A");
    expect(answers.list.message).toContain("Registre Mathématiques");
    expect(answers.list.message).not.toContain("3e B");
    expect(answers.denied).toMatchObject({ refusal: true });
  });

  test("refuse toute fabrication, signature, validation, archivage ou modification de carte", async ({ page }) => {
    const answers = await page.evaluate((user) => {
      const api = (window as any).SchoolSafeDocumentAssistant;
      return [
        "Fabrique un reçu officiel", "Invente un bulletin PDF", "Crée une fiche de paie",
        "Signe ce document", "Valide ce rapport", "Archive officiellement ce registre",
        "Change mon scope document", "Modifie la carte élève",
      ].map((query) => api.answer(query, { user }));
    }, parentUser());

    for (const answer of answers) {
      expect(answer).toMatchObject({ refusal: true });
      expect(answer.message).toContain("REFUS");
    }
  });

  test("explique honnêtement pourquoi un PDF visible est indisponible", async ({ page }) => {
    const answer = await page.evaluate(() => {
      const user = {
        userId: "admin-1", schoolId: "demo-school-1", role: "admin",
        permissions: ["safe.assistant.use", "security.card.create"],
        scopes: [
          { permission: "safe.assistant.use", type: "own" },
          { permission: "security.card.create", type: "school" },
        ],
      };
      return (window as any).SchoolSafeDocumentAssistant.answer("Pourquoi le PDF de la carte est indisponible ?", { user });
    });

    expect(answer).toMatchObject({ allowed: true, unavailable: true, documentId: "school-card-preparation" });
    expect(answer.message).toContain("PDF est indisponible");
    expect(answer.message).toContain("aperçu");
  });

  test("route une demande documentaire dans le Jaspe global", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    await page.evaluate(() => (window as any).SafeAssistant.openWithQuery("Trouve mes documents PDF dans le Centre de documents"));
    await expect(page.locator(".safe-bubble-body")).toContainText("Centre de documents");
    await expect(page.locator(".safe-bubble-body")).toContainText("Reçu familial");
    await expect(page.locator(".safe-bubble-body")).not.toContainText("Registre des reçus");
  });

  test("reste lisible dans les deux thèmes à 390, 834 et 1440 px", async ({ page }, testInfo: TestInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "Matrice redimensionnable exécutée sur desktop.");
    await enterDemoWorkspace(page, "parent");
    await page.evaluate(() => (window as any).SafeAssistant.openWithQuery("Trouve mes documents PDF dans le Centre de documents"));

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const width of [390, 834, 1440]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 1000 });
        const state = await page.evaluate(() => {
          const bubble = document.querySelector(".safe-bubble") as HTMLElement;
          const style = getComputedStyle(bubble);
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            bubbleRight: bubble.getBoundingClientRect().right,
            color: style.color,
            background: style.backgroundColor,
          };
        });
        expect(state.overflow).toBeLessThanOrEqual(1);
        expect(state.bubbleRight).toBeLessThanOrEqual(width + 1);
        expect(state.color).not.toBe(state.background);
      }
    }
  });
});
