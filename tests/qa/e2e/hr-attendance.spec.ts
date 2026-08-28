import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("H5-FE — présence personnel et frontière biométrie", () => {
  test("affiche le registre de présence en lecture seule avec la permission exacte", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await openAction(page, "Présence personnel");

    const attendance = page.locator("[data-hr-attendance]");
    await expect(attendance).toBeVisible();
    await expect(attendance.locator("[data-hr-attendance-row]")).toHaveCount(6);
    await expect(attendance).toContainText("PRÉSENT");
    await expect(attendance).toContainText("ABSENT");
    await expect(attendance).toContainText("RETARD");
    await expect(attendance).toContainText("Première entrée");
    await expect(attendance).toContainText("Dernière sortie");
    await expect(attendance).toContainText("Anomalies");
    await expect(attendance).toContainText("LECTURE SEULE");
    await expect(attendance.locator("form")).toHaveCount(0);
  });

  test("refuse toute présence sans scope school ou avec DENY explicite", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    const results = await page.evaluate(() => {
      const hr = (window as any).SchoolSafeHrDemo;
      const inspect = (session: any) => {
        hr.setSession(session);
        hr.render("hrModule");
        hr.open("attendance");
        return {
          text: document.querySelector("#hrContent")?.textContent || "",
          rows: document.querySelectorAll("[data-hr-attendance-row]").length,
        };
      };
      return {
        wrongScope: inspect({ permissions: ["staff.attendance.read"], scopes: [{ permission: "staff.attendance.read", type: "own" }] }),
        denied: inspect({ permissions: ["staff.attendance.read"], deniedPermissions: ["staff.attendance.read"], scopes: [{ permission: "staff.attendance.read", type: "school" }] }),
      };
    });
    expect(results.wrongScope.rows).toBe(0);
    expect(results.denied.rows).toBe(0);
    expect(results.wrongScope.text).toContain("non autorisées");
    expect(results.denied.text).toContain("DENY explicite prioritaire");
  });

  test("borne la biométrie à un contrat futur sans stockage ni capture", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await openAction(page, "Biométrie");

    const biometric = page.locator("[data-hr-biometric]");
    await expect(biometric).toBeVisible();
    await expect(biometric).toContainText("FEATURE_LATER");
    await expect(biometric).toContainText("BACKEND_LATER");
    await expect(biometric).toContainText("AUCUNE DONNÉE BIOMÉTRIQUE STOCKÉE");
    for (const label of ["Salarié", "Méthode future", "Appareil", "Statut d’enrôlement futur", "Dernière synchronisation future"]) {
      await expect(biometric).toContainText(label);
    }
    await expect(biometric.getByRole("button", { name: /enrôler|empreinte|visage|webcam|capturer/i })).toHaveCount(0);
    const biometricKeys = await page.evaluate(() => Object.keys(localStorage).filter((key) => /biometr/i.test(key)));
    expect(biometricKeys).toEqual([]);
  });
});
