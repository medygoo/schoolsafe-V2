import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

test.describe("H7-FE — rapports Ressources humaines", () => {
  test("synthétise uniquement les données RH frontend visibles", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await page.locator('[data-branch="people"]:visible').first().evaluate((element: HTMLElement) => element.click());
    await page.locator('[data-hr-open="reports"]').click();

    const reports = page.locator("[data-hr-reports]");
    await expect(reports).toBeVisible();
    await expect(reports).toContainText("RAPPORT RH FRONTEND");
    await expect(reports).toContainText("BACKEND_LATER");
    const expected: Record<string, string> = {
      workforce: "6",
      lifecycle: "5 actifs · 1 inactif",
      movements: "1 mouvement visible",
      attendance: "4 arrivés",
      absence: "3 demandes",
      late: "1 retard",
      contracts: "1 échéance",
      assignments: "3 affectations",
      anomalies: "3 signaux",
    };
    for (const [key, value] of Object.entries(expected)) {
      await expect(reports.locator(`[data-hr-report="${key}"]`)).toContainText(value);
    }
  });

  test("ne produit aucun document légal, bancaire, biométrique ou PDF final", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await page.locator('[data-branch="people"]:visible').first().evaluate((element: HTMLElement) => element.click());
    await page.locator('[data-hr-open="reports"]').click();
    const reports = page.locator("[data-hr-reports]");
    await expect(reports).toContainText("AUCUN PDF FINAL");
    await expect(reports).toContainText("Phase J");
    await expect(reports).toContainText("Aucun bilan social légal");
    await expect(reports.getByRole("button", { name: /pdf|banque|déclaration|bulletin|biométr/i })).toHaveCount(0);
  });

  test("exige reports.hr.read school avec DENY prioritaire", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    const result = await page.evaluate(() => {
      const hr = (window as any).SchoolSafeHrDemo;
      const inspect = (session: any) => {
        hr.setSession(session);
        hr.render("hrModule");
        hr.open("reports");
        return { text: document.querySelector("#hrContent")?.textContent || "", reports: document.querySelectorAll("[data-hr-reports]").length };
      };
      return {
        wrongScope: inspect({ permissions: ["reports.hr.read"], scopes: [{ permission: "reports.hr.read", type: "own" }] }),
        denied: inspect({ permissions: ["reports.hr.read"], deniedPermissions: ["reports.hr.read"], scopes: [{ permission: "reports.hr.read", type: "school" }] }),
      };
    });
    expect(result.wrongScope.reports).toBe(0);
    expect(result.denied.reports).toBe(0);
    expect(result.wrongScope.text).toContain("Rapports RH non autorisés");
    expect(result.denied.text).toContain("DENY explicite prioritaire");
  });

  test("reports.hr.read seul ne révèle pas les dossiers individuels", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await page.evaluate(() => {
      const hr = (window as any).SchoolSafeHrDemo;
      hr.setSession({ permissions: ["reports.hr.read"], scopes: [{ permission: "reports.hr.read", type: "school" }] });
      hr.render("hrModule");
      hr.open("staff");
    });
    await expect(page.locator("[data-hr-staff-row]")).toHaveCount(0);
    await expect(page.locator("#hrContent")).toContainText("non autorisé");
  });
});
