import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

test.describe("Phase E2 — présence des élèves", () => {
  test("présente les statuts et horaires des seuls élèves actifs du portail", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    await page.locator("[data-guard-attendance]").click();

    const view = page.locator(".guard-attendance-view");
    await expect(view).toBeVisible();
    await expect(view).toContainText("Présents");
    await expect(view).toContainText("Absents");
    await expect(view).toContainText("Retards");
    await expect(view).toContainText("Entrés");
    await expect(view).toContainText("Sortis");
    await expect(view).toContainText("Première entrée");
    await expect(view).toContainText("Dernière sortie");
    await expect(view).toContainText("Historique synthétique");
    await expect(view).toContainText("DÉMONSTRATION");
    await expect(view).toContainText("BACKEND_LATER");
    await expect(view).not.toContainText("Amina Mbuyi");
    await expect(view.locator("[data-attendance-edit]")).toHaveCount(0);
  });

  test("limite une consultation de classe aux assigned_classes accordées", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    await page.evaluate(() => {
      const api = (window as any).SchoolSafeGuardSecurity;
      api.render("guardSecurityPortal", {
        permissions: ["security.events.read", "school.student.read"],
        assignedClassIds: ["demo-class-1"],
        scopes: [
          { permission: "security.events.read", type: "assigned_classes" },
          { permission: "school.student.read", type: "assigned_classes" },
        ],
      });
      api.open("attendance");
    });

    const view = page.locator(".guard-attendance-view");
    await expect(view).toContainText("6e A");
    await expect(view).not.toContainText("5e A");
    await expect(view).not.toContainText("Ethan Leroy");
  });

  test("refuse la présence lorsque scope ou permission est absent ou nié", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    const denied = await page.evaluate(() => {
      const api = (window as any).SchoolSafeGuardSecurity;
      const base = {
        permissions: ["security.events.read", "school.student.read"],
        assignedClassIds: ["demo-class-1"],
        scopes: [
          { permission: "security.events.read", type: "school" },
          { permission: "school.student.read", type: "assigned_classes" },
        ],
      };
      api.render("guardSecurityPortal", base);
      const wrongScope = api.open("attendance");
      api.render("guardSecurityPortal", { ...base, scopes: [
        { permission: "security.events.read", type: "assigned_classes" },
        { permission: "school.student.read", type: "assigned_classes" },
      ], deniedPermissions: ["security.events.read"] });
      const explicitDeny = api.open("attendance");
      return { wrongScope, explicitDeny };
    });

    expect(denied).toEqual({ wrongScope: false, explicitDeny: false });
    await expect(page.locator(".guard-security-denied")).toBeVisible();
  });
});
