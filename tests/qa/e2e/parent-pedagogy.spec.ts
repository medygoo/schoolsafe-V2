import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openPedagogy(page: any) {
  await page.locator('[data-parent-shortcut="pédagogie"]').click();
  const view = page.locator(".parent-pedagogy");
  await expect(view).toBeVisible();
  return view;
}

test.describe("C4-FE — suivi pédagogique Parent", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
  });

  test("présente le suivi autorisé de l’enfant sélectionné en consultation seule", async ({ page }) => {
    const view = await openPedagogy(page);
    await expect(view).toContainText("Lucas Martin");
    for (const heading of ["Devoirs", "Évaluations", "Moyennes", "Bulletin", "Palmarès", "Difficultés et suivi", "Rattrapage"]) {
      await expect(view.getByRole("heading", { name: heading })).toBeVisible();
    }
    await expect(view).toContainText("Mathématiques");
    await expect(view).toContainText("14 / 20");
    await expect(view.locator("input, textarea, select")).toHaveCount(0);
    await expect(view.getByRole("button", { name: /modifier|publier|enregistrer|supprimer|ajouter/i })).toHaveCount(0);
  });

  test("suit le sélecteur own_children sans exposer un autre enfant", async ({ page }) => {
    await page.locator("#parentChildSelect").selectOption("demo-parent-child-emma");
    const view = await openPedagogy(page);
    await expect(view).toContainText("Emma Martin");
    await expect(view).not.toContainText("Lucas Martin");
    await expect(view).not.toContainText("Ethan Leroy");
  });

  test("fait primer le DENY explicite sur la permission pédagogique", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).SchoolSafeParentPortal.render("parentPortal", {
        role: "parent",
        permissions: ["school.student.read", "pedagogy.grade.read"],
        deniedPermissions: ["pedagogy.grade.read"],
        childIds: ["demo-parent-child-lucas"],
        scopes: [
          { permission: "school.student.read", type: "own_children" },
          { permission: "pedagogy.grade.read", type: "own_children" },
        ],
      });
    });
    const view = await openPedagogy(page);
    await expect(view.locator(".parent-pedagogy-denied")).toContainText("Suivi pédagogique non autorisé");
    await expect(view.getByRole("heading", { name: "Évaluations" })).toHaveCount(0);
  });

  test("refuse l’accès direct au suivi d’un enfant hors périmètre", async ({ page }) => {
    const opened = await page.evaluate(() => {
      const portal = (window as any).SchoolSafeParentPortal;
      return portal.openPedagogy("demo-unrelated-child-ethan", {
        role: "parent",
        permissions: ["school.student.read", "pedagogy.grade.read"],
        childIds: ["demo-parent-child-lucas"],
        scopes: [
          { permission: "school.student.read", type: "own_children" },
          { permission: "pedagogy.grade.read", type: "own_children" },
        ],
      });
    });
    expect(opened).toBe(false);
    await expect(page.locator(".parent-pedagogy")).toHaveCount(0);
  });

  test("n’invente aucune donnée pédagogique officielle pour un dossier en préparation", async ({ page }) => {
    await page.locator("#parentChildSelect").selectOption("demo-draft-student");
    const view = await openPedagogy(page);
    await expect(view).toContainText("EN PRÉPARATION");
    await expect(view).toContainText("Aucune donnée pédagogique officielle");
    await expect(view).not.toContainText("14 / 20");
  });
});
