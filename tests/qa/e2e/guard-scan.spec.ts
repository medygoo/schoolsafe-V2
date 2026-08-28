import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function scan(page: any, payload: string, type: "entry" | "exit" | "incident") {
  await page.locator("#qrPayloadInput").fill(payload);
  await page.locator(`[data-event-type="${type}"]`).click();
  return page.locator("#scanResult");
}

test.describe("Phase E3 — scanner entrée/sortie scoped", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    await page.locator('[data-guard-open="scan"]').click();
  });

  test("réutilise un seul scanner et journalise entrée puis sortie localement", async ({ page }) => {
    await expect(page.locator(".security-scan-panel")).toHaveCount(1);

    let result = await scan(page, "schoolsafe://card/demo-active-student?portal=demo-portal-main", "entry");
    await expect(result).toContainText("AUTORISÉ");
    await expect(result).toContainText("Lucas Martin");
    await expect(result).toContainText("BACKEND_LATER");

    result = await scan(page, "schoolsafe://card/demo-student-chloe?portal=demo-portal-main", "exit");
    await expect(result).toContainText("AUTORISÉ");
    await expect(result).toContainText("Sortie");

    const events = await page.evaluate(() => (window as any).SchoolSafeSecurityModule.readLocalEvents());
    expect(events.map((event: any) => event.type)).toEqual(["exit", "entry"]);
    expect(events.every((event: any) => event.portalId === "demo-portal-main" && event.backendState === "BACKEND_LATER")).toBe(true);
  });

  test("distingue QR inconnu, draft, QR invalide et portail hors affectation", async ({ page }) => {
    let result = await scan(page, "schoolsafe://card/student-unknown?portal=demo-portal-main", "entry");
    await expect(result).toContainText("VÉRIFICATION");

    result = await scan(page, "schoolsafe://card/demo-draft-student?portal=demo-portal-main", "entry");
    await expect(result).toContainText("DOSSIER NON ACTIF");
    await expect(result).not.toContainText("AUTORISÉ");

    result = await scan(page, "QR-SANS-FORMAT", "entry");
    await expect(result).toContainText("REFUSÉ");

    result = await scan(page, "schoolsafe://card/demo-active-student?portal=demo-portal-east", "exit");
    await expect(result).toContainText("REFUSÉ");
    await expect(result).toContainText("portail affecté");
  });

  test("prépare un incident local sur le poste autorisé", async ({ page }) => {
    const result = await scan(page, "schoolsafe://card/demo-active-student?portal=demo-portal-main", "incident");
    await expect(result).toContainText("VÉRIFICATION");
    await expect(result).toContainText("Incident enregistré localement");
    await expect(result).toContainText("BACKEND_LATER");
  });

  test("refuse le scanner si security.scan assigned_portal est absent ou nié", async ({ page }) => {
    const outcomes = await page.evaluate(() => {
      const api = (window as any).SchoolSafeGuardSecurity;
      const base = {
        permissions: ["security.scan", "security.pickup.manage"],
        assignedPortalIds: ["demo-portal-main"],
        scopes: [
          { permission: "security.scan", type: "school" },
          { permission: "security.pickup.manage", type: "assigned_portal" },
        ],
      };
      api.render("guardSecurityPortal", base);
      const wrongScope = api.open("scan");
      api.render("guardSecurityPortal", { ...base, scopes: [
        { permission: "security.scan", type: "assigned_portal" },
        { permission: "security.pickup.manage", type: "assigned_portal" },
      ], deniedPermissions: ["security.scan"] });
      const explicitDeny = api.open("scan");
      return { wrongScope, explicitDeny };
    });

    expect(outcomes).toEqual({ wrongScope: false, explicitDeny: false });
    await expect(page.locator(".security-scan-panel")).toHaveCount(0);
    await expect(page.locator(".guard-security-denied")).toContainText("DENY explicite");
  });
});
