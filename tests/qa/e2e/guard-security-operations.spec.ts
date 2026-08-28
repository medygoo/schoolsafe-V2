import { test, expect, type Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openSecurityOperations(page: Page) {
  await enterDemoWorkspace(page, "guard");
  await page.evaluate(() => {
    localStorage.removeItem("schoolsafe-v2-security-incidents-v1");
    localStorage.removeItem("schoolsafe-v2-security-lockdown-v1");
  });
  await page.locator("[data-guard-security-operations]").click();
  const view = page.locator("[data-security-operations]");
  await expect(view).toBeVisible();
  return view;
}

test.describe("E6-FE — incidents, lockdown et historique", () => {
  test("le poste affecté prépare un incident local sans pouvoir le supprimer", async ({ page }) => {
    const view = await openSecurityOperations(page);
    await view.locator('[name="incident_type"]').selectOption("identity");
    await view.locator('[name="incident_student"]').selectOption("demo-active-student");
    await view.locator('[name="incident_attention"]').selectOption("high");
    await view.locator('[name="incident_description"]').fill("Identité de la personne à revérifier.");
    await view.locator('[name="incident_action"]').fill("Appel du Parent principal préparé.");
    await view.getByRole("button", { name: "Enregistrer l’incident local" }).click();

    const incident = view.locator("[data-security-incident]");
    await expect(incident).toContainText("Identité / récupération");
    await expect(incident).toContainText("Lucas Martin");
    await expect(incident).toContainText("BACKEND_LATER");
    await expect(incident.getByRole("button", { name: /Supprimer/ })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("schoolsafe-v2-security-incidents-v1") || "[]").length)).toBe(1);
  });

  test("le Gardien standard ne voit ni déclenchement lockdown ni rapport global", async ({ page }) => {
    const view = await openSecurityOperations(page);
    await expect(view.getByText("Gestion lockdown non accordée", { exact: true })).toBeVisible();
    await expect(view.getByRole("button", { name: /Préparer le lockdown|Activer|Lever/ })).toHaveCount(0);
    await expect(view.locator("[data-global-security-report]")).toHaveCount(0);
  });

  test("l’Admin autorisé simule les quatre états lockdown sans alerte réelle", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.evaluate(() => {
      const container = document.getElementById("guardSecurityPortal")!;
      container.hidden = false;
      (window as any).SchoolSafeGuardSecurity.renderSecurityOperations("guardSecurityPortal", {
        permissions: ["security.lockdown.manage", "reports.security.read"],
        scopes: [
          { permission: "security.lockdown.manage", type: "school" },
          { permission: "reports.security.read", type: "school" },
        ],
      });
    });
    const view = page.locator("[data-security-operations]");
    await expect(view.getByText("INACTIF", { exact: true })).toBeVisible();
    await view.getByRole("button", { name: "Préparer le lockdown" }).click();
    await expect(view.getByText("PRÉPARATION", { exact: true })).toBeVisible();
    await view.getByRole("button", { name: "Simuler l’activation" }).click();
    await expect(view.getByText("ACTIF — simulation uniquement", { exact: true })).toBeVisible();
    await view.getByRole("button", { name: "Simuler la levée" }).click();
    await expect(view.getByText("LEVÉ — simulation uniquement", { exact: true })).toBeVisible();
    await expect(view.getByText("BACKEND_LATER", { exact: true })).toBeVisible();
    await expect(view.locator("[data-global-security-report]")).toBeVisible();
  });

  test("un DENY lockdown reste prioritaire même pour un Admin", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.evaluate(() => {
      const container = document.getElementById("guardSecurityPortal")!;
      container.hidden = false;
      (window as any).SchoolSafeGuardSecurity.renderSecurityOperations("guardSecurityPortal", {
        permissions: ["security.lockdown.manage"],
        deniedPermissions: ["security.lockdown.manage"],
        scopes: [{ permission: "security.lockdown.manage", type: "school" }],
      });
    });
    await expect(page.locator(".guard-security-denied")).toBeVisible();
    await expect(page.getByRole("button", { name: /Préparer le lockdown|Activer|Lever/ })).toHaveCount(0);
  });

  test("agrège entrées, sorties, récupérations, refus, incidents et préparation sans suppression", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    await page.evaluate(() => {
      localStorage.setItem("schoolsafe-v2-security-local-events", JSON.stringify([
        { id: "scan-1", type: "entry", decision: "AUTORISÉ", studentId: "demo-active-student", studentName: "Lucas Martin", portalId: "demo-portal-main", occurredAt: "2026-08-28T07:30:00.000Z" },
        { id: "scan-2", type: "exit", decision: "AUTORISÉ", studentId: "demo-student-chloe", studentName: "Chloé Bernard", portalId: "demo-portal-main", occurredAt: "2026-08-28T12:00:00.000Z" },
      ]));
      localStorage.setItem("schoolsafe-b4-pickup-events-v1", JSON.stringify([
        { studentId: "demo-active-student", student: "Lucas Martin", picker: "Mireille Wa Kalonji", result: "PERSONNE AUTORISÉE", time: "12:05" },
      ]));
      localStorage.setItem("schoolsafe-v2-security-dismissal-v1", JSON.stringify({
        statuses: { "demo-active-student": "BLOQUÉ" },
        timeline: [
          { id: "d-1", studentId: "demo-active-student", student: "Lucas Martin", eventType: "PRÉPARÉ", detail: "Sortie préparée", time: "11:55", portalId: "demo-portal-main" },
          { id: "d-2", studentId: "demo-active-student", student: "Lucas Martin", eventType: "REFUSÉ", detail: "PERSONNE SUSPENDUE", time: "12:01", portalId: "demo-portal-main" },
        ],
      }));
      localStorage.setItem("schoolsafe-v2-security-incidents-v1", JSON.stringify([
        { id: "i-1", typeLabel: "Identité / récupération", studentId: "demo-active-student", studentName: "Lucas Martin", portalId: "demo-portal-main", description: "Contrôle interrompu", attention: "ÉLEVÉ", action: "Parent prévenu", status: "OUVERT", occurredAt: "2026-08-28T12:02:00.000Z" },
      ]));
      (window as any).SchoolSafeGuardSecurity.open("security");
    });
    const history = page.locator("[data-security-history]");
    await expect(history).toContainText("ENTRÉE");
    await expect(history).toContainText("SORTIE");
    await expect(history).toContainText("RÉCUPÉRATION");
    await expect(history).toContainText("REFUSÉ");
    await expect(history).toContainText("INCIDENT");
    await expect(history).toContainText("PRÉPARÉ");
    await expect(history.getByRole("button", { name: /Supprimer/ })).toHaveCount(0);
  });

  test("borne une lecture de classe aux assigned_classes et conserve le DENY prioritaire", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    const result = await page.evaluate(() => {
      localStorage.setItem("schoolsafe-v2-security-local-events", JSON.stringify([
        { id: "class-1", type: "entry", studentId: "demo-active-student", studentName: "Lucas Martin", portalId: "demo-portal-main" },
        { id: "class-2", type: "exit", studentId: "demo-student-ethan", studentName: "Ethan Leroy", portalId: "demo-portal-east" },
      ]));
      const user = {
        permissions: ["security.events.read", "school.student.read"],
        scopes: [
          { permission: "security.events.read", type: "assigned_classes" },
          { permission: "school.student.read", type: "assigned_classes" },
        ],
        assignedClassIds: ["demo-class-1"],
      };
      const api = (window as any).SchoolSafeGuardSecurity;
      return {
        visible: api.getSecurityHistory(user).map((event: any) => event.student),
        denied: api.getSecurityHistory({ ...user, deniedPermissions: ["security.events.read"] }).length,
      };
    });
    expect(result.visible).toEqual(["Lucas Martin"]);
    expect(result.denied).toBe(0);
  });

  test("reste utilisable sans overflow en clair et bleu nuit à 390, 834 et 1440", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice redimensionnable s’exécute sur desktop.");
    const view = await openSecurityOperations(page);
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const viewport of [{ width: 390, height: 844 }, { width: 834, height: 1112 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        const layout = await view.evaluate((root) => {
          const width = document.documentElement.clientWidth;
          const overflow = Array.from(root.querySelectorAll("*"))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.left < -1 || rect.right > width + 1;
            })
            .map((element) => ({ tag: element.tagName, className: (element as HTMLElement).className }));
          const shortButtons = Array.from(root.querySelectorAll("button"))
            .filter((button) => button.getBoundingClientRect().height < 44)
            .map((button) => button.textContent?.trim());
          return { overflow, shortButtons };
        });
        expect(layout.overflow, `${theme} ${viewport.width}`).toEqual([]);
        expect(layout.shortButtons, `${theme} ${viewport.width}`).toEqual([]);
      }
    }
  });
});
