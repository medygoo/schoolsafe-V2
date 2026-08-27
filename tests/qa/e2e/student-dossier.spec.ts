import { test, expect, type Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openStudents(page: Page, status: "draft" | "active" = "draft") {
  const branch = page.locator('[data-branch="school"]:visible').first();
  await expect(branch).toBeVisible();
  await branch.evaluate((element: HTMLElement) => element.click());
  await page.locator('[data-school-tab="students"]').click();
  if (status === "active") await page.locator('[data-student-status="active"]').click();
}

async function openDossier(page: Page, status: "draft" | "active" = "draft") {
  await openStudents(page, status);
  const id = status === "draft" ? "demo-draft-student" : "demo-active-student";
  await page.locator(`[data-student-id="${id}"] [data-student-dossier]`).click();
  const dossier = page.locator(".student-central-dossier");
  await expect(dossier).toBeVisible();
  return dossier;
}

test.describe("B7-FE — dossier élève central transversal", () => {
  test("affiche un entête professionnel et les douze destinations autorisées", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const dossier = await openDossier(page, "active");

    const header = dossier.locator(".student-dossier-hero");
    await expect(header.getByRole("heading", { name: "Lucas Martin" })).toBeVisible();
    await expect(header.getByText("B1-0001", { exact: true })).toBeVisible();
    await expect(header.getByText("ACTIF", { exact: true })).toBeVisible();
    await expect(header.getByText("6e A", { exact: true })).toBeVisible();
    await expect(header.getByText("2026-2027", { exact: true })).toBeVisible();
    await expect(header.getByText("Sophie Martin", { exact: true })).toBeVisible();

    const destinations = dossier.locator("[data-dossier-section]");
    await expect(destinations).toHaveCount(12);
    await expect(destinations).toHaveText([
      /Identité/, /Famille/, /Scolarité/, /Présence/, /Sécurité/, /Pédagogie/,
      /Finance/, /Cantine/, /Rattrapage/, /Documents/, /Communications/, /Historique/,
    ]);
  });

  test("distingue les entrées existantes des états futurs sans inventer de données", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const dossier = await openDossier(page, "active");

    await dossier.getByRole("button", { name: /Présence/ }).click();
    await expect(dossier.getByRole("heading", { name: "Présence" })).toBeVisible();
    await expect(dossier.getByText("APERÇU — FEATURE_LATER", { exact: true })).toBeVisible();
    await expect(dossier.getByText(/Aucune présence officielle/)).toBeVisible();

    await dossier.getByRole("button", { name: /Scolarité/ }).click();
    await expect(dossier.getByText("Parcours B5", { exact: true })).toBeVisible();
    await expect(dossier.getByRole("button", { name: "Ouvrir le parcours scolaire" })).toBeVisible();
  });

  test("bloque les modules opérationnels pour un draft", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const dossier = await openDossier(page, "draft");

    await expect(dossier.getByText("EN PRÉPARATION", { exact: true }).first()).toBeVisible();
    await expect(dossier.getByText("DOSSIER NON OPÉRATIONNEL", { exact: true })).toBeVisible();
    await dossier.getByRole("button", { name: /Sécurité/ }).click();
    await expect(dossier.getByText("Indisponible tant que le dossier n’est pas ACTIF.")).toBeVisible();
    await expect(dossier.getByRole("button", { name: /valider|activer|transmettre/i })).toHaveCount(0);
  });

  test("filtre la navigation par permission, portée et DENY explicite", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const result = await page.evaluate(() => {
      const dossier = (window as any).SchoolSafeStudentDossier;
      const student = { id: "child-1", lifecycle_status: "active", class_id: "class-1" };
      const parent = {
        permissions: ["school.student.read", "school.guardian.read", "finance.status.read"],
        scopes: [
          { permission: "school.student.read", type: "own_children" },
          { permission: "school.guardian.read", type: "own_children" },
          { permission: "finance.status.read", type: "own_children" },
        ],
        childIds: ["child-1"],
      };
      const denied = { ...parent, deniedPermissions: ["finance.status.read"] };
      const teacher = {
        permissions: ["school.student.read", "pedagogy.grade.read"],
        scopes: [
          { permission: "school.student.read", type: "assigned_classes" },
          { permission: "pedagogy.grade.read", type: "assigned_classes" },
        ],
        assignedClassIds: ["class-1"],
      };
      return {
        parent: dossier.visibleSections(student, parent).map((item: any) => item.id),
        denied: dossier.visibleSections(student, denied).map((item: any) => item.id),
        teacher: dossier.visibleSections(student, teacher).map((item: any) => item.id),
        noPermission: dossier.visibleSections(student, { permissions: [], scopes: [] }),
      };
    });
    expect(result.parent).toContain("finance");
    expect(result.denied).not.toContain("finance");
    expect(result.teacher).toContain("pedagogy");
    expect(result.teacher).not.toContain("finance");
    expect(result.noPermission).toEqual([]);
  });

  test("utilise une navigation mobile en grille sans débordement", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice redimensionnable couvre les trois largeurs.");
    await enterDemoWorkspace(page, "admin");
    const dossier = await openDossier(page, "active");
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const width of [390, 834, 1440]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 1000 });
        await expect(dossier.locator(".student-dossier-nav")).toBeVisible();
        const overflow = await dossier.evaluate((root) => Array.from(root.querySelectorAll("*")).filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1;
        }).map((element) => ({ tag: element.tagName, className: (element as HTMLElement).className })));
        expect(overflow, `${theme} ${width}: ${JSON.stringify(overflow)}`).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath(`b7-dossier-${theme}-${width}.png`) });
      }
    }
  });
});
