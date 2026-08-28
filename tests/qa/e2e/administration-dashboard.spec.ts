import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openAdministration(page: import("@playwright/test").Page) {
  const entry = page.locator('button[data-branch="administration"]:visible').first();
  await expect(entry).toBeVisible();
  await entry.evaluate((element: HTMLElement) => element.click());
  await expect(page.locator("#administrationModule")).toBeVisible();
}

test.describe("Phase L1 — centre Administration", () => {
  test("ouvre un centre transversal sans dupliquer École ni Personnel", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAdministration(page);

    const module = page.locator("#administrationModule");
    await expect(module.getByRole("heading", { name: "Centre Administration" })).toBeVisible();
    await expect(module.getByText("École", { exact: true }).first()).toBeVisible();
    await expect(module.getByText("Comptes et personnel", { exact: true }).first()).toBeVisible();
    await expect(module.getByText("Rôles", { exact: true }).first()).toBeVisible();
    await expect(module.getByText("Permissions", { exact: true }).first()).toBeVisible();
    await expect(module.getByText("Accès effectifs", { exact: true }).first()).toBeVisible();
    await expect(module.getByText("Exceptions / DENY", { exact: true }).first()).toBeVisible();
    await expect(module.getByText("Jaspe", { exact: true }).first()).toBeVisible();
    await expect(module.getByText("Paramètres frontend", { exact: true }).first()).toBeVisible();
    await expect(module.getByText("Ouvrir le module École", { exact: true })).toBeVisible();
    await expect(module.getByText("Ouvrir le module Personnel / RH", { exact: true })).toBeVisible();
  });

  test("masque chaque section sans sa permission exacte et ne donne aucun bypass au rôle admin", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAdministration(page);

    await page.evaluate(() => {
      (window as any).SchoolSafeAdministration.setSession({
        role: "admin",
        permissions: ["safe.assistant.use"],
        scopes: [{ permission: "safe.assistant.use", type: "own" }],
      });
    });

    const module = page.locator("#administrationModule");
    await expect(module.locator('[data-admin-section="jaspe"]')).toBeVisible();
    await expect(module.locator('[data-admin-section="school"]')).toHaveCount(0);
    await expect(module.locator('[data-admin-section="staff"]')).toHaveCount(0);
    await expect(module.locator('[data-admin-section="roles"]')).toHaveCount(0);
    await expect(module.getByText("1 domaine autorisé sur 8")).toBeVisible();
  });

  test("un DENY explicite retire une section pourtant accordée", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAdministration(page);

    await page.evaluate(() => {
      (window as any).SchoolSafeAdministration.setSession({
        permissions: ["school.manage", "staff.read"],
        deniedPermissions: ["staff.read"],
        scopes: [
          { permission: "school.manage", type: "school" },
          { permission: "staff.read", type: "school" },
        ],
      });
    });

    const module = page.locator("#administrationModule");
    await expect(module.locator('[data-admin-section="school"]')).toBeVisible();
    await expect(module.locator('[data-admin-section="staff"]')).toHaveCount(0);
    await expect(module.getByText("DENY explicite prioritaire")).toBeVisible();
  });
});
