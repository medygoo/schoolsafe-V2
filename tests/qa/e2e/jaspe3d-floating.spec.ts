import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

const POSITION_KEY = "schoolsafe-v2-jaspe-position";

async function enterWorkspaceWithoutOnboarding(page: Parameters<typeof enterDemoWorkspace>[0]) {
  await enterDemoWorkspace(page, "admin", async (target) => {
    await target.addInitScript((key) => {
      localStorage.setItem("safe_onboarding_done", "1");
      if (!sessionStorage.getItem("jaspe-floating-test-reset")) {
        localStorage.removeItem(key);
        sessionStorage.setItem("jaspe-floating-test-reset", "1");
      }
    }, POSITION_KEY);
  });
  await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);
}

async function avatarLayout(page: Parameters<typeof enterDemoWorkspace>[0]) {
  return page.locator(".safe-avatar").evaluate((element) => {
    const avatar = element.getBoundingClientRect();
    const bottomNav = document.querySelector(".ss-bottom-nav")?.getBoundingClientRect();
    return {
      left: avatar.left,
      top: avatar.top,
      right: avatar.right,
      bottom: avatar.bottom,
      width: avatar.width,
      height: avatar.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      bottomNavTop: bottomNav && bottomNav.height > 0 ? bottomNav.top : window.innerHeight,
    };
  });
}

test.describe("JASPE 3D — personnage flottant et déplaçable", () => {
  test.describe.configure({ mode: "serial" });

  test("se déplace à la souris et restaure sa position après un rerender", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterWorkspaceWithoutOnboarding(page);

    const before = await avatarLayout(page);
    const guidedDefault = await page.evaluate(() => {
      const avatar = document.querySelector(".safe-avatar")!.getBoundingClientRect();
      const anchor = Array.from(document.querySelectorAll(".hero-jaspe-anchor"))
        .find((element) => element.getBoundingClientRect().width > 0)!.getBoundingClientRect();
      return {
        centerX: avatar.left + avatar.width / 2,
        centerY: avatar.top + avatar.height / 2,
        anchorLeft: anchor.left,
        anchorRight: anchor.right,
        anchorTop: anchor.top,
        anchorBottom: anchor.bottom,
      };
    });
    expect(guidedDefault.centerX).toBeGreaterThanOrEqual(guidedDefault.anchorLeft);
    expect(guidedDefault.centerX).toBeLessThanOrEqual(guidedDefault.anchorRight);
    expect(guidedDefault.centerY).toBeGreaterThanOrEqual(guidedDefault.anchorTop);
    expect(guidedDefault.centerY).toBeLessThanOrEqual(guidedDefault.anchorBottom);
    await page.mouse.move(before.left + before.width / 2, before.top + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(180, 220, { steps: 8 });
    await page.mouse.up();

    const moved = await avatarLayout(page);
    expect(Math.abs(moved.left - before.left) + Math.abs(moved.top - before.top)).toBeGreaterThan(80);

    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), POSITION_KEY);
    expect(stored).toEqual(expect.objectContaining({ left: expect.any(Number), top: expect.any(Number) }));
    expect(stored.left).toBeCloseTo(moved.left, 0);
    expect(stored.top).toBeCloseTo(moved.top, 0);

    await page.evaluate(() => (window as any).SafeAssistant.openWithQuery("Qui es-tu ?"));
    await expect(page.locator(".safe-bubble")).toBeVisible();
    const rerendered = await avatarLayout(page);
    expect(rerendered.left).toBeCloseTo(moved.left, 0);
    expect(rerendered.top).toBeCloseTo(moved.top, 0);

    await page.reload({ waitUntil: "load" });
    await expect(page.locator(".safe-avatar")).toHaveCount(0);
    await enterDemoWorkspace(page, "admin");
    await expect(page.locator(".safe-avatar")).toBeVisible();
    const reloaded = await avatarLayout(page);
    expect(reloaded.left).toBeCloseTo(moved.left, 0);
    expect(reloaded.top).toBeCloseTo(moved.top, 0);
  });

  test("se déplace au toucher sans provoquer de scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterWorkspaceWithoutOnboarding(page);

    const before = await avatarLayout(page);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.locator(".safe-avatar").evaluate((element, rect) => {
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      const event = (type: string, x: number, y: number, buttons: number) => new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 41,
        pointerType: "touch",
        isPrimary: true,
        clientX: x,
        clientY: y,
        buttons,
      });
      element.dispatchEvent(event("pointerdown", startX, startY, 1));
      element.dispatchEvent(event("pointermove", 92, 210, 1));
      element.dispatchEvent(event("pointerup", 92, 210, 0));
    }, before);

    const moved = await avatarLayout(page);
    expect(Math.abs(moved.left - before.left) + Math.abs(moved.top - before.top)).toBeGreaterThan(40);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    expect(moved.left).toBeGreaterThanOrEqual(0);
    expect(moved.right).toBeLessThanOrEqual(moved.viewportWidth);
    expect(moved.top).toBeGreaterThanOrEqual(0);
    expect(moved.bottom).toBeLessThanOrEqual(moved.bottomNavTop);
  });

  test("se recadre au resize et garde sa bulle dans le viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterWorkspaceWithoutOnboarding(page);

    const initial = await avatarLayout(page);
    await page.mouse.move(initial.left + initial.width / 2, initial.top + initial.height / 2);
    await page.mouse.down();
    await page.mouse.move(1400, 850, { steps: 5 });
    await page.mouse.up();
    await page.evaluate(() => (window as any).SafeAssistant.openWithQuery("Qui es-tu ?"));

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 834, height: 1112 },
      { width: 1112, height: 834 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.dispatchEvent(new Event("orientationchange")));
      await page.waitForTimeout(80);

      const layout = await page.evaluate(() => {
        const avatar = document.querySelector(".safe-avatar")!.getBoundingClientRect();
        const bubble = document.querySelector(".safe-bubble")!.getBoundingClientRect();
        const nav = document.querySelector(".ss-bottom-nav")?.getBoundingClientRect();
        const direction = Array.from(document.querySelector(".safe-bubble")!.classList)
          .find((name) => name.indexOf("safe-bubble--") === 0) || "";
        return {
          avatarInside: avatar.left >= 0 && avatar.right <= innerWidth && avatar.top >= 0 && avatar.bottom <= innerHeight,
          avoidsNav: !nav || nav.height === 0 || avatar.bottom <= nav.top,
          bubbleInside: bubble.left >= 0 && bubble.right <= innerWidth && bubble.top >= 0 && bubble.bottom <= innerHeight,
          direction,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          canvases: document.querySelectorAll(".safe-3d-stage canvas").length,
        };
      });
      expect(layout, `${viewport.width}x${viewport.height}`).toEqual({
        avatarInside: true,
        avoidsNav: true,
        bubbleInside: true,
        direction: expect.stringMatching(/^safe-bubble--(left|right|top)$/),
        overflow: false,
        canvases: 1,
      });
    }
  });

  test("oriente automatiquement la bulle à gauche, à droite ou au-dessus", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterWorkspaceWithoutOnboarding(page);
    await page.evaluate(() => (window as any).SafeAssistant.openWithQuery("Qui es-tu ?"));
    await expect(page.locator(".safe-bubble")).toHaveAttribute("data-placement", "left");

    let avatar = await avatarLayout(page);
    await page.mouse.move(avatar.left + avatar.width / 2, avatar.top + avatar.height / 2);
    await page.mouse.down();
    await page.mouse.move(70, 420, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator(".safe-bubble")).toHaveAttribute("data-placement", "right");

    await page.setViewportSize({ width: 390, height: 844 });
    avatar = await avatarLayout(page);
    await page.mouse.move(avatar.left + avatar.width / 2, avatar.top + avatar.height / 2);
    await page.mouse.down();
    await page.mouse.move(195, 610, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator(".safe-bubble")).toHaveAttribute("data-placement", "top");

    const bubbleInside = await page.locator(".safe-bubble").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
    });
    expect(bubbleInside).toBe(true);
  });

  test("adapte une présence 3D lisible du desktop au mobile", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterWorkspaceWithoutOnboarding(page);

    for (const expected of [
      { viewport: { width: 1440, height: 900 }, minWidth: 180, minHeight: 250 },
      { viewport: { width: 834, height: 1112 }, minWidth: 140, minHeight: 205 },
      { viewport: { width: 390, height: 844 }, minWidth: 96, minHeight: 145 },
      { viewport: { width: 844, height: 390 }, minWidth: 80, minHeight: 120 },
    ]) {
      await page.setViewportSize(expected.viewport);
      await page.waitForTimeout(80);
      const size = await page.locator(".safe-avatar").evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      expect(size.width, `${expected.viewport.width}x${expected.viewport.height}`).toBeGreaterThanOrEqual(expected.minWidth);
      expect(size.height, `${expected.viewport.width}x${expected.viewport.height}`).toBeGreaterThanOrEqual(expected.minHeight);
    }
  });

  test("cadre le corps complet avec une marge de sécurité réelle", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterWorkspaceWithoutOnboarding(page);

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 834, height: 1112 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(80);
      const framing = await page.evaluate(() => (window as any).__SCHOOLSAFE_JASPE3D__?.framing);
      expect(framing, `${viewport.width}x${viewport.height}`).toEqual(expect.objectContaining({
        minX: expect.any(Number),
        maxX: expect.any(Number),
        minY: expect.any(Number),
        maxY: expect.any(Number),
      }));
      expect(framing.minX).toBeGreaterThanOrEqual(-0.9);
      expect(framing.maxX).toBeLessThanOrEqual(0.9);
      expect(framing.minY).toBeGreaterThanOrEqual(-0.88);
      expect(framing.maxY).toBeLessThanOrEqual(0.88);
    }
  });

  test("ne laisse ni case rigide ni ancien placeholder sous la 3D", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterWorkspaceWithoutOnboarding(page);

    const visual = await page.evaluate(() => {
      const stage = document.querySelector(".safe-3d-stage") as HTMLElement;
      const canvas = stage.querySelector("canvas") as HTMLCanvasElement;
      const stageRect = stage.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const style = getComputedStyle(stage);
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        borderWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
        placeholderCount: stage.querySelectorAll(".safe-3d-fallback, .safe-3d-fallback__mark").length,
        canvasFillsStage: Math.abs(canvasRect.width - stageRect.width) < 1 && Math.abs(canvasRect.height - stageRect.height) < 1,
      };
    });

    expect(visual).toEqual({
      backgroundColor: "rgba(0, 0, 0, 0)",
      backgroundImage: "none",
      borderWidth: "0px",
      boxShadow: "none",
      placeholderCount: 0,
      canvasFillsStage: true,
    });
  });

  test("reste utilisable au clavier, réduit les mouvements et ne bloque pas la navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enterWorkspaceWithoutOnboarding(page);

    await page.locator(".safe-avatar").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".safe-bubble")).toBeVisible();

    const motion = await page.evaluate(() => {
      const avatar = getComputedStyle(document.querySelector(".safe-avatar")!);
      const bubble = getComputedStyle(document.querySelector(".safe-bubble")!);
      return { avatarTransition: avatar.transitionDuration, bubbleAnimation: bubble.animationName };
    });
    expect(motion).toEqual({ avatarTransition: "0s", bubbleAnimation: "none" });

    await page.locator(".safe-bubble-close").click();
    const menu = page.locator('[data-bottom-nav="menu"]');
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.locator("#workspaceSidebar.open")).toBeVisible();

    await page.setViewportSize({ width: 834, height: 1112 });
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(await page.locator(".safe-assistant").count()).toBe(1);
    expect(await page.locator(".safe-3d-stage canvas").count()).toBe(1);
  });
});
