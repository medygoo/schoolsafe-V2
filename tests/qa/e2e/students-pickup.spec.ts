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
  const shortcut = page.locator('[data-guard-open="pickup"]');
  await expect(shortcut).toBeVisible();
  await shortcut.click();
  const control = page.locator("[data-pickup-control]");
  await expect(control).toBeVisible();
  return control;
}

async function renderDraftPickupControl(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem("schoolsafe-b4-pickup-events-v1");
    (window as any).SchoolSafeStudentPickup.resetControl();
    (window as any).SchoolSafeStudentPickup.renderControl(
      "guardPickupHost",
      {
        role: "guard",
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
        class_id: null,
        enrollment: { status: "draft", planned_class_id: "demo-class-2", planned_class_name: "5e A" },
        primary_parent: { id: "demo-parent-1", display_name: "Sarah Mbuyi", account_status: "pending_activation" },
      },
    );
  });
  return page.locator("[data-pickup-control]");
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
    await expect(section.getByText("Configuration préalable — aucune récupération autorisée avant activation.", { exact: true })).toBeVisible();
  });

  test("bloque entièrement le contrôle Gardien et toute écriture locale pour un dossier draft", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    await openPickupControl(page);
    const control = await renderDraftPickupControl(page);

    await expect(control.getByRole("heading", { name: "DOSSIER NON ACTIF", exact: true })).toBeVisible();
    await expect(control.getByText("Le contrôle de récupération est indisponible tant que le dossier élève n’est pas officiellement activé.", { exact: true })).toBeVisible();
    await expect(control.locator("[data-simulate-student-card]")).toHaveCount(0);
    await expect(control.locator("[data-pickup-person]")).toHaveCount(0);
    await expect(control.locator("[data-validate-pickup]")).toHaveCount(0);
    await expect(control.locator("[data-pickup-local-record]")).toHaveCount(0);
    await expect(control.locator("[data-pickup-notification-preview]")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("schoolsafe-b4-pickup-events-v1"))).toBeNull();
  });

  test("le Parent consulte les personnes de son propre enfant sans pouvoir les modifier", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    const dossier = await openDraftDossier(page);
    await dossier.getByRole("button", { name: "Personnes autorisées" }).click();
    const section = dossier.locator("[data-authorized-pickup-section]");
    await expect(section.locator('[data-pickup-secondary-guardian="1"]')).toBeVisible();
    await expect(section.getByRole("button", { name: /Suspendre|Rétablir|Ajouter|Supprimer/ })).toHaveCount(0);

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

  test("un élève actif accepte une personne autorisée et prépare la notification Parent", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET") writes.push(`${request.method()} ${request.url()}`);
    });
    const control = await openPickupControl(page);

    await control.getByRole("button", { name: "Simuler la lecture de la carte" }).click();
    await expect(control.getByText("Lucas Martin", { exact: true })).toBeVisible();
    await expect(control.getByText("Matricule B1-0001 · 6e A", { exact: true })).toBeVisible();
    await control.locator('[data-pickup-person="guardian-1"]').click();
    await expect(control.getByText("PERSONNE AUTORISÉE", { exact: true })).toBeVisible();
    await expect(control.getByRole("button", { name: "Valider la remise locale" })).toBeEnabled();
    await control.getByRole("button", { name: "Valider la remise locale" }).click();

    await expect(control.locator("[data-pickup-local-record]")).toContainText("Mireille Wa Kalonji");
    await expect(control.locator("[data-pickup-notification-preview]")).toContainText("Sophie Martin");
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

    await expect.poll(() => page.evaluate(() => (window as any).SafeAssistant.isAllowed())).toBe(false);
    await expect(control.locator("[data-pickup-local-record]")).toHaveCount(0);

    await page.evaluate(() => {
      (window as any).SchoolSafeStudentPickup.renderControl("guardPickupHost", {
        permissions: ["security.pickup.manage"],
        scopes: [],
        assignedPortalIds: ["demo-portal-main"],
      });
    });
    await expect(control.getByText("Accès non accordé.", { exact: false })).toBeVisible();
    await expect(control.locator("[data-pickup-person]")).toHaveCount(0);
    await expect(control.getByRole("button", { name: "Valider la remise locale" })).toHaveCount(0);
  });

  test("garde les états actif et draft bloqué lisibles en clair et sombre à 390, 834 et 1440", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice utilise le navigateur desktop redimensionnable.");
    await enterDemoWorkspace(page, "guard");
    const control = await openPickupControl(page);
    await control.getByRole("button", { name: "Simuler la lecture de la carte" }).click();
    await control.locator('[data-pickup-person="guardian-1"]').click();

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const viewport of [{ width: 390, height: 844 }, { width: 834, height: 1112 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        await page.evaluate(() => {
          document.getElementById("workspaceSidebar")?.classList.remove("open");
          document.getElementById("cubeMenu")?.setAttribute("aria-expanded", "false");
        });
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

    const blockedControl = await renderDraftPickupControl(page);
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const viewport of [{ width: 390, height: 844 }, { width: 834, height: 1112 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        await page.evaluate(() => {
          document.getElementById("workspaceSidebar")?.classList.remove("open");
          document.getElementById("cubeMenu")?.setAttribute("aria-expanded", "false");
        });
        await expect(blockedControl.getByRole("heading", { name: "DOSSIER NON ACTIF", exact: true })).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`b4-pickup-blocked-${theme}-${viewport.width}.png`), fullPage: true });
        const layout = await page.evaluate(() => {
          const width = document.documentElement.clientWidth;
          const root = document.querySelector("[data-pickup-control]") as HTMLElement;
          const overflow = Array.from(document.querySelectorAll("[data-pickup-control] *"))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.right > width + 1 || rect.left < -1;
            })
            .map((element) => ({ tag: element.tagName, className: (element as HTMLElement).className }));
          return { viewport: width, rootWidth: root.getBoundingClientRect().width, rootScrollWidth: root.scrollWidth, overflow };
        });
        expect(layout.overflow, `draft ${theme} ${viewport.width}: ${JSON.stringify(layout)}`).toEqual([]);
        expect(layout.rootScrollWidth, `draft ${theme} ${viewport.width}: ${JSON.stringify(layout)}`).toBeLessThanOrEqual(Math.ceil(layout.rootWidth));
      }
    }
  });
});
