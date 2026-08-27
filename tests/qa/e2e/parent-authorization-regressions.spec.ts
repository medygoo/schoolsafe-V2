import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

const childScopes = [
  "school.student.read",
  "school.guardian.read",
  "security.pickup.read",
  "security.events.read",
  "pedagogy.assignment.read",
  "pedagogy.grade.read",
  "pedagogy.report.read",
  "palmarques.read",
  "finance.status.read",
  "finance.fee.read",
  "finance.receipt.read",
  "communication.message.send",
].map((permission) => ({ permission, type: "own_children" }));

const parentScopes = [...childScopes, { permission: "safe.assistant.use", type: "own" }];

const fullParent = {
  role: "parent",
  roles: ["parent"],
  permissions: parentScopes.map(({ permission }) => permission),
  childIds: ["demo-parent-child-lucas"],
  scopes: parentScopes,
};

test.describe("Phase C — régressions d’autorisation Parent", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
  });

  test("applique chaque permission pédagogique à son propre panneau", async ({ page }) => {
    await page.evaluate((user) => {
      (window as any).SchoolSafeParentPortal.render("parentPortal", {
        ...user,
        permissionExceptions: [{ permission: "pedagogy.assignment.read", effect: "deny" }],
      });
    }, fullParent);

    await page.locator('[data-parent-shortcut="pédagogie"]').click();
    const view = page.locator(".parent-pedagogy");
    await expect(view).not.toContainText("Exercices sur les fractions");
    await expect(view).toContainText("Devoirs non autorisés");
    await expect(view).toContainText("14 / 20");
  });

  test("sépare statut financier, frais et reçus", async ({ page }) => {
    await page.evaluate((user) => {
      (window as any).SchoolSafeParentPortal.render("parentPortal", {
        ...user,
        deniedPermissions: ["finance.receipt.read"],
      });
    }, fullParent);

    await page.locator('[data-parent-shortcut="finance"]').click();
    const view = page.locator(".parent-finance");
    await expect(view).toContainText("Frais de scolarité");
    await expect(view).not.toContainText("REC-2026-0586");
    await expect(view).toContainText("Reçus non autorisés");
    await expect(view).toContainText("Historique non disponible · BACKEND_LATER");
  });

  test("protège les autorisations de récupération avec security.pickup.read", async ({ page }) => {
    await page.evaluate((user) => {
      (window as any).SchoolSafeParentPortal.render("parentPortal", {
        ...user,
        deniedPermissions: ["security.pickup.read"],
      });
    }, fullParent);

    await page.locator('[data-parent-shortcut="sécurité"]').click();
    const view = page.locator(".parent-security-family");
    await expect(view).not.toContainText("Mireille Wa Kalonji");
    await expect(view).toContainText("Récupérations non autorisées");
    await expect(view).toContainText("Cécile Ngoie Lukusa");
    await expect(view).toContainText("Entrée enregistrée");
  });

  test("ne publie aucun historique de communication sans permission de lecture définie", async ({ page }) => {
    await page.locator('[data-parent-shortcut="communications"]').click();
    const view = page.locator(".parent-communications");
    await expect(view).toContainText("Historique non disponible · BACKEND_LATER");
    await expect(view).not.toContainText("Réunion de rentrée");
    await expect(view.locator("#parentMessageDraft")).toBeVisible();
  });

  test("retire des résumés et raccourcis toute donnée explicitement refusée", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).SchoolSafeParentPortal.render("parentPortal", {
        role: "parent",
        permissions: ["school.student.read"],
        childIds: ["demo-parent-child-lucas"],
        scopes: [{ permission: "school.student.read", type: "own_children" }],
      });
    });

    const summary = page.locator(".parent-dashboard-summary");
    await expect(summary).not.toContainText("Sortie prévue à 16 h 15");
    await expect(summary).not.toContainText("2 devoirs à consulter");
    await expect(summary).not.toContainText("Paiement partiel");
    await expect(page.locator('[data-parent-shortcut="pédagogie"]')).toHaveCount(0);
    await expect(page.locator('[data-parent-shortcut="finance"]')).toHaveCount(0);
    await expect(page.locator('[data-parent-shortcut="sécurité"]')).toHaveCount(0);
    await expect(page.locator('[data-parent-shortcut="communications"]')).toHaveCount(0);
  });

  test("Jaspe reçoit un contexte frais et ignore le singleton Parent après changement de rôle", async ({ page }) => {
    const result = await page.evaluate((user) => {
      const portal = (window as any).SchoolSafeParentPortal;
      return {
        guard: portal.answerJaspe("Résume la situation de mon enfant", {
          activeRole: "guard",
          user: { role: "guard", permissions: [], scopes: [] },
        }),
        liveParent: portal.answerJaspe("Résume la situation de mon enfant", {
          activeRole: "parent",
          user: { ...user, role: undefined, roles: ["parent"], childIds: ["demo-parent-child-emma"] },
        }),
      };
    }, fullParent);

    expect(result.guard).toBeNull();
    expect(result.liveParent.message).toContain("Emma Martin");
    expect(result.liveParent.message).not.toContain("Lucas Martin");

    await page.evaluate(() => {
      (window as any).SchoolSafeAppContext = {
        getAssistantContext: () => ({ activeRole: "guard", user: { role: "guard", permissions: [], scopes: [] } }),
      };
      (window as any).SafeAssistant.openWithQuery("Résume la situation de mon enfant");
    });
    await expect(page.locator(".safe-bubble-body")).not.toContainText("Lucas Martin");
  });

  test("distingue une projection own_children absente d’un refus d’autorisation", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).SchoolSafeParentPortal.render("parentPortal", {
        roles: ["parent"],
        permissions: ["school.student.read"],
        scopes: [{ permission: "school.student.read", type: "own_children" }],
      });
    });
    await expect(page.locator(".parent-portal-unavailable")).toContainText("BACKEND_LATER");
    await expect(page.locator(".parent-portal-denied")).toHaveCount(0);
  });

  test("distingue aucun rattachement et identifiants live non projetés", async ({ page }) => {
    await page.evaluate(() => {
      const portal = (window as any).SchoolSafeParentPortal;
      const user = {
        role: "parent",
        permissions: ["school.student.read"],
        scopes: [{ permission: "school.student.read", type: "own_children" }],
      };
      portal.render("parentPortal", { ...user, childIds: [] });
    });
    await expect(page.locator(".parent-portal-empty")).toContainText("Aucun enfant rattaché");
    await expect(page.locator(".parent-portal-denied")).toHaveCount(0);

    await page.evaluate(() => {
      (window as any).SchoolSafeParentPortal.render("parentPortal", {
        role: "parent",
        permissions: ["school.student.read"],
        scopes: [{ permission: "school.student.read", type: "own_children" }],
        childIds: ["6ad06e7d-ff55-4b50-8e79-978404484321"],
      });
    });
    await expect(page.locator(".parent-portal-unavailable")).toContainText("BACKEND_LATER");
    await expect(page.locator(".parent-portal-denied")).toHaveCount(0);
  });

  test("masque et refuse Jaspe sans safe.assistant.use + scope own", async ({ page }) => {
    const answer = await page.evaluate(() => {
      const portal = (window as any).SchoolSafeParentPortal;
      const user = {
        role: "parent",
        permissions: ["school.student.read"],
        childIds: ["demo-parent-child-lucas"],
        scopes: [{ permission: "school.student.read", type: "own_children" }],
      };
      portal.render("parentPortal", user);
      return portal.answerJaspe("Résume la situation de mon enfant", { activeRole: "parent", user });
    });
    await expect(page.locator(".parent-jaspe-card")).toHaveCount(0);
    expect(answer.message).toContain("REFUS");
  });

  test("le Parent standard ne peut pas suspendre un tuteur historique", async ({ page }) => {
    await page.locator('[data-parent-shortcut="dossier"]').click();
    const dossier = page.locator(".student-central-dossier");
    await expect(dossier).toBeVisible();
    await expect(dossier.getByRole("button", { name: /Suspendre|Rétablir/ })).toHaveCount(0);
  });

  test("masque le portail Parent pendant un module historique puis le restaure", async ({ page }) => {
    await openAction(page, "Frais scolaires");
    await expect(page.locator("#financeModule")).toBeVisible();
    await expect(page.locator("#parentPortal")).toBeHidden();

    await page.locator("#closeFinanceModule").click();
    await expect(page.locator("#financeModule")).toBeHidden();
    await expect(page.locator("#parentPortal")).toBeVisible();
    await expect(page.locator("#dashboardContainer")).toBeHidden();
  });

  test("évite tout identifiant dupliqué lors de l’ouverture pédagogique historique", async ({ page }) => {
    await openAction(page, "Devoirs");
    await expect(page.locator("#pedagogyModule")).toBeVisible();
    await expect(page.locator("#parentPortal")).toBeHidden();
    expect(await page.locator("#parentChildSelect").count()).toBe(1);
  });
});
