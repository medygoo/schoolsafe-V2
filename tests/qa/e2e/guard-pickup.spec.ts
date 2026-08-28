import { test, expect, type Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openGuardPickup(page: Page) {
  await enterDemoWorkspace(page, "guard");
  await page.locator('[data-guard-open="pickup"]').click();
  const control = page.locator("[data-pickup-control]");
  await expect(control).toBeVisible();
  return control;
}

test.describe("E4-FE — contrôle de récupération au portail affecté", () => {
  test("ouvre le contrôle avec pickup.manage + assigned_portal sans pickup.read", async ({ page }) => {
    const control = await openGuardPickup(page);

    await expect(page.getByRole("heading", { name: "Contrôler une récupération" })).toBeVisible();
    await expect(page.getByText("security.pickup.manage · assigned_portal", { exact: true })).toBeVisible();
    await expect(control.getByText("Accès non accordé.", { exact: false })).toHaveCount(0);
    await expect(control.getByText("BACKEND_LATER", { exact: false })).toBeVisible();
  });

  test("conserve DENY prioritaire et refuse la portée school", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");

    const decisions = await page.evaluate(() => {
      const api = (window as any).SchoolSafeStudentPickup;
      const base = {
        permissions: ["security.pickup.manage"],
        scopes: [{ permission: "security.pickup.manage", type: "assigned_portal" }],
        assignedPortalIds: ["demo-portal-main"],
      };
      return {
        allowed: api.canControlPickup(base),
        denied: api.canControlPickup({ ...base, deniedPermissions: ["security.pickup.manage"] }),
        wrongScope: api.canControlPickup({
          ...base,
          scopes: [{ permission: "security.pickup.manage", type: "school" }],
        }),
      };
    });

    expect(decisions).toEqual({ allowed: true, denied: false, wrongScope: false });
  });

  test("valide localement seulement la personne autorisée et prépare la notification Parent", async ({ page }) => {
    const control = await openGuardPickup(page);
    await control.getByRole("button", { name: "Simuler la lecture de la carte" }).click();

    await expect(control.getByText("Lucas Martin", { exact: true })).toBeVisible();
    await control.locator('[data-pickup-person="guardian-1"]').click();
    await expect(control.getByText("PERSONNE AUTORISÉE", { exact: true })).toBeVisible();
    await control.getByRole("button", { name: "Valider la remise locale" }).click();

    await expect(control.locator("[data-pickup-local-record]")).toContainText("Mireille Wa Kalonji");
    await expect(control.locator("[data-pickup-notification-preview]")).toContainText("Sophie Martin");
    await expect(control.locator("[data-pickup-notification-preview]")).toContainText("BACKEND_LATER");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("schoolsafe-b4-pickup-events-v1") || "[]").length)).toBe(1);
  });

  test("distingue suspendu et inconnu sans permettre la validation", async ({ page }) => {
    const control = await openGuardPickup(page);
    await control.getByRole("button", { name: "Simuler la lecture de la carte" }).click();

    await control.locator('[data-pickup-person="guardian-2"]').click();
    await expect(control.getByText("PERSONNE SUSPENDUE", { exact: true })).toBeVisible();
    await expect(control.getByRole("button", { name: "Valider la remise locale" })).toHaveCount(0);

    await control.locator('[data-pickup-person="unknown"]').click();
    await expect(control.getByText("PERSONNE INCONNUE", { exact: true })).toBeVisible();
    await expect(control.getByRole("button", { name: "Valider la remise locale" })).toHaveCount(0);
    await expect(control.locator("[data-pickup-local-record]")).toHaveCount(0);
  });

  test("exclut les dossiers draft et toutes les mutations de la famille", async ({ page }) => {
    const control = await openGuardPickup(page);
    await expect(control.getByRole("button", { name: /Ajouter|Supprimer|Suspendre|Rétablir/ })).toHaveCount(0);

    await page.evaluate(() => {
      localStorage.removeItem("schoolsafe-b4-pickup-events-v1");
      (window as any).SchoolSafeStudentPickup.resetControl();
      (window as any).SchoolSafeStudentPickup.renderControl(
        "guardPickupHost",
        {
          permissions: ["security.pickup.manage"],
          scopes: [{ permission: "security.pickup.manage", type: "assigned_portal" }],
          assignedPortalIds: ["demo-portal-main"],
        },
        {
          id: "demo-draft-student",
          matricule: "B1-0002",
          first_name: "Amina",
          last_name: "Mbuyi",
          lifecycle_status: "draft",
          enrollment: { status: "draft", planned_class_name: "5e A" },
          primary_parent: { display_name: "Sarah Mbuyi" },
        },
      );
    });

    await expect(control.getByRole("heading", { name: "DOSSIER NON ACTIF", exact: true })).toBeVisible();
    await expect(control.locator("[data-simulate-student-card], [data-validate-pickup]")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("schoolsafe-b4-pickup-events-v1"))).toBeNull();
  });
});
