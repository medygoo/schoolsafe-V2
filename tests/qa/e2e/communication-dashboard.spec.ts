import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openCommunication(page: import("@playwright/test").Page) {
  await page.locator('button[data-branch="communication"]:visible').first().evaluate((element: HTMLElement) => element.click());
}

test.describe("Phase K1 — tableau de bord Communication", () => {
  test("ouvre toutes les catégories avec des limites frontend explicites", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openCommunication(page);

    const module = page.locator("#communicationModule");
    await expect(module).toBeVisible();
    await expect(module.locator("#communicationModuleTitle")).toHaveText("Communication scolaire");

    for (const label of ["Messages", "Notifications", "Annonces", "Convocations", "Site public / WebSync", "Événements"]) {
      await expect(module.getByText(label, { exact: true }).first()).toBeVisible();
    }

    await expect(module.getByText("DÉMONSTRATION", { exact: true }).first()).toBeVisible();
    await expect(module.getByText(/BACKEND_LATER/).first()).toBeVisible();
  });

  test("ne présente aucun compteur fictif comme une donnée live", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openCommunication(page);
    await page.evaluate(() => {
      (window as any).SchoolSafeCommunication.setSession({
        token: "live-test",
        permissions: [],
        scopes: [],
        denies: [],
      });
      (window as any).SchoolSafeCommunication.open("dashboard");
    });

    const dashboard = page.locator("[data-communication-dashboard]");
    await expect(dashboard).toContainText("SESSION LIVE");
    await expect(dashboard).toContainText("BACKEND_LATER");
    await expect(dashboard.locator("[data-live-counter]")).toHaveCount(0);
    await expect(dashboard).not.toContainText(/\d+\s+(non lus|brouillons|urgentes?)/i);
  });
});
