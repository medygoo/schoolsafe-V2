import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("I1-FE — dashboard Stock générique", () => {
  test("ouvre une démonstration Stock honnête depuis le dashboard Admin", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAction(page, "Stock / Inventaire");

    const module = page.locator("#inventoryModule");
    await expect(module).toBeVisible();
    const dashboard = module.locator("[data-inventory-dashboard]");
    await expect(dashboard).toContainText("Stock / Inventaire / Achats internes");
    await expect(dashboard).toContainText("DÉMONSTRATION");
    await expect(dashboard).toContainText("BACKEND_LATER");
    for (const label of ["Articles", "Catégories", "Emplacements", "Alertes seuil", "Ruptures", "Mouvements récents", "Demandes d’achat", "Commandes", "Réceptions", "Anomalies"]) {
      await expect(dashboard).toContainText(label);
    }
  });

  test("limite une session live autorisée aux agrégats opérationnels", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.evaluate(() => {
      const inventory = (window as any).SchoolSafeInventoryDemo;
      inventory.setSession({
        token: "qa-live",
        permissions: ["reports.operational.read"],
        scopes: [{ permission: "reports.operational.read", type: "school" }],
      });
      inventory.render("inventoryModule");
    });

    const module = page.locator("#inventoryModule");
    await expect(module.locator("[data-inventory-live-aggregates]")).toContainText("AGRÉGATS AUTORISÉS");
    await expect(module).toContainText("Aucun détail opérationnel");
    await expect(module.locator("[data-inventory-item], [data-inventory-movement], form")).toHaveCount(0);
  });

  test("fait primer le DENY explicite et ne révèle aucun agrégat live", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.evaluate(() => {
      const inventory = (window as any).SchoolSafeInventoryDemo;
      inventory.setSession({
        token: "qa-live",
        permissions: ["reports.operational.read"],
        deniedPermissions: ["reports.operational.read"],
        scopes: [{ permission: "reports.operational.read", type: "school" }],
      });
      inventory.render("inventoryModule");
    });

    const module = page.locator("#inventoryModule");
    await expect(module).toContainText("Stock non autorisé");
    await expect(module.locator("[data-inventory-dashboard], [data-inventory-live-aggregates]")).toHaveCount(0);
  });
});
