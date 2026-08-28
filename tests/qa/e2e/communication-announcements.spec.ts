import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openAnnouncements(page: import("@playwright/test").Page) {
  await page.locator('button[data-branch="communication"]:visible').first().evaluate((element: HTMLElement) => element.click());
  await page.locator('[data-communication-tab="announcements"]').evaluate((element: HTMLElement) => element.click());
}

test.describe("Phase K3 — annonces", () => {
  test("prépare, prévisualise et fait progresser une annonce sans la publier", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openAnnouncements(page);

    const form = page.locator("[data-announcement-form]");
    await expect(form).toBeVisible();
    for (const name of ["title", "content", "audience", "startsOn", "endsOn", "priority"]) {
      await expect(form.locator(`[name="${name}"]`)).toBeVisible();
    }

    await form.locator('[name="title"]').fill("Journée culturelle");
    await form.locator('[name="content"]').fill("Annonce fictive pour prévisualisation.");
    await form.locator('button[type="submit"]').click();

    const draft = page.locator("[data-announcement-draft]");
    await expect(draft).toContainText("BROUILLON");
    await expect(page.locator("[data-announcement-preview]")).toContainText("Journée culturelle");
    await draft.locator("[data-announcement-advance]").click();
    await expect(page.locator("[data-announcement-draft]")).toContainText("À RELIRE");
    await page.locator("[data-announcement-advance]").click();
    await expect(page.locator("[data-announcement-draft]")).toContainText("PRÊT À PUBLIER");
    await expect(page.locator("[data-announcement-draft] header span").first()).toHaveText("PRÊT À PUBLIER");
    expect(await page.evaluate(() => (window as any).SchoolSafeCommunication.getAnnouncementDrafts()[0].status)).toBe("PRÊT À PUBLIER");
    await expect(page.locator("#toast")).not.toHaveClass(/show/);
  });

  test("exige announcement.manage avec portée effective et respecte le DENY", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openAnnouncements(page);

    const result = await page.evaluate(() => {
      const api = (window as any).SchoolSafeCommunication;
      const allowed = {
        permissions: ["communication.announcement.manage"],
        scopes: [{ permission: "communication.announcement.manage", type: "school" }],
      };
      const denied = {
        ...allowed,
        deniedPermissions: ["communication.announcement.manage"],
      };
      return { allowed: api.canPrepareAnnouncement(allowed), denied: api.canPrepareAnnouncement(denied) };
    });
    expect(result).toEqual({ allowed: true, denied: false });
  });

  test("en live maintient la publication réelle sous BACKEND_LATER", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openAnnouncements(page);
    await page.evaluate(() => {
      (window as any).SchoolSafeCommunication.setSession({
        token: "live-test",
        permissions: ["communication.announcement.manage"],
        scopes: [{ permission: "communication.announcement.manage", type: "school" }],
      });
      (window as any).SchoolSafeCommunication.open("announcements");
    });

    await expect(page.locator("[data-announcement-boundary]")).toContainText("PUBLICATION RÉELLE — BACKEND_LATER");
    await expect(page.locator("[data-announcement-publish]")).toBeDisabled();
    await expect(page.locator("[data-announcement-boundary]")).not.toContainText(/notification envoyée|email envoyé/i);
  });
});
