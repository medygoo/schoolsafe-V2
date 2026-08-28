import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("I5-FE — achats internes", () => {
  test("sépare besoin, demande, fournisseur, devis et commande", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAction(page, "Demandes d’achat");
    const procurement = page.locator("[data-inventory-procurement]");
    for (const label of ["BESOIN", "DEMANDE D’ACHAT", "FOURNISSEUR / DEVIS", "COMMANDE", "RÉCEPTION", "Service demandeur", "Priorité", "Fournisseur démo", "Référence devis", "Montant indicatif", "Devise", "Statut"]) await expect(procurement).toContainText(label);
    await expect(procurement).toContainText("besoin ≠ demande ≠ commande ≠ paiement");
    await expect(procurement).toContainText("Aucun paiement");
    await expect(procurement.locator("[data-pay-supplier], [data-create-expense], [data-approve-order]")).toHaveCount(0);
  });

  test("persiste une demande d’achat locale sans créer de commande", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAction(page, "Demandes d’achat");
    const form = page.locator("[data-purchase-request-form]");
    await form.locator("input[name=service]").fill("Infirmerie");
    await form.locator("input[name=item]").fill("Gants non stériles QA");
    await form.locator("input[name=quantity]").fill("12");
    await form.locator("select[name=priority]").selectOption("HAUTE");
    await form.locator("input[name=supplier]").fill("Fournisseur Démo QA");
    await form.locator("input[name=quote]").fill("DEV-QA-12");
    await form.locator("input[name=amount]").fill("75");
    await form.locator("select[name=currency]").selectOption("USD");
    await form.locator("button[type=submit]").click();
    const draft = page.locator("[data-purchase-request-draft]");
    await expect(draft).toContainText("Gants non stériles QA");
    await expect(draft).toContainText("BROUILLON LOCAL");
    await expect(draft).toContainText("DEMANDE UNIQUEMENT");
    await expect(draft).not.toContainText("COMMANDÉ");
    await page.evaluate(() => { (window as any).SchoolSafeInventoryDemo.render("inventoryModule"); (window as any).SchoolSafeInventoryDemo.open("procurement"); });
    await expect(page.locator("[data-purchase-request-draft]")).toContainText("DEV-QA-12");
  });

  test("interdit les achats détaillés en session live", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.evaluate(() => {
      const inventory = (window as any).SchoolSafeInventoryDemo;
      inventory.setSession({ token: "qa", permissions: ["reports.operational.read"], scopes: [{ permission: "reports.operational.read", type: "school" }] });
      inventory.render("inventoryModule"); inventory.open("procurement");
    });
    await expect(page.locator("#inventoryModule")).toContainText("Stock non autorisé");
    await expect(page.locator("[data-inventory-procurement], [data-purchase-request-form]")).toHaveCount(0);
  });
});
