import { expect, test, type Page } from "@playwright/test";
import { domClick, enterDemoWorkspace, openAction } from "./helpers";

const POSITION_KEY = "schoolsafe-v2-jaspe-position";

async function expectNoJaspeSurface(page: Page) {
  await expect(page.locator(".safe-assistant")).toHaveCount(0);
  await expect(page.locator(".safe-3d-stage, .safe-3d-stage canvas")).toHaveCount(0);
}

async function enterWorkspaceAt(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await enterDemoWorkspace(page, "admin", async (target) => {
    await target.addInitScript((key) => {
      localStorage.removeItem(key);
      localStorage.setItem("safe_onboarding_done", "1");
    }, POSITION_KEY);
  });
  await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);
}

async function guidedLayout(page: Page) {
  return page.evaluate(() => {
    const avatar = document.querySelector(".safe-avatar")!.getBoundingClientRect();
    const anchorElement = Array.from(document.querySelectorAll(".hero-jaspe-anchor"))
      .find((element) => element.getBoundingClientRect().width > 0)!;
    const heroElement = anchorElement.closest(".dashboard-hero")!;
    const anchor = anchorElement.getBoundingClientRect();
    const hero = heroElement.getBoundingClientRect();
    const logo = heroElement.querySelector(".hero-illustration")!.getBoundingClientRect();
    return {
      avatar: { left: avatar.left, top: avatar.top, right: avatar.right, bottom: avatar.bottom, width: avatar.width, height: avatar.height },
      anchor: { left: anchor.left, top: anchor.top, right: anchor.right, bottom: anchor.bottom, width: anchor.width, height: anchor.height },
      hero: { left: hero.left, top: hero.top, right: hero.right, bottom: hero.bottom },
      logo: { width: logo.width, height: logo.height },
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      canvases: document.querySelectorAll(".safe-3d-stage canvas").length,
      framing: (window as any).__SCHOOLSAFE_JASPE3D__?.framing,
    };
  });
}

test.describe("JASPE 3D — placement guidé final", () => {
  for (const viewport of [
    { width: 1440, height: 900, label: "desktop" },
    { width: 834, height: 1112, label: "tablette" },
    { width: 390, height: 844, label: "mobile" },
  ]) {
    test(`reste totalement absente du Splash et du Guardian ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "load" });
      await expectNoJaspeSurface(page);
      expect(await page.evaluate(() => (window as any).__SCHOOLSAFE_JASPE3D__?.instanceCount)).toBe(0);
      await domClick(page, "#enterSplash");
      await expect(page.locator("#guardian.active")).toBeVisible();
      await expectNoJaspeSurface(page);
      expect(await page.evaluate(() => (window as any).__SCHOOLSAFE_JASPE3D__?.instanceCount)).toBe(0);
    });
  }

  test("reste absente du Splash et du Guardian puis charge une seule fois sur Connexion", async ({ page }) => {
    let modelRequests = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/assets/jaspe3d/jaspe-web-v2.glb")) modelRequests += 1;
    });

    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("#splash.active")).toBeVisible();
    await expectNoJaspeSurface(page);
    expect(modelRequests).toBe(0);

    await domClick(page, "#enterSplash");
    await expect(page.locator("#guardian.active")).toBeVisible();
    await expectNoJaspeSurface(page);
    expect(modelRequests).toBe(0);

    await domClick(page, "#continueGuardian");
    await expect(page.locator("#auth.active")).toBeVisible();
    await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);
    await expect(page.locator(".safe-avatar")).toBeVisible();
    await expect(page.locator(".safe-3d-stage canvas")).toHaveCount(1);
    expect(modelRequests).toBe(1);

    await domClick(page, "#backToSplash");
    await expect(page.locator("#splash.active")).toBeVisible();
    await expectNoJaspeSurface(page);
    await expect.poll(() => page.evaluate(() => ({
      loaded: (window as any).__SCHOOLSAFE_JASPE3D__?.loaded,
      instances: (window as any).__SCHOOLSAFE_JASPE3D__?.instanceCount,
    }))).toEqual({ loaded: false, instances: 0 });
  });

  test("enchaîne l’accueil Connexion sans recouvrir le formulaire", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/", { waitUntil: "load" });
    await domClick(page, "#enterSplash");

    await page.evaluate(() => {
      const runtime = (window as any).SchoolSafeJaspe3D;
      const nativePlay = runtime.play.bind(runtime);
      (window as any).__jaspeLoginSequence = [];
      runtime.play = (name: string, options?: object) => {
        (window as any).__jaspeLoginSequence.push({ name, options, at: performance.now() });
        return nativePlay(name, options);
      };
    });

    await domClick(page, "#continueGuardian");
    await page.waitForFunction(() => {
      const names = ((window as any).__jaspeLoginSequence || []).map((entry: any) => entry.name);
      return names.includes("Wave") && names.includes("FormalBow") && names.includes("TalkHandsOpen") && names.at(-1) === "Idle";
    }, undefined, { timeout: 8_000 });

    const result = await page.evaluate(() => {
      const avatar = document.querySelector(".safe-avatar")!.getBoundingClientRect();
      const form = document.querySelector("#loginForm")!.getBoundingClientRect();
      const overlapWidth = Math.max(0, Math.min(avatar.right, form.right) - Math.max(avatar.left, form.left));
      const overlapHeight = Math.max(0, Math.min(avatar.bottom, form.bottom) - Math.max(avatar.top, form.top));
      return {
        sequence: (window as any).__jaspeLoginSequence,
        overlapArea: overlapWidth * overlapHeight,
        formEnabled: !(document.querySelector("#emailIdentifier") as HTMLInputElement).disabled,
      };
    });

    let cursor = -1;
    const names = result.sequence.map((entry: any) => entry.name);
    for (const action of ["Wave", "FormalBow", "TalkHandsOpen", "Idle"]) {
      cursor = names.indexOf(action, cursor + 1);
      expect(cursor, action).toBeGreaterThanOrEqual(0);
    }
    const guidedEntries = result.sequence.filter((entry: any) => ["Wave", "FormalBow", "TalkHandsOpen"].includes(entry.name));
    expect(guidedEntries.every((entry: any) => entry.options?.once === true && entry.options?.durationSeconds > 0 && entry.options?.returnToIdle === false)).toBe(true);
    const wave = result.sequence.find((entry: any) => entry.name === "Wave");
    const finalIdle = [...result.sequence].reverse().find((entry: any) => entry.name === "Idle");
    expect(finalIdle.at - wave.at).toBeGreaterThanOrEqual(5_000);
    expect(finalIdle.at - wave.at).toBeLessThanOrEqual(6_000);
    expect(result.overlapArea).toBe(0);
    expect(result.formEnabled).toBe(true);

    await page.locator("#emailIdentifier").fill("parent@example.com");
    await page.locator("#password").fill("secret");
    await page.locator("#togglePassword").click();
    await expect(page.locator("#password")).toHaveAttribute("type", "text");

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 834, height: 1112 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(80);
      const responsive = await page.evaluate(() => {
        const avatar = document.querySelector(".safe-avatar")!.getBoundingClientRect();
        const form = document.querySelector("#loginForm")!.getBoundingClientRect();
        const passwordLabel = document.querySelector(".label-row .ss-label")!.getBoundingClientRect();
        const forgot = document.querySelector("#forgotPassword")!.getBoundingClientRect();
        const intersection = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
          * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return {
          avatarFormOverlap: intersection(avatar, form),
          passwordLabelsOverlap: intersection(passwordLabel, forgot),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          avatarInside: avatar.left >= 0 && avatar.right <= innerWidth && avatar.top >= 0 && avatar.bottom <= innerHeight,
          mobilePasswordStacked: innerWidth > 390 || forgot.top >= passwordLabel.bottom + 2,
        };
      });
      expect(responsive, `${viewport.width}x${viewport.height}`).toEqual({
        avatarFormOverlap: 0,
        passwordLabelsOverlap: 0,
        overflow: false,
        avatarInside: true,
        mobilePasswordStacked: true,
      });
    }
  });

  test("passe directement à Idle à la Connexion avec mouvements réduits", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });
    await domClick(page, "#enterSplash");
    await page.evaluate(() => {
      const runtime = (window as any).SchoolSafeJaspe3D;
      const nativePlay = runtime.play.bind(runtime);
      (window as any).__jaspeReducedLogin = [];
      runtime.play = (name: string, options?: object) => {
        (window as any).__jaspeReducedLogin.push(name);
        return nativePlay(name, options);
      };
    });
    await domClick(page, "#continueGuardian");
    await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);
    await page.waitForTimeout(300);
    const actions = await page.evaluate(() => (window as any).__jaspeReducedLogin);
    expect(actions).toContain("Idle");
    expect(actions).not.toContain("Wave");
    expect(actions).not.toContain("FormalBow");
    expect(actions).not.toContain("TalkHandsOpen");
  });

  for (const viewport of [
    { width: 1440, height: 900, label: "desktop", minimumPanelRatio: 0.72, minimumWidth: 400 },
    { width: 834, height: 1112, label: "tablette", minimumPanelRatio: 0.68, minimumWidth: 280 },
    { width: 768, height: 1024, label: "tablette étroite", minimumPanelRatio: 0.62, minimumWidth: 160 },
    { width: 700, height: 900, label: "intermédiaire", minimumPanelRatio: 0.62, minimumWidth: 160 },
    { width: 390, height: 844, label: "mobile", minimumPanelRatio: 0.62, minimumWidth: 160 },
  ]) {
    test(`donne à Jaspe une présence proche de la hauteur du panneau ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "load" });
      await domClick(page, "#enterSplash");
      await domClick(page, "#continueGuardian");
      await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);

      const layout = await page.evaluate(() => {
        const avatar = document.querySelector(".safe-avatar")!.getBoundingClientRect();
        const panel = document.querySelector("#loginForm")!.getBoundingClientRect();
        const overlap = Math.max(0, Math.min(avatar.right, panel.right) - Math.max(avatar.left, panel.left))
          * Math.max(0, Math.min(avatar.bottom, panel.bottom) - Math.max(avatar.top, panel.top));
        return {
          width: avatar.width,
          heightRatio: avatar.height / panel.height,
          overlap,
          avatarInside: avatar.left >= 0 && avatar.right <= innerWidth && avatar.top >= 0 && avatar.bottom <= innerHeight,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          avatar: { left: avatar.left, right: avatar.right, top: avatar.top, bottom: avatar.bottom },
          viewport: { width: innerWidth, height: innerHeight },
        };
      });
      expect(layout.width).toBeGreaterThanOrEqual(viewport.minimumWidth);
      expect(layout.heightRatio).toBeGreaterThanOrEqual(viewport.minimumPanelRatio);
      expect(layout.overlap).toBe(0);
      expect(layout.avatarInside, JSON.stringify(layout)).toBe(true);
      expect(layout.overflow).toBe(false);
    });
  }

  test("masque Jaspe et élargit le panneau dès la première saisie", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "load" });
    await domClick(page, "#enterSplash");
    await domClick(page, "#continueGuardian");
    await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);
    const before = await page.locator("#loginForm").boundingBox();

    await page.locator("#emailIdentifier").click();
    await expect(page.locator("#auth")).toHaveClass(/auth-is-typing/);
    await page.waitForTimeout(380);
    await expect(page.locator(".safe-assistant")).toBeHidden();
    const after = await page.locator("#loginForm").boundingBox();
    expect(after!.width).toBeGreaterThan(before!.width + 40);
    expect(after!.x).toBeGreaterThanOrEqual(0);
    expect(after!.x + after!.width).toBeLessThanOrEqual(390);

    await domClick(page, "#backToSplash");
    await domClick(page, "#enterSplash");
    await domClick(page, "#continueGuardian");
    await expect(page.locator("#auth")).not.toHaveClass(/auth-is-typing/);
    await expect(page.locator(".safe-assistant")).toBeVisible();
  });

  test("masque Jaspe sans transition si les mouvements sont réduits", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });
    await domClick(page, "#enterSplash");
    await domClick(page, "#continueGuardian");
    await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);

    await page.locator("#emailIdentifier").click();
    const transitionDuration = await page.locator(".safe-assistant").evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(transitionDuration).toBe("0s");
    await expect(page.locator(".safe-assistant")).toBeHidden();
  });

  test("applique le même flou à toutes les images du diaporama Auth", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await domClick(page, "#enterSplash");
    await domClick(page, "#continueGuardian");
    const filters = await page.locator(".auth-image").evaluateAll((images) => images.map((image) => getComputedStyle(image).filter));
    expect(filters).toHaveLength(2);
    expect(filters[0]).not.toBe("none");
    expect(filters[1]).toBe(filters[0]);
  });

  for (const viewport of [
    { width: 1440, height: 900, label: "desktop" },
    { width: 834, height: 1112, label: "tablette" },
    { width: 390, height: 844, label: "mobile" },
  ]) {
    test(`place Jaspe entière dans le Hero au point zéro ${viewport.label}`, async ({ page }) => {
      await enterWorkspaceAt(page, viewport);
      const layout = await guidedLayout(page);
      const centerX = layout.avatar.left + layout.avatar.width / 2;
      const centerY = layout.avatar.top + layout.avatar.height / 2;

      expect(centerX).toBeGreaterThanOrEqual(layout.anchor.left);
      expect(centerX).toBeLessThanOrEqual(layout.anchor.right);
      expect(centerY).toBeGreaterThanOrEqual(layout.anchor.top);
      expect(centerY).toBeLessThanOrEqual(layout.anchor.bottom);
      expect(layout.avatar.left).toBeGreaterThanOrEqual(layout.hero.left);
      expect(layout.avatar.right).toBeLessThanOrEqual(layout.hero.right);
      expect(layout.avatar.top).toBeGreaterThanOrEqual(layout.hero.top);
      expect(layout.avatar.bottom).toBeLessThanOrEqual(layout.hero.bottom);
      expect(layout.framing.minY).toBeGreaterThanOrEqual(-0.9);
      expect(layout.framing.maxY).toBeLessThanOrEqual(0.9);
      expect(layout.overflow).toBe(false);
      expect(layout.canvases).toBe(1);
      if (viewport.width >= 1200) expect(layout.avatar.height).toBeGreaterThan(layout.logo.height);
    });
  }

  test("réinitialise immédiatement la position sauvegardée vers le point zéro courant", async ({ page }) => {
    await enterWorkspaceAt(page, { width: 1440, height: 900 });
    const initial = await guidedLayout(page);
    const avatar = page.locator(".safe-avatar");
    const rect = await avatar.boundingBox();
    expect(rect).not.toBeNull();
    await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
    await page.mouse.down();
    await page.mouse.move(140, 240, { steps: 8 });
    await page.mouse.up();
    expect(await page.evaluate((key) => localStorage.getItem(key), POSITION_KEY)).not.toBeNull();

    await page.evaluate(() => (window as any).SafeAssistant.openWithQuery(""));
    await expect(page.locator(".safe-bubble")).toBeVisible();
    await page.getByRole("button", { name: "Réinitialiser la position de Jaspe" }).click();
    expect(await page.evaluate((key) => localStorage.getItem(key), POSITION_KEY)).toBeNull();

    const reset = await guidedLayout(page);
    expect(reset.avatar.left).toBeCloseTo(initial.avatar.left, 0);
    expect(reset.avatar.top).toBeCloseTo(initial.avatar.top, 0);
  });

  test("n'applique jamais la position Dashboard sauvegardée au formulaire de connexion", async ({ page }) => {
    await enterWorkspaceAt(page, { width: 1440, height: 900 });
    const avatar = await page.locator(".safe-avatar").boundingBox();
    await page.mouse.move(avatar!.x + avatar!.width / 2, avatar!.y + avatar!.height / 2);
    await page.mouse.down();
    await page.mouse.move(720, 320, { steps: 8 });
    await page.mouse.up();
    expect(await page.evaluate((key) => localStorage.getItem(key), POSITION_KEY)).not.toBeNull();
    await domClick(page, "#workspaceBack");
    await expect(page.locator("#auth.active")).toBeVisible();
    await page.waitForTimeout(100);

    const overlap = await page.evaluate(() => {
      const avatar = document.querySelector(".safe-avatar")!.getBoundingClientRect();
      const form = document.querySelector("#loginForm")!.getBoundingClientRect();
      return Math.max(0, Math.min(avatar.right, form.right) - Math.max(avatar.left, form.left))
        * Math.max(0, Math.min(avatar.bottom, form.bottom) - Math.max(avatar.top, form.top));
    });
    expect(overlap).toBe(0);
  });

  test("se réduit hors du Dashboard et retrouve le point zéro au retour", async ({ page }) => {
    await enterWorkspaceAt(page, { width: 1440, height: 900 });
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 834, height: 1112 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(100);
      const before = await page.locator(".safe-avatar").boundingBox();
      await openAction(page, "Élèves");
      await expect(page.locator("#schoolModule")).toBeVisible();
      await expect(page.locator(".safe-avatar")).toHaveClass(/safe-minimized/);
      const docked = await page.locator(".safe-avatar").boundingBox();
      expect(docked!.width).toBeLessThanOrEqual(64);
      expect(docked!.height).toBeLessThanOrEqual(64);
      expect(docked!.x).toBeGreaterThanOrEqual(0);
      expect(docked!.y).toBeGreaterThanOrEqual(0);
      expect(docked!.x + docked!.width).toBeLessThanOrEqual(viewport.width);
      expect(docked!.y + docked!.height).toBeLessThanOrEqual(viewport.height);

      await domClick(page, "#workspaceBreadcrumbHome");
      await expect(page.locator("#dashboardContainer")).toBeVisible();
      await expect(page.locator(".safe-avatar")).not.toHaveClass(/safe-minimized/);
      const after = await page.locator(".safe-avatar").boundingBox();
      expect(after!.width).toBeCloseTo(before!.width, 0);
      expect(after!.height).toBeCloseTo(before!.height, 0);
      expect(after!.x).toBeCloseTo(before!.x, 0);
      expect(after!.y).toBeCloseTo(before!.y, 0);
    }
  });
});
