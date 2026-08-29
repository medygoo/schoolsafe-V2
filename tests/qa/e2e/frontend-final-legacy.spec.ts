import { expect, test, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const APP_DIR = path.resolve(process.cwd(), "app");
const REFERENCE_DIR = path.resolve(process.cwd(), "tmp", "m5-visual-reference");
const CAPTURE_MODE = process.env.M5_CAPTURE;

async function domClick(page: Page, selector: string) {
  await page.locator(selector).evaluate((element: HTMLElement) => element.click());
}

async function visualSignature(page: Page, selectors: string[]) {
  return page.evaluate((requestedSelectors) => {
    const properties = [
      "display", "position", "overflow", "backgroundColor", "color", "fontSize",
      "fontWeight", "lineHeight", "gridTemplateColumns", "width", "height",
      "left", "right", "top", "bottom", "padding", "margin", "borderRadius",
    ];
    return Object.fromEntries(requestedSelectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return [selector, null];
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return [selector, {
        style: Object.fromEntries(properties.map((property) => [property, (style as any)[property]])),
        rect: {
          x: Math.round(rect.x * 100) / 100,
          y: Math.round(rect.y * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        },
      }];
    }));
  }, selectors);
}

test.describe("M5 — retrait contrôlé des chemins de présentation legacy", () => {
  test("ne charge plus les feuilles legacy validées comme mortes", async ({ page }) => {
    const styles = readFileSync(path.join(APP_DIR, "styles.css"), "utf8");
    const index = readFileSync(path.join(APP_DIR, "index.html"), "utf8");
    expect(styles).not.toContain("styles-original.css");
    expect(index).not.toContain("legacy=1");
    expect(index).toContain("./styles/screens/entry.css");
    for (const retired of ["styles-original.css", "styles.css.bak", "v3-theme.css", "v3-theme.css.bak", "v4-theme.css"]) {
      expect(existsSync(path.join(APP_DIR, retired)), `${retired} doit être retiré`).toBe(false);
    }

    await page.goto("/", { waitUntil: "load" });
    const sheets = await page.evaluate(() => Array.from(document.styleSheets).map((sheet) => sheet.href || ""));
    expect(sheets.some((href) => href.endsWith("/styles/screens/entry.css"))).toBe(true);
    expect(sheets.some((href) => /styles-original|v[34]-theme/.test(href))).toBe(false);
  });

  test("conserve les contrats visuels protégés de Splash et Guardian", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "load" });
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}#particles{visibility:hidden!important}" });
    await expect(page.locator("#splash.active")).toBeVisible();

    const splashSelectors = ["#splash", ".splash-center", ".splash-shield", ".wordmark", ".splash-tap"];
    const splash = await visualSignature(page, splashSelectors);
    mkdirSync(REFERENCE_DIR, { recursive: true });
    if (CAPTURE_MODE) await page.locator("#splash").screenshot({ path: path.join(REFERENCE_DIR, `m5-${CAPTURE_MODE}-splash.png`) });

    await domClick(page, "#enterSplash");
    await expect(page.locator("#guardian.active")).toBeVisible();
    const guardianSelectors = ["#guardian", ".children-line", ".overlay-brand", ".guardian-copy", ".guardian-copy h1", "#continueGuardian"];
    const guardian = await visualSignature(page, guardianSelectors);
    if (CAPTURE_MODE) await page.locator("#guardian").screenshot({ path: path.join(REFERENCE_DIR, `m5-${CAPTURE_MODE}-guardian.png`) });

    const signature = { splash, guardian };
    const referencePath = path.join(REFERENCE_DIR, "m5-before-signature.json");
    if (CAPTURE_MODE === "before") {
      writeFileSync(referencePath, JSON.stringify(signature, null, 2));
    } else if (CAPTURE_MODE === "after") {
      expect(existsSync(referencePath), "La signature visuelle avant nettoyage doit exister").toBe(true);
      expect(signature).toEqual(JSON.parse(readFileSync(referencePath, "utf8")));
    }

    expect(splash["#splash"]?.style.backgroundColor).toBe("rgb(7, 26, 61)");
    expect(splash[".splash-shield"]?.rect).toMatchObject({ width: 138, height: 138 });
    expect(guardian["#guardian"]?.style.backgroundColor).toBe("rgb(4, 17, 42)");
    expect(guardian[".guardian-copy h1"]?.style.fontSize).toBe("48px");
  });

  test("préserve les parcours Auth, Setup et Workspace", async ({ page }) => {
    await page.route("**/config", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ setup_enabled: true }) }));
    await page.route("**/setup/validate-token", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ valid: true }) }));
    await page.goto("/", { waitUntil: "load" });
    await domClick(page, "#enterSplash");
    await domClick(page, "#continueGuardian");
    await expect(page.locator("#auth.active")).toBeVisible();
    await domClick(page, "#startSetup");
    await page.locator("#setup-token-input").fill("m5-setup-token");
    await page.getByRole("button", { name: "Valider" }).click();
    await expect(page.locator("#setup.active")).toBeVisible();
    await domClick(page, "#closeSetup");
    await domClick(page, "#previewWorkspace");
    await expect(page.locator("#workspace.active")).toBeVisible();
  });
});
