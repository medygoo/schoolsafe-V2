import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openNotifications(page: import("@playwright/test").Page) {
  await page.locator('button[data-branch="communication"]:visible').first().evaluate((element: HTMLElement) => element.click());
  await page.locator('[data-communication-tab="notifications"]').evaluate((element: HTMLElement) => element.click());
}

test.describe("Phase K5 — notifications", () => {
  test("gère uniquement ses préférences et affiche un historique démo", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openNotifications(page);

    for (const category of ["Sécurité", "Présence", "Pédagogie", "Finance", "Administration", "Communication"]) {
      await expect(page.locator("[data-notification-categories]").getByText(category, { exact: true })).toBeVisible();
    }
    const form = page.locator("[data-notification-preferences]");
    await expect(form).toContainText("notification.subscribe");
    await expect(form.locator('[name="subscription"]')).toBeVisible();
    await expect(form.locator('[name="channel"]')).toHaveCount(3);
    await form.locator('[name="subscription"]').selectOption("opt-out");
    await form.locator('button[type="submit"]').click();
    await expect(page.locator("[data-notification-state]")).toContainText("DÉSACTIVÉES");
    await expect(page.locator("[data-notification-history]")).toContainText("HISTORIQUE DÉMO");
  });

  test("notification.subscribe + own ne permet jamais d’envoyer ou de lire toutes les notifications", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openNotifications(page);

    const result = await page.evaluate(() => {
      const api = (window as any).SchoolSafeCommunication;
      const allowed = {
        permissions: ["notification.subscribe"],
        scopes: [{ permission: "notification.subscribe", type: "own" }],
      };
      const denied = { ...allowed, deniedPermissions: ["notification.subscribe"] };
      return {
        allowed: api.canManageOwnNotifications(allowed),
        denied: api.canManageOwnNotifications(denied),
        canSend: api.canSendNotification(allowed),
      };
    });
    expect(result).toEqual({ allowed: true, denied: false, canSend: false });
    await expect(page.locator("[data-notification-send]")).toHaveCount(0);
    await expect(page.locator("[data-notification-boundary]")).toContainText("ni envoyer, ni gérer, ni lire toutes les notifications");
  });

  test("en live masque l’historique fictif et garde Push sous BACKEND_LATER", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openNotifications(page);
    await page.evaluate(() => {
      (window as any).SchoolSafeCommunication.setSession({
        token: "live-test",
        permissions: ["notification.subscribe"],
        scopes: [{ permission: "notification.subscribe", type: "own" }],
      });
      (window as any).SchoolSafeCommunication.open("notifications");
    });

    await expect(page.locator("[data-notification-history]")).toHaveCount(0);
    await expect(page.locator("[data-notification-boundary]")).toContainText("PUSH — BACKEND_LATER");
    await expect(page.locator("[data-notification-security-boundary]")).toContainText("permissions Sécurité d’origine");
    await expect(page.locator("[data-notification-boundary]")).not.toContainText(/OneSignal|Webpushr/i);
  });
});
