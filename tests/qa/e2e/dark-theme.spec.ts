import { test, expect, type Page } from "@playwright/test";
import { domClick, enterDemoWorkspace } from "./helpers";

type Rgb = { r: number; g: number; b: number };

function parseRgb(value: string): Rgb {
  const rgb = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };

  const srgb = value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (srgb) return { r: Number(srgb[1]) * 255, g: Number(srgb[2]) * 255, b: Number(srgb[3]) * 255 };

  throw new Error(`Couleur CSS inattendue : ${value}`);
}

function luminance(color: Rgb) {
  const channels = [color.r, color.g, color.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: Rgb, second: Rgb) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseGradientColors(value: string): Rgb[] {
  return Array.from(value.matchAll(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/g)).map((match) => ({
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  }));
}

function hue(color: Rgb) {
  const [r, g, b] = [color.r, color.g, color.b].map((channel) => channel / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  const raw = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (raw * 60 + 360) % 360;
}

async function useDarkTheme(page: Page) {
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
}

async function openBranch(page: Page, branch: string) {
  const button = page.locator(`[data-branch="${branch}"]:visible`).first();
  await expect(button).toBeVisible();
  await button.evaluate((element: HTMLElement) => element.click());
}

test.describe("Thème sombre bleu nuit", () => {
  test("garde les textes atténués lisibles et expose les tokens sémantiques manquants", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });

    const tokens = await page.evaluate(() => {
      function themeValues(theme: "light" | "dark") {
        document.documentElement.setAttribute("data-theme", theme);
        const sample = document.createElement("span");
        sample.style.cssText = "color:var(--ss-text-muted);background:var(--ss-bg-primary)";
        document.body.appendChild(sample);
        const style = getComputedStyle(sample);
        const root = getComputedStyle(document.documentElement);
        const result = {
          muted: style.color,
          surface: style.backgroundColor,
          primary: root.getPropertyValue("--ss-primary").trim(),
          amber50: root.getPropertyValue("--ss-amber-50").trim(),
          amber900: root.getPropertyValue("--ss-amber-900").trim(),
        };
        sample.remove();
        return result;
      }
      return { light: themeValues("light"), dark: themeValues("dark") };
    });

    for (const theme of [tokens.light, tokens.dark]) {
      expect(contrastRatio(parseRgb(theme.muted), parseRgb(theme.surface))).toBeGreaterThanOrEqual(4.5);
      expect(theme.primary).not.toBe("");
      expect(theme.amber50).not.toBe("");
      expect(theme.amber900).not.toBe("");
    }
  });

  test("présente l'entrée de démonstration comme un vrai bouton pleine largeur", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await domClick(page, "#enterSplash");
    await domClick(page, "#continueGuardian");

    const visual = await page.locator("#demoEntry").evaluate((button: HTMLButtonElement) => {
      const form = button.closest("form")!;
      const buttonRect = button.getBoundingClientRect();
      const primaryRect = form.querySelector(".login-button")!.getBoundingClientRect();
      const style = getComputedStyle(button);
      return {
        tag: button.tagName,
        type: button.type,
        widthRatio: buttonRect.width / primaryRect.width,
        borderStyle: style.borderStyle,
      };
    });

    expect(visual.tag).toBe("BUTTON");
    expect(visual.type).toBe("button");
    expect(visual.widthRatio).toBeGreaterThanOrEqual(0.95);
    expect(visual.borderStyle).toBe("dashed");
  });

  test("garde le canvas bleu nuit sans tomber dans le presque noir", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await useDarkTheme(page);

    const canvas = parseRgb(await page.locator(".workspace-screen").evaluate((element) => getComputedStyle(element).backgroundColor));
    expect((canvas.r + canvas.g + canvas.b) / 3).toBeGreaterThanOrEqual(22);
    expect(canvas.b).toBeGreaterThan(canvas.r + 15);
    expect(luminance(canvas)).toBeLessThan(0.08);
  });

  test("conserve des textes clairs sur les en-têtes colorés", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    await useDarkTheme(page);
    await openBranch(page, "finance");

    const colors = await page.locator(".finance-module-header").evaluate((header) => ({
      title: getComputedStyle(header.querySelector("h2")!).color,
      copy: getComputedStyle(header.querySelector("p")!).color,
      state: getComputedStyle(header.querySelector(".local-draft")!).color,
      background: getComputedStyle(header).backgroundImage,
    }));
    expect(luminance(parseRgb(colors.title))).toBeGreaterThan(0.75);
    expect(luminance(parseRgb(colors.copy))).toBeGreaterThan(0.45);
    expect(luminance(parseRgb(colors.state))).toBeGreaterThan(0.75);
    const backgrounds = parseGradientColors(colors.background);
    for (const foreground of [colors.title, colors.copy, colors.state]) {
      const ratios = backgrounds.map((background) => contrastRatio(parseRgb(foreground), background));
      expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("préserve l'identité ambre de Finance dans le thème bleu nuit", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    await useDarkTheme(page);
    await openBranch(page, "finance");

    const background = await page.locator(".finance-module-header").evaluate((element) => getComputedStyle(element).backgroundImage);
    const colors = parseGradientColors(background);
    expect(colors.length).toBeGreaterThanOrEqual(2);
    for (const color of colors) expect(hue(color)).toBeGreaterThanOrEqual(25);
    for (const color of colors) expect(hue(color)).toBeLessThanOrEqual(50);
  });

  test("applique aussi des surfaces sombres aux modules élèves récents", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await useDarkTheme(page);
    await openBranch(page, "school");
    await page.locator('[data-school-tab="structure"]').click();

    const structureSurface = parseRgb(await page.locator(".academic-section").first().evaluate((element) => getComputedStyle(element).backgroundColor));
    expect(luminance(structureSurface)).toBeLessThan(0.12);

    await page.locator('[data-school-tab="students"]').click();
    await page.locator('[data-student-status="active"]').click();
    await page.locator('[data-student-id="demo-active-student"] [data-student-dossier]').evaluate((element: HTMLElement) => element.click());
    const dossierSurface = parseRgb(await page.locator(".student-dossier-panel").evaluate((element) => getComputedStyle(element).backgroundColor));
    expect(luminance(dossierSurface)).toBeLessThan(0.12);
  });
});
