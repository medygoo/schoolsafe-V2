import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openFinance(page: any) {
  await page.locator('[data-parent-shortcut="finance"]').click();
  const view = page.locator(".parent-finance");
  await expect(view).toBeVisible();
  return view;
}

test.describe("C5-FE — finance et reçus Parent", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
  });

  test("affiche les frais, paiements, reçus et l’historique autorisés", async ({ page }) => {
    const view = await openFinance(page);
    await expect(view).toContainText("Lucas Martin");
    await expect(view.getByRole("heading", { name: "Situation des frais" })).toBeVisible();
    for (const state of ["PAYÉ", "PARTIEL", "EN ATTENTE", "EXEMPTÉ", "ANOMALIE"]) {
      await expect(view.getByText(state, { exact: true })).toBeVisible();
    }
    await expect(view.getByRole("heading", { name: "Paiements enregistrés" })).toBeVisible();
    await expect(view.getByRole("heading", { name: "Reçus" })).toBeVisible();
    await expect(view.getByRole("heading", { name: "Historique" })).toBeVisible();
    await expect(view).toContainText("REC-2026-0586");
  });

  test("reste limité à l’enfant sélectionné", async ({ page }) => {
    await page.locator("#parentChildSelect").selectOption("demo-parent-child-emma");
    const view = await openFinance(page);
    await expect(view).toContainText("Emma Martin");
    await expect(view).toContainText("REC-2026-0585");
    await expect(view).not.toContainText("REC-2026-0586");
    await expect(view).not.toContainText("Ethan Leroy");
  });

  test("ne propose aucun paiement ni pouvoir de caisse", async ({ page }) => {
    const view = await openFinance(page);
    await expect(view.getByText(/PAYER MAINTENANT/i)).toHaveCount(0);
    await expect(view.getByRole("button", { name: /payer|enregistrer|modifier|annuler|créer|supprimer/i })).toHaveCount(0);
    await expect(view.locator("input, textarea, select, form")).toHaveCount(0);
    await expect(view).toContainText("Aucun paiement en ligne");
  });

  test("fait primer le DENY explicite finance", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).SchoolSafeParentPortal.render("parentPortal", {
        role: "parent",
        permissions: ["school.student.read", "finance.status.read"],
        deniedPermissions: ["finance.status.read"],
        childIds: ["demo-parent-child-lucas"],
        scopes: [
          { permission: "school.student.read", type: "own_children" },
          { permission: "finance.status.read", type: "own_children" },
        ],
      });
    });
    const view = await openFinance(page);
    await expect(view.locator(".parent-finance-denied")).toContainText("Situation financière non autorisée");
    await expect(view.getByRole("heading", { name: "Reçus" })).toHaveCount(0);
  });

  test("refuse une ouverture directe pour un enfant non lié", async ({ page }) => {
    const opened = await page.evaluate(() => {
      const portal = (window as any).SchoolSafeParentPortal;
      return portal.openFinance("demo-unrelated-child-ethan", {
        role: "parent",
        permissions: ["school.student.read", "finance.status.read"],
        childIds: ["demo-parent-child-lucas"],
        scopes: [
          { permission: "school.student.read", type: "own_children" },
          { permission: "finance.status.read", type: "own_children" },
        ],
      });
    });
    expect(opened).toBe(false);
    await expect(page.locator(".parent-finance")).toHaveCount(0);
  });

  test("n’invente aucune opération financière pour un dossier en préparation", async ({ page }) => {
    await page.locator("#parentChildSelect").selectOption("demo-draft-student");
    const view = await openFinance(page);
    await expect(view).toContainText("EN PRÉPARATION");
    await expect(view).toContainText("Aucune opération financière officielle");
    await expect(view).not.toContainText("REC-2026-0586");
  });
});
