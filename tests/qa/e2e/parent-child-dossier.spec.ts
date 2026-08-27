import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openParentDossier(page: any) {
  await page.locator('[data-parent-shortcut="dossier"]').click();
  const dossier = page.locator(".student-central-dossier");
  await expect(dossier).toBeVisible();
  return dossier;
}

test.describe("C2-FE — dossier de l’enfant lié", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
  });

  test("réutilise le dossier central B7 pour l’enfant sélectionné", async ({ page }) => {
    const dossier = await openParentDossier(page);
    await expect(dossier.locator(".student-dossier-hero")).toContainText("Lucas Martin");
    await expect(dossier.locator(".student-dossier-hero")).toContainText("6e A");
    await expect(dossier.locator(".student-dossier-hero")).toContainText("2026-2027");

    await expect(dossier.locator("[data-dossier-section]")).toHaveText([
      /Identité/,
      /Famille/,
      /Scolarité/,
      /Présence/,
      /Pédagogie/,
      /Finance/,
      /Rattrapage/,
      /Documents/,
      /Historique/,
    ]);
    await expect(dossier.getByRole("button", { name: /Sécurité|Cantine|Communications/ })).toHaveCount(0);
  });

  test("ouvre uniquement le dossier de l’enfant choisi", async ({ page }) => {
    await page.locator("#parentChildSelect").selectOption("demo-parent-child-emma");
    const dossier = await openParentDossier(page);
    await expect(dossier.locator(".student-dossier-hero")).toContainText("Emma Martin");
    await expect(dossier.locator(".student-dossier-hero")).not.toContainText("Lucas Martin");
    await expect(dossier.locator(".student-dossier-hero")).not.toContainText("Ethan Leroy");
  });

  test("refuse l’ouverture d’un enfant hors own_children", async ({ page }) => {
    const opened = await page.evaluate(() => {
      const portal = (window as any).SchoolSafeParentPortal;
      return portal.openChildDossier("demo-unrelated-child-ethan", {
        role: "parent",
        permissions: ["school.student.read"],
        childIds: ["demo-parent-child-lucas"],
        scopes: [{ permission: "school.student.read", type: "own_children" }],
      });
    });
    expect(opened).toBe(false);
    await expect(page.locator(".student-central-dossier")).toHaveCount(0);
  });

  test("applique le DENY explicite aux sections et n’expose aucune action administrative", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).SchoolSafeParentPortal.render("parentPortal", {
        role: "parent",
        permissions: ["school.student.read", "school.guardian.read", "finance.status.read", "school.student.activate", "school.student.transfer"],
        deniedPermissions: ["finance.status.read", "school.student.activate", "school.student.transfer"],
        childIds: ["demo-parent-child-lucas"],
        scopes: [
          { permission: "school.student.read", type: "own_children" },
          { permission: "school.guardian.read", type: "own_children" },
          { permission: "finance.status.read", type: "own_children" },
          { permission: "school.student.activate", type: "own_children" },
          { permission: "school.student.transfer", type: "own_children" },
        ],
      });
    });
    const dossier = await openParentDossier(page);
    await expect(dossier.getByRole("button", { name: /Finance/ })).toHaveCount(0);
    await expect(dossier.getByRole("button", { name: /activer|transférer|archiver|modifier|supprimer/i })).toHaveCount(0);
    await dossier.locator("[data-open-student-card]").click();
    await expect(page.locator(".student-card-readonly")).toContainText("Consultation uniquement");
    await expect(page.getByRole("button", { name: /Transmission à SchoolSafe Control/ })).toHaveCount(0);
  });
});
