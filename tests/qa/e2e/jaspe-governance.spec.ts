import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openGovernance(page: import("@playwright/test").Page) {
  await enterDemoWorkspace(page, "admin");
  await page.locator('button[data-branch="administration"]:visible').first().evaluate((element: HTMLElement) => element.click());
  await page.evaluate(() => (window as any).SchoolSafeAdministration.open("jaspe"));
  await expect(page.locator("[data-jaspe-governance]")).toBeVisible();
}

test.describe("Phase L6 — gouvernance Jaspe logiciel", () => {
  test("refuse Jaspe sans safe.assistant.use même au rôle admin", async ({ page }) => {
    await openGovernance(page);
    const states = await page.evaluate(() => {
      const policy = (window as any).SchoolSafeJaspeGovernance;
      return {
        missing: policy.evaluateBase({ role: "admin", permissions: [], scopes: [] }),
        wrongScope: policy.evaluateBase({ role: "admin", permissions: ["safe.assistant.use"], scopes: [{ permission: "safe.assistant.use", type: "school" }] }),
        deny: policy.evaluateBase({ role: "admin", permissions: ["safe.assistant.use"], deniedPermissions: ["safe.assistant.use"], scopes: [{ permission: "safe.assistant.use", type: "own" }] }),
      };
    });
    expect(states.missing).toMatchObject({ allowed: false, reason: "SAFE_PERMISSION_ABSENTE" });
    expect(states.wrongScope).toMatchObject({ allowed: false, reason: "SAFE_SCOPE_OWN_REQUIS" });
    expect(states.deny).toMatchObject({ allowed: false, reason: "SAFE_DENY_EXPLICITE" });
  });

  test("un domaine exige après safe la permission métier et sa portée", async ({ page }) => {
    await openGovernance(page);
    const statuses = await page.evaluate(() => {
      const policy = (window as any).SchoolSafeJaspeGovernance;
      const user = {
        userId: "finance-1",
        permissions: ["safe.assistant.use", "finance.report.read", "pedagogy.report.read"],
        deniedPermissions: ["pedagogy.report.read"],
        scopes: [
          { permission: "safe.assistant.use", type: "own" },
          { permission: "finance.report.read", type: "school" },
          { permission: "pedagogy.report.read", type: "school" },
        ],
      };
      return {
        finance: policy.evaluateDomain(user, "finance"),
        pedagogy: policy.evaluateDomain(user, "pedagogy"),
        hr: policy.evaluateDomain(user, "staff"),
      };
    });
    expect(statuses.finance.allowed).toBe(true);
    expect(statuses.finance.permission).toBe("finance.report.read");
    expect(statuses.pedagogy).toMatchObject({ allowed: false, reason: "BUSINESS_DENY_EXPLICITE" });
    expect(statuses.hr).toMatchObject({ allowed: false, reason: "BUSINESS_PERMISSION_ABSENTE" });
  });

  test("la console est informative et ne permet ni pouvoir ni rôle supplémentaire", async ({ page }) => {
    await openGovernance(page);
    const governance = page.locator("[data-jaspe-governance]");
    await expect(governance.getByText("JASPE <= UTILISATEUR", { exact: true })).toBeVisible();
    await expect(governance.getByText("safe.assistant.use", { exact: true }).first()).toBeVisible();
    await expect(governance.getByText("own", { exact: true }).first()).toBeVisible();
    await expect(governance.getByText("AUTORISÉ", { exact: true }).first()).toBeVisible();
    await expect(governance.getByText("REFUSÉ", { exact: true }).first()).toBeVisible();
    await expect(governance.getByRole("button", { name: /Accorder|Activer Jaspe|Modifier les rôles|Ajouter une permission/i })).toHaveCount(0);
    await expect(governance).not.toContainText(/GLB|Blender|Three\.js|mesh|texture|animation 3D/i);
  });
});
