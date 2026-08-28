import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { enterDemoWorkspace } from "./helpers";

const inventoryUser = (live: boolean, report = false, deniedPermissions: string[] = []) => ({
  role: "school_head",
  ...(live ? { token: "qa-live" } : {}),
  permissions: ["safe.assistant.use", ...(report ? ["reports.operational.read"] : [])],
  scopes: [
    { permission: "safe.assistant.use", type: "own" },
    ...(report ? [{ permission: "reports.operational.read", type: "school" }] : []),
  ],
  deniedPermissions,
});

async function askGlobalJaspe(page: Page, query: string) {
  await page.evaluate((value) => (window as any).SafeAssistant.openWithQuery(value), query);
  const bubble = page.locator(".safe-bubble-body");
  await expect(bubble).toBeVisible();
  return bubble;
}

test.describe("I8-FE — Jaspe Stock et QA finale", () => {
  test("explique les surfaces démo sans accomplir d’opération", async ({ page }) => {
    await enterDemoWorkspace(page, "school_head");
    const results = await page.evaluate((user) => {
      const api = (window as any).SchoolSafeInventoryDemo;
      const context = { activeRole: "school_head", user };
      return ["articles du stock", "seuil et rupture", "mouvements fictifs", "workflow achat", "réception et anomalie"].map((query) => api.answerJaspe(`Explique ${query}`, context));
    }, inventoryUser(false));
    for (const result of results) expect(result).toMatchObject({ allowed: true, refusal: false });
  });

  test("refuse toutes les mutations Stock, achats et Finance", async ({ page }) => {
    await enterDemoWorkspace(page, "school_head");
    const results = await page.evaluate((user) => {
      const api = (window as any).SchoolSafeInventoryDemo;
      const context = { activeRole: "school_head", user };
      return [
        "Crée un stock officiel", "Modifie la quantité officielle", "Commande réellement ces articles",
        "Choisis et valide officiellement ce fournisseur", "Réceptionne officiellement la commande",
        "Crée une dépense et paie le fournisseur", "Invente un mouvement", "Supprime l’historique Stock",
      ].map((query) => api.answerJaspe(query, context));
    }, inventoryUser(false));
    for (const result of results) {
      expect(result).toMatchObject({ refusal: true });
      expect(result.message).toContain("REFUS");
    }
  });

  test("exige la double garde en live et applique les DENY", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    const result = await page.evaluate(({ allowed, noReport, deniedReport, deniedAssistant }) => {
      const api = (window as any).SchoolSafeInventoryDemo;
      return {
        allowed: api.answerJaspe("Explique le rapport Stock", { activeRole: "school_head", user: allowed }),
        noReport: api.answerJaspe("Explique le rapport Stock", { activeRole: "school_head", user: noReport }),
        deniedReport: api.answerJaspe("Explique le rapport Stock", { activeRole: "school_head", user: deniedReport }),
        deniedAssistant: api.answerJaspe("Explique le rapport Stock", { activeRole: "school_head", user: deniedAssistant }),
      };
    }, {
      allowed: inventoryUser(true, true), noReport: inventoryUser(true, false),
      deniedReport: inventoryUser(true, true, ["reports.operational.read"]),
      deniedAssistant: inventoryUser(true, true, ["safe.assistant.use"]),
    });
    expect(result.allowed).toMatchObject({ allowed: true, action: "reports" });
    expect(result.allowed.message).toContain("AGRÉGATS AUTORISÉS");
    expect(result.noReport).toMatchObject({ refusal: true });
    expect(result.deniedReport).toMatchObject({ refusal: true });
    expect(result.deniedAssistant).toMatchObject({ refusal: true });
  });

  test("route Jaspe vers le moteur Stock générique et Cantine le réutilise", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    const bubble = await askGlobalJaspe(page, "Explique les seuils et ruptures du stock");
    await expect(bubble).toContainText("Stock");
    await expect(page.locator("#inventoryModule")).toBeVisible();
    await expect(page.locator("[data-inventory-levels]")).toBeVisible();
    const snapshot = await page.evaluate(() => ({
      generic: Boolean((window as any).SchoolSafeInventoryDemo),
      duplicate: Boolean((window as any).SchoolSafeCanteenInventory),
      data: (window as any).SchoolSafeInventoryDemo.getSnapshot(),
    }));
    expect(snapshot.generic).toBeTruthy();
    expect(snapshot.duplicate).toBeFalsy();
    expect(snapshot.data.items.some((item: any) => item.service === "Cantine")).toBeTruthy();
    expect(snapshot.data.movements.some((movement: any) => movement.service === "Cantine")).toBeTruthy();
    expect(JSON.stringify(snapshot.data)).not.toMatch(/allergie|menu|bénéficiaire|presence repas/i);
  });

  test("ne contient aucune permission Stock ou Achats dédiée", async () => {
    const permissions = JSON.parse(await readFile(path.join(process.cwd(), "shared", "permissions.json"), "utf8"));
    expect(JSON.stringify(permissions)).not.toMatch(/"(?:inventory|stock|procurement|purchase|supplier|warehouse)\./i);
  });

  test("reste lisible à 390, 834 et 1440 en clair et bleu nuit", async ({ page }, testInfo: TestInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice redimensionnable s’exécute sur desktop.");
    await enterDemoWorkspace(page, "finance");
    await askGlobalJaspe(page, "Explique le rapport Stock");
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const viewport of [{ width: 390, height: 844 }, { width: 834, height: 1112 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        const layout = await page.evaluate(() => {
          const visible = (node: Element) => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; };
          const insideScroller = (node: Element) => {
            let parent = node.parentElement;
            while (parent && parent !== document.body) {
              const style = getComputedStyle(parent);
              if ((style.overflowX === "auto" || style.overflowX === "scroll") && parent.scrollWidth > parent.clientWidth + 1) return true;
              parent = parent.parentElement;
            }
            return false;
          };
          const overflow = Array.from(document.querySelectorAll("#inventoryModule *, .safe-assistant *")).filter(visible).filter((node) => !insideScroller(node)).filter((node) => {
            const rect = node.getBoundingClientRect(); return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
          }).map((node) => ({ tag: node.tagName, className: (node as HTMLElement).className }));
          const shortControls = Array.from(document.querySelectorAll("#inventoryModule button, #inventoryModule input, #inventoryModule select, #inventoryModule textarea, .safe-assistant button, .safe-assistant input")).filter(visible).filter((node) => node.getBoundingClientRect().height < 43.5).map((node) => ({ tag: node.tagName, height: node.getBoundingClientRect().height }));
          return { overflow, shortControls, bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
        });
        expect(layout, `${theme} ${viewport.width}px`).toEqual({ overflow: [], shortControls: [], bodyOverflow: false });
      }
    }
  });
});
