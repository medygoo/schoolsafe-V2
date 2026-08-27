import { test, expect, type Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openCard(page: Page, status: "draft" | "active") {
  const branch = page.locator('[data-branch="school"]:visible').first();
  await expect(branch).toBeVisible();
  await branch.evaluate((element: HTMLElement) => element.click());
  await page.locator('[data-school-tab="students"]').click();
  if (status === "active") await page.locator('[data-student-status="active"]').click();
  const id = status === "draft" ? "demo-draft-student" : "demo-active-student";
  await page.locator(`[data-student-id="${id}"] [data-student-dossier]`).click();
  await page.locator(".student-central-dossier").getByRole("button", { name: /carte/i }).click();
  const card = page.locator(".student-card-preparation");
  await expect(card).toBeVisible();
  return card;
}

test.describe("B8-FE — préparation de la carte élève", () => {
  test("interdit toute carte officielle à un dossier draft", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const card = await openCard(page, "draft");
    await expect(card.getByText("CARTE INDISPONIBLE", { exact: true })).toBeVisible();
    await expect(card.getByText("DOSSIER NON ACTIF", { exact: true })).toBeVisible();
    await expect(card.getByText("NON PRÊTE", { exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: /générer|imprimer|télécharger|transmettre/i })).toHaveCount(0);
  });

  test("prévisualise l'identité disponible et une zone QR honnête", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const card = await openCard(page, "active");
    const preview = card.locator(".student-card-preview");
    await expect(preview.getByText("Lucas Martin", { exact: true })).toBeVisible();
    await expect(preview.getByText("B1-0001", { exact: true })).toBeVisible();
    await expect(preview.getByText("École de démonstration", { exact: true })).toBeVisible();
    await expect(preview.getByText("6e A", { exact: true })).toBeVisible();
    await expect(preview.getByText("2026-2027", { exact: true })).toBeVisible();
    await expect(preview.getByText("EMPLACEMENT QR", { exact: true })).toBeVisible();
    await expect(preview.getByText("Identité SchoolSafe", { exact: true })).toBeVisible();
  });

  test("calcule la checklist et garde la transmission en BACKEND_LATER", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const card = await openCard(page, "active");
    await expect(card.locator("[data-card-check]")).toHaveCount(7);
    await expect(card.getByText("À VÉRIFIER", { exact: true }).first()).toBeVisible();
    await expect(card.locator('[data-card-check="photo"]').getByText("Photo manquante", { exact: true })).toBeVisible();
    const transmission = card.getByRole("button", { name: "Transmission à SchoolSafe Control — BACKEND_LATER" });
    await expect(transmission).toBeVisible();
    await expect(transmission).toBeDisabled();
    await expect(card.getByRole("button", { name: /pdf|imprimer|télécharger/i })).toHaveCount(0);
  });

  test("réserve la préparation à la permission school et applique le DENY", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const result = await page.evaluate(() => {
      const cards = (window as any).SchoolSafeStudentCardPreparation;
      const student = { id: "student-1", lifecycle_status: "active", class_id: "class-1" };
      const admin = { permissions: ["security.card.create"], scopes: [{ permission: "security.card.create", type: "school" }] };
      const denied = { ...admin, deniedPermissions: ["security.card.create"] };
      const parent = { permissions: ["school.student.read"], scopes: [{ permission: "school.student.read", type: "own_children" }], childIds: ["student-1"] };
      const teacher = { permissions: ["school.student.read"], scopes: [{ permission: "school.student.read", type: "assigned_classes" }], assignedClassIds: ["class-1"] };
      return {
        admin: cards.canPrepare(student, admin),
        denied: cards.canPrepare(student, denied),
        parent: cards.canPrepare(student, parent),
        teacher: cards.canPrepare(student, teacher),
      };
    });
    expect(result).toEqual({ admin: true, denied: false, parent: false, teacher: false });
  });

  test("reste lisible en clair et sombre aux trois largeurs", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice redimensionnable couvre les trois largeurs.");
    await enterDemoWorkspace(page, "admin");
    const card = await openCard(page, "active");
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const width of [390, 834, 1440]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 1000 });
        const overflow = await card.evaluate((root) => Array.from(root.querySelectorAll("*")).filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1;
        }).map((element) => ({ tag: element.tagName, className: (element as HTMLElement).className })));
        expect(overflow, `${theme} ${width}: ${JSON.stringify(overflow)}`).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath(`b8-card-${theme}-${width}.png`) });
      }
    }
  });
});
