import { expect, test, type Page } from "@playwright/test";
import { domClick, enterDemoWorkspace } from "./helpers";

async function waitForAction(page: Page, action: string) {
  await page.waitForFunction((expected) => (window as any).__SCHOOLSAFE_JASPE3D__?.currentAction === expected, action);
}

test.describe("JASPE 3D — états visuels du logiciel", () => {
  test("alterne plusieurs gestes calmes lorsqu'elle attend dans l'application", async ({ page }) => {
    await page.clock.install();
    await enterDemoWorkspace(page, "admin", async (target) => {
      await target.addInitScript(() => localStorage.setItem("safe_onboarding_done", "1"));
    });
    await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);
    await waitForAction(page, "Idle");

    await page.evaluate(() => {
      const runtime = (window as any).SchoolSafeJaspe3D;
      const nativePlay = runtime.play.bind(runtime);
      (window as any).__jaspeAmbientActions = [];
      runtime.play = (name: string, options?: object) => {
        if (name !== "Idle") (window as any).__jaspeAmbientActions.push(name);
        return nativePlay(name, options);
      };
    });

    await page.clock.runFor(36_000);
    const actions = await page.evaluate(() => (window as any).__jaspeAmbientActions);
    expect(actions.slice(0, 3)).toEqual(["Wave", "Listening", "Agree"]);
    expect(new Set(actions).size).toBeGreaterThanOrEqual(3);
  });

  test("suspend les gestes automatiques lorsque Jaspe est masquée", async ({ page }) => {
    await page.clock.install();
    await enterDemoWorkspace(page, "admin", async (target) => {
      await target.addInitScript(() => localStorage.setItem("safe_onboarding_done", "1"));
    });
    await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);
    await page.getByRole("button", { name: "Masquer Jaspe" }).click();

    await page.evaluate(() => {
      const runtime = (window as any).SchoolSafeJaspe3D;
      const nativePlay = runtime.play.bind(runtime);
      (window as any).__jaspeHiddenActions = [];
      runtime.play = (name: string, options?: object) => {
        if (name !== "Idle") (window as any).__jaspeHiddenActions.push(name);
        return nativePlay(name, options);
      };
    });

    await page.clock.runFor(36_000);
    expect(await page.evaluate(() => (window as any).__jaspeHiddenActions)).toEqual([]);
  });

  test("ne lance aucun geste automatique lorsque les mouvements sont réduits", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install();
    await enterDemoWorkspace(page, "admin", async (target) => {
      await target.addInitScript(() => localStorage.setItem("safe_onboarding_done", "1"));
    });
    await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);

    await page.evaluate(() => {
      const runtime = (window as any).SchoolSafeJaspe3D;
      const nativePlay = runtime.play.bind(runtime);
      (window as any).__jaspeReducedAmbientActions = [];
      runtime.play = (name: string, options?: object) => {
        if (name !== "Idle") (window as any).__jaspeReducedAmbientActions.push(name);
        return nativePlay(name, options);
      };
    });

    await page.clock.runFor(36_000);
    expect(await page.evaluate(() => (window as any).__jaspeReducedAmbientActions)).toEqual([]);
  });

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
