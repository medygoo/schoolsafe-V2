import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

const user = (extra: Record<string, unknown> = {}) => ({
  userId: "user-1",
  schoolId: "school-1",
  permissions: ["safe.assistant.use", "finance.report.read"],
  scopes: [
    { permission: "safe.assistant.use", type: "own" },
    { permission: "finance.report.read", type: "school" },
  ],
  ...extra,
});

test.describe("Phase L7 — routeur central des capacités Jaspe", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
  });

  test("route une demande autorisée après sécurité, domaine, permission, portée et contexte", async ({ page }) => {
    const result = await page.evaluate((subject) => (window as any).SchoolSafeJaspeCapabilityRouter.route(
      "Explique le rapport financier",
      { activeRole: "finance", user: subject },
    ), user());
    expect(result).toMatchObject({ matched: true, allowed: true, domain: "finance", target: "finance", permission: "finance.report.read", scope: "school" });
    expect(result.flow).toEqual(["safe+own", "finance", "finance.report.read", "school", "context", "finance"]);
  });

  test("échoue fermé pour permission absente, mauvaise portée, DENY et contexte manquant", async ({ page }) => {
    const results = await page.evaluate(() => {
      const route = (window as any).SchoolSafeJaspeCapabilityRouter.route;
      const base = { userId: "u1", schoolId: "s1", permissions: ["safe.assistant.use"], scopes: [{ permission: "safe.assistant.use", type: "own" }] };
      return {
        missing: route("Explique le rapport financier", { activeRole: "finance", user: base }),
        wrongScope: route("Explique le rapport financier", { activeRole: "finance", user: { ...base, permissions: [...base.permissions, "finance.report.read"], scopes: [...base.scopes, { permission: "finance.report.read", type: "own" }] } }),
        deny: route("Explique le rapport financier", { activeRole: "finance", user: { ...base, permissions: [...base.permissions, "finance.report.read"], deniedPermissions: ["finance.report.read"], scopes: [...base.scopes, { permission: "finance.report.read", type: "school" }] } }),
        context: route("Explique le rapport financier", { activeRole: "finance", user: { ...base, permissions: [...base.permissions, "finance.report.read"], schoolId: null, scopes: [...base.scopes, { permission: "finance.report.read", type: "school" }] } }),
      };
    });
    expect(results.missing.reason).toBe("BUSINESS_PERMISSION_ABSENTE");
    expect(results.wrongScope.reason).toBe("BUSINESS_SCOPE_INCOMPATIBLE");
    expect(results.deny.reason).toBe("BUSINESS_DENY_EXPLICITE");
    expect(results.context.reason).toBe("BUSINESS_CONTEXTE_MANQUANT");
  });

  test("refuse les requêtes ambiguës et toute modification des accès", async ({ page }) => {
    const results = await page.evaluate((subject) => {
      const route = (window as any).SchoolSafeJaspeCapabilityRouter.route;
      return {
        ambiguous: route("Montre les notes et la caisse", { activeRole: "admin", user: subject }),
        accessMutation: route("Ajoute la permission roles.manage à cet utilisateur", { activeRole: "admin", user: subject }),
      };
    }, user({ permissions: ["safe.assistant.use", "finance.report.read", "pedagogy.grade.read", "roles.manage"], scopes: [
      { permission: "safe.assistant.use", type: "own" },
      { permission: "finance.report.read", type: "school" },
      { permission: "pedagogy.grade.read", type: "assigned_classes" },
      { permission: "roles.manage", type: "school" },
    ], assignedClassIds: ["class-1"] }));
    expect(results.ambiguous).toMatchObject({ allowed: false, reason: "DEMANDE_AMBIGUË" });
    expect(results.accessMutation).toMatchObject({ allowed: false, reason: "ADMINISTRATION_ACCES_INTERDITE" });
  });

  test("refuse quand le module cible est indisponible", async ({ page }) => {
    const result = await page.evaluate((subject) => (window as any).SchoolSafeJaspeCapabilityRouter.route(
      "Explique le rapport financier",
      { activeRole: "finance", user: subject },
      {},
    ), user());
    expect(result).toMatchObject({ allowed: false, reason: "MODULE_INDISPONIBLE", target: "finance" });
  });

  test("échoue fermé si le routeur central est indisponible", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__jaspeRouter = (window as any).SchoolSafeJaspeCapabilityRouter;
      delete (window as any).SchoolSafeJaspeCapabilityRouter;
      (window as any).SafeAssistant.openWithQuery("Explique le rapport financier");
    });
    await expect(page.locator(".safe-bubble-body")).toContainText("routeur central de capacités est indisponible");
    await page.evaluate(() => {
      (window as any).SchoolSafeJaspeCapabilityRouter = (window as any).__jaspeRouter;
      delete (window as any).__jaspeRouter;
    });
  });

  test("la bulle globale applique le refus central avant les modules métier", async ({ page }) => {
    await page.evaluate(() => (window as any).SafeAssistant.openWithQuery("Ajoute la permission roles.manage à cet utilisateur"));
    const bubble = page.locator(".safe-bubble");
    await expect(bubble).toContainText("ne modifie ni rôle, ni permission, ni portée");
  });
});
