import { test, expect, type Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openSchoolStudents(page: Page) {
  const branch = page.locator('[data-branch="school"]:visible').first();
  await expect(branch).toBeVisible();
  await branch.evaluate((element: HTMLElement) => element.click());
  await expect(page.locator("#schoolModule")).toBeVisible();
  await page.locator('[data-school-tab="students"]').click();
}

test.describe("B9-FE — QA finale Phase B Élèves", () => {
  test("limite le Parent à ses propres enfants et masque la configuration", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    await openSchoolStudents(page);

    await expect(page.locator('[data-school-tab="school"]')).toBeHidden();
    await expect(page.locator('[data-school-tab="staff"]')).toBeHidden();
    await expect(page.locator('[data-school-tab="structure"]')).toBeHidden();
    await expect(page.locator('[data-student-id="demo-draft-student"]')).toBeVisible();
    await expect(page.locator('[data-student-id="demo-active-student"]')).toHaveCount(0);

    await page.locator('[data-student-status="active"]').click();
    await expect(page.locator(".student-record")).toHaveCount(0);
    await expect(page.getByText("Aucun élève actif", { exact: true })).toBeVisible();
  });

  test("limite l'Enseignant à ses classes affectées et à la lecture utile", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await openSchoolStudents(page);

    await expect(page.locator('[data-school-tab="school"]')).toBeHidden();
    await expect(page.locator('[data-school-tab="staff"]')).toBeHidden();
    await expect(page.locator('[data-school-tab="structure"]')).toBeVisible();
    await expect(page.locator('[data-school-tab="students"]')).toBeVisible();
    await expect(page.locator(".student-record")).toHaveCount(0);
    await page.locator('[data-student-status="active"]').click();
    await expect(page.locator('[data-student-id="demo-active-student"]')).toBeVisible();
    await expect(page.locator('[data-student-id="demo-draft-student"]')).toHaveCount(0);

    await page.locator('[data-school-tab="structure"]').click();
    await expect(page.locator("[data-academic-class]")).toHaveCount(1);
    await expect(page.getByText("6e A", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /préparer|modifier/i })).toHaveCount(0);
  });

  test("refuse Gardien et utilisateur sans permission sans gain implicite", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    await expect(page.locator('[data-branch="school"]')).toHaveCount(0);
    const matrix = await page.evaluate(() => {
      const student = { id: "student-1", lifecycle_status: "active", class_id: "class-1" };
      const nobody = { role: "admin", permissions: [], scopes: [{ type: "school" }] };
      return {
        structure: (window as any).SchoolSafeAcademicStructure.canRead(nobody),
        dossier: (window as any).SchoolSafeStudentDossier.visibleSections(student, nobody),
        cardView: (window as any).SchoolSafeStudentCardPreparation.canView(student, nobody),
        cardPrepare: (window as any).SchoolSafeStudentCardPreparation.canPrepare(student, nobody),
      };
    });
    expect(matrix).toEqual({ structure: false, dossier: [], cardView: false, cardPrepare: false });
  });

  test("conserve le draft non opérationnel dans structure, dossier et carte", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openSchoolStudents(page);
    const draft = page.locator('[data-student-id="demo-draft-student"]');
    await expect(draft.getByText("EN PRÉPARATION", { exact: true })).toBeVisible();
    await draft.locator("[data-student-dossier]").click();
    const dossier = page.locator(".student-central-dossier");
    await expect(dossier.getByText("DOSSIER NON OPÉRATIONNEL", { exact: true })).toBeVisible();
    await dossier.getByRole("button", { name: /carte/i }).click();
    const card = page.locator(".student-card-preparation");
    await expect(card.getByText("CARTE INDISPONIBLE", { exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: /transmettre|imprimer|télécharger|activer/i })).toHaveCount(0);
  });

  test("préserve les trois interfaces principales sans overflow en clair et sombre", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice redimensionnable couvre les trois largeurs.");
    await enterDemoWorkspace(page, "admin");
    await openSchoolStudents(page);
    await page.locator('[data-student-status="active"]').click();
    await page.locator('[data-student-id="demo-active-student"] [data-student-dossier]').click();

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const width of [390, 834, 1440]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 1000 });
        for (const selector of [".student-central-dossier"]) {
          const overflow = await page.locator(selector).evaluate((root) => Array.from(root.querySelectorAll("*")).filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1;
          }).map((element) => ({ tag: element.tagName, className: (element as HTMLElement).className })));
          expect(overflow, `${selector} ${theme} ${width}: ${JSON.stringify(overflow)}`).toEqual([]);
        }
        if (width === 390) {
          const communicationLabel = page.locator('[data-dossier-section="communications"] b');
          const clipped = await communicationLabel.evaluate((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1);
          expect(clipped, `${theme} 390: le libellé Communications ne doit pas être tronqué`).toBe(false);
        }
        await page.screenshot({ path: testInfo.outputPath(`b9-dossier-${theme}-${width}.png`) });
      }
    }
  });
});
