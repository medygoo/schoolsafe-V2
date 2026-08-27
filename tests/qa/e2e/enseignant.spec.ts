import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, expectBranches, expectNoBranch, openAction } from "./helpers";

test.describe("Profil enseignant", () => {
  test("affiche ses élèves, la pédagogie et la communication", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await expectBranches(page, "teacher");
    await expectNoBranch(page, "finance");
    await expectNoBranch(page, "security");
    await expectNoBranch(page, "pilotage");
  });

  test("peut composer des devoirs et voir les travaux assignés", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await openAction(page, "Devoirs et corrections");
    await expect(page.locator("#pedagogyModule")).toBeVisible();
    await expect(page.locator("#assignmentForm")).toBeVisible();
    await expect(page.locator(".assignment-list")).toContainText("Fractions équivalentes");
    await expect(page.locator(".assignment-list")).toContainText("Reading comprehension");
  });

  test("a un accès certificatif limité", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await openAction(page, "Préparation aux épreuves certificatives");
    await expect(page.locator("#pedagogyModule")).toBeVisible();
    await page.locator('[data-cert-exam="EXETAT"]').click();
    await expect(page.locator('[data-cert-view="stages"]')).toBeVisible();
    await expect(page.locator('[data-cert-view="preparation"]')).toBeVisible();
    await expect(page.locator('[data-cert-view="candidates"]')).toHaveCount(0);
    await expect(page.locator('[data-cert-view="results"]')).toHaveCount(0);
  });
});
