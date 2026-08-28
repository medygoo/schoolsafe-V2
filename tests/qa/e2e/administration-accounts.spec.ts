import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

const STAFF = [
  { id: "staff-1", display_name: "Aline Kabeya", email: "aline@example.test", is_active: true, roles: [{ id: "role-teacher", label: "Enseignant" }] },
  { id: "staff-2", display_name: "Joël Mbuyi", email: "joel@example.test", is_active: false, roles: [] },
];
const ROLES = [
  { id: "role-teacher", code: "teacher", label: "Enseignant" },
  { id: "role-hr", code: "hr", label: "Responsable RH" },
];

async function openAccounts(page: import("@playwright/test").Page, user: Record<string, unknown>) {
  await enterDemoWorkspace(page, "admin");
  await page.route("**/school/staff", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(STAFF) }));
  await page.route("**/school/roles", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ROLES) }));
  await page.locator('button[data-branch="administration"]:visible').first().evaluate((element: HTMLElement) => element.click());
  await page.evaluate((nextUser) => {
    (window as any).SchoolSafeAdministration.setSession(nextUser);
    (window as any).SchoolSafeAdministration.open("accounts");
  }, user);
  await expect(page.locator("[data-administration-accounts]")).toBeVisible();
}

test.describe("Phase L2 — comptes, personnel et rôles", () => {
  test("staff.read affiche les comptes sans autoriser les mutations", async ({ page }) => {
    await openAccounts(page, {
      permissions: ["staff.read"],
      scopes: [{ permission: "staff.read", type: "school" }],
    });

    const accounts = page.locator("[data-administration-accounts]");
    await expect(accounts.getByText("Aline Kabeya")).toBeVisible();
    await expect(accounts.getByText("Joël Mbuyi")).toBeVisible();
    await expect(accounts.getByRole("button", { name: "Attribuer les rôles" })).toHaveCount(0);
    await expect(accounts.getByRole("button", { name: /Activer|Désactiver/ })).toHaveCount(0);
  });

  test("staff.manage sans roles.manage ne peut jamais attribuer un rôle", async ({ page }) => {
    await openAccounts(page, {
      permissions: ["staff.read", "staff.manage"],
      scopes: [
        { permission: "staff.read", type: "school" },
        { permission: "staff.manage", type: "school" },
      ],
    });

    const accounts = page.locator("[data-administration-accounts]");
    await expect(accounts.getByRole("button", { name: "Inviter un membre" })).toBeVisible();
    await expect(accounts.getByRole("button", { name: "Désactiver Aline Kabeya" })).toBeVisible();
    await expect(accounts.getByRole("button", { name: "Attribuer les rôles" })).toHaveCount(0);
    await expect(accounts.getByText("roles.manage requis pour toute attribution")).toBeVisible();
  });

  test("roles.manage avec portée school permet une attribution confirmée via l’API existante", async ({ page }) => {
    let payload: unknown = null;
    await openAccounts(page, {
      permissions: ["staff.read", "roles.manage"],
      scopes: [
        { permission: "staff.read", type: "school" },
        { permission: "roles.manage", type: "school" },
      ],
    });
    await page.route("**/school/staff/staff-1/roles", async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });

    await page.getByRole("button", { name: "Attribuer les rôles à Aline Kabeya" }).click();
    const form = page.locator("[data-role-assignment]");
    await expect(form).toBeVisible();
    await form.getByLabel("Responsable RH").check();
    await expect(form.getByRole("button", { name: "Confirmer l’attribution live" })).toBeDisabled();
    await form.getByLabel("Je confirme cette modification via le backend existant").check();
    await form.getByRole("button", { name: "Confirmer l’attribution live" }).click();
    await expect(page.getByText("Rôles mis à jour par le backend.")).toBeVisible();
    expect(payload).toEqual({ role_ids: ["role-teacher", "role-hr"] });
  });

  test("un DENY explicite sur roles.manage bloque l’attribution", async ({ page }) => {
    await openAccounts(page, {
      permissions: ["staff.read", "roles.manage"],
      deniedPermissions: ["roles.manage"],
      scopes: [
        { permission: "staff.read", type: "school" },
        { permission: "roles.manage", type: "school" },
      ],
    });
    await expect(page.getByRole("button", { name: "Attribuer les rôles" })).toHaveCount(0);
    await expect(page.getByText("DENY roles.manage prioritaire")).toBeVisible();
  });
});
