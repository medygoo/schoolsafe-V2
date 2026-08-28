import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("H4-FE — absences et congés préparatoires", () => {
  test("consulte les demandes démo, leurs statuts et leur historique", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await openAction(page, "Absences");

    const absence = page.locator("[data-hr-absence]");
    await expect(absence).toBeVisible();
    await expect(absence.locator("[data-hr-absence-row]")).toHaveCount(3);
    await expect(absence).toContainText("SOUMIS — simulation");
    await expect(absence).toContainText("EN REVUE");
    await expect(absence).toContainText("PRÊT POUR DÉCISION");
    await expect(absence).toContainText("Historique");
    await expect(absence).toContainText("DÉCISION OFFICIELLE — BACKEND_LATER");
    await expect(absence.getByRole("button", { name: /approuver/i })).toHaveCount(0);
  });

  test("prépare et persiste une demande locale avec durée indicative", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await openAction(page, "Absences");
    const absence = page.locator("[data-hr-absence]");
    const form = absence.locator("[data-hr-absence-form]");
    await form.locator('[name="staffId"]').selectOption("hr-demo-3");
    await form.locator('[name="type"]').selectOption("Congé préparatoire");
    await form.locator('[name="reason"]').fill("Motif administratif non sensible");
    await form.locator('[name="startDate"]').fill("2026-09-10");
    await form.locator('[name="endDate"]').fill("2026-09-12");
    await form.locator('[name="observation"]').fill("À examiner sans décision automatique");
    await form.locator('button[type="submit"]').click();

    const draft = absence.locator("[data-hr-absence-draft]");
    await expect(draft).toContainText("BROUILLON LOCAL");
    await expect(draft).toContainText("3 jours indicatifs");
    await expect(draft).toContainText("À examiner sans décision automatique");
    await expect(draft).toContainText("BACKEND_LATER");
    await page.evaluate(() => (window as any).SchoolSafeHrDemo.open("absence"));
    await expect(absence.locator("[data-hr-absence-draft]")).toContainText("Chantal Lukusa");
  });

  test("reports.hr.read permet la synthèse mais aucune préparation ni décision", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await page.evaluate(() => {
      const hr = (window as any).SchoolSafeHrDemo;
      hr.setSession({
        role: "hr",
        permissions: ["reports.hr.read"],
        scopes: [{ permission: "reports.hr.read", type: "school" }],
      });
      hr.render("hrModule");
      hr.open("absence");
    });

    await expect(page.locator("[data-hr-absence-summary]")).toBeVisible();
    await expect(page.locator("[data-hr-absence-form]")).toHaveCount(0);
    await expect(page.locator("#hrContent")).toContainText("Synthèse uniquement");
    await expect(page.getByRole("button", { name: /approuver|décider/i })).toHaveCount(0);
  });
});
