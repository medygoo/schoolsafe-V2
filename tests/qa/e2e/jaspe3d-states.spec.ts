import { expect, test, type Page } from "@playwright/test";
import { domClick, enterDemoWorkspace } from "./helpers";

async function waitForAction(page: Page, action: string) {
  await page.waitForFunction((expected) => (window as any).__SCHOOLSAFE_JASPE3D__?.currentAction === expected, action);
}

test.describe("JASPE 3D — états visuels du logiciel", () => {
  test("enchaîne ouverture, écoute, réponse et confirmation puis revient à Idle", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);
    await waitForAction(page, "Idle");

    await domClick(page, ".safe-avatar");
    await waitForAction(page, "Wave");
    await waitForAction(page, "Idle");

    await page.locator("#safeInput").fill("Qui es-tu ?");
    await waitForAction(page, "Listening");
    await page.locator("#safeSend").click();
    await waitForAction(page, "TalkHandsOpen");
    await expect(page.locator(".safe-bubble-body")).toContainText("assistante SchoolSafe");
    await waitForAction(page, "Idle");

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("safe:event", { detail: { type: "action:success" } })));
    await waitForAction(page, "Agree");
    await waitForAction(page, "Idle");
  });

  test("emploie Shrug pour une incertitude sans changer le résultat métier", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);
    await domClick(page, ".safe-avatar");
    await page.locator("#safeInput").fill("Question totalement inconnue xyz");
    await page.locator("#safeSend").click();
    await waitForAction(page, "Shrug");
    await expect(page.locator(".safe-bubble-body")).toContainText("pas sûre de comprendre");
  });
});
