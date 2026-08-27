import { test, expect, type Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openStructure(page: Page) {
  const branch = page.locator('[data-branch="school"]:visible').first();
  await expect(branch).toBeVisible();
  await branch.evaluate((element: HTMLElement) => element.click());
  await page.locator('[data-school-tab="structure"]').click();
  await expect(page.locator(".academic-structure")).toBeVisible();
}

async function rerenderStructure(page: Page) {
  await page.locator('[data-school-tab="students"]').click();
  await page.locator('[data-school-tab="structure"]').click();
  await expect(page.locator(".academic-structure")).toBeVisible();
}

function academicModal(page: Page) {
  return page.locator(".academic-structure-modal .ss-modal");
}

test.describe("B6-FE — années, niveaux et classes", () => {
  test("présente une structure générique et les quatre états d'année", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openStructure(page);

    await expect(page.getByRole("heading", { name: "Structure scolaire" })).toBeVisible();
    await expect(page.locator("[data-academic-year]")).toHaveCount(4);
    for (const status of ["EN PRÉPARATION", "ACTIVE", "TERMINÉE", "ARCHIVÉE"]) {
      await expect(page.getByText(status, { exact: true }).first()).toBeVisible();
    }
    await expect(page.locator("[data-academic-level]")).toHaveCount(4);
    await expect(page.locator("[data-academic-class]")).toHaveCount(4);
    await expect(page.getByText("Capacité indicative", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Enseignant principal", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /supprimer/i })).toHaveCount(0);
  });

  test("prépare localement sans prétendre écrire sur le serveur", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openStructure(page);

    await page.getByRole("button", { name: "Préparer une classe" }).click();
    const modal = academicModal(page);
    await expect(modal.getByText("Brouillon local", { exact: true })).toBeVisible();
    await expect(modal.getByText("BACKEND_LATER", { exact: true })).toBeVisible();
    await modal.getByLabel("Nom de la classe").fill("4e C");
    await modal.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    const draft = page.locator('[data-academic-class][data-draft-action="create"]').filter({ hasText: "4e C" });
    await expect(draft).toHaveCount(1);
    await expect(draft).toContainText("BROUILLON LOCAL");
    await expect(draft).toContainText("BACKEND_LATER");
  });

  test("persiste un brouillon d'année après un nouveau rendu", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openStructure(page);

    await page.getByRole("button", { name: "Préparer une année" }).click();
    const modal = academicModal(page);
    await modal.getByLabel("Libellé").fill("2028-2029");
    await modal.getByRole("button", { name: "Enregistrer le brouillon" }).click();

    const draftSelector = '[data-academic-year][data-local-draft="true"]';
    await expect(page.locator(draftSelector).filter({ hasText: "2028-2029" })).toContainText("BACKEND_LATER");
    await rerenderStructure(page);
    await expect(page.locator(draftSelector).filter({ hasText: "2028-2029" })).toContainText("BROUILLON LOCAL");
  });

  test("persiste un brouillon de niveau après un nouveau rendu", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openStructure(page);

    await page.getByRole("button", { name: "Préparer un niveau" }).click();
    const modal = academicModal(page);
    await modal.getByLabel("Libellé").fill("4e Primaire");
    await modal.getByRole("button", { name: "Enregistrer le brouillon" }).click();

    const draftSelector = '[data-academic-level][data-local-draft="true"]';
    await expect(page.locator(draftSelector).filter({ hasText: "4e Primaire" })).toContainText("BACKEND_LATER");
    await rerenderStructure(page);
    await expect(page.locator(draftSelector).filter({ hasText: "4e Primaire" })).toContainText("BROUILLON LOCAL");
  });

  test("prépare séparément la modification d'une classe sans altérer l'originale", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openStructure(page);

    const original = page.locator('[data-academic-class="demo-class-1"]');
    await original.getByRole("button", { name: "Modifier localement" }).click();
    const modal = academicModal(page);
    await expect(modal.getByLabel("Nom de la classe")).toHaveValue("6e A");
    await expect(modal.getByLabel("Niveau")).toHaveValue("level-6");
    await expect(modal.getByLabel("Capacité indicative")).toHaveValue("36");
    await modal.getByLabel("Nom de la classe").fill("6e A — matin");
    await modal.getByLabel("Capacité indicative").fill("38");
    await modal.getByRole("button", { name: "Enregistrer le brouillon" }).click();

    await expect(original).toContainText("6e A");
    await expect(original).not.toContainText("6e A — matin");
    const update = page.locator('[data-academic-class][data-draft-action="update"][data-source-class="demo-class-1"]');
    await expect(update).toHaveCount(1);
    await expect(update).toContainText("6e A — matin");
    await expect(update).toContainText("Modification préparée de 6e A");
    await expect(update).toContainText("BROUILLON LOCAL");
    await expect(update).toContainText("BACKEND_LATER");

    await rerenderStructure(page);
    await expect(page.locator('[data-academic-class="demo-class-1"]')).toContainText("6e A");
    await expect(page.locator('[data-academic-class][data-draft-action="update"][data-source-class="demo-class-1"]')).toContainText("6e A — matin");

    const assigned = await page.evaluate(() => {
      const structure = (window as any).SchoolSafeAcademicStructure;
      return structure.getVisibleClasses({
        permissions: ["school.class.read"],
        scopes: [{ permission: "school.class.read", type: "assigned_classes" }],
        assignedClassIds: ["demo-class-1"],
      }).map((item: any) => ({ id: item.id, name: item.name }));
    });
    expect(assigned).toEqual([{ id: "demo-class-1", name: "6e A" }]);
  });

  test("applique permission, portée et DENY explicite sans bypass de rôle", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const result = await page.evaluate(() => {
      const structure = (window as any).SchoolSafeAcademicStructure;
      const granted = {
        role: "admin",
        permissions: ["school.structure.manage"],
        scopes: [{ permission: "school.structure.manage", type: "school" }],
      };
      const denied = { ...granted, deniedPermissions: ["school.structure.manage"] };
      const teacher = {
        role: "teacher",
        permissions: ["school.class.read"],
        scopes: [{ permission: "school.class.read", type: "assigned_classes" }],
        assignedClassIds: ["demo-class-1"],
      };
      return {
        granted: structure.canManage(granted),
        denied: structure.canManage(denied),
        teacherCanRead: structure.canRead(teacher),
        teacherClasses: structure.getVisibleClasses(teacher).map((item: any) => item.id),
      };
    });
    expect(result).toEqual({ granted: true, denied: false, teacherCanRead: true, teacherClasses: ["demo-class-1"] });
  });

  test("partage les années et classes avec le parcours B5", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const shared = await page.evaluate(() => {
      const structure = (window as any).SchoolSafeAcademicStructure;
      const lifecycle = (window as any).SchoolSafeStudentLifecycle;
      return {
        activeYear: structure.getActiveYear().label,
        lifecycleYear: lifecycle.getAcademicStructure().activeYear.label,
        classNames: lifecycle.getAcademicStructure().classes.map((item: any) => item.name),
      };
    });
    expect(shared.activeYear).toBe("2026-2027");
    expect(shared.lifecycleYear).toBe(shared.activeYear);
    expect(shared.classNames).toEqual(["6e A", "5e A", "3e Maternelle", "1re Secondaire B"]);
  });

  test("reste sans débordement en clair et sombre aux trois largeurs", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice redimensionnable couvre les trois largeurs.");
    await enterDemoWorkspace(page, "admin");
    await openStructure(page);

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const width of [390, 834, 1440]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 1000 });
        const overflow = await page.locator(".academic-structure").evaluate((root) =>
          Array.from(root.querySelectorAll("*")).filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1;
          }).map((element) => ({ tag: element.tagName, className: (element as HTMLElement).className })),
        );
        expect(overflow, `${theme} ${width}: ${JSON.stringify(overflow)}`).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath(`b6-structure-${theme}-${width}.png`) });
      }
    }
  });
});
