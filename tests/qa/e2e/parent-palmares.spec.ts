import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

test.describe("Palmarès — frontières Parent et école", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
  });

  test("offre un vrai point d'entrée Parent et n'affiche que l'enfant lié sélectionné", async ({ page }) => {
    const shortcut = page.locator('[data-parent-shortcut="palmarès"]');
    await expect(shortcut).toBeVisible();
    await shortcut.click();

    const view = page.locator(".parent-palmares");
    await expect(view).toBeVisible();
    await expect(view).toContainText("Lucas Martin");
    await expect(view).toContainText("7e position");
    await expect(view).toContainText("CALCUL_BACKEND_LATER");
    await expect(view).toContainText(/résultats validés/i);
    await expect(view).toContainText(/progression/i);
    await expect(view).toContainText(/effort \/ régularité/i);
    await expect(view).toContainText(/mentions \/ distinctions/i);
    await expect(view).not.toContainText("Emma Martin");
    await expect(view).not.toContainText("Ethan Leroy");
    await expect(view).not.toContainText("Chloé Bernard");
    await expect(view.getByRole("button", { name: /calculer|publier|modifier/i })).toHaveCount(0);
  });

  test("suit own_children sans laisser les données du premier enfant dans la vue", async ({ page }) => {
    await page.locator("#parentChildSelect").selectOption("demo-parent-child-emma");
    await page.locator('[data-parent-shortcut="palmarès"]').click();
    const view = page.locator(".parent-palmares");
    await expect(view).toContainText("Emma Martin");
    await expect(view).toContainText("Non applicable en maternelle");
    await expect(view).not.toContainText("Lucas Martin");
    await expect(view).not.toContainText("7e position");
  });

  test("fait primer le DENY palmarques.read et refuse un enfant non lié", async ({ page }) => {
    const result = await page.evaluate(() => {
      const portal = (window as any).SchoolSafeParentPortal;
      const user = {
        role: "parent",
        permissions: ["school.student.read", "palmarques.read"],
        deniedPermissions: ["palmarques.read"],
        childIds: ["demo-parent-child-lucas"],
        scopes: [
          { permission: "school.student.read", type: "own_children" },
          { permission: "palmarques.read", type: "own_children" },
        ],
      };
      portal.render("parentPortal", user);
      return {
        denied: portal.openPalmares("demo-parent-child-lucas", user),
        unrelated: portal.openPalmares("demo-unrelated-child-ethan", { ...user, deniedPermissions: [] }),
      };
    });
    expect(result).toEqual({ denied: false, unrelated: false });
    await expect(page.locator('[data-parent-shortcut="palmarès"]')).toHaveCount(0);
    await expect(page.locator(".parent-palmares")).toHaveCount(0);
  });

  test("réserve la vue école au scope school et n'invente aucun calcul officiel frontend", async ({ page }) => {
    const content = page.locator("#palmaresContent");
    await page.evaluate(async () => {
      (document.getElementById("palmaresModule") as HTMLElement).hidden = false;
      await (window as any).renderPalmaresModule(document.getElementById("palmaresContent"), {
        roles: ["pedagogy"],
        permissions: ["palmarques.read"],
        scopes: [{ permission: "palmarques.read", type: "assigned_classes" }],
      });
    });
    await expect(content.locator('[data-view="class"]')).toBeVisible();
    await expect(content.locator('[data-view="school"]')).toHaveCount(0);
    await expect(content).toContainText("CALCUL_BACKEND_LATER");
    await expect(content).toContainText("Aucune formule officielle n'est exécutée dans le frontend");

    await page.evaluate(async () => {
      await (window as any).renderPalmaresModule(document.getElementById("palmaresContent"), {
        roles: ["pedagogy"],
        permissions: ["palmarques.read"],
        scopes: [{ permission: "palmarques.read", type: "school" }],
      });
    });
    await expect(content.locator('[data-view="school"]')).toBeVisible();
  });
});
