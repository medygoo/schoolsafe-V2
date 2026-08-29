import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { domClick, enterDemoWorkspace, openAction } from "./helpers";

function rgb(hex: string): string {
  const value = hex.replace("#", "");
  return `rgb(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)})`;
}

async function activeColor(page: Page, selector: string): Promise<string> {
  const tab = page.locator(selector).first();
  await expect(tab).toBeVisible();
  return tab.evaluate((element) => getComputedStyle(element).color);
}

test.describe("Harmonisation des sous-fonctionnalités", () => {
  test("les onglets actifs de chaque module appartiennent à la famille du domaine", async ({ page }) => {
    const cases = [
      { name: "Finance", role: "finance", action: "Tableau financier", tab: "#financeTabs button.active", accent: "#d97706" },
      { name: "Comptabilité", role: "admin", action: "Plan comptable", tab: "#accountingTabs button.active", accent: "#3a6ea5" },
      { name: "RH", role: "admin", action: "Enseignants", tab: "#hrTabs button.active", accent: "#8e4585" },
      { name: "Stock", role: "admin", action: "Stock / Inventaire", tab: "#inventoryTabs button.active", accent: "#0f766e" },
      { name: "Communication", role: "admin", action: "Messages", tab: "#communicationTabs button.active", accent: "#0ea5e9" },
    ];
    for (const item of cases) {
      await enterDemoWorkspace(page, item.role);
      await openAction(page, item.action);
      expect(await activeColor(page, item.tab), `${item.name} : onglet actif hors famille`).toBe(rgb(item.accent));
    }

    // École : sous-onglets Scolarité dans la famille bleu royal.
    await enterDemoWorkspace(page, "admin");
    await openAction(page, "Élèves");
    expect(await activeColor(page, "#schoolModule .school-tabs button.active")).toBe(rgb("#1d4ed8"));

    // Sécurité : sous-onglets de mode en bleu nuit.
    await enterDemoWorkspace(page, "admin");
    await openAction(page, "Scanner un QR");
    expect(await activeColor(page, "#securityModule .security-mode-tabs button.active")).toBe(rgb("#1e293b"));
  });

  test("les sous-fonctionnalités gardent la famille après changement d'onglet", async ({ page }) => {
    // Les onglets ont une transition CSS : on attend la couleur finale via expect.poll.
    await enterDemoWorkspace(page, "finance");
    await openAction(page, "Tableau financier");
    const receiptsTab = page.locator('#financeTabs [data-finance-tab="receipts"]');
    await receiptsTab.evaluate((element: HTMLElement) => element.click());
    await expect(receiptsTab).toHaveClass(/active/);
    await expect.poll(() => receiptsTab.evaluate((element) => getComputedStyle(element).color)).toBe(rgb("#d97706"));

    await enterDemoWorkspace(page, "admin");
    await openAction(page, "Stock / Inventaire");
    const catalogTab = page.locator('[data-inventory-tab="catalog"]');
    await catalogTab.evaluate((element: HTMLElement) => element.click());
    await expect(catalogTab).toHaveClass(/active/);
    await expect.poll(() => catalogTab.evaluate((element) => getComputedStyle(element).color)).toBe(rgb("#0f766e"));
  });

  test("les couleurs de statut universelles ne sont jamais remplacées par les domaines", async ({ page }) => {
    // Verrou statique : aucune variante sémantique ss-badge n'est surchargée par les identités de domaine.
    const identity = readFileSync(path.resolve(process.cwd(), "app/styles/modules/domain-identity.css"), "utf8");
    expect(identity).not.toMatch(/\.ss-badge--/);
    const components = readFileSync(path.resolve(process.cwd(), "app/styles/components.css"), "utf8");
    expect(components).toMatch(/\.ss-badge--success\s*\{[^}]*--ss-emerald/);
    expect(components).toMatch(/\.ss-badge--danger\s*\{[^}]*--ss-coral/);

    // Verrou runtime : un statut « Validé » Finance reste vert, pas ambre.
    await enterDemoWorkspace(page, "cashier");
    await openAction(page, "Produire un reçu PDF");
    const badge = page.locator("#financeContent .ss-badge--success").first();
    await expect(badge).toBeVisible();
    const badgeColor = await badge.evaluate((element) => getComputedStyle(element).color);
    expect(badgeColor, "un statut valide Finance reste vert").toBe(rgb("#047857"));
    expect(badgeColor).not.toBe(rgb("#d97706"));
  });

  test("famille conservée en bleu nuit et sans overflow à 390/1440", async ({ page }) => {
    for (const theme of ["light", "dark"]) {
      await page.addInitScript((value) => localStorage.setItem("ss-theme", value), theme);
      for (const width of [390, 1440]) {
        await enterDemoWorkspace(page, "admin");
        await openAction(page, "Stock / Inventaire");
        await page.setViewportSize({ width, height: 844 });
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        const expected = theme === "light" ? "#0f766e" : "#5eead4";
        expect(await activeColor(page, "#inventoryTabs button.active"), `Stock ${theme} ${width}px`).toBe(rgb(expected));
      }
    }
  });

  test("Splash et Guardian restent visuellement intacts", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("#splash.active")).toBeVisible();
    expect(await page.locator("#particles .particle").count()).toBeGreaterThanOrEqual(12);
    await expect(page.locator("#enterSplash")).toBeVisible();
    await domClick(page, "#enterSplash");
    await expect(page.locator("#guardian.active")).toBeVisible();
    await expect(page.locator("#continueGuardian")).toBeVisible();
  });
});
