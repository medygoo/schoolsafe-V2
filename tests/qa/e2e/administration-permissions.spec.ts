import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openPermissions(page: import("@playwright/test").Page) {
  await enterDemoWorkspace(page, "admin");
  await page.locator('button[data-branch="administration"]:visible').first().evaluate((element: HTMLElement) => element.click());
  await page.evaluate(() => {
    (window as any).SchoolSafeSchoolAPI.listPermissions = async () => [
      { code: "invented.permission.manage", label: "Permission inventée", scope: "school" },
    ];
    (window as any).SchoolSafeAdministration.open("permissions");
  });
  await expect(page.locator("[data-permission-catalog]")).toBeVisible();
  await expect(page.locator("[data-permission-row]").first()).toBeVisible();
}

test.describe("Phase L3 — catalogue canonique des permissions", () => {
  test("charge uniquement shared/permissions.json via SchoolSafeAccess", async ({ page }) => {
    await openPermissions(page);
    const catalog = page.locator("[data-permission-catalog]");

    await expect(catalog.getByText("Source canonique · shared/permissions.json")).toBeVisible();
    await expect(catalog.getByText("school.manage", { exact: true })).toBeVisible();
    await expect(catalog.getByText("safe.assistant.use", { exact: true })).toBeVisible();
    await expect(catalog.getByText("invented.permission.manage", { exact: true })).toHaveCount(0);
    await expect(catalog.getByRole("button", { name: /Créer|Renommer|Supprimer/ })).toHaveCount(0);
  });

  test("recherche et filtre par domaine, opération, portée et code", async ({ page }) => {
    await openPermissions(page);
    const catalog = page.locator("[data-permission-catalog]");

    await catalog.getByLabel("Rechercher une permission").fill("rapport");
    await expect(catalog.getByText("finance.report.read", { exact: true })).toBeVisible();
    await expect(catalog.getByText("school.manage", { exact: true })).toHaveCount(0);

    await catalog.getByLabel("Rechercher une permission").fill("");
    await catalog.getByLabel("Domaine").selectOption("pedagogy");
    await catalog.getByLabel("Opération").selectOption("manage");
    await catalog.getByLabel("Portée").selectOption("assigned_classes");
    const rows = catalog.locator("[data-permission-row]");
    await expect(rows).toHaveCount(3);
    await expect(catalog.getByText("pedagogy.assignment.manage", { exact: true })).toBeVisible();
    await expect(catalog.getByText("pedagogy.grade.manage", { exact: true })).toBeVisible();
    await expect(catalog.getByText("pedagogy.lesson-plan.manage", { exact: true })).toBeVisible();

    await catalog.getByLabel("Code exact").fill("pedagogy.grade.manage");
    await expect(rows).toHaveCount(1);
  });

  test("reste fermé sans roles.manage avec portée school", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.locator('button[data-branch="administration"]:visible').first().evaluate((element: HTMLElement) => element.click());
    await page.evaluate(() => {
      (window as any).SchoolSafeAdministration.setSession({
        role: "admin",
        permissions: ["roles.manage"],
        deniedPermissions: ["roles.manage"],
        scopes: [{ permission: "roles.manage", type: "school" }],
      });
      (window as any).SchoolSafeAdministration.open("permissions");
    });
    await expect(page.getByText("Catalogue non autorisé")).toBeVisible();
    await expect(page.locator("[data-permission-row]")).toHaveCount(0);
  });
});
