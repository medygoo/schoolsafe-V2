import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openChannels(page: import("@playwright/test").Page) {
  await page.locator('button[data-branch="communication"]:visible').first().evaluate((element: HTMLElement) => element.click());
  await page.locator('[data-communication-tab="channels"]').evaluate((element: HTMLElement) => element.click());
}

test.describe("Phase K6 — canaux, Email et WebSync", () => {
  test("sépare In-app, Push, Email et Site public", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openChannels(page);
    const channels = page.locator("[data-channel-grid]");
    for (const channel of ["In-app", "Push", "Email", "Site public / WebSync"]) {
      await expect(channels.getByText(channel, { exact: true })).toBeVisible();
    }
    await expect(page.locator("[data-websync-boundary]")).toContainText("PERMISSION FUTURE REQUISE");
    await expect(page.locator("[data-websync-boundary]")).toContainText("BACKEND_LATER");
  });

  test("email.send permet seulement une préparation locale bornée", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openChannels(page);
    const form = page.locator("[data-email-form]");
    await expect(form).toBeVisible();
    await expect(form).toContainText("email.send");
    await form.locator('[name="subject"]').fill("Information de démonstration");
    await form.locator('[name="content"]').fill("Préparation sans envoi réseau.");
    await form.locator('button[type="submit"]').click();
    await expect(page.locator("[data-email-draft]")).toContainText("ENVOI EMAIL — BACKEND_LATER");
    await expect(page.locator("#toast")).not.toHaveClass(/show/);
  });

  test("un DENY email bloque et sync.submit ne devient jamais WebSync", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openChannels(page);
    const result = await page.evaluate(() => {
      const api = (window as any).SchoolSafeCommunication;
      const deniedEmail = {
        permissions: ["email.send"],
        deniedPermissions: ["email.send"],
        scopes: [{ permission: "email.send", type: "school" }],
      };
      const syncOnly = {
        permissions: ["sync.submit"],
        scopes: [{ permission: "sync.submit", type: "own" }],
      };
      return {
        email: api.canPrepareEmail(deniedEmail),
        websync: api.canPublishWebSync(syncOnly),
      };
    });
    expect(result).toEqual({ email: false, websync: false });
  });

  test("les événements restent un aperçu démo et disparaissent comme contenu live", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openChannels(page);
    await page.locator('[data-communication-tab="events"]').evaluate((element: HTMLElement) => element.click());
    await expect(page.locator("[data-events-demo]")).toContainText("APERÇU DÉMO");
    await expect(page.locator("[data-events-publish]")).toBeDisabled();

    await page.evaluate(() => {
      (window as any).SchoolSafeCommunication.setSession({ token: "live-test", permissions: [], scopes: [] });
      (window as any).SchoolSafeCommunication.open("events");
    });
    await expect(page.locator("[data-events-demo]")).toHaveCount(0);
    await expect(page.locator("[data-events-live-boundary]")).toContainText("PERMISSION FUTURE REQUISE");
  });
});
