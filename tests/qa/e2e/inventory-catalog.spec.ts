import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("I2-FE — catalogue articles générique", () => {
  test("affiche les champs du catalogue sans enum métier fermée", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAction(page, "Catalogue articles");
    const catalog = page.locator("[data-inventory-catalog]");
    await expect(catalog).toContainText("Code article");
    for (const label of ["Nom", "Catégorie", "Unité", "Type", "Statut", "Service principal"]) await expect(catalog).toContainText(label);
    await expect(catalog).toContainText("Papier A4");
    await expect(catalog).toContainText("Farine de maïs");
    await expect(catalog.locator("input[name=category]")).toBeVisible();
  });

  test("conserve un brouillon d’article local après rerender", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAction(page, "Catalogue articles");
    const form = page.locator("[data-inventory-item-form]");
    await form.locator("input[name=code]").fill("ART-QA-900");
    await form.locator("input[name=name]").fill("Gants de nettoyage QA");
    await form.locator("input[name=category]").fill("Hygiène locale QA");
    await form.locator("input[name=unit]").fill("paire");
    await form.locator("input[name=service]").fill("Entretien");
    await form.locator("button[type=submit]").click();
    await expect(page.locator("[data-inventory-item-draft]")).toContainText("Gants de nettoyage QA");
    await expect(page.locator("#inventoryModule")).toContainText("BROUILLON LOCAL");
    await page.evaluate(() => { (window as any).SchoolSafeInventoryDemo.render("inventoryModule"); (window as any).SchoolSafeInventoryDemo.open("catalog"); });
    await expect(page.locator("[data-inventory-item-draft]")).toContainText("Gants de nettoyage QA");
  });

  test("interdit tout catalogue détaillé en session live", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.evaluate(() => {
      const inventory = (window as any).SchoolSafeInventoryDemo;
      inventory.setSession({ token: "qa-live", permissions: ["reports.operational.read"], scopes: [{ permission: "reports.operational.read", type: "school" }] });
      inventory.render("inventoryModule");
      inventory.open("catalog");
    });
    await expect(page.locator("#inventoryModule")).toContainText("Stock non autorisé");
    await expect(page.locator("[data-inventory-item], [data-inventory-item-form]")).toHaveCount(0);
  });
});
