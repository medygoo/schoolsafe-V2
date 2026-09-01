import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openSimulation(page: import("@playwright/test").Page) {
  await enterDemoWorkspace(page, "admin");
  await page.locator('button[data-branch="administration"]:visible').first().evaluate((element: HTMLElement) => element.click());
  await page.evaluate(() => (window as any).SchoolSafeAdministration.open("simulation"));
  await expect(page.locator("[data-access-simulation]")).toBeVisible();
}

test.describe("Phase L5 — simulation Access_Law", () => {
  test("présente une frontière BACKEND_LATER et tous les champs de simulation", async ({ page }) => {
    await openSimulation(page);
    const simulation = page.locator("[data-access-simulation]");
    await expect(simulation.getByText("GESTION FINE ACCESS_LAW — BACKEND_LATER")).toBeVisible();
    await expect(simulation.getByText("SIMULATION UNIQUEMENT")).toBeVisible();
    for (const label of ["Rôle de base", "Permission additionnelle", "Portée", "Effet", "Condition", "Justification"]) {
      await expect(simulation.getByLabel(label)).toBeVisible();
    }
  });

  test("une exception ALLOW simulée autorise le clone sans modifier l’utilisateur réel", async ({ page }) => {
    await openSimulation(page);
    const outcome = await page.evaluate(() => {
      const user = { role: "teacher", permissions: [], scopes: [], permissionExceptions: [], schoolId: "school-1" };
      const before = JSON.stringify(user);
      const simulated = (window as any).SchoolSafeAdministration.simulateAccessLaw(user, {
        baseRole: "teacher",
        permission: "finance.report.read",
        scope: "school",
        effect: "allow",
        condition: "période ouverte",
        justification: "Contrôle temporaire",
        contextId: "school-1",
      });
      return { before, after: JSON.stringify(user), simulated };
    });

    expect(outcome.after).toBe(outcome.before);
    expect(outcome.simulated.result.status).toBe("AUTORISÉ");
    expect(outcome.simulated.result.exception).toBe("ALLOW");
    expect(outcome.simulated.boundary).toBe("SIMULATION UNIQUEMENT");
  });

  test("un DENY simulé l’emporte sur la permission et un ALLOW existant", async ({ page }) => {
    await openSimulation(page);
    const outcome = await page.evaluate(() => (window as any).SchoolSafeAdministration.simulateAccessLaw(
      {
        permissions: ["roles.manage"],
        scopes: [{ permission: "roles.manage", type: "school" }],
        permissionExceptions: [{ permission: "roles.manage", effect: "allow", scope: "school" }],
        schoolId: "school-1",
      },
      { permission: "roles.manage", scope: "school", effect: "deny", contextId: "school-1" },
    ));
    expect(outcome.result.status).toBe("DENY EXPLICITE");
    expect(outcome.result.allowed).toBe(false);
  });

  test("le formulaire ne déclenche aucun endpoint ni stockage persistant", async ({ page }) => {
    let mutations = 0;
    await page.route("**/*", async (route) => {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(route.request().method())) mutations += 1;
      await route.fallback();
    });
    await openSimulation(page);
    const before = await page.evaluate(() => sessionStorage.getItem("schoolsafe-v2-session"));
    const simulation = page.locator("[data-access-simulation]");
    await simulation.getByLabel("Permission additionnelle").fill("roles.manage");
    await simulation.getByLabel("Portée").selectOption("school");
    await simulation.getByLabel("Effet").selectOption("deny");
    await simulation.getByLabel("Justification").fill("Vérification temporaire");
    await simulation.getByRole("button", { name: "Simuler l’impact" }).evaluate((element: HTMLButtonElement) => element.click());
    await expect(simulation.getByText("DENY EXPLICITE", { exact: true }).last()).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem("schoolsafe-v2-session"))).toBe(before);
    expect(mutations).toBe(0);
  });
});
