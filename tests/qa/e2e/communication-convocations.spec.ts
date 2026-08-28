import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openConvocations(page: import("@playwright/test").Page) {
  await page.locator('button[data-branch="communication"]:visible').first().evaluate((element: HTMLElement) => element.click());
  await page.locator('[data-communication-tab="convocations"]').evaluate((element: HTMLElement) => element.click());
}

test.describe("Phase K4 — frontière des convocations", () => {
  test("prépare un brouillon démo complet et un aperçu non officiel", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openConvocations(page);

    const form = page.locator("[data-convocation-form]");
    await expect(form).toBeVisible();
    for (const name of ["reason", "recipient", "child", "date", "time", "place", "contact", "note", "status"]) {
      await expect(form.locator(`[name="${name}"]`)).toBeVisible();
    }
    await form.locator('[name="reason"]').fill("Entretien de démonstration");
    await form.locator('[name="recipient"]').fill("Parent démo");
    await form.locator('[name="child"]').fill("Élève démo");
    await form.locator('button[type="submit"]').click();

    await expect(page.locator("[data-convocation-draft]")).toContainText("BROUILLON LOCAL");
    await expect(page.locator("[data-convocation-preview]")).toContainText("APERÇU NON OFFICIEL");
    await expect(page.locator("[data-convocation-boundary]")).toContainText("PERMISSION CONVOCATION DÉDIÉE REQUISE");
    await expect(page.locator("[data-convocation-boundary]")).toContainText("BACKEND_LATER");
  });

  test("refuse toute convocation live même avec les permissions message, annonce ou email", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openConvocations(page);
    const outcome = await page.evaluate(() => {
      const api = (window as any).SchoolSafeCommunication;
      const user = {
        token: "live-test",
        permissions: ["communication.message.send", "communication.announcement.manage", "email.send"],
        scopes: [
          { permission: "communication.message.send", type: "school" },
          { permission: "communication.announcement.manage", type: "school" },
          { permission: "email.send", type: "school" },
        ],
      };
      api.setSession(user);
      api.open("convocations");
      return api.canPrepareConvocation(user);
    });
    expect(outcome).toBe(false);
    await expect(page.locator("[data-convocation-form]")).toHaveCount(0);
    await expect(page.locator("[data-convocation-live-denied]")).toContainText("PERMISSION CONVOCATION DÉDIÉE REQUISE");
  });

  test("une permission de classe Enseignant ne devient jamais une convocation individuelle", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await page.evaluate(() => {
      (window as any).SchoolSafeCommunication.setSession({
        token: "live-teacher",
        role: "teacher",
        permissions: ["communication.message.send"],
        assignedClassIds: ["demo-class-1"],
        scopes: [{ permission: "communication.message.send", type: "assigned_classes" }],
      });
      (window as any).SchoolSafeAppContext.openCommunication("convocations");
    });
    await expect(page.locator("[data-convocation-form]")).toHaveCount(0);
    await expect(page.locator("[data-convocation-live-denied]")).toContainText("message de classe ≠ convocation individuelle");
  });
});
