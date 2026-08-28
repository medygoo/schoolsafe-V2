import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("I4-FE — journal des mouvements", () => {
  test("affiche un journal append-only avec les quatre types", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAction(page, "Mouvements");
    const journal = page.locator("[data-inventory-movements]");
    for (const label of ["ENTRÉE", "SORTIE", "TRANSFERT", "AJUSTEMENT", "Référence", "Article", "Quantité", "Source", "Destination", "Service", "Date", "Motif", "Statut"]) await expect(journal).toContainText(label);
    await expect(journal).toContainText("append-only");
    await expect(journal).toContainText("Aucune mutation officielle");
  });

  test("refuse un transfert vers le même emplacement puis conserve le brouillon valide", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAction(page, "Mouvements");
    const form = page.locator("[data-inventory-movement-form]");
    await form.locator("select[name=type]").selectOption("TRANSFERT");
    await form.locator("select[name=item]").selectOption("ART-001");
    await form.locator("input[name=quantity]").fill("3");
    await form.locator("input[name=source]").fill("Magasin central");
    await form.locator("input[name=destination]").fill("Magasin central");
    await form.locator("input[name=service]").fill("Administration");
    await form.locator("input[name=reason]").fill("Réassort QA");
    await form.locator("button[type=submit]").click();
    await expect(page.locator("[data-movement-error]")).toContainText("différents");
    await expect(page.locator("[data-inventory-movement-draft]")).toHaveCount(0);
    await form.locator("input[name=destination]").fill("Secrétariat");
    await form.locator("button[type=submit]").click();
    await expect(page.locator("[data-inventory-movement-draft]")).toContainText("Réassort QA");
    await expect(page.locator("[data-inventory-movement-draft]")).toContainText("BROUILLON LOCAL");
    await page.evaluate(() => { (window as any).SchoolSafeInventoryDemo.render("inventoryModule"); (window as any).SchoolSafeInventoryDemo.open("movements"); });
    await expect(page.locator("[data-inventory-movement-draft]")).toContainText("Secrétariat");
  });

  test("ne révèle aucun mouvement en live", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.evaluate(() => {
      const inventory = (window as any).SchoolSafeInventoryDemo;
      inventory.setSession({ token: "qa", permissions: ["reports.operational.read"], scopes: [{ permission: "reports.operational.read", type: "school" }] });
      inventory.render("inventoryModule"); inventory.open("movements");
    });
    await expect(page.locator("#inventoryModule")).toContainText("Stock non autorisé");
    await expect(page.locator("[data-inventory-movement], [data-inventory-movement-draft], [data-inventory-movement-form]")).toHaveCount(0);
  });
});
