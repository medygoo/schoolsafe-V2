import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

const ROOT = process.cwd();
const read = (relative: string) => readFileSync(path.resolve(ROOT, relative), "utf8");

test.describe("JASPE 3D — retrait de la présentation 2D", () => {
  test("supprime le catalogue 2D, ses poses et toutes ses références actives", () => {
    expect(existsSync(path.resolve(ROOT, "app/safe2d"))).toBe(false);

    const presentationSources = [
      "app/index.html",
      "app/app.js",
      "app/modules/safe/safe-assistant.js",
      "app/modules/safe/safe-assistant.css",
      "app/modules/parent/parent-portal-demo.js",
      "app/modules/pedagogy/teacher-pedagogy-demo.js",
      "app/styles/dashboard.css",
      "app/styles/modules/parent-portal.css",
      "app/styles/modules/teacher-pedagogy.css",
      "app/styles/modules/deep-school-harmony.css",
    ].map(read).join("\n");

    expect(presentationSources).not.toMatch(/safe2d|safe_(?:sourire|pointe|salue|clin|saute|accueil|reflechie|pouce|pense|marche|livre|assise)/i);
    expect(read("app/modules/safe/safe-assistant.js")).not.toMatch(/state\.pose|(?:^|[,{]\s*)pose\s*:/im);
    expect(presentationSources).not.toMatch(/class=["'][^"']*jaspe-avatar|parent-jaspe-avatar|teacher-jaspe-avatar/i);
    expect(presentationSources).not.toMatch(/safe-3d-fallback\s+img|jaspe-avatar\s+img/i);
  });

  test("remplace chaque ancienne image par un accès HTML vers l’unique Jaspe 3D", async ({ page }) => {
    const missingAssets: string[] = [];
    page.on("response", (response) => {
      if (response.status() === 404) missingAssets.push(response.url());
    });

    await enterDemoWorkspace(page, "admin");
    await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);

    expect(await page.locator('img[src*="safe2d"], img[src*="safe_"]').count()).toBe(0);
    await expect(page.locator('[data-open-jaspe="dashboard"]:visible')).toHaveCount(1);
    await expect(page.locator(".safe-3d-fallback")).toContainText("Jaspe reste disponible");
    expect(missingAssets).toEqual([]);
  });

  test("nomme toujours l’assistant visible Jaspe, y compris pendant l’onboarding", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("safe_onboarding_done"));
    await page.route("**/assistant-name-fixture", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "text/html",
        body: '<!doctype html><html lang="fr"><body class="screen-workspace"><button type="button" data-open-jaspe="fixture">Ouvrir Jaspe</button><script src="/modules/safe/safe-assistant.js"></script></body></html>',
      });
    });
    await page.goto("/assistant-name-fixture", { waitUntil: "load" });

    const assistant = page.locator(".safe-assistant");
    await expect(assistant).toHaveAttribute("aria-label", "Assistant Jaspe");
    await expect(page.locator(".safe-bubble-header strong")).toHaveText("Jaspe");
    await expect(page.locator(".safe-bubble-body p")).toContainText("Je suis Jaspe");

    await page.getByRole("button", { name: "Plus tard" }).click();
    await page.locator('[data-open-jaspe="fixture"]').click();
    await expect(page.locator(".safe-bubble-body p")).toContainText("Je suis Jaspe");

    await enterDemoWorkspace(page, "admin");
    await page.locator('[data-open-jaspe="dashboard"]:visible').click();
    await page.locator("#safeInput").fill("Qui es-tu ?");
    await page.locator("#safeSend").click();
    await expect(page.locator(".safe-bubble-body p")).toContainText("Je suis Jaspe");
  });

  for (const surface of [
    { role: "parent", launcher: '[data-open-jaspe="parent"]' },
    { role: "teacher", launcher: '[data-open-jaspe="teacher"]' },
  ]) {
    test("la surface " + surface.role + " ouvre le même assistant 3D", async ({ page }) => {
      await enterDemoWorkspace(page, surface.role);
      await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);
      await expect(page.locator(surface.launcher)).toBeVisible();
      await page.locator(surface.launcher).click();
      await expect(page.locator(".safe-bubble-body")).toBeVisible();
      await expect(page.locator(".safe-3d-stage canvas")).toHaveCount(1);
    });
  }
});
