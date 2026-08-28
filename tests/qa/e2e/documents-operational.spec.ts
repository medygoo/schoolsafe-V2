import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

test.describe("J6 — Documents opérationnels", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
  });

  test("enregistre uniquement les rapports frontend Sécurité, RH et Stock", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const center = (window as any).SchoolSafeDocumentCenter;
      const connector = (window as any).SchoolSafeOperationalDocuments;
      const documents = center.listRegistered().filter((item: any) => ["security", "hr", "inventory"].includes(item.sourceModule));
      const template = await connector.getTemplate("inventory-operational-summary");
      return { documents, template: template.info, boundaries: connector.boundaries };
    });
    expect(result.documents.map((item: any) => item.type)).toEqual(expect.arrayContaining([
      "security-report", "hr-report", "staff-attendance-summary", "inventory-summary", "stock-levels-report", "stock-movements-report",
    ]));
    expect(result.template).toMatchObject({ type: "inventory-summary", defaultLayout: "a4-portrait" });
    for (const item of result.documents) {
      expect(item.formats).toContain("pdf");
      expect(item.scope).toBe("school");
      expect(item.authority).toBe("preview");
      expect(item.dataBoundary).toBe("aggregates-only");
    }
    for (const notice of Object.values(result.boundaries) as string[]) {
      expect(notice).toContain("BACKEND_LATER");
      expect(notice).toContain("PERMISSION FUTURE REQUISE");
    }
  });

  test("sépare strictement les trois permissions et applique DENY", async ({ page }) => {
    const result = await page.evaluate(() => {
      const center = (window as any).SchoolSafeDocumentCenter;
      const makeUser = (permission: string, deniedPermissions: string[] = []) => ({
        userId: permission, schoolId: "demo-school-1", permissions: [permission], deniedPermissions,
        scopes: [{ permission, type: "school" }],
      });
      const ids = (user: any) => center.visibleDocuments(user).map((item: any) => item.id);
      return {
        security: ids(makeUser("reports.security.read")),
        hr: ids(makeUser("reports.hr.read")),
        inventory: ids(makeUser("reports.operational.read")),
        denied: ids(makeUser("reports.operational.read", ["reports.operational.read"])),
      };
    });
    expect(result.security.every((id: string) => id.startsWith("security-"))).toBe(true);
    expect(result.hr.every((id: string) => id.startsWith("hr-"))).toBe(true);
    expect(result.inventory.every((id: string) => id.startsWith("inventory-"))).toBe(true);
    expect(result.denied.filter((id: string) => id.startsWith("inventory-"))).toHaveLength(0);
  });

  test("n’invente aucun document sensible ou officiel interdit", async ({ page }) => {
    const serialized = await page.evaluate(() => JSON.stringify((window as any).SchoolSafeOperationalDocuments.list()).toLowerCase());
    expect(serialized).not.toMatch(/donnée biométrique|rapport biométrique|document médical|bulletin de paie officiel|contrat rh officiel|détail fournisseur live|stock officiel/);
  });

  test("affiche au profil RH uniquement ses synthèses autorisées", async ({ page }) => {
    await page.locator("#documentsNav").click();
    await expect(page.locator("[data-document-id='hr-summary']")).toBeVisible();
    await expect(page.locator("[data-document-id='hr-attendance-summary']")).toBeVisible();
    await expect(page.locator("[data-document-id^='security-']")).toHaveCount(0);
    await expect(page.locator("[data-document-id^='inventory-']")).toHaveCount(0);
  });
});
