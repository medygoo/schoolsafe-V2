import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("I7-FE — rapports opérationnels Stock", () => {
  test("affiche les agrégats démo sans détail commercial", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAction(page, "Rapports Stock");
    const reports = page.locator("[data-inventory-reports]");
    for (const label of ["État du stock", "Seuils", "Ruptures", "Mouvements", "Consommation par service", "Commandes", "Réceptions", "Anomalies", "CDF", "USD"]) await expect(reports).toContainText(label);
    await expect(reports).toContainText("Aucune conversion automatique");
    await expect(reports).toContainText("Phase J");
    await expect(reports.locator("[data-supplier-detail], [data-quote-detail], [data-export-pdf]")).toHaveCount(0);
  });

  test("borne une session live autorisée aux agrégats school", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.evaluate(() => {
      const inventory = (window as any).SchoolSafeInventoryDemo;
      inventory.setSession({ token: "qa", permissions: ["reports.operational.read"], scopes: [{ permission: "reports.operational.read", type: "school" }] });
      inventory.render("inventoryModule"); inventory.open("reports");
    });
    const reports = page.locator("[data-inventory-reports][data-live-aggregates]");
    await expect(reports).toContainText("AGRÉGATS AUTORISÉS");
    await expect(reports).toContainText("LECTURE SEULE");
    await expect(reports).toContainText("Aucun détail fournisseur");
    await expect(reports.locator("form, [data-inventory-item], [data-inventory-movement], [data-supplier-detail]")).toHaveCount(0);
  });

  test("fait primer le DENY sur le rapport opérationnel", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.evaluate(() => {
      const inventory = (window as any).SchoolSafeInventoryDemo;
      inventory.setSession({ token: "qa", permissions: ["reports.operational.read"], deniedPermissions: ["reports.operational.read"], scopes: [{ permission: "reports.operational.read", type: "school" }] });
      inventory.render("inventoryModule"); inventory.open("reports");
    });
    await expect(page.locator("#inventoryModule")).toContainText("Stock non autorisé");
    await expect(page.locator("[data-inventory-reports]")).toHaveCount(0);
  });
});
