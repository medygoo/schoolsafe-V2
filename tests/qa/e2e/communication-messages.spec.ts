import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openMessages(page: import("@playwright/test").Page) {
  await page.locator('button[data-branch="communication"]:visible').first().evaluate((element: HTMLElement) => element.click());
  await page.locator('[data-communication-tab="messages"]').evaluate((element: HTMLElement) => element.click());
}

test.describe("Phase K2 — messages bornés", () => {
  test("prépare un brouillon local avec tous les champs attendus", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openMessages(page);

    const form = page.locator("[data-message-form]");
    await expect(form).toBeVisible();
    await expect(form.locator('[name="recipient"]')).toBeVisible();
    await expect(form.locator('[name="subject"]')).toBeVisible();
    await expect(form.locator('[name="content"]')).toBeVisible();
    await expect(form.locator('[name="priority"]')).toBeVisible();
    await expect(form.locator('[name="attachment"]')).toBeVisible();
    await expect(form.locator('[name="date"]')).toBeVisible();
    await expect(form.locator('[name="status"]')).toBeVisible();

    await form.locator('[name="subject"]').fill("Réunion de rentrée");
    await form.locator('[name="content"]').fill("Information de démonstration sans donnée personnelle.");
    await form.locator('button[type="submit"]').click();
    await expect(page.locator("[data-message-draft]")).toContainText("BROUILLON LOCAL");
    await expect(page.locator("[data-message-draft]")).not.toContainText(/envoyé/i);
  });

  test("applique le DENY explicite et la portée effective", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openMessages(page);

    const result = await page.evaluate(() => {
      const api = (window as any).SchoolSafeCommunication;
      const denied = {
        permissions: ["communication.message.send"],
        deniedPermissions: ["communication.message.send"],
        scopes: [{ permission: "communication.message.send", type: "school" }],
      };
      const assigned = {
        permissions: ["communication.message.send"],
        assignedClassIds: ["demo-class-1"],
        scopes: [{ permission: "communication.message.send", type: "assigned_classes" }],
      };
      return {
        denied: api.canPrepareMessage(denied),
        assigned: api.messageRecipients(assigned),
      };
    });

    expect(result.denied).toBe(false);
    expect(result.assigned.map((item: { value: string }) => item.value)).toContain("class:demo-class-1");
    expect(result.assigned.map((item: { value: string }) => item.value)).not.toContain("class:demo-class-2");
  });

  test("limite le Parent à la Direction au sujet de ses propres enfants", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    await openMessages(page);

    const recipients = await page.locator('[name="recipient"] option').allTextContents();
    expect(recipients.join(" ")).toContain("Direction");
    expect(recipients.join(" ")).toContain("Lucas");
    expect(recipients.join(" ")).not.toMatch(/autres parents|enseignants|élèves/i);
    await expect(page.locator("[data-message-boundary]")).toContainText("own_children");
  });

  test("en session live conserve seulement un brouillon mémoire et annonce la vraie limite", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openMessages(page);
    await page.evaluate(() => {
      localStorage.setItem("communication-live-sentinel", "intact");
      (window as any).SchoolSafeCommunication.setSession({
        token: "live-test",
        permissions: ["communication.message.send"],
        scopes: [{ permission: "communication.message.send", type: "school" }],
      });
      (window as any).SchoolSafeCommunication.open("messages");
    });

    const form = page.locator("[data-message-form]");
    await form.locator('[name="subject"]').fill("Message live préparatoire");
    await form.locator('[name="content"]').fill("Contenu éphémère");
    await form.locator('button[type="submit"]').click();

    await expect(page.locator("[data-message-draft]")).toContainText("ENVOI RÉEL — BACKEND_LATER");
    await expect(page.locator("#toast")).not.toHaveClass(/show/);
    expect(await page.evaluate(() => localStorage.getItem("communication-live-sentinel"))).toBe("intact");
    expect(await page.evaluate(() => Object.keys(localStorage).some((key) => /communication.*message/i.test(key)))).toBe(false);
  });
});
