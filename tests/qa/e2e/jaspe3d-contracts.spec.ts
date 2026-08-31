import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { domClick, enterDemoWorkspace } from "./helpers";

const ROOT = process.cwd();
const normalizedSha256 = (relative: string) => createHash("sha256")
  .update(readFileSync(path.resolve(ROOT, relative), "utf8").replace(/\r\n/g, "\n"), "utf8")
  .digest("hex");

test.describe("JASPE 3D — contrats accès, fallback et performance", () => {
  test.describe.configure({ mode: "serial" });

  test("laisse Access_Law gelée et n’introduit aucun appel métier", () => {
    expect(normalizedSha256("shared/permissions.json")).toBe("6cfa44ce804bc7fc22985a1ba6e3c8d4afe95b092ec1fa4ce29403fa1438373f");
    expect(normalizedSha256("app/modules/core/access.js")).toBe("319d5e5aab7545f186b5c57cb742cee1f72093e75dec2f70099b4b879ac7b0e7");

    const runtime = readFileSync(path.resolve(ROOT, "app/modules/jaspe3d/jaspe3d-runtime.js"), "utf8");
    const loader = readFileSync(path.resolve(ROOT, "app/modules/jaspe3d/jaspe3d-loader.js"), "utf8");
    expect(runtime + loader).not.toMatch(/supabase|\/api\/|workers?|migration|sql|rls/i);
  });

  test("reste fluide, unique et sans requête backend lors des animations", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);
    await page.waitForFunction(() => Number((window as any).__SCHOOLSAFE_JASPE3D__?.fps) > 0);

    const before = await page.evaluate(() => {
      const canvas = document.querySelector(".safe-3d-stage canvas") as HTMLElement;
      canvas.dataset.runtimeIdentity = "jaspe-singleton";
      (window as any).__jaspeUnexpectedFetches = [];
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const url = String(args[0] instanceof Request ? args[0].url : args[0]);
        if (/supabase|\/api\//i.test(url)) (window as any).__jaspeUnexpectedFetches.push(url);
        return nativeFetch(...args);
      };
      return (window as any).__SCHOOLSAFE_JASPE3D__;
    });

    expect(before.loadMs).toBeLessThan(15000);
    expect(before.fps).toBeGreaterThan(0);
    expect(before.instanceCount).toBe(1);
    expect(before.rendererInfo.geometries).toBeGreaterThanOrEqual(0);
    expect(before.rendererInfo.textures).toBeGreaterThanOrEqual(0);

    for (const animation of ["Wave", "Listening", "TalkHandsOpen", "Agree", "Shrug", "Idle"]) {
      await page.evaluate((name) => (window as any).SchoolSafeJaspe3D.play(name, { once: name !== "Idle" && name !== "Listening" }), animation);
      await page.waitForFunction((name) => (window as any).__SCHOOLSAFE_JASPE3D__?.currentAction === name, animation);
    }
    await domClick(page, ".safe-avatar");
    await domClick(page, ".safe-bubble-close");

    expect(await page.evaluate(() => (window as any).__jaspeUnexpectedFetches)).toEqual([]);
    expect(await page.locator('.safe-3d-stage canvas[data-runtime-identity="jaspe-singleton"]').count()).toBe(1);
    expect(await page.locator(".safe-3d-stage canvas").count()).toBe(1);
  });

  test("reste contenu à 1440, 834 et 390 px en clair et bleu nuit", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);

    for (const viewport of [{ width: 1440, height: 900 }, { width: 834, height: 1112 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      for (const theme of ["light", "dark"]) {
        await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
        await page.waitForTimeout(150);
        const layout = await page.evaluate(() => {
          const avatar = document.querySelector(".safe-avatar")!.getBoundingClientRect();
          const bottomNav = document.querySelector(".ss-bottom-nav")?.getBoundingClientRect();
          return {
            overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
            avatarInside: avatar.left >= 0 && avatar.right <= window.innerWidth && avatar.top >= 0 && avatar.bottom <= window.innerHeight,
            avoidsBottomNav: !bottomNav || bottomNav.height === 0 || avatar.bottom <= bottomNav.top,
            canvasCount: document.querySelectorAll(".safe-3d-stage canvas").length,
          };
        });
        expect(layout, `${viewport.width}px ${theme}`).toEqual({ overflow: false, avatarInside: true, avoidsBottomNav: true, canvasCount: 1 });
      }
    }
  });

  test("conserve l’assistant HTML si le GLB échoue", async ({ page }) => {
    await enterDemoWorkspace(page, "admin", async (target) => {
      await target.route("**/jaspe-web-v2.glb", (route) => route.abort("failed"));
    });
    await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.errors?.length > 0);
    await page.evaluate(() => (window as any).SafeAssistant.openWithQuery("Qui es-tu ?"));
    await expect(page.locator(".safe-bubble-body")).toContainText("assistante SchoolSafe");
    await expect(page.locator(".safe-3d-stage.is-fallback")).toHaveCount(1);
    await expect(page.locator(".safe-3d-fallback-label")).toContainText("Jaspe");
    const fallback = await page.locator(".safe-avatar").boundingBox();
    expect(fallback!.width).toBeLessThanOrEqual(80);
    expect(fallback!.height).toBeLessThanOrEqual(80);
  });

  test("affiche un fallback discret à la Connexion si le GLB échoue", async ({ page }) => {
    await page.route("**/jaspe-web-v2.glb", (route) => route.abort("failed"));
    await page.goto("/", { waitUntil: "load" });
    await domClick(page, "#enterSplash");
    await domClick(page, "#continueGuardian");
    await expect(page.locator("#auth.active")).toBeVisible();
    await expect(page.locator(".safe-3d-fallback-label")).toContainText("Jaspe");
    const layout = await page.evaluate(() => {
      const avatar = document.querySelector(".safe-avatar")!.getBoundingClientRect();
      const form = document.querySelector("#loginForm")!.getBoundingClientRect();
      return {
        width: avatar.width,
        height: avatar.height,
        overlap: Math.max(0, Math.min(avatar.right, form.right) - Math.max(avatar.left, form.left))
          * Math.max(0, Math.min(avatar.bottom, form.bottom) - Math.max(avatar.top, form.top)),
      };
    });
    expect(layout.width).toBeLessThanOrEqual(80);
    expect(layout.height).toBeLessThanOrEqual(80);
    expect(layout.overlap).toBe(0);
  });

  test("conserve l’assistant HTML si WebGL est indisponible", async ({ page }) => {
    await page.addInitScript(() => {
      const nativeGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type: string, ...args: any[]) {
        if (/webgl/i.test(type)) return null;
        return nativeGetContext.call(this, type as any, ...args as any);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await enterDemoWorkspace(page, "admin");
    await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.errors?.length > 0);
    await page.evaluate(() => (window as any).SafeAssistant.openWithQuery("Qui es-tu ?"));
    await expect(page.locator(".safe-bubble-body")).toContainText("assistante SchoolSafe");
    await expect(page.locator(".safe-3d-stage.is-fallback")).toHaveCount(1);
  });

  test("masque Jaspe et refuse son runtime sans safe.assistant.use + own", async ({ page }) => {
    await enterDemoWorkspace(page, "secretary");
    expect(await page.evaluate(() => (window as any).SafeAssistant.isAllowed())).toBe(false);
    await expect(page.locator(".safe-assistant")).toBeHidden();
    expect(await page.evaluate(() => (window as any).__SCHOOLSAFE_JASPE3D__?.instanceCount)).toBe(0);
  });

  test("annule un GLB retardé si un DENY intervient pendant le chargement", async ({ page }) => {
    const glb = readFileSync(path.resolve(ROOT, "app/assets/jaspe3d/jaspe-web-v2.glb"));
    await page.route("**/jaspe-web-v2.glb", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({ status: 200, contentType: "model/gltf-binary", body: glb });
    });
    await enterDemoWorkspace(page, "admin");
    await page.evaluate(() => {
      (window as any).currentSession = null;
      (window as any).SchoolSafeAppContext.getCurrentUser = () => ({
        permissions: ["safe.assistant.use"],
        deniedPermissions: ["safe.assistant.use"],
        scopes: [{ permission: "safe.assistant.use", type: "own" }],
      });
      (window as any).SafeAssistant.refreshAccess();
    });
    await page.waitForTimeout(900);

    await expect(page.locator(".safe-assistant, .safe-3d-stage canvas")).toHaveCount(0);
    expect(await page.evaluate(() => ({
      loaded: (window as any).__SCHOOLSAFE_JASPE3D__?.loaded,
      instances: (window as any).__SCHOOLSAFE_JASPE3D__?.instanceCount,
    }))).toEqual({ loaded: false, instances: 0 });
  });
});
