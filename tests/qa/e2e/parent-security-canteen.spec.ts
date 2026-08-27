import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openSecurity(page: any) {
  await page.locator('[data-parent-shortcut="sécurité"]').click();
  const view = page.locator(".parent-security-family");
  await expect(view).toBeVisible();
  return view;
}

test.describe("C6-FE — sécurité familiale et cantine", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
  });

  test("réutilise le cadre B4 en consultation familiale", async ({ page }) => {
    const view = await openSecurity(page);
    await expect(view).toContainText("Lucas Martin");
    await expect(view.getByRole("heading", { name: "Personnes autorisées" })).toBeVisible();
    await expect(view).toContainText("Mireille Wa Kalonji");
    await expect(view.getByText("AUTORISÉ", { exact: true }).first()).toBeVisible();
    await expect(view).toContainText("Patrick Kabeya Mbuyi");
    await expect(view.getByText("SUSPENDU", { exact: true })).toBeVisible();
    await expect(view.getByRole("heading", { name: "Contact d’urgence" })).toBeVisible();
    await expect(view).toContainText("Cécile Ngoie Lukusa");
    await expect(view.getByRole("heading", { name: "Entrées et sorties" })).toBeVisible();
    await expect(view.getByRole("heading", { name: "Historique des récupérations" })).toBeVisible();
    await expect(view.getByRole("heading", { name: "Alertes de sécurité" })).toBeVisible();
  });

  test("n’accorde aucun pouvoir d’agent de contrôle au Parent", async ({ page }) => {
    const view = await openSecurity(page);
    await expect(view.getByRole("button", { name: /scanner|valider|autoriser|remettre|suspendre|rétablir|modifier|supprimer/i })).toHaveCount(0);
    await expect(view.locator("input, textarea, select, form")).toHaveCount(0);
    await expect(view).toContainText("Consultation uniquement");
  });

  test("reste limité à l’enfant sélectionné", async ({ page }) => {
    await page.locator("#parentChildSelect").selectOption("demo-parent-child-emma");
    const view = await openSecurity(page);
    await expect(view).toContainText("Emma Martin");
    await expect(view).not.toContainText("Lucas Martin");
    await expect(view).not.toContainText("Ethan Leroy");
  });

  test("fait primer le DENY explicite sur les événements de sécurité", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).SchoolSafeParentPortal.render("parentPortal", {
        role: "parent",
        permissions: ["school.student.read", "school.guardian.read", "security.pickup.read", "security.events.read"],
        deniedPermissions: ["security.events.read"],
        childIds: ["demo-parent-child-lucas"],
        scopes: [
          { permission: "school.student.read", type: "own_children" },
          { permission: "school.guardian.read", type: "own_children" },
          { permission: "security.pickup.read", type: "own_children" },
          { permission: "security.events.read", type: "own_children" },
        ],
      });
    });
    const view = await openSecurity(page);
    await expect(view).toContainText("Mireille Wa Kalonji");
    await expect(view.locator(".parent-security-events-denied")).toContainText("Événements de sécurité non autorisés");
    await expect(view.getByRole("heading", { name: "Entrées et sorties" })).toHaveCount(0);
  });

  test("refuse une ouverture directe pour un enfant hors own_children", async ({ page }) => {
    const opened = await page.evaluate(() => {
      const portal = (window as any).SchoolSafeParentPortal;
      return portal.openSecurity("demo-unrelated-child-ethan", {
        role: "parent",
        permissions: ["school.student.read", "school.guardian.read", "security.events.read"],
        childIds: ["demo-parent-child-lucas"],
        scopes: [
          { permission: "school.student.read", type: "own_children" },
          { permission: "school.guardian.read", type: "own_children" },
          { permission: "security.events.read", type: "own_children" },
        ],
      });
    });
    expect(opened).toBe(false);
    await expect(page.locator(".parent-security-family")).toHaveCount(0);
  });

  test("n’invente aucune opération de sécurité pour un dossier en préparation", async ({ page }) => {
    await page.locator("#parentChildSelect").selectOption("demo-draft-student");
    const view = await openSecurity(page);
    await expect(view).toContainText("EN PRÉPARATION");
    await expect(view).toContainText("Aucun événement de sécurité officiel");
  });

  test("présente la cantine comme une fonctionnalité future honnête", async ({ page }) => {
    await page.locator('[data-parent-shortcut="cantine"]').click();
    const view = page.locator(".parent-canteen");
    await expect(view).toBeVisible();
    await expect(view).toContainText("FEATURE_LATER");
    await expect(view).toContainText("Aucun repas, consommation, paiement ou solde n’est inventé");
    await expect(view.locator("input, textarea, select, form")).toHaveCount(0);
  });
});
