import { test, expect, Page } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

type ControlUser = {
  permissions: string[];
  scopes: Array<Record<string, unknown>>;
  assignedClassIds?: string[];
  deniedPermissions?: string[];
};

async function renderControl(page: Page, user: ControlUser) {
  await page.evaluate((session) => {
    const module = (window as any).SchoolSafeFeeControlModule;
    module.setSession(session);
    (document.getElementById("feeControlModule") as HTMLElement).hidden = false;
    module.render("feeControlContent");
  }, user);
}

test.describe("F5-FE — campagnes et contrôle des frais", () => {
  test("réutilise le module Contrôle des frais depuis le parcours Finance", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    await openAction(page, "Contrôle des frais");
    await expect(page.locator("#feeControlModule")).toBeVisible();
    await expect(page.locator("#feeControlContent")).toContainText("Campagnes de contrôle autorisées");
    await expect(page.locator("#feeControlCampaignForm")).toBeVisible();
    await expect(page.locator("#feeControlDemoScanForm")).toHaveCount(0);
  });

  test("sépare strictement lecture, gestion et scan", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    await renderControl(page, {
      permissions: ["finance.control.read"],
      scopes: [{ permission: "finance.control.read", type: "school" }],
    });
    await expect(page.locator("[data-fee-control-campaign]")).toBeVisible();
    await expect(page.locator("#feeControlCampaignForm")).toHaveCount(0);
    await expect(page.locator("#feeControlDemoScanForm")).toHaveCount(0);
    await expect(page.locator("#feeControlHistory")).toContainText("BACKEND_LATER");
  });

  test("prépare une campagne locale complète sans écriture serveur", async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET" && request.url().includes("/finance/")) writes.push(`${request.method()} ${request.url()}`);
    });
    await enterDemoWorkspace(page, "finance");
    await renderControl(page, {
      permissions: ["finance.control.manage"],
      scopes: [{ permission: "finance.control.manage", type: "school" }],
    });
    const form = page.locator("#feeControlCampaignForm");
    await form.locator('[name="label"]').fill("Contrôle rentrée — 5e");
    await form.locator('[name="fee_type"]').selectOption("school-fees");
    await form.locator('[name="class_id"]').selectOption("demo-class-5");
    await form.locator('[name="controller_id"]').selectOption("demo-controller-gate");
    await form.locator('[name="starts_at"]').fill("2026-09-15");
    await form.locator('[name="ends_at"]').fill("2026-09-30");
    await form.locator('button[type="submit"]').click();

    const draft = page.locator("[data-fee-control-campaign-draft]").first();
    await expect(draft).toContainText("BROUILLON LOCAL");
    await expect(draft).toContainText("BACKEND_LATER");
    await expect(draft).toContainText("Frais scolaires");
    await expect(draft).toContainText("5e primaire");
    await expect(draft).toContainText("Grâce Mbuyi");
    await page.evaluate(() => (window as any).SchoolSafeFeeControlModule.render("feeControlContent"));
    await expect(page.locator("[data-fee-control-campaign-draft]").first()).toContainText("Contrôle rentrée — 5e");
    expect(writes).toEqual([]);
  });

  test("scanne uniquement dans assigned_classes et rend un résultat minimal", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    await renderControl(page, {
      permissions: ["finance.control.scan"],
      scopes: [{ permission: "finance.control.scan", type: "assigned_classes", classIds: ["demo-class-5"] }],
      assignedClassIds: ["demo-class-5"],
    });
    await expect(page.locator("#feeControlCampaignForm")).toHaveCount(0);
    await expect(page.locator("#feeControlHistory")).toHaveCount(0);
    const form = page.locator("#feeControlDemoScanForm");
    await form.locator("#feeControlQrInput").fill("schoolsafe://card/DEMO-PAID/verification");
    await form.locator('button[type="submit"]').click();
    const result = page.locator("[data-fee-control-result]");
    await expect(result).toContainText("Amina Kalonji");
    await expect(result).toContainText("5e primaire");
    await expect(result).toContainText("EN RÈGLE");
    await expect(result).toContainText("Consigne");
    await expect(result).not.toContainText(/montant|transaction|reçu|caisse|rapport|supprimer/i);
  });

  test("présente les cinq statuts sans obligation ni détail financier", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    await renderControl(page, {
      permissions: ["finance.control.read"],
      scopes: [{ permission: "finance.control.read", type: "school" }],
    });
    const history = page.locator("#feeControlHistory");
    for (const status of ["En règle", "Paiement partiel", "Non en règle", "Exempté", "Anomalie"]) {
      await expect(history).toContainText(status);
    }
    await expect(history).toContainText("BACKEND_LATER");
    await expect(history.getByRole("button", { name: /supprimer|paiement|reçu|rapport/i })).toHaveCount(0);
    await expect(history).not.toContainText(/montant global|obligation de paiement|journal de caisse/i);
  });

  test("fait primer le DENY et refuse une portée autre que assigned_classes", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    const base = {
      permissions: ["finance.control.scan"],
      scopes: [{ permission: "finance.control.scan", type: "school" }],
      assignedClassIds: ["demo-class-5"],
    };
    await renderControl(page, base);
    await expect(page.locator("#feeControlDemoScanForm")).toHaveCount(0);
    await renderControl(page, {
      ...base,
      scopes: [{ permission: "finance.control.scan", type: "assigned_classes", classIds: ["demo-class-5"] }],
      deniedPermissions: ["finance.control.scan"],
    });
    await expect(page.locator("#feeControlDemoScanForm")).toHaveCount(0);
    await expect(page.locator("#feeControlContent")).not.toContainText("Amina Mbuyi");
  });
});
