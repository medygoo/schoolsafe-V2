import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("I3-FE — inventaire, emplacements et seuils", () => {
  test("affiche les quantités théoriques et les quatre états bornés", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAction(page, "Emplacements et seuils");
    const levels = page.locator("[data-inventory-levels]");
    for (const label of ["Article", "Emplacement", "Quantité théorique", "Unité", "Seuil minimum", "NORMAL", "BAS", "RUPTURE", "À CONTRÔLER"]) await expect(levels).toContainText(label);
    await expect(levels).toContainText("navigateur n’est pas la source officielle");
    await expect(levels.locator("[data-level-item='ART-001']")).toHaveCount(2);
    const quantities = await levels.locator("[data-level-quantity]").evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-level-quantity"))));
    expect(quantities.every((quantity) => quantity >= 0)).toBeTruthy();
  });

  test("n’expose aucun emplacement détaillé en live même avec rapport agrégé", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.evaluate(() => {
      const inventory = (window as any).SchoolSafeInventoryDemo;
      inventory.setSession({ token: "qa-live", permissions: ["reports.operational.read"], scopes: [{ permission: "reports.operational.read", type: "school" }] });
      inventory.render("inventoryModule"); inventory.open("levels");
    });
    await expect(page.locator("#inventoryModule")).toContainText("Stock non autorisé");
    await expect(page.locator("[data-inventory-levels], [data-level-item]")).toHaveCount(0);
  });
});
