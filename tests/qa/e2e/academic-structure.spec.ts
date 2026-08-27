import { test, expect, type Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openStructure(page: Page) {
  const branch = page.locator('[data-branch="school"]:visible').first();
  await expect(branch).toBeVisible();
  await branch.evaluate((element: HTMLElement) => element.click());
  await page.locator('[data-school-tab="structure"]').click();
  await expect(page.locator(".academic-structure")).toBeVisible();
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
    const modal = page.locator(".academic-structure-modal .ss-modal");
    await expect(modal.getByText("Brouillon local", { exact: true })).toBeVisible();
    await expect(modal.getByText("BACKEND_LATER", { exact: true })).toBeVisible();
    await modal.getByLabel("Nom de la classe").fill("4e C");
    await modal.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    await expect(page.locator('[data-academic-class="draft-class"]')).toContainText("4e C");
    await expect(page.locator('[data-academic-class="draft-class"]')).toContainText("BROUILLON LOCAL");
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
