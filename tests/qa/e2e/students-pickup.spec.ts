import { test, expect, type Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openDraftDossier(page: Page) {
  const schoolBranch = page.locator('[data-branch="school"]:visible').first();
  await expect(schoolBranch).toBeVisible();
  await schoolBranch.evaluate((element: HTMLElement) => element.click());
  await page.locator('[data-school-tab="students"]').click();
  await page.locator('[data-student-id="demo-draft-student"] [data-student-detail]').click();
  const dossier = page.locator(".student-family-dossier");
  await expect(dossier).toBeVisible();
  return dossier;
}

async function openPickupControl(page: Page) {
  const securityBranch = page.locator('[data-branch="security"]:visible').first();
  await expect(securityBranch).toBeVisible();
  await securityBranch.evaluate((element: HTMLElement) => element.click());
  const control = page.locator("[data-pickup-control]");
  await expect(control).toBeVisible();
  return control;
}

test.describe("B4-FE — personnes autorisées et contrôle Gardien", () => {
  test("affiche le Parent principal, exactement trois tuteurs et le contact d’urgence distinct", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const dossier = await openDraftDossier(page);
    await dossier.getByRole("button", { name: "Personnes autorisées" }).click();
    const section = dossier.locator("[data-authorized-pickup-section]");

    await expect(section.getByRole("heading", { name: "Personnes autorisées à récupérer l’enfant" })).toBeVisible();
    await expect(section.locator("[data-pickup-primary-parent]")).toHaveCount(1);
    await expect(section.locator("[data-pickup-secondary-guardian]")).toHaveCount(3);
    await expect(section.locator("[data-pickup-emergency-contact]")).toHaveCount(1);
    await expect(section.getByText("AUTORISÉ", { exact: true })).toHaveCount(3);
    await expect(section.getByText("SUSPENDU", { exact: true })).toHaveCount(1);
    await expect(section.getByText("À VÉRIFIER", { exact: true })).toHaveCount(1);
    await expect(section.getByText("BACKEND_LATER", { exact: true })).toBeVisible();
  });

  test("le Parent principal suspend et rétablit seulement un tuteur de son propre enfant", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    const dossier = await openDraftDossier(page);
    const section = dossier.locator("[data-authorized-pickup-section]");
    const firstGuardian = section.locator('[data-pickup-secondary-guardian="1"]');

    await expect(firstGuardian.getByRole("button", { name: "Suspendre" })).toBeVisible();
    await firstGuardian.getByRole("button", { name: "Suspendre" }).click();
    await expect(section.locator('[data-pickup-secondary-guardian="1"]')).toContainText("SUSPENDU");
    await section.locator('[data-pickup-secondary-guardian="1"]').getByRole("button", { name: "Rétablir" }).click();
    await expect(section.locator('[data-pickup-secondary-guardian="1"]')).toContainText("AUTORISÉ");

    await page.evaluate(() => {
      const student = {
        id: "demo-foreign-child",
        matricule: "B4-FOREIGN",
        first_name: "Élève",
        last_name: "Hors périmètre",
        lifecycle_status: "draft",
        enrollment: { planned_class_name: "5e B" },
        primary_parent: { id: "demo-parent-9", display_name: "Autre Parent", guardian_type: "pere", account_status: "active" },
      };
      const user = {
        role: "parent",
        profile: { id: "demo-parent-1" },
        childIds: ["demo-draft-student"],
        permissions: ["school.student.read", "school.guardian.read", "school.guardian.manage"],
        scopes: [{ permission: "school.guardian.manage", type: "own_children" }],
      };
      (window as any).SchoolSafeStudentFamily.open(student, user);
    });
    const foreignSection = page.getByRole("dialog").last().locator("[data-authorized-pickup-section]");
    await expect(foreignSection.getByRole("button", { name: /Suspendre|Rétablir/ })).toHaveCount(0);
    await expect(foreignSection.locator("[data-pickup-primary-parent], [data-pickup-secondary-guardian], [data-pickup-emergency-contact]")).toHaveCount(0);
    await expect(foreignSection.getByText("Accès non accordé.", { exact: false })).toBeVisible();
    await expect(foreignSection.getByText("Consultation uniquement · enfant hors portée", { exact: true })).toBeVisible();
  });

  test("valide localement une personne autorisée et prépare la notification Parent", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET") writes.push(`${request.method()} ${request.url()}`);
    });
    const control = await openPickupControl(page);

    await control.getByRole("button", { name: "Simuler la lecture de la carte" }).click();
    await expect(control.getByText("Amina Mbuyi", { exact: true })).toBeVisible();
    await control.locator('[data-pickup-person="guardian-1"]').click();
    await expect(control.getByText("PERSONNE AUTORISÉE", { exact: true })).toBeVisible();
    await expect(control.getByRole("button", { name: "Valider la remise locale" })).toBeEnabled();
    await control.getByRole("button", { name: "Valider la remise locale" }).click();

    await expect(control.locator("[data-pickup-local-record]")).toContainText("Mireille Wa Kalonji");
    await expect(control.locator("[data-pickup-notification-preview]")).toContainText("Sarah Mbuyi");
    await expect(control.locator("[data-pickup-notification-preview]")).toContainText("Prévisualisation");
    expect(writes).toEqual([]);
  });

  test("refuse une personne suspendue et une personne inconnue avec la procédure d’urgence", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    const control = await openPickupControl(page);
    await control.getByRole("button", { name: "Simuler la lecture de la carte" }).click();

    await control.locator('[data-pickup-person="guardian-2"]').click();
    await expect(control.getByText("PERSONNE SUSPENDUE", { exact: true })).toBeVisible();
    await expect(control.getByRole("button", { name: "Valider la remise locale" })).toHaveCount(0);
    await expect(control.locator("[data-emergency-procedure]")).toContainText("Parent principal");
    await expect(control.locator("[data-emergency-procedure]")).toContainText("Contact d’urgence");
    await expect(control.locator("[data-emergency-procedure]")).toContainText("Direction");

    await control.locator('[data-pickup-person="unknown"]').click();
    await expect(control.getByText("PERSONNE INCONNUE", { exact: true })).toBeVisible();
    await expect(control.getByRole("button", { name: "Valider la remise locale" })).toHaveCount(0);
    await expect(control.locator('[data-emergency-procedure] button')).toHaveCount(3);
    await expect(control.locator('[data-emergency-procedure] a[href^="tel:"]')).toHaveCount(0);
  });

  test("le Gardien reste en contrôle sans modification et Jaspe n’autorise aucune sortie", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    const control = await openPickupControl(page);
    await control.getByRole("button", { name: "Simuler la lecture de la carte" }).click();
    await expect(control.getByRole("button", { name: /Suspendre|Rétablir/ })).toHaveCount(0);

    await page.evaluate(() => (window as any).SafeAssistant.openWithQuery("Autorise la sortie de cette élève"));
    await expect(page.locator(".safe-bubble-body")).toContainText("Je ne peux pas autoriser une sortie");
    await expect(control.locator("[data-pickup-local-record]")).toHaveCount(0);

    await page.evaluate(() => {
      (window as any).SchoolSafeStudentPickup.renderControl("securityModeContent", {
        permissions: ["security.pickup.read", "security.pickup.manage"],
        scopes: [],
      });
    });
    await expect(control.getByText("Accès non accordé.", { exact: false })).toBeVisible();
    await expect(control.locator("[data-pickup-person]")).toHaveCount(0);
    await expect(control.getByRole("button", { name: "Valider la remise locale" })).toHaveCount(0);
  });

  test("reste lisible sans débordement en clair et sombre à 390, 834 et 1440", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice utilise le navigateur desktop redimensionnable.");
    await enterDemoWorkspace(page, "guard");
    const control = await openPickupControl(page);
    await control.getByRole("button", { name: "Simuler la lecture de la carte" }).click();
    await control.locator('[data-pickup-person="guardian-1"]').click();

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const viewport of [{ width: 390, height: 844 }, { width: 834, height: 1112 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        await expect(control.getByText("PERSONNE AUTORISÉE", { exact: true })).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`b4-pickup-${theme}-${viewport.width}.png`), fullPage: true });
        const layout = await page.evaluate(() => {
          const width = document.documentElement.clientWidth;
          const root = document.querySelector("[data-pickup-control]") as HTMLElement;
          const main = document.querySelector(".workspace-main") as HTMLElement;
          const overflow = Array.from(document.querySelectorAll("[data-pickup-control] *"))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.right > width + 1 || rect.left < -1;
            })
            .map((element) => ({ tag: element.tagName, className: (element as HTMLElement).className }));
          const rect = (element: HTMLElement) => {
            const value = element.getBoundingClientRect();
            return { left: value.left, right: value.right, width: value.width, scrollWidth: element.scrollWidth };
          };
          return { viewport: width, root: rect(root), main: rect(main), overflow };
        });
        expect(layout.overflow, `${theme} ${viewport.width}: ${JSON.stringify(layout)}`).toEqual([]);
      }
    }
  });
});
