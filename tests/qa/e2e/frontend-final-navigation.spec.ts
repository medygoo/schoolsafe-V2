import { expect, test, type Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function domClick(page: Page, selector: string) {
  await page.locator(selector).first().evaluate((element: HTMLElement) => element.click());
}

test.describe("Phase M2 — navigation et accessibilité des modules", () => {
  test("parcourt Splash, Guardian, Auth, Setup, Workspace puis revient à Auth", async ({ page }) => {
    await page.route("**/config", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ setup_enabled: true }) }));
    await page.route("**/setup/validate-token", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ valid: true }) }));
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("#splash.active")).toBeVisible();
    await domClick(page, "#enterSplash");
    await expect(page.locator("#guardian.active")).toBeVisible();
    await domClick(page, "#continueGuardian");
    await expect(page.locator("#auth.active")).toBeVisible();
    await domClick(page, "#startSetup");
    await page.locator("#setup-token-input").fill("setup-token-test");
    await page.getByRole("button", { name: "Valider" }).click();
    await expect(page.locator("#setup.active")).toBeVisible();
    await domClick(page, "#closeSetup");
    await expect(page.locator("#auth.active")).toBeVisible();
    await domClick(page, "#previewWorkspace");
    await expect(page.locator("#workspace.active")).toBeVisible();
    await domClick(page, "#workspaceBack");
    await expect(page.locator("#auth.active")).toBeVisible();
  });

  test("ouvre un module depuis la sidebar puis revient au Dashboard par le breadcrumb", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    await domClick(page, '#workspaceNav [data-branch="finance"]');
    await expect(page.locator("#financeModule")).toBeVisible();
    await expect(page.locator("#workspaceBreadcrumb")).toBeVisible();
    await expect(page.locator("#workspaceBreadcrumbModule")).toHaveText("Finance");
    await domClick(page, "#workspaceBreadcrumbBack");
    await expect(page.locator("#dashboardContainer")).toBeVisible();
    await expect(page.locator("#workspaceBreadcrumb")).toBeHidden();
  });

  test("la navigation mobile ouvre la sidebar, atteint un module et revient au Dashboard", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterDemoWorkspace(page, "admin");
    await expect(page.locator("#workspaceBottomNav")).toBeVisible();
    await domClick(page, '[data-bottom-nav="menu"]');
    await expect(page.locator("#workspaceSidebar.open")).toBeVisible();
    await domClick(page, '#workspaceNav [data-branch="inventory"]');
    await expect(page.locator("#inventoryModule")).toBeVisible();
    await expect(page.locator("#workspaceSidebar.open")).toHaveCount(0);
    await domClick(page, '[data-bottom-nav="dashboard"]');
    await expect(page.locator("#dashboardContainer")).toBeVisible();
  });

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    test(`nettoie la bottom-nav sans masquer le contenu à ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await enterDemoWorkspace(page, "admin");
      await page.waitForFunction(() => (window as any).__SCHOOLSAFE_JASPE3D__?.loaded === true);

      const nav = page.locator("#workspaceBottomNav");
      await expect(nav).toBeVisible();
      const entries = await nav.locator("[data-bottom-nav]").evaluateAll((buttons) => buttons.map((button) => ({
        target: button.getAttribute("data-bottom-nav"),
        label: button.textContent?.trim(),
      })));
      expect(entries).toEqual([
        { target: "dashboard", label: "Dashboard" },
        { target: "jaspe", label: "Jaspe" },
        { target: "menu", label: "Menu" },
      ]);

      const layout = await page.evaluate(() => {
        const navElement = document.getElementById("workspaceBottomNav")!;
        const navRect = navElement.getBoundingClientRect();
        const buttons = Array.from(navElement.querySelectorAll("button")).map((button) => button.getBoundingClientRect());
        const content = document.querySelector(".workspace-content") as HTMLElement;
        const contentPaddingBottom = Number.parseFloat(getComputedStyle(content).paddingBottom);
        const overlaps = buttons.some((button, index) => buttons.slice(index + 1).some((other) => (
          Math.max(0, Math.min(button.right, other.right) - Math.max(button.left, other.left))
          * Math.max(0, Math.min(button.bottom, other.bottom) - Math.max(button.top, other.top))
        ) > 0));
        return {
          navInside: navRect.left >= 0 && navRect.right <= innerWidth && navRect.bottom <= innerHeight && navRect.bottom >= innerHeight - 1,
          overlaps,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          contentClearsNav: contentPaddingBottom >= navRect.height,
        };
      });
      expect(layout).toEqual({ navInside: true, overlaps: false, overflow: false, contentClearsNav: true });

      expect(await page.locator(".safe-3d-stage canvas").count()).toBe(1);
      await domClick(page, '[data-bottom-nav="jaspe"]');
      await expect(page.locator("#safeJaspeBubble")).toBeVisible();
      expect(await page.locator(".safe-3d-stage canvas").count()).toBe(1);

      await domClick(page, '[data-bottom-nav="menu"]');
      await expect(page.locator("#workspaceSidebar.open")).toBeVisible();
      await domClick(page, '#workspaceNav [data-branch="inventory"]');
      await expect(page.locator("#inventoryModule")).toBeVisible();
      await expect(nav).toBeVisible();
      await domClick(page, '[data-bottom-nav="dashboard"]');
      await expect(page.locator("#dashboardContainer")).toBeVisible();
    });
  }

  test("les modules B à L déjà livrés n’ouvrent aucun état prochaine étape", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const modules: Array<[string, string]> = [
      ["school", "#schoolModule"],
      ["people", "#hrModule"],
      ["pedagogy", "#pedagogyModule"],
      ["security", "#securityModule"],
      ["finance", "#financeModule"],
      ["accounting", "#accountingModule"],
      ["inventory", "#inventoryModule"],
      ["communication", "#communicationModule"],
      ["administration", "#administrationModule"],
    ];
    for (const [branch, selector] of modules) {
      await domClick(page, `button[data-branch="${branch}"]:visible`);
      await expect(page.locator(selector)).toBeVisible();
      await expect(page.locator("#toast")).not.toContainText(/prochaine étape/i);
      await page.evaluate(() => (window as any).SchoolSafeAppContext.showDashboard());
    }
  });

  test("une route de branche inconnue échoue fermée et conserve le Dashboard", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.evaluate(() => {
      const entry = document.querySelector('#workspaceNav [data-branch="school"]');
      entry?.setAttribute("data-branch", "unknown-module");
      (entry as HTMLElement | null)?.click();
    });
    await expect(page.locator("#dashboardContainer")).toBeVisible();
    for (const selector of ["#schoolModule", "#financeModule", "#accountingModule", "#hrModule", "#inventoryModule", "#communicationModule", "#administrationModule"]) {
      await expect(page.locator(selector)).toBeHidden();
    }
  });

  test("le rôle admin sans grant roles.manage ne voit ni n’ouvre la console d’accès", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.evaluate(() => {
      const access = (window as any).SchoolSafeAccess;
      const originalCanAccess = access.canAccess;
      access.canAccess = (user: unknown, permission: string) => permission === "roles.manage" ? false : originalCanAccess(user, permission);
      (window as any).schoolSafeShow("workspace");
    });
    await expect(page.locator("#permissionsNav")).toBeHidden();
    await page.evaluate(() => {
      const nav = document.getElementById("permissionsNav");
      nav?.removeAttribute("hidden");
      nav?.click();
    });
    await expect(page.locator("#accessConsole")).toBeHidden();
    await expect(page.locator("#toast")).toContainText("non autorisé");
  });

  test("roles.manage avec portée school autorise la console sans dépendre du nom du rôle", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await page.evaluate(() => {
      const access = (window as any).SchoolSafeAccess;
      const originalCanAccess = access.canAccess;
      const originalAllowsScope = access.allowsScope;
      access.canAccess = (user: unknown, permission: string) => permission === "roles.manage" || originalCanAccess(user, permission);
      access.allowsScope = (user: unknown, permission: string, scope: string) => permission === "roles.manage" && scope === "school" ? true : originalAllowsScope(user, permission, scope);
      (window as any).schoolSafeShow("workspace");
    });
    await expect(page.locator("#permissionsNav")).toBeVisible();
    await domClick(page, "#permissionsNav");
    await expect(page.locator("#accessConsole")).toBeVisible();
  });
});
