import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

test.describe("Phase E1 — dashboard Gardien affecté", () => {
  test("affiche uniquement le portail de sécurité affecté et ses priorités", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");

    const portal = page.locator("#guardSecurityPortal");
    await expect(portal).toBeVisible();
    await expect(page.locator("#dashboardContainer")).toBeHidden();
    await expect(portal).toContainText("Portail principal");
    await expect(portal).toContainText("POSTE ACTIF");
    await expect(portal).toContainText("Scans du jour");
    await expect(portal).toContainText("Élèves à préparer");
    await expect(portal).toContainText("Contrôles de récupération");
    await expect(portal).toContainText("Événements récents");
    await expect(portal).toContainText("Alertes à traiter");
    await expect(portal.locator("[data-guard-open]")).toHaveCount(3);
  });

  test("exclut les brouillons et les domaines hors sécurité", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");

    const portal = page.locator("#guardSecurityPortal");
    await expect(portal).toContainText("Lucas Martin");
    await expect(portal).not.toContainText("Amina Mbuyi");
    await expect(portal).not.toContainText("Notes");
    await expect(portal).not.toContainText("Finance");
    await expect(portal).not.toContainText("Permissions");
    await expect(portal).not.toContainText("Dossiers pédagogiques");
  });

  test("exige les deux permissions assigned_portal et fait primer le DENY", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");

    const renderWith = async (overrides: Record<string, unknown>) => page.evaluate((values) => {
      const base = {
        role: "guard",
        permissions: ["security.scan", "security.pickup.manage"],
        assignedPortalIds: ["demo-portal-main"],
        scopes: [
          { permission: "security.scan", type: "assigned_portal", portalIds: ["demo-portal-main"] },
          { permission: "security.pickup.manage", type: "assigned_portal", portalIds: ["demo-portal-main"] },
        ],
      };
      (window as any).SchoolSafeGuardSecurity.render("guardSecurityPortal", { ...base, ...values });
    }, overrides);

    await renderWith({});
    await expect(page.locator(".guard-security-dashboard")).toBeVisible();

    await renderWith({
      scopes: [
        { permission: "security.scan", type: "school" },
        { permission: "security.pickup.manage", type: "assigned_portal", portalIds: ["demo-portal-main"] },
      ],
    });
    await expect(page.locator(".guard-security-denied")).toContainText("Accès sécurité refusé");

    await renderWith({ deniedPermissions: ["security.pickup.manage"] });
    await expect(page.locator(".guard-security-denied")).toContainText("DENY explicite");
  });
});
