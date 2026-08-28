import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

test.describe("H1-FE — dashboard Ressources humaines", () => {
  test("ouvre un dashboard RH de démonstration borné pour le Responsable RH", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await page.locator('[data-branch="people"]:visible').first().evaluate((element: HTMLElement) => element.click());

    const dashboard = page.locator("[data-hr-dashboard]");
    await expect(dashboard).toBeVisible();
    await expect(dashboard).toContainText("DÉMONSTRATION");
    await expect(dashboard).toContainText("BACKEND_LATER");

    for (const label of [
      "Effectif visible",
      "Actifs / inactifs",
      "Présents aujourd’hui",
      "Absents",
      "Retards",
      "Contrats à surveiller",
      "Affectations",
      "Demandes en préparation",
      "Rapports RH",
      "Alertes / échéances",
    ]) {
      await expect(dashboard.locator(".hr-dashboard-metric small", { hasText: label })).toBeVisible();
    }

    for (const tab of ["staff", "contracts", "assignments", "absence", "attendance", "biometric", "payroll", "reports"]) {
      await expect(dashboard.locator(`[data-hr-open="${tab}"]`)).toBeVisible();
    }
  });

  test("n’affiche que les raccourcis couverts par les permissions exactes", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await page.evaluate(() => {
      const hr = (window as any).SchoolSafeHrDemo;
      hr.setSession({
        role: "hr",
        permissions: ["staff.attendance.read", "safe.assistant.use"],
        scopes: [
          { permission: "staff.attendance.read", type: "school" },
          { permission: "safe.assistant.use", type: "own" },
        ],
      });
      hr.render("hrModule");
    });

    const dashboard = page.locator("[data-hr-dashboard]");
    await expect(dashboard.locator('[data-hr-open="attendance"]')).toBeVisible();
    await expect(dashboard.locator('[data-hr-open="biometric"]')).toBeVisible();
    await expect(dashboard.locator('[data-hr-open="staff"]')).toHaveCount(0);
    await expect(dashboard.locator('[data-hr-open="contracts"]')).toHaveCount(0);
    await expect(dashboard.locator('[data-hr-open="payroll"]')).toHaveCount(0);
    await expect(dashboard.locator('[data-hr-open="reports"]')).toHaveCount(0);
  });

  test("fait primer un DENY explicite sans masquer les autres sous-surfaces autorisées", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await page.evaluate(() => {
      const hr = (window as any).SchoolSafeHrDemo;
      hr.setSession({
        role: "hr",
        permissions: ["staff.read", "staff.attendance.read"],
        deniedPermissions: ["staff.read"],
        scopes: [
          { permission: "staff.read", type: "school" },
          { permission: "staff.attendance.read", type: "school" },
        ],
      });
      hr.render("hrModule");
    });

    const dashboard = page.locator("[data-hr-dashboard]");
    await expect(dashboard.locator('[data-hr-open="staff"]')).toHaveCount(0);
    await expect(dashboard.locator('[data-hr-open="attendance"]')).toBeVisible();
    await expect(dashboard).toContainText("DENY explicite prioritaire");
  });
});
