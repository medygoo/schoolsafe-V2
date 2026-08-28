import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("H3-FE — contrats et affectations du personnel", () => {
  test("consulte les contrats démo et leurs échéances sans enum juridique fermée", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await openAction(page, "Contrats");

    const contracts = page.locator("[data-hr-contracts]");
    await expect(contracts).toBeVisible();
    await expect(contracts).toContainText("DÉMONSTRATION");
    await expect(contracts).toContainText("CTR-DEM-001");
    await expect(contracts).toContainText("ACTIF");
    await expect(contracts).toContainText("À RENOUVELER");
    await expect(contracts).toContainText("types présentés comme exemples");
    await expect(contracts.locator("[data-hr-contract-row]")).toHaveCount(3);
  });

  test("prépare un contrat local distinct sans modifier les contrats visibles", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await openAction(page, "Contrats");
    const contracts = page.locator("[data-hr-contracts]");
    const originalCount = await contracts.locator("[data-hr-contract-row]").count();

    const form = contracts.locator("[data-hr-contract-form]");
    await form.locator('[name="staffId"]').selectOption("hr-demo-2");
    await form.locator('[name="type"]').fill("Contrat projet démo");
    await form.locator('[name="endDate"]').fill("2027-06-30");
    await form.locator('[name="status"]').selectOption("BROUILLON");
    await form.locator('[name="observation"]').fill("Conditions à revoir");
    await form.locator('button[type="submit"]').click();

    const draft = contracts.locator("[data-hr-contract-draft]");
    await expect(draft).toContainText("BROUILLON LOCAL");
    await expect(draft).toContainText("BACKEND_LATER");
    await expect(draft).toContainText("Contrat projet démo");
    await expect(draft).toContainText("Conditions à revoir");
    await expect(contracts.locator("[data-hr-contract-row]")).toHaveCount(originalCount);
    await page.evaluate(() => (window as any).SchoolSafeHrDemo.open("contracts"));
    await expect(contracts.locator("[data-hr-contract-draft]")).toContainText("2027-06-30");
  });

  test("prépare une affectation projetée sans toucher à teacher_assignments", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await openAction(page, "Affectations");
    const assignments = page.locator("[data-hr-assignments]");
    await expect(assignments.locator("[data-hr-assignment-row]")).toHaveCount(3);

    const form = assignments.locator("[data-hr-assignment-form]");
    await form.locator('[name="staffId"]').selectOption("hr-demo-1");
    await form.locator('[name="service"]').selectOption("Secondaire");
    await form.locator('[name="className"]').fill("5e B — projection");
    await form.locator('[name="subject"]').fill("Français — projection");
    await form.locator('button[type="submit"]').click();

    const draft = assignments.locator("[data-hr-assignment-draft]");
    await expect(draft).toContainText("BROUILLON LOCAL");
    await expect(draft).toContainText("5e B — projection");
    await expect(draft).toContainText("teacher_assignments backend inchangé");
    await expect(assignments.locator("[data-hr-assignment-row]")) .toHaveCount(3);
  });

  test("reste en lecture seule sans staff.manage", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await page.evaluate(() => {
      const hr = (window as any).SchoolSafeHrDemo;
      hr.setSession({
        role: "hr",
        permissions: ["staff.read"],
        scopes: [{ permission: "staff.read", type: "school" }],
      });
      hr.render("hrModule");
      hr.open("contracts");
    });
    await expect(page.locator("[data-hr-contract-row]")).toHaveCount(3);
    await expect(page.locator("[data-hr-contract-form]")).toHaveCount(0);
    await expect(page.locator("#hrContent")).toContainText("Lecture seule");
  });
});
