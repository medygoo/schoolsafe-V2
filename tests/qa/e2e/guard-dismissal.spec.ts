import { test, expect, type Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openDismissal(page: Page) {
  await enterDemoWorkspace(page, "guard");
  await page.evaluate(() => localStorage.removeItem("schoolsafe-v2-security-dismissal-v1"));
  await page.locator('[data-guard-open="dismissal"]').click();
  const view = page.locator("[data-guard-dismissal]");
  await expect(view).toBeVisible();
  return view;
}

async function returnToDismissal(page: Page) {
  await page.locator("[data-guard-back]").click();
  await page.locator('[data-guard-open="dismissal"]').click();
  return page.locator("[data-guard-dismissal]");
}

test.describe("E5-FE — préparation de sortie", () => {
  test("n’admet que les élèves actifs et expose le draft comme dossier non actif", async ({ page }) => {
    const view = await openDismissal(page);

    await expect(view.locator("[data-dismissal-student]")).toHaveCount(3);
    await expect(view.locator('[data-dismissal-student="demo-draft-student"]')).toHaveCount(0);
    await expect(view.locator('[data-dismissal-draft="demo-draft-student"]')).toContainText("DOSSIER NON ACTIF");
    await expect(view.getByText("PRÊT ≠ SORTI", { exact: true })).toBeVisible();
  });

  test("prépare localement un élève, persiste PRÊT et prévisualise la notification Parent", async ({ page }) => {
    let view = await openDismissal(page);
    const lucas = view.locator('[data-dismissal-student="demo-active-student"]');

    await lucas.getByRole("button", { name: "Préparer la sortie" }).click();
    await expect(lucas.getByText("PRÊT", { exact: true })).toBeVisible();
    await expect(view.locator("[data-dismissal-notification-preview]")).toContainText("Votre enfant est en préparation de sortie");
    await expect(view.locator("[data-dismissal-notification-preview]")).toContainText("BACKEND_LATER");
    await expect(lucas.getByText("RÉCUPÉRÉ", { exact: true })).toHaveCount(0);

    view = await returnToDismissal(page);
    await expect(view.locator('[data-dismissal-student="demo-active-student"]')).toContainText("PRÊT");
    await expect(view.locator("[data-dismissal-timeline]")).toContainText("PRÉPARÉ");
  });

  test("ne devient RÉCUPÉRÉ qu’après un contrôle E4 autorisé", async ({ page }) => {
    let view = await openDismissal(page);
    let lucas = view.locator('[data-dismissal-student="demo-active-student"]');
    await lucas.getByRole("button", { name: "Préparer la sortie" }).click();
    await lucas.getByRole("button", { name: "Passer au contrôle" }).click();

    const control = page.locator("[data-pickup-control]");
    await control.getByRole("button", { name: "Simuler la lecture de la carte" }).click();
    await control.locator('[data-pickup-person="guardian-1"]').click();
    await control.getByRole("button", { name: "Valider la remise locale" }).click();
    await expect(control.locator("[data-pickup-local-record]")).toBeVisible();

    view = await returnToDismissal(page);
    lucas = view.locator('[data-dismissal-student="demo-active-student"]');
    await expect(lucas.getByText("RÉCUPÉRÉ", { exact: true })).toBeVisible();
    await expect(view.locator("[data-dismissal-timeline]")).toContainText("PRÉPARÉ");
    await expect(view.locator("[data-dismissal-timeline]")).toContainText("CONTRÔLÉ");
    await expect(view.locator("[data-dismissal-timeline]")).toContainText("RÉCUPÉRÉ");
  });

  test("un contrôle suspendu bloque la sortie et conserve le refus dans la chronologie", async ({ page }) => {
    let view = await openDismissal(page);
    let lucas = view.locator('[data-dismissal-student="demo-active-student"]');
    await lucas.getByRole("button", { name: "Préparer la sortie" }).click();
    await lucas.getByRole("button", { name: "Passer au contrôle" }).click();

    const control = page.locator("[data-pickup-control]");
    await control.getByRole("button", { name: "Simuler la lecture de la carte" }).click();
    await control.locator('[data-pickup-person="guardian-2"]').click();
    await expect(control.getByText("PERSONNE SUSPENDUE", { exact: true })).toBeVisible();

    view = await returnToDismissal(page);
    lucas = view.locator('[data-dismissal-student="demo-active-student"]');
    await expect(lucas.getByText("BLOQUÉ", { exact: true })).toBeVisible();
    await expect(view.locator("[data-dismissal-timeline]")).toContainText("REFUSÉ");
  });

  test("applique pickup.manage + assigned_portal et le DENY prioritaire", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    const result = await page.evaluate(() => {
      const api = (window as any).SchoolSafeGuardSecurity;
      const user = {
        permissions: ["security.pickup.manage"],
        scopes: [{ permission: "security.pickup.manage", type: "assigned_portal" }],
        assignedPortalIds: ["demo-portal-main"],
      };
      return {
        allowed: api.getDismissalProjection(user).allowed,
        denied: api.getDismissalProjection({ ...user, deniedPermissions: ["security.pickup.manage"] }).allowed,
        wrongScope: api.getDismissalProjection({ ...user, scopes: [{ permission: "security.pickup.manage", type: "school" }] }).allowed,
      };
    });
    expect(result).toEqual({ allowed: true, denied: false, wrongScope: false });
  });

  test("reste lisible sans overflow en clair et bleu nuit à 390, 834 et 1440", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice redimensionnable s’exécute sur le projet desktop.");
    const view = await openDismissal(page);
    await view.locator('[data-dismissal-student="demo-active-student"]').getByRole("button", { name: "Préparer la sortie" }).click();

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const viewport of [{ width: 390, height: 844 }, { width: 834, height: 1112 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        const layout = await view.evaluate((root) => {
          const viewportWidth = document.documentElement.clientWidth;
          const overflow = Array.from(root.querySelectorAll("*"))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.left < -1 || rect.right > viewportWidth + 1;
            })
            .map((element) => ({ tag: element.tagName, className: (element as HTMLElement).className }));
          const shortButtons = Array.from(root.querySelectorAll("button"))
            .filter((button) => button.getBoundingClientRect().height < 44)
            .map((button) => button.textContent?.trim());
          return { overflow, shortButtons };
        });
        expect(layout.overflow, `${theme} ${viewport.width}`).toEqual([]);
        expect(layout.shortButtons, `${theme} ${viewport.width}`).toEqual([]);
      }
    }
  });
});
