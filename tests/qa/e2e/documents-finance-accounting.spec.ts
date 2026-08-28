import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openDocumentsCenter } from "./helpers";

test.describe("J4 — Documents Finance et Comptabilité", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
  });

  test("enregistre les sorties autorisées et réutilise le reçu existant", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const center = (window as any).SchoolSafeDocumentCenter;
      const connector = (window as any).SchoolSafeFinanceAccountingDocuments;
      const user = {
        userId: "finance-real-1", schoolId: "school-real-1", childIds: ["child-real-1"], assignedClassIds: ["class-real-1"],
        permissions: ["finance.receipt.read", "finance.report.read", "finance.status.read", "reports.financial.read"],
        scopes: [
          { permission: "finance.receipt.read", type: "own_children" },
          { permission: "finance.report.read", type: "school" },
          { permission: "finance.status.read", type: "assigned_classes" },
          { permission: "reports.financial.read", type: "school" },
        ],
      };
      await (window as any).SchoolSafeDocumentRuntime.bindContext({ user, mode: "live" });
      const documents = center.listRegistered().filter((item: any) => ["finance", "accounting"].includes(item.sourceModule));
      const receiptTemplate = await connector.getTemplate("finance-receipt-family");
      return { documents, receiptInfo: receiptTemplate.info };
    });

    expect(result.documents.map((item: any) => item.type)).toEqual(expect.arrayContaining([
      "receipt", "cash-report", "financial-situation", "financial-register", "accounting-summary", "treasury-report",
    ]));
    expect(result.receiptInfo).toMatchObject({ type: "receipt", defaultLayout: "a5-receipt" });
    for (const item of result.documents) {
      expect(item.formats).toContain("pdf");
      expect(item.authority).toBe("preview");
      expect(item.currencyPolicy).toBe("separate-usd-cdf");
      expect(item.status).toBe("draft");
    }
  });

  test("ne publie aucun document comptable légal inventé", async ({ page }) => {
    const labels = await page.evaluate(() => (window as any).SchoolSafeDocumentCenter.listRegistered()
      .filter((item: any) => ["finance", "accounting"].includes(item.sourceModule))
      .map((item: any) => `${item.type} ${item.label}`.toLowerCase()));
    const joined = labels.join(" | ");
    expect(joined).not.toMatch(/bilan légal|compte de résultat légal|grand livre officiel|syscohada|pièce comptable officielle/);
  });

  test("borne les vues school, assigned_classes et own_children avec DENY prioritaire", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const center = (window as any).SchoolSafeDocumentCenter;
      const financeUser = {
        userId: "finance-1", schoolId: "school-real-1", childIds: ["child-real-1"], assignedClassIds: ["class-real-1"],
        permissions: ["finance.receipt.read", "finance.report.read", "finance.status.read"],
        scopes: [
          { permission: "finance.receipt.read", type: "own_children" },
          { permission: "finance.report.read", type: "school" },
          { permission: "finance.status.read", type: "assigned_classes" },
        ],
      };
      const parent = {
        userId: "parent-1", schoolId: "school-real-1", childIds: ["child-real-1"],
        permissions: ["finance.receipt.read"],
        scopes: [{ permission: "finance.receipt.read", type: "own_children" }],
      };
      const denied = { ...financeUser, deniedPermissions: ["finance.report.read"] };
      const bindIds = async (user: any) => {
        await (window as any).SchoolSafeDocumentRuntime.bindContext({ user, mode: "live" });
        return center.visibleDocuments(user).map((item: any) => item.id);
      };
      const finance = await bindIds(financeUser);
      const parentIds = await bindIds(parent);
      const otherParentIds = center.visibleDocuments({ ...parent, childIds: ["child-real-2"] }).map((item: any) => item.id);
      const deniedIds = await bindIds(denied);
      return { finance, parent: parentIds, otherParent: otherParentIds, denied: deniedIds };
    });

    expect(result.finance).toEqual(expect.arrayContaining(["finance-receipt-family", "finance-cash-report", "finance-situation-class"]));
    expect(result.parent).toContain("finance-receipt-family");
    expect(result.otherParent).not.toContain("finance-receipt-family");
    expect(result.denied).not.toContain("finance-cash-report");
  });

  test("affiche dans le Centre uniquement les sorties Finance du profil", async ({ page }) => {
    await openDocumentsCenter(page);
    await expect(page.locator("[data-document-id='finance-cash-report']")).toBeVisible();
    await expect(page.locator("[data-document-id='finance-receipt-family']")).toHaveCount(0);
    await expect(page.locator("[data-document-id='finance-situation-class']")).toHaveCount(0);
    await expect(page.locator("#documentCenterModule")).toContainText("Aucun PDF confidentiel n’est archivé");
  });
});
