import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

test.describe("C1-FE — dashboard Parent", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
  });

  test("affiche un espace Parent centré sur les enfants liés", async ({ page }) => {
    await expect(page.locator("#parentPortal")).toBeVisible();
    await expect(page.locator("#dashboardContainer")).toBeHidden();
    await expect(page.locator(".parent-dashboard h1")).toContainText("Mes enfants");

    const options = await page.locator("#parentChildSelect option").allTextContents();
    expect(options).toEqual(["Lucas Martin", "Emma Martin", "Amina Mbuyi · EN PRÉPARATION"]);
    expect(options.join(" ")).not.toContain("Ethan Leroy");
  });

  test("présente l’enfant sélectionné et ses informations autorisées", async ({ page }) => {
    await expect(page.locator('[data-parent-selected-child="demo-parent-child-lucas"]')).toBeVisible();
    await expect(page.locator(".parent-child-identity")).toContainText("Lucas Martin");
    await expect(page.locator(".parent-child-identity")).toContainText("6e A");
    await expect(page.locator(".parent-child-identity")).toContainText("2026-2027");
    await expect(page.locator(".parent-dashboard-summary")).toContainText("Présent");
    await expect(page.locator(".parent-dashboard-summary")).toContainText("Devoirs");
    await expect(page.locator(".parent-dashboard-summary")).toContainText("Notification");
    await expect(page.locator(".parent-dashboard-summary")).toContainText("Situation financière");
    await expect(page.locator("[data-parent-shortcut]")).toHaveCount(6);
  });

  test("change d’enfant sans sortir de own_children", async ({ page }) => {
    await page.locator("#parentChildSelect").selectOption("demo-parent-child-emma");
    await expect(page.locator('[data-parent-selected-child="demo-parent-child-emma"]')).toBeVisible();
    await expect(page.locator(".parent-child-identity")).toContainText("Emma Martin");
    await expect(page.locator(".parent-child-identity")).not.toContainText("Lucas Martin");
  });

  test("bloque les opérations officielles pour un enfant en préparation", async ({ page }) => {
    await page.locator("#parentChildSelect").selectOption("demo-draft-student");
    await expect(page.locator('[data-parent-selected-child="demo-draft-student"]')).toBeVisible();
    await expect(page.locator(".parent-child-identity")).toContainText("EN PRÉPARATION");
    await expect(page.locator(".parent-draft-boundary")).toContainText("Aucune opération scolaire officielle");
    await expect(page.locator(".parent-dashboard-summary")).toContainText("Indisponible");
  });

  test("fait primer un DENY explicite sur la permission et la portée", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).SchoolSafeParentPortal.render("parentPortal", {
        role: "parent",
        profile: { id: "demo-parent-1" },
        permissions: ["school.student.read"],
        deniedPermissions: ["school.student.read"],
        childIds: ["demo-parent-child-lucas"],
        scopes: [{ permission: "school.student.read", type: "own_children" }],
      });
    });
    await expect(page.locator(".parent-portal-denied")).toBeVisible();
    await expect(page.locator(".parent-portal-denied")).toContainText("Accès refusé");
    await expect(page.locator(".parent-child-identity")).toHaveCount(0);
  });
});
