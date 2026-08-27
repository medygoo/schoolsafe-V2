import { test, expect, type Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

const ACTIVE_STUDENT = {
  id: "demo-active-student",
  matricule: "B1-0001",
  first_name: "Lucas",
  last_name: "Martin",
  lifecycle_status: "active",
  class_id: "demo-class-1",
  enrollment: {
    status: "active",
    academic_year_label: "2026-2027",
    planned_class_id: "demo-class-1",
    planned_class_name: "6e A",
    level_name: "6e",
    section_name: "A",
    starts_on: "2026-09-01",
  },
  primary_parent: { id: "demo-parent-2", display_name: "Sophie Martin", account_status: "active" },
};

const DRAFT_STUDENT = {
  id: "demo-draft-student",
  matricule: "B1-0002",
  first_name: "Amina",
  last_name: "Mbuyi",
  lifecycle_status: "draft",
  class_id: null,
  enrollment: { status: "draft", academic_year_label: "2026-2027", planned_class_name: "5e A", starts_on: "2026-09-01" },
};

async function openStudents(page: Page, status: "draft" | "active") {
  const schoolBranch = page.locator('[data-branch="school"]:visible').first();
  await expect(schoolBranch).toBeVisible();
  await schoolBranch.evaluate((element: HTMLElement) => element.click());
  await page.locator('[data-school-tab="students"]').click();
  if (status === "active") await page.getByRole("button", { name: "Actifs" }).click();
}

async function openActiveLifecycle(page: Page) {
  await openStudents(page, "active");
  await page.locator('[data-student-id="demo-active-student"] [data-student-detail]').click();
  const modal = page.locator(".student-lifecycle-modal");
  await expect(modal).toBeVisible();
  return modal;
}

async function openLifecycleAs(page: Page, user: Record<string, unknown>, student = ACTIVE_STUDENT) {
  await page.evaluate(({ student, currentUser }) => {
    (window as any).SchoolSafeStudentLifecycle.open(student, currentUser);
  }, { student, currentUser: user });
  return page.locator(".student-lifecycle-modal");
}

test.describe("B5-FE — cycle scolaire de l’élève", () => {
  test("bloque toutes les opérations pour un dossier draft", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openStudents(page, "draft");
    await page.locator('[data-student-id="demo-draft-student"] [data-student-detail]').click();

    const lifecycle = page.locator("[data-lifecycle-section]");
    await expect(lifecycle.getByRole("heading", { name: "Parcours scolaire", exact: true })).toBeVisible();
    await expect(lifecycle.getByText("DOSSIER NON ACTIF", { exact: true })).toBeVisible();
    await expect(lifecycle.getByText("La réinscription, le changement de classe et le départ ne sont disponibles qu’après l’activation officielle de l’élève.")).toBeVisible();
    await expect(lifecycle.getByRole("button", { name: /réinscrire|changement de classe|transfert|départ|archiver/i })).toHaveCount(0);
    await expect(lifecycle.getByText("Année prévue", { exact: true })).toBeVisible();
    await expect(lifecycle.getByText("Niveau prévu", { exact: true })).toBeVisible();
    await expect(lifecycle.getByText("Classe prévue", { exact: true })).toBeVisible();
    await expect(lifecycle.getByText("Année actuelle", { exact: true })).toHaveCount(0);
    await expect(lifecycle.getByText("Ancienneté", { exact: true }).locator("..")).toContainText("—");
    await expect(lifecycle.locator("[data-lifecycle-history-item]")).toHaveCount(2);
  });

  test("affiche le parcours actif et conserve toutes les inscriptions historiques", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const modal = await openActiveLifecycle(page);
    const lifecycle = modal.locator("[data-lifecycle-section]");

    await expect(lifecycle.getByRole("heading", { name: "Parcours scolaire", exact: true })).toBeVisible();
    await expect(lifecycle.getByText("ACTUELLE", { exact: true }).first()).toBeVisible();
    await expect(lifecycle.locator("[data-current-year]")).toHaveText("2026-2027");
    await expect(lifecycle.locator("[data-current-level]")).toHaveText("6e");
    await expect(lifecycle.locator("[data-current-class]")).toHaveText("6e A");
    await expect(lifecycle.getByText("Inscription initiale", { exact: true })).toBeVisible();
    await expect(lifecycle.getByText("Changement annulé", { exact: true })).toBeVisible();
    await expect(lifecycle.locator("[data-lifecycle-enrollment]")).toHaveCount(3);
  });

  test("prépare une réinscription sans remplacer l’inscription actuelle", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const modal = await openActiveLifecycle(page);
    const lifecycle = modal.locator("[data-lifecycle-section]");
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/school/students") && request.method() !== "GET") writes.push(`${request.method()} ${request.url()}`);
    });

    await lifecycle.getByRole("button", { name: "Préparer une réinscription" }).click();
    const form = lifecycle.locator('[data-lifecycle-form="reenrollment"]');
    await expect(form.getByLabel("Année scolaire actuelle")).toHaveValue("2026-2027");
    await form.getByLabel("Prochaine année scolaire").fill("2027-2028");
    await form.getByLabel("Niveau prévu").fill("5e");
    await form.getByLabel("Classe prévue").fill("5e A");
    await form.getByLabel("Date prévue").fill("2027-09-01");
    await form.getByRole("button", { name: "Enregistrer la préparation" }).click();

    await expect(lifecycle.getByText("RÉINSCRIPTION EN PRÉPARATION", { exact: true }).first()).toBeVisible();
    await expect(lifecycle.locator("[data-current-year]")).toHaveText("2026-2027");
    await expect(lifecycle.locator("[data-current-class]")).toHaveText("6e A");
    await expect(lifecycle.locator(".lifecycle-operation__notice")).toContainText(/Préparation locale — aucune donnée officielle modifiée.*BACKEND_LATER/i);
    expect(writes).toEqual([]);
  });

  test("prépare un changement de classe et un transfert sans modifier la classe actuelle", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const modal = await openActiveLifecycle(page);
    const lifecycle = modal.locator("[data-lifecycle-section]");

    await lifecycle.getByRole("button", { name: "Préparer un changement de classe" }).click();
    const classForm = lifecycle.locator('[data-lifecycle-form="class_change"]');
    await classForm.getByLabel("Nouvelle classe").fill("6e B");
    await classForm.getByLabel("Date d’effet prévue").fill("2026-10-05");
    await classForm.getByLabel("Motif").selectOption("reorganisation");
    await classForm.getByRole("button", { name: "Enregistrer la préparation" }).click();
    await expect(lifecycle.getByText("EN ATTENTE DE VALIDATION", { exact: true }).first()).toBeVisible();
    await expect(lifecycle.getByText("6e A → 6e B", { exact: true })).toBeVisible();
    await expect(lifecycle.locator("[data-current-class]")).toHaveText("6e A");

    await lifecycle.getByRole("button", { name: "Préparer un transfert interne" }).click();
    const transferForm = lifecycle.locator('[data-lifecycle-form="transfer"]');
    await transferForm.getByLabel("Destination").fill("Cycle secondaire");
    await transferForm.getByLabel("Classe ou section cible").fill("6e C");
    await transferForm.getByLabel("Date prévue").fill("2026-11-03");
    await transferForm.getByLabel("Motif").fill("Réorganisation des sections");
    await transferForm.getByRole("button", { name: "Enregistrer la préparation" }).click();
    await expect(lifecycle.getByText("AVANT", { exact: true }).first()).toBeVisible();
    await expect(lifecycle.getByText("APRÈS", { exact: true }).first()).toBeVisible();
    await expect(lifecycle.getByText("EN PRÉPARATION — BACKEND_LATER", { exact: true }).first()).toBeVisible();
    await expect(lifecycle.locator("[data-current-class]")).toHaveText("6e A");
  });

  test("prépare un départ et un archivage futur sans supprimer le dossier", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const modal = await openActiveLifecycle(page);
    const lifecycle = modal.locator("[data-lifecycle-section]");

    await lifecycle.getByRole("button", { name: "Préparer un départ" }).click();
    const form = lifecycle.locator('[data-lifecycle-form="departure"]');
    await form.getByLabel("Type de départ").selectOption("other_school");
    await form.getByLabel("Date prévue").fill("2027-06-30");
    await form.getByLabel("Motif", { exact: true }).fill("Poursuite de la scolarité dans une autre ville");
    await form.getByLabel("Établissement de destination").fill("École Horizon");
    await form.getByRole("button", { name: "Enregistrer la préparation" }).click();

    await expect(lifecycle.getByText("DÉPART EN PRÉPARATION", { exact: true }).first()).toBeVisible();
    await expect(lifecycle.getByText("Documents à préparer · aperçu uniquement", { exact: true })).toBeVisible();
    await lifecycle.getByText("Transitions futures sensibles", { exact: true }).click();
    await lifecycle.getByRole("button", { name: "Préparer l’archivage" }).click();
    const confirmation = page.getByRole("dialog").last();
    await expect(confirmation.getByRole("heading", { name: "Préparer l’archivage" })).toBeVisible();
    await confirmation.getByRole("button", { name: "Confirmer la préparation" }).click();
    await expect(lifecycle.getByText("ARCHIVÉE", { exact: true }).first()).toBeVisible();
    await expect(modal.getByText("Lucas Martin", { exact: true }).first()).toBeVisible();
    await expect(lifecycle.locator("[data-lifecycle-history-item]")).toHaveCount(8);
  });

  test("limite Parent et Enseignant à la consultation et refuse le Gardien", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");

    let modal = await openLifecycleAs(page, {
      role: "parent",
      permissions: ["school.student.read"],
      childIds: ["demo-active-student"],
      scopes: [{ permission: "school.student.read", type: "own_children" }],
    });
    await expect(modal.getByText("Consultation uniquement", { exact: true })).toBeVisible();
    await expect(modal.getByRole("button", { name: /préparer/i })).toHaveCount(0);
    await modal.locator('[data-action-index="0"]').click();
    await expect(modal).toHaveCount(0);

    modal = await openLifecycleAs(page, {
      role: "teacher",
      permissions: ["school.student.read"],
      assignedClassIds: ["demo-class-1"],
      scopes: [{ permission: "school.student.read", type: "assigned_classes" }],
    });
    await expect(modal.getByText("Consultation uniquement", { exact: true })).toBeVisible();
    await expect(modal.getByRole("button", { name: /préparer/i })).toHaveCount(0);
    await modal.locator('[data-action-index="0"]').click();
    await expect(modal).toHaveCount(0);

    modal = await openLifecycleAs(page, {
      role: "guard",
      permissions: ["security.pickup.read"],
      scopes: [{ permission: "security.pickup.read", type: "school" }],
    });
    await expect(modal.getByText("Accès au cycle scolaire indisponible", { exact: true })).toBeVisible();
    await expect(modal.locator("[data-lifecycle-section]")).toHaveCount(0);
  });

  test("refuse une permission sans portée school et applique un DENY explicite", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");

    let modal = await openLifecycleAs(page, {
      role: "admissions",
      permissions: ["school.student.read", "school.enrollment.manage"],
      scopes: [],
    });
    await expect(modal.getByText("Accès au cycle scolaire indisponible", { exact: true })).toBeVisible();
    await modal.locator('[data-action-index="0"]').click();
    await expect(modal).toHaveCount(0);

    modal = await openLifecycleAs(page, {
      role: "admin",
      permissions: ["school.student.read", "school.enrollment.manage", "school.student.transfer", "school.student.archive"],
      deniedPermissions: ["school.enrollment.manage"],
      scopes: [{ type: "school" }],
    });
    await expect(modal.getByRole("button", { name: "Préparer une réinscription" })).toHaveCount(0);
    await expect(modal.getByRole("button", { name: "Préparer un changement de classe" })).toHaveCount(0);
    await expect(modal.getByRole("button", { name: "Préparer un transfert interne" })).toBeVisible();
  });

  test("confirme une transition sensible et permet d’annuler une préparation sans effacer son historique", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const modal = await openActiveLifecycle(page);
    const lifecycle = modal.locator("[data-lifecycle-section]");

    await lifecycle.getByRole("button", { name: "Préparer un changement de classe" }).click();
    const form = lifecycle.locator('[data-lifecycle-form="class_change"]');
    await form.getByLabel("Nouvelle classe").fill("6e B");
    await form.getByLabel("Date d’effet prévue").fill("2026-10-05");
    await form.getByLabel("Motif").selectOption("reorganisation");
    await form.getByRole("button", { name: "Enregistrer la préparation" }).click();
    const operation = lifecycle.locator("[data-lifecycle-operation]").last();
    await expect(operation).toBeFocused();
    await operation.getByRole("button", { name: "Annuler cette préparation" }).click();

    await expect(lifecycle.getByText("6e A → 6e B", { exact: true })).toHaveCount(0);
    await expect(lifecycle.getByText("Changement de classe annulé", { exact: true })).toBeVisible();
    await expect(lifecycle.getByText("Aucune opération préparée", { exact: true }).last()).toBeVisible();
  });

  test("replace le focus sur une opération voisine après une annulation", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const modal = await openActiveLifecycle(page);
    const lifecycle = modal.locator("[data-lifecycle-section]");

    await lifecycle.getByRole("button", { name: "Préparer un changement de classe" }).click();
    let form = lifecycle.locator('[data-lifecycle-form="class_change"]');
    await form.getByLabel("Nouvelle classe").fill("6e B");
    await form.getByLabel("Date d’effet prévue").fill("2026-10-05");
    await form.getByLabel("Motif").selectOption("reorganisation");
    await form.getByRole("button", { name: "Enregistrer la préparation" }).click();

    await lifecycle.getByRole("button", { name: "Préparer un transfert interne" }).click();
    form = lifecycle.locator('[data-lifecycle-form="transfer"]');
    await form.getByLabel("Destination").fill("Cycle secondaire");
    await form.getByLabel("Classe ou section cible").fill("6e C");
    await form.getByLabel("Date prévue").fill("2026-11-03");
    await form.getByLabel("Motif").fill("Réorganisation des sections");
    await form.getByRole("button", { name: "Enregistrer la préparation" }).click();

    const operations = lifecycle.locator("[data-lifecycle-operation]");
    await expect(operations).toHaveCount(2);
    await operations.first().getByRole("button", { name: "Annuler cette préparation" }).click();
    await expect(operations).toHaveCount(1);
    await expect(operations.first()).toBeFocused();
    await expect(lifecycle.getByText("Changement de classe annulé", { exact: true })).toBeVisible();
  });

  test("Jaspe explique mais ne valide aucune opération", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const modal = await openActiveLifecycle(page);
    const lifecycle = modal.locator("[data-lifecycle-section]");
    await page.evaluate(() => (window as any).SafeAssistant.openWithQuery("Valide la réinscription de Lucas et change sa classe"));

    await expect(page.locator(".safe-bubble-body")).toContainText("Je ne peux pas valider une réinscription");
    await expect(lifecycle.locator("[data-lifecycle-empty]")).toContainText("Aucune opération préparée");
  });

  test("reste lisible en clair et sombre aux largeurs 390, 834 et 1440", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice multi-viewport utilise le projet desktop redimensionnable.");
    await enterDemoWorkspace(page, "admin");
    const modal = await openActiveLifecycle(page);

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const viewport of [{ width: 390, height: 844 }, { width: 834, height: 1112 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        await expect(modal.locator("[data-lifecycle-section]")).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`b5-lifecycle-${theme}-${viewport.width}.png`) });
        const overflow = await modal.evaluate((root) => Array.from(root.querySelectorAll("*"))
          .filter((element) => {
            if (element.classList.contains("sr-only")) return false;
            const rect = element.getBoundingClientRect();
            return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1;
          })
          .map((element) => ({ tag: element.tagName, className: element.className })));
        expect(overflow, `${theme} ${viewport.width}: ${JSON.stringify(overflow)}`).toEqual([]);
      }
    }

    await modal.locator('[data-action-index="0"]').click();
    await expect(modal).toHaveCount(0);
    const blockedModal = await openLifecycleAs(page, {
      role: "admin",
      permissions: ["school.student.read", "school.enrollment.manage", "school.student.transfer", "school.student.archive"],
      scopes: [{ type: "school" }],
    }, DRAFT_STUDENT);

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const viewport of [{ width: 390, height: 844 }, { width: 834, height: 1112 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        await expect(blockedModal.getByText("DOSSIER NON ACTIF", { exact: true })).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`b5-lifecycle-draft-${theme}-${viewport.width}.png`) });
        const overflow = await blockedModal.evaluate((root) => Array.from(root.querySelectorAll("*"))
          .filter((element) => {
            if (element.classList.contains("sr-only")) return false;
            const rect = element.getBoundingClientRect();
            return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1;
          })
          .map((element) => ({ tag: element.tagName, className: element.className })));
        expect(overflow, `draft ${theme} ${viewport.width}: ${JSON.stringify(overflow)}`).toEqual([]);
      }
    }
  });
});
