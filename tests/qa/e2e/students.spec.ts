import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openStudents(page: import("@playwright/test").Page) {
  const schoolBranch = page.locator('[data-branch="school"]:visible').first();
  await expect(schoolBranch).toBeVisible();
  await schoolBranch.evaluate((element: HTMLElement) => element.click());
  const studentsTab = page.locator('[data-school-tab="students"]');
  await expect(studentsTab).toBeVisible();
  await studentsTab.click();
}

test.describe("B1 — dossier élève en préparation", () => {
  test("affiche les drafts et les actifs sans aucune action opérationnelle", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openStudents(page);

    await expect(page.locator('[data-school-tab="students"]')).toHaveClass(/active/);
    await expect(page.getByText("EN PRÉPARATION").first()).toBeVisible();
    await expect(page.getByText(/brouillon n.est pas opérationnel/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /activer/i })).toHaveCount(0);
    await expect(page.locator("#studentWorkspace").getByRole("button", { name: /carte|qr|finance|pédagogie|document/i })).toHaveCount(0);

    await page.getByRole("button", { name: "Actifs" }).click();
    await expect(page.locator("#studentWorkspace").getByText("ACTIF", { exact: true })).toBeVisible();
  });

  test("montre Nouveau dossier uniquement avec school.student.create", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openStudents(page);

    await page.evaluate(() => {
      (window as any).SchoolSafeSchoolModule.render("students", {
        permissions: ["school.student.read", "school.student.create"],
        scopes: [
          { permission: "school.student.read", type: "school" },
          { permission: "school.student.create", type: "school" },
        ],
      });
    });
    await expect(page.getByRole("button", { name: "Nouveau dossier" })).toBeVisible();

    await page.evaluate(() => {
      (window as any).SchoolSafeSchoolModule.render("students", {
        permissions: ["school.student.read"],
        scopes: [{ permission: "school.student.read", type: "school" }],
      });
    });
    await expect(page.getByRole("button", { name: "Nouveau dossier" })).toHaveCount(0);
  });

  test("propose un parent existant ou un nouveau parent sans champ mot de passe", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openStudents(page);
    await page.evaluate(() => {
      (window as any).SchoolSafeSchoolModule.render("students", {
        permissions: ["school.student.read", "school.student.create"],
        scopes: [
          { permission: "school.student.read", type: "school" },
          { permission: "school.student.create", type: "school" },
        ],
      });
    });
    await page.getByRole("button", { name: "Nouveau dossier" }).click();

    await expect(page.getByLabel(/Parent existant/i)).toBeVisible();
    await expect(page.getByLabel(/Inviter un nouveau Parent/i)).toBeVisible();
    await page.getByLabel(/Inviter un nouveau Parent/i).check();
    await expect(page.getByRole("dialog").getByText("pending_activation")).toBeVisible();
    await expect(page.getByRole("dialog").locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByRole("dialog").getByText(/mot de passe/i)).toContainText(/jamais/i);
  });

  test("reste utilisable sur téléphone, tablette et ordinateur", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openStudents(page);

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 834, height: 1112 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.locator("#studentWorkspace")).toBeVisible();
      const overflow = await page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth;
        return Array.from(document.querySelectorAll("#studentWorkspace, #studentWorkspace *"))
          .filter((element) => {
            if (element.classList.contains("sr-only")) return false;
            const rect = element.getBoundingClientRect();
            return rect.right > viewportWidth + 1 || element.scrollWidth > element.clientWidth + 1;
          })
          .map((element) => ({
            tag: element.tagName,
            id: element.id,
            className: element.className,
            right: Math.round(element.getBoundingClientRect().right),
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
          }));
      });
      expect(overflow, JSON.stringify(overflow)).toEqual([]);
    }
  });
});
