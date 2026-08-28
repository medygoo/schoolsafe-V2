import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openInspector(page: import("@playwright/test").Page) {
  await enterDemoWorkspace(page, "admin");
  await page.locator('button[data-branch="administration"]:visible').first().evaluate((element: HTMLElement) => element.click());
  await page.evaluate(() => (window as any).SchoolSafeAdministration.open("inspector"));
  await expect(page.locator("[data-access-inspector]")).toBeVisible();
}

test.describe("Phase L4 — inspecteur Access_Law", () => {
  test("explique la chaîne sans accorder de bypass administrateur", async ({ page }) => {
    await openInspector(page);
    const inspector = page.locator("[data-access-inspector]");
    for (const label of ["Utilisateur", "Rôle", "Permission", "Portée", "Contexte", "Exception", "Résultat"]) {
      await expect(inspector.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(inspector.getByText("AUTORISÉ", { exact: true }).last()).toBeVisible();

    const noGrant = await page.evaluate(() => (window as any).SchoolSafeAdministration.inspectAccess(
      { role: "admin", permissions: [], scopes: [] },
      "roles.manage",
      "school",
      { schoolId: "school-1" },
    ));
    expect(noGrant.status).toBe("PERMISSION ABSENTE");
  });

  test("DENY explicite gagne avant permission, portée et exception ALLOW", async ({ page }) => {
    await openInspector(page);
    const result = await page.evaluate(() => (window as any).SchoolSafeAdministration.inspectAccess(
      {
        permissions: ["roles.manage"],
        scopes: [{ permission: "roles.manage", type: "school" }],
        permissionExceptions: [
          { permission: "roles.manage", effect: "allow", scope: "school" },
          { permission: "roles.manage", effect: "deny" },
        ],
      },
      "roles.manage",
      "school",
      { schoolId: "school-1" },
    ));
    expect(result.status).toBe("DENY EXPLICITE");
    expect(result.allowed).toBe(false);
  });

  test("distingue scope incompatible et contexte manquant", async ({ page }) => {
    await openInspector(page);
    const results = await page.evaluate(() => {
      const inspect = (window as any).SchoolSafeAdministration.inspectAccess;
      const user = {
        permissions: ["pedagogy.grade.manage"],
        scopes: [{ permission: "pedagogy.grade.manage", type: "assigned_classes" }],
        assignedClassIds: ["class-1"],
      };
      return {
        wrongScope: inspect(user, "pedagogy.grade.manage", "school", { schoolId: "school-1" }),
        missingContext: inspect(user, "pedagogy.grade.manage", "assigned_classes", {}),
        allowed: inspect(user, "pedagogy.grade.manage", "assigned_classes", { classId: "class-1" }),
      };
    });
    expect(results.wrongScope.status).toBe("SCOPE INCOMPATIBLE");
    expect(results.missingContext.status).toBe("CONTEXTE MANQUANT");
    expect(results.allowed.status).toBe("AUTORISÉ");
  });

  test("reconnaît une exception ALLOW avec sa portée sans mutation", async ({ page }) => {
    await openInspector(page);
    const result = await page.evaluate(() => (window as any).SchoolSafeAdministration.inspectAccess(
      {
        permissions: [],
        permissionExceptions: [{ permission: "finance.receipt.read", effect: "allow", scope: "own_children" }],
        childIds: ["child-1"],
      },
      "finance.receipt.read",
      "own_children",
      { childId: "child-1" },
    ));
    expect(result.status).toBe("AUTORISÉ");
    expect(result.exception).toBe("ALLOW");
  });
});
